#!/usr/bin/env bash
#
# One-time Chitra AI setup on the Hostinger VPS (Ubuntu 24.04 + CloudPanel).
#
# Run ONCE, as root, AFTER creating the site in CloudPanel:
#   Sites -> Add Site -> Create a Reverse Proxy
#     Domain            chitra-ai.devtechguru.cloud
#     Reverse Proxy URL http://127.0.0.1:8021
#     Site User         chitra-ai
#
#   sudo bash bootstrap.sh
#
# Idempotent: safe to re-run. It skips anything already in place and never
# overwrites an existing .env.
set -euo pipefail

DOMAIN="chitra-ai.devtechguru.cloud"
APP_ORIGIN="https://chitra-ai.technicalbind.com"
SITE_USER="chitra-ai"
SITE_HOME="/home/${SITE_USER}"
APP_ROOT="${SITE_HOME}/htdocs/${DOMAIN}"
BACKEND="${APP_ROOT}/backend"
VENV="${BACKEND}/.venv"
GUNICORN_PORT="8021"
DB_NAME="chitra_ai"
DB_USER="chitra"
REPO_URL="${REPO_URL:-}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root (sudo bash bootstrap.sh)."

# --- 0. Preconditions ------------------------------------------------------
log "Checking preconditions"

id "${SITE_USER}" >/dev/null 2>&1 || die \
  "User '${SITE_USER}' does not exist. Create the reverse-proxy site in CloudPanel first (see the header of this script)."

[ -d "${SITE_HOME}/htdocs" ] || die \
  "${SITE_HOME}/htdocs is missing. Create the site in CloudPanel first."

if ss -lntp 2>/dev/null | grep -q ":${GUNICORN_PORT}\b"; then
  warn "Port ${GUNICORN_PORT} is already in use. If that is not a previous Chitra AI install, pick another port and update this script, the CloudPanel reverse-proxy URL, and the systemd unit."
fi
echo "    site user, htdocs, and port look right"

# --- 1. System packages ----------------------------------------------------
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  python3-venv python3-dev build-essential \
  postgresql postgresql-contrib libpq-dev \
  git curl >/dev/null
echo "    done"

systemctl enable --now postgresql >/dev/null 2>&1 || true

# --- 2. Database -----------------------------------------------------------
log "Configuring PostgreSQL"

DB_PASSWORD=""
ENV_FILE="${BACKEND}/.env"

if [ -f "${ENV_FILE}" ] && grep -q '^DATABASE_URL=' "${ENV_FILE}"; then
  # Reuse the password already in .env so a re-run does not orphan the database.
  DB_PASSWORD="$(sed -n 's|^DATABASE_URL=postgres://[^:]*:\([^@]*\)@.*|\1|p' "${ENV_FILE}")"
fi
if [ -z "${DB_PASSWORD}" ]; then
  DB_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  echo "    role '${DB_USER}' exists, syncing password"
  sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
else
  echo "    creating role '${DB_USER}'"
  sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
fi

sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "    database '${DB_NAME}' exists"
else
  echo "    creating database '${DB_NAME}'"
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi
sudo -u postgres psql -q -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# PostgreSQL listens on localhost only. Nothing here opens it to the network.

# --- 3. Application code ---------------------------------------------------
log "Fetching application code"
if [ -d "${APP_ROOT}/.git" ]; then
  echo "    repository present, pulling"
  sudo -u "${SITE_USER}" git -C "${APP_ROOT}" pull --ff-only
else
  [ -n "${REPO_URL}" ] || die \
    "No repository at ${APP_ROOT}. Re-run with: REPO_URL=https://github.com/you/chitra-ai.git sudo -E bash bootstrap.sh"
  echo "    cloning ${REPO_URL}"
  # htdocs already exists and CloudPanel put an index page in it; clone into a
  # temp dir and move the contents so the site user keeps ownership.
  rm -rf /tmp/chitra-clone
  sudo -u "${SITE_USER}" git clone "${REPO_URL}" /tmp/chitra-clone
  sudo -u "${SITE_USER}" cp -a /tmp/chitra-clone/. "${APP_ROOT}/"
  rm -rf /tmp/chitra-clone
fi

# --- 4. Python environment -------------------------------------------------
log "Building the Python environment"
if [ ! -d "${VENV}" ]; then
  sudo -u "${SITE_USER}" python3 -m venv "${VENV}"
fi
sudo -u "${SITE_USER}" "${VENV}/bin/pip" install --upgrade pip --quiet
sudo -u "${SITE_USER}" "${VENV}/bin/pip" install -r "${BACKEND}/requirements.txt" --quiet
echo "    done"

# --- 5. Environment file ---------------------------------------------------
log "Writing the environment file"
if [ -f "${ENV_FILE}" ]; then
  warn "${ENV_FILE} already exists. Leaving it untouched."
  warn "If the database password changed, update DATABASE_URL by hand."
else
  SECRET_KEY="$("${VENV}/bin/python" -c 'from django.core.management.utils import get_random_secret_key as k; print(k())')"
  cat > "${ENV_FILE}" <<ENVEOF
DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN}

DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# ---------------------------------------------------------------------------
# PASTE YOUR REAL HUGGING FACE TOKEN BELOW, THEN:
#   systemctl restart chitra-api
# Until then IMAGE_PROVIDER stays on 'stub' and generates placeholder images.
# ---------------------------------------------------------------------------
HF_TOKEN=
HF_MODEL=black-forest-labs/FLUX.1-schnell
HF_PROVIDER=auto
HF_TIMEOUT=120

