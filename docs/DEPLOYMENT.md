# Deploying Chitra AI

## Target

| Piece | Where | Address |
|---|---|---|
| React SPA | Vercel | `https://chitra-ai.technicalbind.com` |
| Django API | Hostinger VPS `72.62.124.221` | `https://chitra-ai.devtechguru.cloud` |
| Generated images | Same VPS, served by nginx from disk | `https://chitra-ai.devtechguru.cloud/media/…` |
| PostgreSQL | Same VPS, bound to localhost | not reachable from the internet |

The VPS runs **Ubuntu 24.04 with CloudPanel**. CloudPanel owns nginx, so the
site is created through its UI and Chitra AI slots in behind a reverse proxy on
`127.0.0.1:8021`. Do not hand-write files into `/etc/nginx/sites-available` on
this box — CloudPanel regenerates them.

Because the SPA and the API sit on different origins, every API call is
cross-site. That single fact drives the cookie flags, the CORS list, and the
Origin check. Part 5 explains why each is what it is.

---

## Status of the pieces

| Step | State |
|---|---|
| DNS `chitra-ai.devtechguru.cloud` → `72.62.124.221` | **Done** (A record, TTL 300) |
| DNS for `chitra-ai.technicalbind.com` | **Nothing to do** — `technicalbind.com` already uses `ns1/ns2.vercel-dns.com`, so Vercel creates the record when you attach the domain |
| CloudPanel site + TLS | You (Part 1) |
| VPS bootstrap | You (Part 2) |
| GitHub repo, secrets, deploy key | You (Part 3) |
| Vercel project + domain | You (Part 4) |

---

## Part 1 — Create the site in CloudPanel

1. Open CloudPanel (usually `https://72.62.124.221:8443`).
2. **Sites → Add Site → Create a Reverse Proxy.**

   | Field | Value |
   |---|---|
   | Domain Name | `chitra-ai.devtechguru.cloud` |
   | Reverse Proxy URL | `http://127.0.0.1:8021` |
   | Site User | `chitra-ai` |

3. Note the site user password CloudPanel shows you.

This creates the Linux user `chitra-ai`, the directory
`/home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud`, and an nginx vhost.
Nothing is listening on 8021 yet, so the site will 502 until Part 2 finishes.
That is expected.

---

## Part 2 — Bootstrap the backend

SSH in as root and run the bootstrap once:

```bash
ssh root@72.62.124.221

REPO_URL=https://github.com/YOUR_USER/chitra-ai.git \
  bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USER/chitra-ai/master/deploy/bootstrap.sh)
```

Or, if you would rather read it first (recommended — it is 260 lines and it
touches PostgreSQL, systemd, and sudoers):

```bash
git clone https://github.com/YOUR_USER/chitra-ai.git /tmp/chitra
less /tmp/chitra/deploy/bootstrap.sh
REPO_URL=https://github.com/YOUR_USER/chitra-ai.git sudo -E bash /tmp/chitra/deploy/bootstrap.sh
```

The script is idempotent — re-running it is safe, and it never overwrites an
existing `.env`. It:

- installs PostgreSQL, Python build tools, and git
- creates the `chitra` role and `chitra_ai` database with a generated password
- clones the repo into the CloudPanel site directory
- builds the virtualenv and installs `requirements.txt`
- writes `backend/.env` (mode 600) with a fresh `DJANGO_SECRET_KEY`
- runs `migrate` and `collectstatic`
- installs and starts the `chitra-api` systemd unit on `127.0.0.1:8021`
- installs `/home/chitra-ai/deploy.sh` for CI to call
- grants the site user password-less sudo for **exactly** `systemctl restart
  chitra-api` and nothing else
- schedules the weekly expired-token cleanup
- health-checks gunicorn before declaring success

### 2a. Add the media and static location blocks

CloudPanel's vhost proxies everything to gunicorn. Serving 1.5 MB PNGs through
Python is wasteful, so hand `/media/` and `/static/` to nginx:

**CloudPanel → Sites → chitra-ai.devtechguru.cloud → Vhost.** Paste the two
blocks from [`deploy/cloudpanel-vhost.conf`](../deploy/cloudpanel-vhost.conf)
above the existing `location /` block, then save.

While in that editor, raise the timeout on the main `location /` block:

```nginx
proxy_read_timeout 180s;
proxy_send_timeout 180s;
```

CloudPanel's default is 60s. A cold FLUX model regularly takes longer, and
without this you get a 504 while the image is still being generated.

### 2b. Issue the certificate

**CloudPanel → Sites → chitra-ai.devtechguru.cloud → SSL/TLS → Let's Encrypt →
Issue.**

