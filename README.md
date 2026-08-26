# Chitra AI

Generate images from natural language prompts. React frontend, Django API,
PostgreSQL, and Hugging Face Inference Providers — with the provider credential
held entirely on the server.

Built to the specification in `chitra_ai_prd.pdf`.

---

## What it does

Write a prompt, pick a size and quality, generate. The image comes back with
its metadata, is saved to your private history, and can be downloaded with a
meaningful filename or regenerated later.

- Prompt input with live validation and a built-in prompt-writing guide
- Three sizes (1024×1024, 1024×1536, 1536×1024) and two quality tiers
- Paginated private history with preview, download, regenerate, and delete
- Account sign-up and sign-in; every image is scoped to its owner
- Dark and light themes, full keyboard access, reduced-motion support

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, JavaScript, Vite, Tailwind CSS v4, React Router |
| Backend | Django 6, Django REST Framework, SimpleJWT |
| Database | PostgreSQL |
| AI provider | Hugging Face Inference Providers (FLUX.1-schnell by default) |
| Storage | Filesystem behind a swappable interface |
| Hosting | Vercel (frontend), Hostinger VPS + CloudPanel (backend, database, media) |
| CI/CD | GitHub Actions |


Push to `master` runs the full suite, then deploys the backend to the VPS over
SSH and the frontend to Vercel. Nothing ships unless the tests pass.

---

## Layout

```
chitra-ai/
├── backend/
│   ├── config/
│   │   ├── settings/          base, dev, prod, test
│   │   ├── exception_handler.py   provider error -> safe API response
│   │   └── urls.py
│   ├── accounts/              user model, JWT cookie auth, Origin guard
│   ├── images/
│   │   ├── models.py          GeneratedImage
│   │   ├── constants.py       sizes, qualities, sampler mapping
│   │   ├── exceptions.py      domain errors + user-safe messages
│   │   ├── services/
│   │   │   ├── generation.py  provider -> storage -> database
│   │   │   ├── providers/     base, huggingface, stub
│   │   │   └── storage/       base, local
│   │   └── management/commands/check_provider.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── styles/tokens.css  the whole design system
│       ├── lib/               api client, auth, theme, formatting
│       ├── components/ui/     the design system in components
│       └── features/          auth, generator, history
├── .github/workflows/
│   ├── ci.yml                 tests + secret scan, every branch
│   └── deploy.yml             test -> VPS + Vercel, on main
├── deploy/
│   ├── bootstrap.sh           one-time VPS setup (idempotent)
│   ├── deploy.sh              what CI runs on the VPS
│   ├── gunicorn.service       systemd template
│   └── cloudpanel-vhost.conf  nginx blocks to paste into CloudPanel
└── docs/
    ├── DESIGN_SYSTEM.md
    └── DEPLOYMENT.md
```

---

## Local setup

**Requires** Python 3.12+, Node 20+, PostgreSQL 14+.

### 1. Database

```bash
createdb chitra_ai
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt

cp .env.example .env
```

Edit `.env`:

```bash
DJANGO_SECRET_KEY=<generate one, see below>
DATABASE_URL=postgres://YOUR_USER@localhost:5432/chitra_ai
HF_TOKEN=hf_your_token_here
IMAGE_PROVIDER=huggingface     # or `stub` to work offline
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

```bash
.venv/bin/python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"

.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver
```

The API is on `http://localhost:8000`.

**Working without a Hugging Face token.** Set `IMAGE_PROVIDER=stub` and the app
runs end to end against a local generator that paints a deterministic gradient.
Every other part of the system — validation, storage, history, download, delete
— behaves identically.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Check the Hugging Face credential

```bash
cd backend
.venv/bin/python manage.py check_provider
```

Prints the provider, model, sampler settings, byte count, and elapsed time. It
never prints the token.

---

## Tests

```bash
cd backend && .venv/bin/python -m pytest        # 82 tests
cd frontend && npm test                          # 63 tests
```

Backend tests run against the `stub` provider and a temporary media directory,
so no network and no token are needed.

Covered: prompt validation, submission, loading state, successful generation,
error states, image rendering, download, history rendering, pagination, delete
confirmation, ownership isolation, provider error translation, token
non-persistence, refresh rotation and replay rejection, and the Origin guard.

---

## API

All image endpoints require `Authorization: Bearer <access token>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register/` | Create an account |
| `POST` | `/api/auth/login/` | Sign in |
| `POST` | `/api/auth/refresh/` | New access token from the refresh cookie |
| `POST` | `/api/auth/logout/` | Blacklist the refresh token, clear the cookie |
| `GET` `PATCH` | `/api/auth/me/` | Read or update the profile |
| `POST` | `/api/auth/password/` | Change password |
| `POST` | `/api/images/generate/` | Generate an image |
| `GET` | `/api/images/` | Paginated history |
| `GET` | `/api/images/{id}/` | One generation |
| `DELETE` | `/api/images/{id}/` | Delete a generation |
| `GET` | `/api/images/options/` | Supported sizes, qualities, active model |
| `GET` | `/api/health/` | Liveness probe |

