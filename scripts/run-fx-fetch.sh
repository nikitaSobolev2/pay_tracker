#!/usr/bin/env bash
# One-shot FX fetch inside the running app container (used by cron and deploy).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"

if [[ ! -f "${PAYTRACKER_ENV_FILE}" ]]; then
  echo "Missing ${PAYTRACKER_ENV_FILE}" >&2
  exit 1
fi

# Avoid npx trying to download tsx under cron (no TTY, tiny PATH).
prod_compose exec -T app sh -c '
  if [ -x node_modules/.bin/tsx ]; then
    exec node_modules/.bin/tsx scripts/fetch-exchange-rates.ts
  fi
  echo "tsx missing in the app image — rebuild with the current Dockerfile." >&2
  exit 1
'
