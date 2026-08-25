#!/usr/bin/env bash
# Daily pg_dump into ./backups (keep the seven newest SQL dumps). Used by host cron.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"

BACKUP_DIR="${ROOT}/backups"

env_get() {
  local key="$1"
  [[ -f "${PAYTRACKER_ENV_FILE}" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "${PAYTRACKER_ENV_FILE}" | tail -n1 || true)"
  [[ -n "${line}" ]] || return 0
  printf '%s' "${line#*=}"
}

if [[ ! -f "${PAYTRACKER_ENV_FILE}" ]]; then
  echo "Missing ${PAYTRACKER_ENV_FILE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}" || true

user="$(env_get POSTGRES_USER)"
db="$(env_get POSTGRES_DB)"
user="${user:-paytracker}"
db="${db:-paytracker}"

if ! prod_is_sql_ident "${user}" || ! prod_is_sql_ident "${db}"; then
  echo "POSTGRES_USER/POSTGRES_DB are not safe identifiers" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${BACKUP_DIR}/paytracker-${stamp}.sql"

echo "Creating backup ${file}"
prod_compose exec -T postgres pg_dump -U "${user}" -d "${db}" --no-owner --no-acl >"${file}"

size="$(wc -c <"${file}" | tr -d ' ')"
if [[ "${size}" -lt 100 ]]; then
  echo "Backup too small (${size} bytes) — discarding"
  rm -f "${file}"
  exit 1
fi

if ! grep -qE 'COPY public\."Transaction"|INSERT INTO' "${file}"; then
  if ! grep -q 'CREATE TABLE' "${file}"; then
    echo "Backup validation failed — discarding"
    rm -f "${file}"
    exit 1
  fi
fi

ls -1t "${BACKUP_DIR}"/paytracker-*.sql 2>/dev/null | tail -n +8 | while read -r old; do
  echo "Removing old backup ${old}"
  rm -f "${old}"
done

chmod 600 "${file}" || true
echo "Backup complete: ${file} (${size} bytes)"