CORS_ALLOWED_ORIGINS=${APP_ORIGIN}

IMAGE_PROVIDER=stub
IMAGE_STORAGE=local
MEDIA_BASE_URL=https://${DOMAIN}

GENERATION_RATE=20/hour
ANON_RATE=30/hour
USER_RATE=300/hour
ENVEOF
  echo "    created ${ENV_FILE}"
fi

chown "${SITE_USER}:${SITE_USER}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# --- 6. Media and static directories --------------------------------------
log "Preparing media and static directories"
sudo -u "${SITE_USER}" mkdir -p "${BACKEND}/media" "${BACKEND}/staticfiles"
# nginx (www-data) reads these; the site user writes them.
chown -R "${SITE_USER}:${SITE_USER}" "${BACKEND}/media" "${BACKEND}/staticfiles"
chmod 755 "${BACKEND}/media" "${BACKEND}/staticfiles"
# nginx must be able to traverse into the site directory.
chmod o+x "${SITE_HOME}" "${SITE_HOME}/htdocs" "${APP_ROOT}" "${BACKEND}" 2>/dev/null || true
echo "    done"

# --- 7. Migrate and collect static ----------------------------------------
log "Applying migrations and collecting static files"
cd "${BACKEND}"
sudo -u "${SITE_USER}" DJANGO_SETTINGS_MODULE=config.settings.prod "${VENV}/bin/python" manage.py migrate --noinput
sudo -u "${SITE_USER}" DJANGO_SETTINGS_MODULE=config.settings.prod "${VENV}/bin/python" manage.py collectstatic --noinput >/dev/null
echo "    done"

# --- 8. systemd service ----------------------------------------------------
log "Installing the systemd service"
sed -e "s|__APP_ROOT__|${APP_ROOT}|g" \
    -e "s|__BACKEND__|${BACKEND}|g" \
    -e "s|__VENV__|${VENV}|g" \
    -e "s|__SITE_USER__|${SITE_USER}|g" \
    -e "s|__PORT__|${GUNICORN_PORT}|g" \
    "${APP_ROOT}/deploy/gunicorn.service" > /etc/systemd/system/chitra-api.service

systemctl daemon-reload
systemctl enable chitra-api >/dev/null
systemctl restart chitra-api
sleep 3

if systemctl is-active --quiet chitra-api; then
  echo "    chitra-api is running"
else
  systemctl status chitra-api --no-pager -l | tail -30
  die "chitra-api failed to start."
fi

# --- 9. Deploy hook for CI -------------------------------------------------
log "Installing the CI deploy hook"
install -o "${SITE_USER}" -g "${SITE_USER}" -m 750 \
  "${APP_ROOT}/deploy/deploy.sh" "${SITE_HOME}/deploy.sh"

# Let the site user restart its own service without a password. This is the
# only sudo right it gets, and it is limited to these exact commands.
cat > /etc/sudoers.d/chitra-api <<SUDOEOF
${SITE_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart chitra-api, /usr/bin/systemctl status chitra-api, /usr/bin/systemctl is-active chitra-api
SUDOEOF
chmod 440 /etc/sudoers.d/chitra-api
visudo -cf /etc/sudoers.d/chitra-api >/dev/null || die "sudoers file is invalid"
echo "    done"

# --- 10. Weekly token cleanup ---------------------------------------------
log "Scheduling expired-token cleanup"
cat > /etc/cron.d/chitra-flush-tokens <<CRONEOF
# Clear rotated refresh tokens from the blacklist every Sunday at 04:00 UTC.
0 4 * * 0 ${SITE_USER} cd ${BACKEND} && DJANGO_SETTINGS_MODULE=config.settings.prod ${VENV}/bin/python manage.py flushexpiredtokens >/dev/null 2>&1
CRONEOF
chmod 644 /etc/cron.d/chitra-flush-tokens
echo "    done"

# --- 11. Local health check ------------------------------------------------
log "Health check"
if curl -fsS --max-time 10 "http://127.0.0.1:${GUNICORN_PORT}/api/health/" >/dev/null; then
  echo "    gunicorn is answering on 127.0.0.1:${GUNICORN_PORT}"
else
  die "gunicorn is not answering. Check: journalctl -u chitra-api -n 50"
fi

cat <<DONEEOF

============================================================================
Bootstrap complete.

Still to do, in CloudPanel:

  1. Sites -> ${DOMAIN} -> Vhost
     Paste the two location blocks from deploy/cloudpanel-vhost.conf
     ABOVE the existing "location /" block, then save.

  2. Sites -> ${DOMAIN} -> SSL/TLS -> Let's Encrypt -> Issue

  3. Create your admin account:
       cd ${BACKEND}
       sudo -u ${SITE_USER} DJANGO_SETTINGS_MODULE=config.settings.prod \\
         ${VENV}/bin/python manage.py createsuperuser

  4. Add your Hugging Face token to ${ENV_FILE},
     set IMAGE_PROVIDER=huggingface, then:
       cd ${BACKEND}
       sudo -u ${SITE_USER} DJANGO_SETTINGS_MODULE=config.settings.prod \\
         ${VENV}/bin/python manage.py check_provider
       sudo systemctl restart chitra-api

  5. Add the CI deploy key to ${SITE_HOME}/.ssh/authorized_keys
     (see docs/DEPLOYMENT.md).
============================================================================

DONEEOF
