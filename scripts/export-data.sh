#!/usr/bin/env bash
# Export Postgres + uploaded files into a zip (MinIO volume or filesystem).
#
# Usage:
#   ./scripts/export-data.sh
#   ./scripts/export-data.sh /path/to/paytracker.zip
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

[[ -f "${PAYTRACKER_ENV_FILE}" ]] || die "Missing ${PAYTRACKER_ENV_FILE}"
command -v docker >/dev/null 2>&1 || die "docker not found"
command -v python3 >/dev/null 2>&1 || die "python3 not found (needed to write the zip)"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="${1:-${ROOT}/backups/paytracker-${stamp}.zip}"
prod_ensure_backup_dir
mkdir -p "$(dirname "${out}")"
out="$(realpath -m "${out}")"

stage="$(mktemp -d)"
trap 'rm -rf "${stage}"' EXIT
mkdir -p "${stage}/files"

user="$(prod_env_get POSTGRES_USER)"
db="$(prod_env_get POSTGRES_DB)"
user="${user:-paytracker}"
db="${db:-paytracker}"
prod_is_sql_ident "${user}" || die "POSTGRES_USER is not a safe identifier"
prod_is_sql_ident "${db}" || die "POSTGRES_DB is not a safe identifier"

prod_compose exec -T postgres pg_isready -U "${user}" -d "${db}" >/dev/null \
  || die "Postgres is not ready. Start the stack first."

echo "Dumping database ${db}..."
prod_compose exec -T postgres pg_dump -U "${user}" -d "${db}" --no-owner --no-acl >"${stage}/postgres.sql"
[[ -s "${stage}/postgres.sql" ]] || die "pg_dump produced an empty file"

storage_source="none"
host_files="${ROOT}/data/files"

copy_volume_tree() {
  local volume="$1"
  local src_inside="$2"
  docker run --rm \
    -v "${volume}:/from:ro" \
    -v "${stage}/files:/to" \
    alpine:3.20 sh -c "
      set -e
      if [ -d /from/${src_inside} ]; then
        cp -a /from/${src_inside}/. /to/
      fi
    "
}

# Production stores uploads on the files_data volume. A leftover ./data/files
# (from local compose) must not hide that volume or the zip is empty/stale.
files_vol="$(prod_volume_for files_data || true)"
if [[ -n "${files_vol}" ]] && prod_volume_has_uploads "${files_vol}"; then
  copy_volume_tree "${files_vol}" "."
  storage_source="fs"
fi

if [[ "${storage_source}" == "none" ]]; then
  minio_vol="$(prod_volume_for minio_data || true)"
  if [[ -n "${minio_vol}" ]] && prod_volume_has_uploads "${minio_vol}"; then
    if docker run --rm -v "${minio_vol}:/from:ro" alpine:3.20 \
      sh -c 'test -d /from/paytracker/events -o -d /from/paytracker/travels'; then
      copy_volume_tree "${minio_vol}" "paytracker"
    else
      copy_volume_tree "${minio_vol}" "."
    fi
    storage_source="minio"
  fi
fi

if [[ "${storage_source}" == "none" && -d "${host_files}" ]]; then
  if find "${host_files}/events" "${host_files}/travels" -type f 2>/dev/null | grep -q .; then
    cp -a "${host_files}/." "${stage}/files/"
    storage_source="host"
  fi
fi

cat >"${stage}/manifest.json" <<EOF
{
  "version": 1,
  "exportedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "${db}",
  "storageSource": "${storage_source}"
}
EOF

echo "Writing ${out}..."
(
  cd "${stage}"
  umask 077
  python3 -m zipfile -c "${out}" postgres.sql manifest.json files
)
chmod 600 "${out}" || true

printf 'Exported %s (storage: %s)\n' "${out}" "${storage_source}"
if [[ "${storage_source}" == "none" ]]; then
  printf 'Warning: zip has no event/travel uploads (database dump is still included).\n' >&2
fi
