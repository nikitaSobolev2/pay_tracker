#!/usr/bin/env bash
# Copy objects from a leftover MinIO Docker volume into the files volume.
# No-op when MinIO data is missing or the files volume already has uploads.
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

minio_vol="$(prod_volume_for minio_data || true)"
if [[ -z "${minio_vol}" ]]; then
  echo "No MinIO volume; skip copy."
  exit 0
fi

files_vol="$(prod_volume_for files_data || true)"
if [[ -z "${files_vol}" ]]; then
  files_vol="$(prod_project_name)_files_data"
fi

docker volume create "${files_vol}" >/dev/null

echo "Copying objects from ${minio_vol} → ${files_vol}"
docker run --rm \
  -v "${minio_vol}:/from:ro" \
  -v "${files_vol}:/to" \
  alpine:3.20 sh -c '
    set -e
    if find /to/events /to/travels -type f 2>/dev/null | grep -q .; then
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