```http
POST /api/images/generate/
{ "prompt": "A futuristic city at sunset", "size": "1024x1024", "quality": "standard" }

201 Created
{
  "id": 42,
  "prompt": "A futuristic city at sunset",
  "image_url": "https://api.example.com/media/generated/7/a1b2....png",
  "size": "1024x1024",
  "quality": "standard",
  "provider": "huggingface",
  "model": "black-forest-labs/FLUX.1-schnell",
  "width": 1024,
  "height": 1024,
  "byte_size": 1483020,
  "download_filename": "chitra-a-futuristic-city-at-sunset-20260825-093000.png",
  "created_at": "2026-08-25T09:30:00Z"
}
```

Errors return a plain-language `detail` and a stable `code`:

```json
{ "detail": "The image took too long to generate. Please try again.", "code": "timeout" }
```

`provider_unconfigured` · `rate_limited` · `timeout` · `provider_unavailable` ·
`prompt_rejected` · `storage_error` · `generation_failed` · `invalid` ·
`unauthenticated` · `forbidden` · `not_found`

---

## How it is put together

### Provider abstraction

`ImageProvider` (`images/services/providers/base.py`) defines `generate()` and
`describe()`. `HuggingFaceProvider` and `StubProvider` implement it; the active
one is chosen by `IMAGE_PROVIDER`. Nothing above the service layer knows Hugging
Face exists, so adding a provider is one subclass and one registry entry.

Storage works the same way: `LocalImageStorage` writes to `MEDIA_ROOT` today,
and an S3 or R2 backend is one more `ImageStorage` subclass — models and views
only ever see a key and a URL.

### Quality is mapped, not passed through

FLUX has no quality parameter. Per PRD FR-04 each tier maps to real sampler
settings, chosen per model family because a timestep-distilled model needs very
different values from a guidance model:

| Model family | Standard | High detail |
|---|---|---|
| FLUX.1-schnell | 4 steps, guidance 0.0 | 8 steps, guidance 0.0 |
| FLUX.1-dev | 20 steps, guidance 3.5 | 40 steps, guidance 4.5 |
| anything else | 25 steps, guidance 7.0 | 45 steps, guidance 7.5 |

### Token handling

The access token lives in a module-level variable in the API client and is
never written to `localStorage` or `sessionStorage`, so an XSS payload has
nothing on disk to steal. The refresh token is an httpOnly cookie scoped to
`/api/auth/`, which script cannot read at all. On reload the client posts to
`/api/auth/refresh/`; the browser supplies the cookie. Refresh tokens rotate on
every use and the old one is blacklisted, so a stolen token is single-use at
best. Parallel 401s collapse into one refresh.

Because the SPA and the API are on different origins, the cookie must be
`SameSite=None`, which means `SameSite` cannot provide CSRF protection. The
cookie-authenticated endpoints validate the `Origin` header against
`CORS_ALLOWED_ORIGINS` instead — see `accounts/security.py`.

### Errors never leak

Every provider failure becomes a `GenerationError` subclass carrying a fixed,
user-safe `user_message`. `config/exception_handler.py` renders that to the
client and logs the diagnostic separately. Response bodies, headers, and tokens
from the provider are never returned and never logged.

---

## Security checklist

- `HF_TOKEN` is read from the environment, used only server-side, and never
  appears in a response or a log
- `.env` is gitignored; `.env.example` holds placeholders only
- CORS is an explicit allowlist, never a wildcard
- Refresh cookie is httpOnly, Secure, path-scoped, and rotated
- `Origin` is validated on every cookie-authenticated endpoint
- Rate limiting in DRF and again at nginx
- Passwords go through Django's validators, minimum 8 characters
- Every queryset is filtered by `request.user`; another account's image is a
  404, not a 403
- HTTPS, HSTS, and secure cookies enforced in production settings

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full walkthrough:
CloudPanel site creation, the VPS bootstrap, GitHub secrets and the deploy key,
the Vercel project, and why each cookie flag is what it is.

Short version, once:

1. CloudPanel → Add Site → Reverse Proxy to `http://127.0.0.1:8021`
2. `REPO_URL=… sudo -E bash deploy/bootstrap.sh` on the VPS
3. Paste `deploy/cloudpanel-vhost.conf` into the CloudPanel vhost, issue TLS
4. Add the GitHub secrets, add the domain in Vercel

After that, `git push origin master`.

## Design system

See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for tokens, components,
the nine interaction states, layout, responsive behaviour, and accessibility.
