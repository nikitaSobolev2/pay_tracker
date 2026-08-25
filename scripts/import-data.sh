#!/usr/bin/env bash
# Restore Postgres + uploaded files from an export zip. Destructive.
#
# Usage:
#   ./scripts/import-data.sh /path/to/paytracker.zip
#   ./scripts/import-data.sh --yes /path/to/paytracker.zip
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

skip_confirm=0
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
  skip_confirm=1
  shift
fi

zip_path="${1:-}"
[[ -n "${zip_path}" ]] || die "Usage: $0 [--yes] /path/to/paytracker.zip"
[[ -f "${zip_path}" ]] || die "Zip not found: ${zip_path}"
zip_path="$(realpath "${zip_path}")"
[[ -f "${PAYTRACKER_ENV_FILE}" ]] || die "Missing ${PAYTRACKER_ENV_FILE}"
command -v docker >/dev/null 2>&1 || die "docker not found"
command -v python3 >/dev/null 2>&1 || die "python3 not found (needed to read the zip)"

if [[ "${skip_confirm}" -ne 1 ]]; then
  printf 'This replaces the database and uploaded files. A snapshot is written to ./backups first. Continue? [y/N]: '
  read -r answer || true
  [[ "${answer}" =~ ^[Yy]$ ]] || die "Import cancelled."
fi

user="$(prod_env_get POSTGRES_USER)"
db="$(prod_env_get POSTGRES_DB)"
user="${user:-paytracker}"
db="${db:-paytracker}"
prod_is_sql_ident "${user}" || die "POSTGRES_USER is not a safe identifier"
prod_is_sql_ident "${db}" || die "POSTGRES_DB is not a safe identifier"

prod_compose exec -T postgres pg_isready -U "${user}" -d postgres >/dev/null \
  || die "Postgres is not ready. Start the stack first."

prod_ensure_backup_dir
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot_sql="${PAYTRACKER_BACKUP_DIR}/pre-import-${stamp}.sql"
snapshot_files="${PAYTRACKER_BACKUP_DIR}/pre-import-${stamp}-files.tgz"

echo "Snapshotting current database to ${snapshot_sql}..."
prod_compose exec -T postgres pg_dump -U "${user}" -d "${db}" --no-owner --no-acl >"${snapshot_sql}" \
  || die "Refusing import: could not snapshot the current database"
[[ -s "${snapshot_sql}" ]] || die "Refusing import: current database dump is empty"
chmod 600 "${snapshot_sql}"

files_vol="$(prod_volume_for files_data || true)"
if [[ -z "${files_vol}" ]]; then
  files_vol="$(prod_project_name)_files_data"
fi
docker volume create "${files_vol}" >/dev/null
echo "Snapshotting current files to ${snapshot_files}..."
docker run --rm \
  -v "${files_vol}:/from:ro" \
  -v "${PAYTRACKER_BACKUP_DIR}:/backups" \
  alpine:3.20 \
  tar -czf "/backups/$(basename "${snapshot_files}")" -C /from .
chmod 600 "${snapshot_files}" || true

stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT

python3 - "${zip_path}" "${stage}" <<'PY'
import os
import sys
import zipfile

zip_path, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=True)
dest_real = os.path.realpath(dest)
with zipfile.ZipFile(zip_path) as archive:
    for info in archive.infolist():
        mode = (info.external_attr >> 16) & 0o170000
        if mode == 0o120000:
            raise SystemExit(f"Refusing zip symlink: {info.filename}")
        target = os.path.realpath(os.path.join(dest, info.filename))
        if target != dest_real and not target.startswith(dest_real + os.sep):
            raise SystemExit(f"Refusing zip path traversal: {info.filename}")
    archive.extractall(dest)
PY

[[ -f "${stage}/postgres.sql" ]] || die "Zip is missing postgres.sql"
[[ -s "${stage}/postgres.sql" ]] || die "Zip postgres.sql is empty"
[[ -f "${stage}/manifest.json" ]] || die "Zip is missing manifest.json"

echo "Stopping app..."
prod_compose stop app >/dev/null 2>&1 || true

echo "Restoring database ${db}..."
prod_compose exec -T postgres psql -U "${user}" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${db}' AND pid <> pg_backend_pid();
SQL
prod_compose exec -T postgres dropdb -U "${user}" --if-exists "${db}"
prod_compose exec -T postgres createdb -U "${user}" "${db}"
prod_compose exec -T postgres psql -U "${user}" -d "${db}" -v ON_ERROR_STOP=1 <"${stage}/postgres.sql"

mkdir -p "${stage}/files"

echo "Restoring files..."
docker run --rm \
  -v "${files_vol}:/to" \
  -v "${stage}/files:/from:ro" \
  alpine:3.20 sh -c '
    set -e
    rm -rf /to/.import-staging
    mkdir -p /to/.import-staging
    if [ -d /from/events ] || [ -d /from/travels ] || [ "$(ls -A /from 2>/dev/null)" ]; then
      cp -a /from/. /to/.import-staging/
    fi
    if [ -d /to/.import-staging/events ] || [ -d /to/.import-staging/travels ]; then
      rm -rf /to/events.bak /to/travels.bak
      [ -d /to/events ] && mv /to/events /to/events.bak
      [ -d /to/travels ] && mv /to/travels /to/travels.bak
      [ -d /to/.import-staging/events ] && mv /to/.import-staging/events /to/events
      [ -d /to/.import-staging/travels ] && mv /to/.import-staging/travels /to/travels
      rm -rf /to/events.bak /to/travels.bak
    fi
    rm -rf /to/.import-staging
  '

host_files="${ROOT}/data/files"
if [[ -d "${host_files}" ]]; then
  if find "${stage}/files/events" "${stage}/files/travels" -type f 2>/dev/null | grep -q .; then
    rm -rf "${host_files}/events" "${host_files}/travels"
    cp -a "${stage}/files/." "${host_files}/"
  fi
fi

echo "Starting app..."
prod_compose up -d --no-build app

# Keep two newest pre-import snapshots so a 2 GB disk is not filled with copies.
ls -1t "${PAYTRACKER_BACKUP_DIR}"/pre-import-*.sql 2>/dev/null | tail -n +3 | while read -r old; do
  rm -f "${old}" "${old%.sql}-files.tgz"
done

echo "Import complete. Pre-import snapshot: ${snapshot_sql} and ${snapshot_files}"
