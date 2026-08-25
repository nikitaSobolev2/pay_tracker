# Production compose helpers. Source from other scripts; do not execute.
# shellcheck shell=bash

PAYTRACKER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAYTRACKER_ENV_FILE="${PAYTRACKER_ROOT}/.env"
PAYTRACKER_COMPOSE_FILE="${PAYTRACKER_ROOT}/docker-compose.prod.yml"
PAYTRACKER_BACKUP_DIR="${PAYTRACKER_ROOT}/backups"

prod_env_get() {
  local key="$1"
  local line=""
  [[ -f "${PAYTRACKER_ENV_FILE}" ]] || return 0
  line="$(grep -E "^${key}=" "${PAYTRACKER_ENV_FILE}" | tail -n1 || true)"
  [[ -n "${line}" ]] || return 0
  printf '%s' "${line#*=}"
}

prod_is_sql_ident() {
  [[ "${1:-}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

prod_is_project_name() {
  [[ "${1:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]
}

prod_warn() {
  printf 'Warning: %s\n' "$*" >&2
}

prod_ensure_backup_dir() {
  mkdir -p "${PAYTRACKER_BACKUP_DIR}"
  chmod 700 "${PAYTRACKER_BACKUP_DIR}" || true
}

# Prefer a pinned name so renaming the checkout cannot create empty volumes
# and look like data loss. Detection never prints the name to stdout except
# as the return value.
prod_project_name() {
  local name="" cid="" matches="" match_count=""

  name="$(prod_env_get COMPOSE_PROJECT_NAME)"
  if [[ -n "${name}" ]]; then
    if prod_is_project_name "${name}"; then
      printf '%s' "${name}"
      return 0
    fi
    prod_warn "Ignoring invalid COMPOSE_PROJECT_NAME in .env."
  fi

  cid="$(docker ps -aq \
    --filter "label=com.docker.compose.project.working_dir=${PAYTRACKER_ROOT}" \
    --filter "label=com.docker.compose.service=postgres" \
    2>/dev/null | head -n1 || true)"
  if [[ -n "${cid}" ]]; then
    name="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "${cid}" 2>/dev/null || true)"
    if [[ -n "${name}" ]]; then
      printf '%s' "${name}"
      return 0
    fi
  fi

  matches="$(docker volume ls -q 2>/dev/null | grep -E '_postgres_data$' || true)"
  match_count="$(printf '%s\n' "${matches}" | grep -c . || true)"
  if [[ "${match_count}" -eq 1 ]]; then
    printf '%s' "${matches%_postgres_data}"
    return 0
  fi
  if [[ "${match_count}" -gt 1 ]]; then
    prod_warn "Multiple *_postgres_data volumes found. Set COMPOSE_PROJECT_NAME in .env to the prefix of the volume that holds your data."
  fi

  printf '%s' "$(basename "${PAYTRACKER_ROOT}")"
}

prod_compose() {
  local project
  project="$(prod_project_name)"
  if docker compose version >/dev/null 2>&1; then
    docker compose -p "${project}" --env-file "${PAYTRACKER_ENV_FILE}" -f "${PAYTRACKER_COMPOSE_FILE}" "$@"
  else
    docker-compose -p "${project}" --env-file "${PAYTRACKER_ENV_FILE}" -f "${PAYTRACKER_COMPOSE_FILE}" "$@"
  fi
}

# Resolve compose volume "files_data" / "minio_data" even if the project name drifted.
prod_volume_for() {
  local suffix="$1"
  local project matches match_count
  project="$(prod_project_name)"
  if docker volume inspect "${project}_${suffix}" >/dev/null 2>&1; then
    printf '%s' "${project}_${suffix}"
    return 0
  fi
  matches="$(docker volume ls -q 2>/dev/null | grep -E "_${suffix}$" || true)"
  match_count="$(printf '%s\n' "${matches}" | grep -c . || true)"
  if [[ "${match_count}" -eq 1 ]]; then
    printf '%s' "${matches}"
    return 0
  fi
  if [[ "${match_count}" -gt 1 ]]; then
    prod_warn "Multiple *_${suffix} volumes; not guessing. Set COMPOSE_PROJECT_NAME in .env."
  fi
  return 1
}

prod_volume_has_uploads() {
  local volume="$1"
  docker run --rm \
    -v "${volume}:/from:ro" \
    alpine:3.20 \
    sh -c 'find /from/events /from/travels /from/paytracker/events /from/paytracker/travels -type f 2>/dev/null | grep -q .'
}
