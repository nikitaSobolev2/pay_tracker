#!/usr/bin/env bash
# Reconstruct leftover MinIO objects onto the files volume.
# Prefer `mc mirror` (strips bitrot / erasure). Fall back to copying XL
# directories and flattening recognizable image/PDF payloads.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"

if [[ ! -f "${PAYTRACKER_ENV_FILE}" || ! -f "${PAYTRACKER_COMPOSE_FILE}" ]]; then
  echo "Skip MinIO copy: missing .env or docker-compose.prod.yml"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Skip MinIO copy: docker not found"
  exit 0
fi

strip_env_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "${value}"
}

find_env_value() {
  local key="$1"
  local file line value
  for file in "${PAYTRACKER_ENV_FILE}" "${ROOT}"/.env.bak.*; do
    [[ -f "${file}" ]] || continue
    line="$(grep -E "^${key}=" "${file}" | tail -n1 || true)"
    [[ -n "${line}" ]] || continue
    value="$(strip_env_quotes "${line#*=}")"
    if [[ -n "${value}" ]]; then
      printf '%s' "${value}"
      return 0
    fi
  done
  return 1
}

files_vol="$(prod_volume_for files_data || true)"
if [[ -z "${files_vol}" ]]; then
  files_vol="$(prod_project_name)_files_data"
fi
docker volume create "${files_vol}" >/dev/null

minio_vol="$(prod_volume_for minio_data || true)"

export_via_minio() {
  local access secret name i
  [[ -n "${minio_vol}" ]] || return 1
  access="$(find_env_value S3_ACCESS_KEY || true)"
  secret="$(find_env_value S3_SECRET_KEY || true)"
  if [[ -z "${access}" || -z "${secret}" ]]; then
    echo "No S3_ACCESS_KEY/S3_SECRET_KEY in .env or .env.bak.*; skip MinIO API export"
    return 1
  fi

  name="paytracker-minio-export-$$"
  docker rm -f "${name}" >/dev/null 2>&1 || true
  echo "Starting MinIO on ${minio_vol} to reconstruct objects into ${files_vol}"
  docker run -d --name "${name}" \
    --memory=512m \
    -v "${minio_vol}:/data" \
    -v "${files_vol}:/export" \
    -e "MINIO_ROOT_USER=${access}" \
    -e "MINIO_ROOT_PASSWORD=${secret}" \
    minio/minio:latest server /data --console-address ":9001" >/dev/null

  cleanup_minio() {
    docker rm -f "${name}" >/dev/null 2>&1 || true
  }
  trap cleanup_minio EXIT

  for i in $(seq 1 40); do
    if docker exec "${name}" mc ready local >/dev/null 2>&1; then
      break
    fi
    if [[ "${i}" -eq 40 ]]; then
      echo "MinIO did not become ready; skip API export"
      cleanup_minio
      trap - EXIT
      return 1
    fi
    sleep 1
  done

  if ! docker exec "${name}" mc alias set src http://127.0.0.1:9000 "${access}" "${secret}" >/dev/null; then
    echo "MinIO credentials rejected; skip API export"
    cleanup_minio
    trap - EXIT
    return 1
  fi
  if ! docker exec "${name}" mc ls src/paytracker >/dev/null 2>&1; then
    echo "MinIO bucket paytracker is not readable; skip API export"
    cleanup_minio
    trap - EXIT
    return 1
  fi

  docker run --rm -v "${files_vol}:/export" alpine:3.20 sh -c '
    find /export -type f -name xl.meta 2>/dev/null | while IFS= read -r meta; do
      rm -rf "$(dirname "$meta")"
    done
  '
  docker exec "${name}" mc mirror --overwrite src/paytracker /export
  echo "Exported MinIO bucket paytracker via mc mirror"
  cleanup_minio
  trap - EXIT
  return 0
}

copy_xl_directories() {
  [[ -n "${minio_vol}" ]] || return 0
  echo "Copying XL directories from ${minio_vol} → ${files_vol}"
  docker run --rm \
    -v "${minio_vol}:/from:ro" \
    -v "${files_vol}:/to" \
    alpine:3.20 sh -c '
      set -e
      if find /to/events /to/travels -type f -o -type d 2>/dev/null | grep -q .
      then
        echo "files volume already has objects; skip MinIO copy"
        exit 0
      fi
      if [ -d /from/paytracker/events ] || [ -d /from/paytracker/travels ]; then
        cp -a /from/paytracker/. /to/
        echo "Copied MinIO bucket paytracker into files volume"
        exit 0
      fi
      if [ -d /from/events ] || [ -d /from/travels ]; then
        [ -d /from/events ] && cp -a /from/events /to/
        [ -d /from/travels ] && cp -a /from/travels /to/
        echo "Copied MinIO data root into files volume"
        exit 0
      fi
      echo "MinIO volume has no recognizable objects; skip"
    '
}

if [[ -n "${minio_vol}" ]]; then
  if ! export_via_minio; then
    copy_xl_directories
  fi
else
  echo "No MinIO volume; skip copy."
fi

echo "Flattening MinIO XL object directories on ${files_vol}"
docker run --rm \
  -v "${files_vol}:/to" \
  -v "${ROOT}/scripts/flatten-minio-xl.py:/flatten.py:ro" \
  alpine:3.20 sh -c 'apk add --no-cache python3 >/dev/null && python3 /flatten.py'
