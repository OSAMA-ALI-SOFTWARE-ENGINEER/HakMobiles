#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .deploy.env ]]; then
  echo "Copy .deploy.env.example to .deploy.env and fill in the host."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .deploy.env
set +a

: "${DEPLOY_HOST:?}"
: "${DEPLOY_USER:?}"
: "${DEPLOY_PATH:?}"
: "${DEPLOY_HEALTH_URL:?}"

(cd api && php artisan test)
(cd app && npm test)
(cd app && npm run build)
git push

ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && git pull && composer install --no-dev --optimize-autoloader && php artisan migrate --force && php artisan optimize"
scp -r app/dist/. "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/public/"
curl --fail --silent "${DEPLOY_HEALTH_URL}"
echo
echo "Deployed. Health check passed."