The A record already resolves, so validation should pass immediately.

### 2c. Create your admin account

```bash
cd /home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend
sudo -u chitra-ai DJANGO_SETTINGS_MODULE=config.settings.prod \
  .venv/bin/python manage.py createsuperuser
```

### 2d. Add the Hugging Face token

Bootstrap leaves `IMAGE_PROVIDER=stub`, so the API works end to end from the
first minute, generating placeholder gradients. To switch to real generation:

```bash
sudo nano /home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend/.env
```

```bash
HF_TOKEN=hf_your_real_token
IMAGE_PROVIDER=huggingface
```

Verify the credential **before** restarting:

```bash
cd /home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend
sudo -u chitra-ai DJANGO_SETTINGS_MODULE=config.settings.prod \
  .venv/bin/python manage.py check_provider
sudo systemctl restart chitra-api
```

`check_provider` prints the provider, model, sampler settings, byte count, and
elapsed time. It never prints the token.

### 2e. Confirm

```bash
curl https://chitra-ai.devtechguru.cloud/api/health/
# {"status":"ok"}
```

---

## Part 3 — GitHub

### 3a. Create the deploy key

The CI job SSHes in as `chitra-ai`. Give it a dedicated key that exists for
nothing else. Generate it **on your machine**, not on the server:

```bash
ssh-keygen -t ed25519 -N "" -C "chitra-ai-github-actions" -f ~/.ssh/chitra_deploy
```

Install the public half on the VPS:

```bash
ssh root@72.62.124.221 'mkdir -p /home/chitra-ai/.ssh && chmod 700 /home/chitra-ai/.ssh'
ssh-copy-id -i ~/.ssh/chitra_deploy.pub -o 'User=root' chitra-ai@72.62.124.221 2>/dev/null || \
  cat ~/.ssh/chitra_deploy.pub | ssh root@72.62.124.221 \
    'cat >> /home/chitra-ai/.ssh/authorized_keys &&
     chown -R chitra-ai:chitra-ai /home/chitra-ai/.ssh &&
     chmod 600 /home/chitra-ai/.ssh/authorized_keys'
```

Capture the host key so CI is not trusting whatever answers on the day:

```bash
ssh-keyscan -H 72.62.124.221
```

### 3b. Add the secrets

**Settings → Secrets and variables → Actions → New repository secret.**

| Secret | Value |
|---|---|
| `VPS_HOST` | `72.62.124.221` |
| `VPS_USER` | `chitra-ai` |
| `VPS_PORT` | `22` (omit if 22) |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/chitra_deploy` — the **private** key, including the BEGIN/END lines |
| `VPS_HOST_KEY` | Output of the `ssh-keyscan` above (optional but recommended) |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | From `frontend/.vercel/project.json` after Part 4 |
| `VERCEL_PROJECT_ID` | Same file |

> The private key grants shell access as `chitra-ai`. Paste it only into the
> GitHub secret. If it ever leaks, remove the line from
> `/home/chitra-ai/.ssh/authorized_keys` and generate a new pair — rotating the
> GitHub secret alone does nothing, because the old key still opens the door.

### 3c. What the workflows do

**`.github/workflows/ci.yml`** runs on every branch and PR:
backend pytest against a PostgreSQL service container, a missing-migration
check, frontend vitest + production build, and a secret scan that
fails the build if a real `hf_…` token or a tracked `.env` appears.

**`.github/workflows/deploy.yml`** runs on push to `master`:

```
test ──┬─→ backend  (ssh → /home/chitra-ai/deploy.sh → health check)
       └─→ frontend (vercel pull → build → deploy → health check)
```

Nothing deploys unless the full suite passes. The two deploys run in parallel
once tests are green. `concurrency: cancel-in-progress: false` means an
in-flight deploy is never killed part-way through a migration.

---

## Part 4 — Vercel

1. **vercel.com/new** → import the repository.
2. **Root Directory: `frontend`.** Vercel reads `frontend/vercel.json` for the
   build command, output directory, SPA rewrite, and security headers.
3. **Environment Variables**, for Production, Preview, and Development:

   | Name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://chitra-ai.devtechguru.cloud` |

   No trailing slash. Vite bakes this in at build time, so changing it needs a
   redeploy, not a restart.
4. Deploy once from the dashboard.
5. **Settings → Domains → Add `chitra-ai.technicalbind.com`.** Because
   `technicalbind.com` already uses Vercel's nameservers, the record is created
   automatically — there is no CNAME to add anywhere.
