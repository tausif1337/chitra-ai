# Production fix: images came back as gradients

**Date:** 2026-08-26
**Host:** `chitra-ai.devtechguru.cloud` (VPS `72.62.124.221`, VM `1738107`)

## Symptom

Every generation on the live site returned a blue-to-green gradient instead of
an image. The result panel reported `MODEL gradient`, `7.3 KB`, and returned
instantly.

## Diagnosis

Not a code bug. The live backend was running the **stub provider**.

```
$ curl https://chitra-ai.devtechguru.cloud/api/images/options/
... "provider":"stub","model":"stub/gradient"
```

`StubProvider` paints a deterministic gradient by design — see
`backend/images/services/providers/stub.py`. The frontend was faithfully
rendering exactly what the API returned.

Root cause: `deploy/bootstrap.sh` writes a starter `.env` containing

```
HF_TOKEN=
IMAGE_PROVIDER=stub
```

and defers the switch to step 4 of its post-install checklist. That step had
never been carried out. `deploy.sh` never touches `.env`, so no amount of
pushing to `master` would have fixed it.

## Fix applied

On the VPS, in `/home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend`:

1. Backed up `.env` to `.env.bak.pre-hf` (rollback point; still on disk).
2. Wrote the working `HF_TOKEN` (same token as local `backend/.env`).
3. Smoke-tested **before** switching, using an inline override so `.env` still
   said `stub` if the token turned out to be bad:

   ```bash
   sudo -u chitra-ai env DJANGO_SETTINGS_MODULE=config.settings.prod \
     IMAGE_PROVIDER=huggingface .venv/bin/python manage.py check_provider
   ```

   Result: `OK - 1,335,178 bytes, 1024 x 1024, in 7.9s`, routed via nscale.

   This override works because `config/settings/base.py` calls
   `environ.Env.read_env()`, which uses `setdefault` — a variable already in
   the process environment wins over the `.env` file.

4. Set `IMAGE_PROVIDER=huggingface`, restored `chitra-ai:chitra-ai` ownership
   and `600` on `.env` (`sed -i` writes a new inode and would otherwise leave
   it root-owned, which gunicorn could not read).
5. `systemctl restart chitra-api`.

## Verification

```
$ curl -s https://chitra-ai.devtechguru.cloud/api/images/options/
... "provider":"huggingface","model":"black-forest-labs/FLUX.1-schnell"

$ curl -s https://chitra-ai.devtechguru.cloud/api/health/
{"status":"ok"}

systemctl is-active chitra-api  -> active
NRestarts                       -> 0   (clean start, no crash loop)
```

Timeouts checked, since real generations take ~8s and ~1.3 MB where the stub
was instant and 7 KB:

- gunicorn `--timeout 180` (`deploy/gunicorn.service`)
- nginx `proxy_read_timeout 900` / `proxy_send_timeout 900` on the live vhost

Both have ample headroom. No 504 risk.

The storage and database path was already proven by the stub — those images
saved, displayed, and appeared in history correctly. Only the provider changed.

## Follow-ups

- [ ] **Rotate the VPS root password.** It was shared in a chat session and is
      now in that session's transcript and local log files. This box also hosts
      six other production sites.
- [ ] Consider rotating the Hugging Face token too — it now exists in two
      places (local `backend/.env` and the VPS `.env`).
- [ ] FLUX.1-schnell through HF Inference Providers bills credits. When the
      balance runs out the API will return `402`, which surfaces to users as a
      `ProviderUnavailable` error rather than a silent gradient. Worth an alert.
- [ ] `bootstrap.sh` leaves new installs on `stub` with no loud signal. Options:
      have the `/api/health/` payload report the active provider, or make
      `check --deploy` warn when `IMAGE_PROVIDER=stub` under prod settings.
- [ ] Delete `.env.bak.pre-hf` once the fix has held for a while.