6. Link the project locally so you can read the two IDs:

   ```bash
   cd frontend
   npx vercel link
   cat .vercel/project.json
   ```

   Copy `orgId` and `projectId` into the GitHub secrets from Part 3b.
   `.vercel/` is gitignored.

### Preview deployments will not sign in

Each Vercel preview gets its own generated origin, and none of them are in the
VPS `CORS_ALLOWED_ORIGINS`. Sign-in will fail there. That is the Origin guard
working correctly, not a bug. Either add a specific preview origin to the
server's list when you need one, or test auth against production only.

**Do not use a wildcard.** `CORS_ALLOW_CREDENTIALS = True` and `*` are mutually
exclusive in browsers, and allowing arbitrary origins would defeat the CSRF
protection described below.

---

## Part 5 — Why the cookie settings are what they are

The refresh token is an httpOnly cookie. Cross-origin, that forces one specific
combination:

| Setting | Value | What breaks if you change it |
|---|---|---|
| `httpOnly` | `True` | Script could read the refresh token; XSS becomes account takeover |
| `SameSite` | `None` | Anything else and the browser drops the cookie on Vercel → VPS requests. Sign-in appears to work, then a reload signs the user out |
| `Secure` | `True` | Chrome rejects `SameSite=None` without it, so plain HTTP fails entirely |
| `Path` | `/api/auth/` | The cookie stops riding along on image and generation requests |

Because `SameSite=None` means the browser attaches the cookie to a cross-site
POST from *any* page, SameSite provides no CSRF protection here. That job
belongs to [`accounts/security.py`](../backend/accounts/security.py): the
`refresh` and `logout` endpoints validate the `Origin` header against
`CORS_ALLOWED_ORIGINS`. A browser stamps `Origin` from the requesting page and
will not let script forge it, so an attacker's page cannot drive either
endpoint.

**This is why `CORS_ALLOWED_ORIGINS` is a security control rather than a
convenience setting. Keep it exact and minimal.**

---

## Routine deploys

Push to `master`. That is the whole procedure.

To deploy by hand:

```bash
sudo -u chitra-ai /home/chitra-ai/deploy.sh
```

It pulls, installs, runs `check --deploy` with `--fail-level WARNING`,
migrates, collects static files, restarts gunicorn, and polls the health
endpoint. A failure at any step leaves the previous version serving.

---

## Operations

```bash
# Logs, live
sudo journalctl -u chitra-api -f

# Service state
sudo systemctl status chitra-api

# Django shell
cd /home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend
sudo -u chitra-ai DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py shell

# Database backup
sudo -u postgres pg_dump chitra_ai | gzip > ~/chitra_ai_$(date +%F).sql.gz

# Disk used by generated images
du -sh /home/chitra-ai/htdocs/chitra-ai.devtechguru.cloud/backend/media
```

Generated images accumulate and are never pruned automatically. The VPS has
100 GB; at roughly 1.5 MB per image that is a lot of headroom, but it is worth
a periodic look.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `502 Bad Gateway` | gunicorn is down | `sudo systemctl status chitra-api`, then `journalctl -u chitra-api -n 50` |
| Site loads, API calls fail with a CORS error | Origin mismatch | `CORS_ALLOWED_ORIGINS` must be exactly `https://chitra-ai.technicalbind.com`. Restart `chitra-api` after editing |
| Signed out after every reload | Refresh cookie rejected | Both sides must be HTTPS, with `Secure=True` and `SameSite=None`. Check the certificate actually issued |
| `403` from `/api/auth/refresh/` | Origin not allowlisted | Same list. This is the CSRF guard doing its job |
| Images 404 | `/media/` block missing or unreadable | Confirm the block is in the CloudPanel vhost and that the alias path ends in `/`. `chmod o+x` is needed on each parent directory |
| Images load but Download navigates instead of saving | `Access-Control-Allow-Origin` missing on `/media/` | It is in the `/media/` block in `cloudpanel-vhost.conf` |
| `503 provider_unconfigured` | Bad, missing, or gated `HF_TOKEN` | `manage.py check_provider`; confirm model access on huggingface.co |
| `504` on the first generation | Cold model, and nginx gave up first | Raise `HF_TIMEOUT`, and `proxy_read_timeout` must be at least as large |
| `429` immediately | Rate limits | Tune `GENERATION_RATE` in `.env` |
| CI deploy fails with `Permission denied (publickey)` | Deploy key not installed for `chitra-ai` | Re-run Part 3a; confirm `/home/chitra-ai/.ssh/authorized_keys` is mode 600 and owned by `chitra-ai` |
| CI deploy fails on `systemctl restart` | sudoers rule missing | Re-run `bootstrap.sh`; check `/etc/sudoers.d/chitra-api` |
