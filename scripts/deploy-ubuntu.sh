#!/usr/bin/env bash
# PayTracker production deploy helper for Ubuntu 22.04 LTS.
# Installs Docker, configures .env, and manages the compose stack.
#
# Usage:
#   sudo ./scripts/deploy-ubuntu.sh              # interactive menu
#   sudo ./scripts/deploy-ubuntu.sh install
#   sudo ./scripts/deploy-ubuntu.sh configure
#   sudo ./scripts/deploy-ubuntu.sh deploy
#   ./scripts/deploy-ubuntu.sh status|logs|up|down|update|help
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT}/docker-compose.prod.yml"
ENV_FILE="${ROOT}/.env"
# shellcheck source=scripts/lib-prod-stack.sh
. "${ROOT}/scripts/lib-prod-stack.sh"
COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

log() { printf '%s\n' "$*"; }
info() { printf '%s%s%s\n' "${CYAN}" "$*" "${RESET}"; }
ok() { printf '%s%s%s\n' "${GREEN}" "$*" "${RESET}"; }
warn() { printf '%s%s%s\n' "${YELLOW}" "$*" "${RESET}"; }
err() { printf '%s%s%s\n' "${RED}" "$*" "${RESET}" >&2; }

die() {
  err "Error: $*"
  exit 1
}

need_root_for_install() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Docker install needs root. Re-run with: sudo $0 install"
  fi
}

run_as_deploy_user() {
  if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    sudo -u "${SUDO_USER}" -H "$@"
  else
    "$@"
  fi
}

docker_bin_present() {
  command -v docker >/dev/null 2>&1
}

# Compose v2 plugin: `docker compose`
compose_plugin_present() {
  docker_bin_present && docker compose version >/dev/null 2>&1
}

# Legacy standalone binary (some VPS images ship this instead of the plugin)
compose_standalone_present() {
  command -v docker-compose >/dev/null 2>&1
}

compose_available() {
  compose_plugin_present || compose_standalone_present
}

docker_daemon_running() {
  docker info >/dev/null 2>&1
}

docker_permission_denied() {
  local err=""
  err="$(docker info 2>&1)" || true
  [[ "${err}" == *"permission denied"* ]]
}

start_docker_daemon() {
  if docker_daemon_running; then
    return 0
  fi
  if [[ "${EUID}" -ne 0 ]]; then
    return 1
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable docker >/dev/null 2>&1 || true
    systemctl start docker >/dev/null 2>&1 || true
  elif command -v service >/dev/null 2>&1; then
    service docker start >/dev/null 2>&1 || true
  fi
  docker_daemon_running
}

# Print what is already on the machine (preinstalled VPS images, etc.).
report_docker_status() {
  if ! docker_bin_present; then
    warn "Docker binary: not found"
    return 1
  fi
  ok "Docker binary: $(docker --version 2>/dev/null || echo present)"
  if compose_plugin_present; then
    ok "Compose plugin: $(docker compose version 2>/dev/null | head -n1)"
  elif compose_standalone_present; then
    ok "Compose standalone: $(docker-compose --version 2>/dev/null || echo present)"
    warn "Using legacy docker-compose binary (plugin preferred but OK)."
  else
    warn "Compose: not found (need plugin or docker-compose)"
  fi
  if docker_daemon_running; then
    ok "Docker daemon: running"
  else
    warn "Docker daemon: not running"
  fi
  return 0
}

refresh_compose_cmd() {
  local project
  project="$(prod_project_name)"
  if compose_plugin_present; then
    COMPOSE=(docker compose -p "${project}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
  elif compose_standalone_present; then
    COMPOSE=(docker-compose -p "${project}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
  else
    COMPOSE=(docker compose -p "${project}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
  fi
}

compose() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    die "Missing ${ENV_FILE}. Run: $0 configure"
  fi
  refresh_compose_cmd
  if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    # Prefer non-root docker group after install; fall back to root socket.
    if sudo -u "${SUDO_USER}" -H docker info >/dev/null 2>&1; then
      sudo -u "${SUDO_USER}" -H "${COMPOSE[@]}" "$@"
    else
      "${COMPOSE[@]}" "$@"
    fi
  else
    "${COMPOSE[@]}" "$@"
  fi
}

require_ubuntu_22() {
  if [[ ! -f /etc/os-release ]]; then
    die "Cannot detect OS (/etc/os-release missing)."
  fi
  # shellcheck source=/dev/null
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    die "This script targets Ubuntu. Detected: ${ID:-unknown}"
  fi
  local major="${VERSION_ID%%.*}"
  if [[ "${major}" != "22" ]]; then
    warn "Designed for Ubuntu 22.04; detected ${PRETTY_NAME:-$VERSION_ID}. Continuing anyway."
  else
    ok "OS: ${PRETTY_NAME}"
  fi
}

random_secret() {
  local bytes="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "${bytes}" | tr -d '\n' | tr '+/' 'Aa' | head -c 48
    printf '\n'
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48
    printf '\n'
  fi
}

random_password() {
  # Alphanumeric only so it is safe inside DATABASE_URL without encoding.
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  printf '\n'
}

prompt() {
  local label="$1"
  local default="${2:-}"
  local value=""
  if [[ -n "${default}" ]]; then
    read -r -p "${label} [${default}]: " value || true
    printf '%s' "${value:-$default}"
  else
    read -r -p "${label}: " value || true
    printf '%s' "${value}"
  fi
}

prompt_secret() {
  local label="$1"
  local default="${2:-}"
  local value=""
  if [[ -n "${default}" ]]; then
    read -r -s -p "${label} [press Enter to keep existing]: " value || true
    printf '\n' >&2
    printf '%s' "${value:-$default}"
  else
    read -r -s -p "${label}: " value || true
    printf '\n' >&2
    printf '%s' "${value}"
  fi
}

confirm() {
  local label="${1:-Continue?}"
  local answer=""
  read -r -p "${label} [y/N]: " answer || true
  [[ "${answer}" =~ ^[Yy]$ ]]
}

env_get() {
  local key="$1"
  local file="${2:-$ENV_FILE}"
  [[ -f "${file}" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "${file}" | tail -n1 || true)"
  [[ -n "${line}" ]] || return 0
  printf '%s' "${line#*=}"
}

chmod_deploy_scripts() {
  chmod +x \
    "${ROOT}/scripts/deploy-ubuntu.sh" \
    "${ROOT}/scripts/app-entrypoint.sh" \
    "${ROOT}/scripts/light-redeploy.sh" \
    "${ROOT}/scripts/export-data.sh" \
    "${ROOT}/scripts/import-data.sh" \
    "${ROOT}/scripts/run-fx-fetch.sh" \
    "${ROOT}/scripts/run-sql-backup.sh" \
    "${ROOT}/scripts/copy-minio-data-to-files.sh" \
    "${ROOT}/scripts/setup-nginx.sh" \
    2>/dev/null || true
}

append_env_if_missing() {
  local key="$1"
  local value="$2"
  if ! grep -qE "^${key}=" "${ENV_FILE}"; then
    printf '%s=%s\n' "${key}" "${value}" >>"${ENV_FILE}"
  fi
}

ensure_env_defaults() {
  [[ -f "${ENV_FILE}" ]] || return 0
  local auth_url project
  auth_url="$(env_get BETTER_AUTH_URL)"
  auth_url="${auth_url%/}"
  append_env_if_missing STORAGE_BACKEND fs
  append_env_if_missing STORAGE_DIR /data/files
  if ! grep -qE '^S3_PUBLIC_URL=' "${ENV_FILE}"; then
    if [[ -n "${auth_url}" ]]; then
      printf 'S3_PUBLIC_URL=%s/files\n' "${auth_url}" >>"${ENV_FILE}"
    fi
  fi
  project="$(prod_project_name)"
  if prod_is_project_name "${project}"; then
    append_env_if_missing COMPOSE_PROJECT_NAME "${project}"
  fi
}

copy_minio_if_needed() {
  local script="${ROOT}/scripts/copy-minio-data-to-files.sh"
  [[ -x "${script}" || -f "${script}" ]] || return 0
  chmod +x "${script}" || true
  info "Checking for leftover MinIO objects..."
  if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    if sudo -u "${SUDO_USER}" -H docker info >/dev/null 2>&1; then
      sudo -u "${SUDO_USER}" -H "${script}" || warn "MinIO file copy skipped."
      return 0
    fi
  fi
  "${script}" || warn "MinIO file copy skipped."
}

is_valid_cron_schedule() {
  local schedule="${1:-}"
  case "${schedule}" in
    @reboot|@hourly|@daily|@weekly|@monthly|@yearly|@annually) return 0 ;;
  esac
  local field_count
  field_count="$(printf '%s' "${schedule}" | awk '{print NF}')"
  [[ "${field_count}" -eq 5 ]] || return 1
  [[ "${schedule}" =~ ^[0-9*/,\ -]+$ ]]
}

install_host_jobs() {
  prod_ensure_backup_dir
  chmod_deploy_scripts
  local user fx_sched bak_sched tmp current_user
  current_user="$(id -un)"
  user="${current_user}"
  if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    user="${SUDO_USER}"
  fi
  fx_sched="$(env_get FX_FETCH_CRON)"
  fx_sched="${fx_sched:-0 2 * * *}"
  if ! is_valid_cron_schedule "${fx_sched}"; then
    warn "Ignoring invalid FX_FETCH_CRON; using 0 2 * * *"
    fx_sched="0 2 * * *"
  fi
  bak_sched="$(env_get BACKUP_CRON)"
  bak_sched="${bak_sched:-0 3 * * *}"
  if ! is_valid_cron_schedule "${bak_sched}"; then
    warn "Ignoring invalid BACKUP_CRON; using 0 3 * * *"
    bak_sched="0 3 * * *"
  fi

  if ! command -v crontab >/dev/null 2>&1; then
    warn "crontab not found. Install the cron package, then re-run deploy so FX/SQL jobs are installed."
    return 0
  fi

  tmp="$(mktemp)"
  if [[ "${EUID}" -eq 0 && "${user}" != "${current_user}" ]]; then
    crontab -u "${user}" -l 2>/dev/null | grep -v 'scripts/run-fx-fetch.sh' | grep -v 'scripts/run-sql-backup.sh' | grep -v '^PATH=' >"${tmp}" || true
  else
    crontab -l 2>/dev/null | grep -v 'scripts/run-fx-fetch.sh' | grep -v 'scripts/run-sql-backup.sh' | grep -v '^PATH=' >"${tmp}" || true
  fi
  {
    printf 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n'
    cat "${tmp}"
    printf '%s cd %q && %q >> %q 2>&1\n' \
      "${fx_sched}" "${ROOT}" "${ROOT}/scripts/run-fx-fetch.sh" "${ROOT}/backups/fx-cron.log"
    printf '%s cd %q && %q >> %q 2>&1\n' \
      "${bak_sched}" "${ROOT}" "${ROOT}/scripts/run-sql-backup.sh" "${ROOT}/backups/sql-cron.log"
  } >"${tmp}.out"
  mv "${tmp}.out" "${tmp}"

  if [[ "${EUID}" -eq 0 && "${user}" != "${current_user}" ]]; then
    crontab -u "${user}" "${tmp}" || warn "Could not install crontab for ${user}."
  else
    crontab "${tmp}" || warn "Could not install crontab (FX/SQL jobs)."
  fi
  rm -f "${tmp}"
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    chown "${SUDO_USER}:${SUDO_USER}" "${ROOT}/backups" || true
  fi
  chmod 700 "${ROOT}/backups" || true
  ok "Host cron: FX (${fx_sched}) and SQL backup (${bak_sched}) for ${user}."
}

run_fx_once() {
  wait_for_app || true
  info "Fetching FX rates..."
  chmod +x "${ROOT}/scripts/run-fx-fetch.sh" || true
  local n=0
  while [[ "${n}" -lt 8 ]]; do
    if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]] \
      && sudo -u "${SUDO_USER}" -H docker info >/dev/null 2>&1; then
      if sudo -u "${SUDO_USER}" -H "${ROOT}/scripts/run-fx-fetch.sh"; then
        ok "FX fetch complete."
        return 0
      fi
    elif "${ROOT}/scripts/run-fx-fetch.sh"; then
      ok "FX fetch complete."
      return 0
    fi
    n=$((n + 1))
    sleep 3
  done
  warn "FX fetch did not succeed (will retry on cron)."
}

wait_for_app() {
  local host port url n
  host="$(env_get APP_HOST)"
  host="${host:-127.0.0.1}"
  if [[ "${host}" == "0.0.0.0" ]]; then
    host="127.0.0.1"
  fi
  port="$(env_get APP_PORT)"
  port="${port:-3000}"
  url="http://${host}:${port}/api/health"
  info "Waiting for app at ${url}..."
  n=0
  while [[ "${n}" -lt 60 ]]; do
    if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 5 "${url}" >/dev/null 2>&1; then
      ok "App is up."
      return 0
    fi
    if command -v wget >/dev/null 2>&1 && wget -q -T 5 -O /dev/null "${url}"; then
      ok "App is up."
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  warn "App did not respond at ${url} yet."
  return 1
}

wait_for_postgres() {
  local user db n
  user="$(env_get POSTGRES_USER)"
  db="$(env_get POSTGRES_DB)"
  user="${user:-paytracker}"
  db="${db:-paytracker}"
  n=0
  while [[ "${n}" -lt 30 ]]; do
    if compose exec -T postgres pg_isready -U "${user}" -d "${db}" >/dev/null 2>&1; then
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  warn "Postgres did not become ready."
  return 1
}

# Official Postgres image ignores POSTGRES_PASSWORD after the volume is initialized.
# Keep the role in sync with .env when configure rotates the password.
sync_postgres_role_password() {
  local user pass escaped
  user="$(env_get POSTGRES_USER)"
  pass="$(env_get POSTGRES_PASSWORD)"
  user="${user:-paytracker}"
  [[ -n "${pass}" ]] || return 0
  prod_is_sql_ident "${user}" || {
    warn "POSTGRES_USER is not a simple identifier; skip password sync."
    return 0
  }
  wait_for_postgres || return 0
  escaped="${pass//\'/\'\'}"
  # stdin so the password is not visible in `ps` as a psql -c argument.
  if compose exec -T postgres psql -U "${user}" -d postgres -v ON_ERROR_STOP=1 >/dev/null <<SQL
ALTER ROLE ${user} WITH PASSWORD '${escaped}';
SQL
  then
    ok "Postgres role password matches .env."
  else
    warn "Could not sync Postgres role password (first boot is OK)."
  fi
}

ensure_swapfile() {
  [[ -f /proc/meminfo ]] || return 0
  local mem_kb
  mem_kb="$(awk '/MemTotal:/ {print $2}' /proc/meminfo)"
  if [[ "${mem_kb}" -ge 3600000 ]]; then
    ok "RAM >= 4 GB — not creating a swap file."
    return 0
  fi
  if swapon --show 2>/dev/null | grep -q '/'; then
    ok "Swap already enabled."
    return 0
  fi
  info "Creating 2 GB swap file (host RAM is under 3.5 GB)..."
  if [[ -f /swapfile ]]; then
    swapon /swapfile || true
    return 0
  fi
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l 2G /swapfile
  else
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
  fi
  sysctl -w vm.swappiness=10 >/dev/null || true
  if [[ -f /etc/sysctl.conf ]] && ! grep -q '^vm.swappiness=' /etc/sysctl.conf; then
    printf 'vm.swappiness=10\n' >>/etc/sysctl.conf
  fi
  ok "Swap file enabled."
}

git_pull_if_repo() {
  if [[ -d "${ROOT}/.git" ]]; then
    info "Pulling latest git changes..."
    if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
      run_as_deploy_user git -C "${ROOT}" pull --ff-only
    else
      git -C "${ROOT}" pull --ff-only
    fi
  else
    warn "Not a git checkout; using current tree."
  fi
  chmod_deploy_scripts
}

cmd_help() {
  cat <<EOF
${BOLD}PayTracker Ubuntu 22 production deploy${RESET}

${CYAN}Commands${RESET}
  install     Detect preinstalled Docker, or install Engine + Compose if missing
  configure   Interactive .env setup (secrets, URL, port, currencies)
  deploy      Build images on this machine and start the stack (migrate on boot)
  update      git pull (if repo) + rebuild & restart
  redeploy    Same as update (git pull + build on the server)
  light       git pull + pull GHCR image + restart (no build on the server)
  export      Zip Postgres + uploaded files into ./backups
  import      Restore from an export zip (destructive)
  up          Start existing containers
  down        Stop containers
  status      Container status + recent health
  logs        Follow app logs (Ctrl+C to exit)
  menu        Interactive menu (default)
  help        Show this help

${CYAN}This month (4 GB VPS)${RESET}
  ./scripts/deploy-ubuntu.sh redeploy

${CYAN}Later (2 GB + GHCR)${RESET}
  GHCR package must be Public, then: ./scripts/light-redeploy.sh
  First-time without an image: $0 deploy

${CYAN}Typical first run${RESET}
  sudo ./scripts/deploy-ubuntu.sh install   # skips Docker if already present
  ./scripts/deploy-ubuntu.sh configure
  ./scripts/deploy-ubuntu.sh deploy

${CYAN}Files${RESET}
  Compose: ${COMPOSE_FILE}
  Env:     ${ENV_FILE}
EOF
}

install_docker_engine() {
  info "Installing Docker Engine from Docker's official apt repository..."
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  # shellcheck source=/dev/null
  . /etc/os-release
  local arch
  arch="$(dpkg --print-architecture)"
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "${arch}" "${VERSION_CODENAME}" >/etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed: $(docker --version)"
  ok "Compose: $(docker compose version)"
}

# If Docker is present but Compose is missing, try apt packages without
# replacing a working preinstalled Engine.
install_compose_only() {
  info "Docker is present; installing Compose plugin only..."
  if apt-get install -y docker-compose-plugin 2>/dev/null; then
    if compose_plugin_present; then
      ok "Compose plugin: $(docker compose version 2>/dev/null | head -n1)"
      return 0
    fi
  fi
  if apt-get install -y docker-compose-v2 2>/dev/null; then
    if compose_plugin_present; then
      ok "Compose plugin: $(docker compose version 2>/dev/null | head -n1)"
      return 0
    fi
  fi
  if apt-get install -y docker-compose 2>/dev/null; then
    if compose_available; then
      ok "Compose available after apt install"
      return 0
    fi
  fi
  return 1
}

cmd_install() {
  need_root_for_install
  require_ubuntu_22

  info "Checking for preinstalled Docker..."
  report_docker_status || true
  log ""

  export DEBIAN_FRONTEND=noninteractive
  info "Ensuring host packages (ca-certificates, curl, openssl)..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release openssl python3 cron

  local docker_was_preinstalled=0
  if docker_bin_present; then
    docker_was_preinstalled=1
    ok "Using preinstalled Docker — skipping Engine reinstall."
    if ! start_docker_daemon; then
      die "Docker is installed but the daemon failed to start. Check: systemctl status docker"
    fi
    ok "Docker daemon: running"

    if ! compose_available; then
      if ! install_compose_only; then
        die "Docker is installed but Compose is missing. Install docker-compose-plugin, then re-run install."
      fi
    else
      ok "Compose already available — nothing to install for Compose."
    fi
  else
    info "No Docker binary found — installing Engine + Compose..."
    install_docker_engine
  fi

  if ! docker_bin_present || ! compose_available; then
    die "Docker/Compose still unavailable after install."
  fi
  if ! docker_daemon_running; then
    die "Docker daemon is not running after install."
  fi

  refresh_compose_cmd
  log ""
  info "Final Docker check:"
  report_docker_status
  if [[ "${docker_was_preinstalled}" -eq 1 ]]; then
    ok "Preinstalled Docker verified and ready."
  fi

  local deploy_user="${SUDO_USER:-}"
  if [[ -n "${deploy_user}" && "${deploy_user}" != "root" ]]; then
    usermod -aG docker "${deploy_user}" || true
    warn "User '${deploy_user}' added to the docker group."
    warn "Log out and back in (or run: newgrp docker) before non-sudo deploy."
  fi

  mkdir -p "${ROOT}/backups"
  chmod_deploy_scripts
  if [[ -n "${deploy_user}" && "${deploy_user}" != "root" ]]; then
    chown -R "${deploy_user}:${deploy_user}" "${ROOT}/backups" || true
  fi
  chmod 700 "${ROOT}/backups" || true

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now cron >/dev/null 2>&1 || systemctl enable --now crond >/dev/null 2>&1 || true
  fi

  ensure_swapfile

  ok "Install complete."
}

cmd_configure() {
  require_ubuntu_22
  cd "${ROOT}"

  info "Configure production environment → ${ENV_FILE}"
  log ""

  local existing_url existing_port existing_secret existing_pg_pass
  local existing_currencies existing_currency existing_tz existing_app_name
  local existing_host existing_pg_user existing_pg_db
  local existing_s3_url existing_ai_key existing_ai_base existing_ai_model
  local existing_ai_timeout existing_yandex_js existing_yandex_geo existing_yandex_referer
  local existing_fx_cron existing_bak_cron existing_image_tag existing_project
  existing_url="$(env_get BETTER_AUTH_URL)"
  existing_port="$(env_get APP_PORT)"
  existing_host="$(env_get APP_HOST)"
  existing_secret="$(env_get BETTER_AUTH_SECRET)"
  existing_pg_pass="$(env_get POSTGRES_PASSWORD)"
  existing_pg_user="$(env_get POSTGRES_USER)"
  existing_pg_db="$(env_get POSTGRES_DB)"
  existing_currencies="$(env_get DEFAULT_CURRENCIES)"
  existing_currency="$(env_get DEFAULT_CURRENCY)"
  existing_tz="$(env_get DEFAULT_TIMEZONE)"
  existing_app_name="$(env_get NEXT_PUBLIC_APP_NAME)"
  existing_s3_url="$(env_get S3_PUBLIC_URL)"
  existing_ai_key="$(env_get AI_API_KEY)"
  existing_ai_base="$(env_get AI_BASE_URL)"
  existing_ai_model="$(env_get AI_MODEL_ID)"
  existing_ai_timeout="$(env_get AI_TIMEOUT_MS)"
  existing_yandex_js="$(env_get NEXT_PUBLIC_YANDEX_MAPS_API_KEY)"
  existing_yandex_geo="$(env_get YANDEX_GEOCODER_API_KEY)"
  existing_yandex_referer="$(env_get YANDEX_GEOCODER_REFERER)"
  existing_fx_cron="$(env_get FX_FETCH_CRON)"
  existing_bak_cron="$(env_get BACKUP_CRON)"
  existing_image_tag="$(env_get PAYTRACKER_IMAGE_TAG)"
  existing_project="$(env_get COMPOSE_PROJECT_NAME)"
  if [[ -z "${existing_project}" ]]; then
    existing_project="$(prod_project_name)"
  fi

  local auth_url app_port app_host app_name currencies currency timezone
  local auth_secret pg_password pg_user pg_db public_files_url

  auth_url="$(prompt "Public app URL (https://your.domain)" "${existing_url:-http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000}")"
  [[ -n "${auth_url}" ]] || die "BETTER_AUTH_URL is required."
  public_files_url="$(prompt "Public files URL (keep files.* if the DB already has those links)" "${existing_s3_url:-${auth_url%/}/files}")"
  [[ -n "${public_files_url}" ]] || public_files_url="${auth_url%/}/files"

  app_host="$(prompt "Bind host (127.0.0.1 = nginx only; 0.0.0.0 = public)" "${existing_host:-127.0.0.1}")"
  app_port="$(prompt "Host port" "${existing_port:-3000}")"
  app_name="$(prompt "App display name" "${existing_app_name:-PayTracker}")"
  currencies="$(prompt "Currencies (comma-separated)" "${existing_currencies:-RUB,USD,EUR}")"
  currency="$(prompt "Default currency" "${existing_currency:-RUB}")"
  timezone="$(prompt "Default timezone" "${existing_tz:-UTC}")"
  pg_user="$(prompt "Postgres user" "${existing_pg_user:-paytracker}")"
  pg_db="$(prompt "Postgres database" "${existing_pg_db:-paytracker}")"
  prod_is_sql_ident "${pg_user}" || die "Postgres user must be letters, digits, and underscore."
  prod_is_sql_ident "${pg_db}" || die "Postgres database must be letters, digits, and underscore."

  if [[ -n "${existing_secret}" ]]; then
    auth_secret="$(prompt_secret "BETTER_AUTH_SECRET" "${existing_secret}")"
  else
    auth_secret="$(random_secret)"
    ok "Generated BETTER_AUTH_SECRET"
  fi

  if [[ -n "${existing_pg_pass}" ]]; then
    if confirm "Generate a new Postgres password? (keeps existing if No)"; then
      pg_password="$(random_password)"
      ok "Generated new POSTGRES_PASSWORD"
    else
      pg_password="${existing_pg_pass}"
    fi
  else
    pg_password="$(random_password)"
    ok "Generated POSTGRES_PASSWORD"
  fi

  if [[ -f "${ENV_FILE}" ]]; then
    cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
    chmod 600 "${ENV_FILE}.bak."* 2>/dev/null || true
    warn "Previous .env backed up."
  fi

  cat >"${ENV_FILE}" <<EOF
# Generated by scripts/deploy-ubuntu.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
APP_HOST=${app_host}
APP_PORT=${app_port}

POSTGRES_USER=${pg_user}
POSTGRES_PASSWORD=${pg_password}
POSTGRES_DB=${pg_db}
DATABASE_URL=postgresql://${pg_user}:${pg_password}@postgres:5432/${pg_db}

BETTER_AUTH_SECRET=${auth_secret}
BETTER_AUTH_URL=${auth_url}

DEFAULT_CURRENCIES=${currencies}
NEXT_PUBLIC_DEFAULT_CURRENCIES=${currencies}
DEFAULT_CURRENCY=${currency}
DEFAULT_TIMEZONE=${timezone}
NEXT_PUBLIC_APP_NAME=${app_name}

FX_PROVIDER=frankfurter
FX_API_BASE_URL=https://api.frankfurter.dev
FX_BACKFILL_DAYS=40
FX_FETCH_CRON=${existing_fx_cron:-0 2 * * *}
BACKUP_DIR=/backups
BACKUP_CRON=${existing_bak_cron:-0 3 * * *}
STORAGE_BACKEND=fs
STORAGE_DIR=/data/files
S3_PUBLIC_URL=${public_files_url}
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=${existing_yandex_js}
YANDEX_GEOCODER_API_KEY=${existing_yandex_geo}
YANDEX_GEOCODER_REFERER=${existing_yandex_referer}
AI_BASE_URL=${existing_ai_base:-https://api.artemox.com/v1}
AI_API_KEY=${existing_ai_key}
AI_MODEL_ID=${existing_ai_model:-gpt-5-nano}
AI_TIMEOUT_MS=${existing_ai_timeout:-120000}
PAYTRACKER_IMAGE_TAG=${existing_image_tag:-latest}
COMPOSE_PROJECT_NAME=${existing_project}
EOF

  chmod 600 "${ENV_FILE}" || true
  prod_ensure_backup_dir
  if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    chown "${SUDO_USER}:${SUDO_USER}" "${ENV_FILE}" "${ROOT}/backups" || true
  fi
  ok "Wrote ${ENV_FILE}"
  info "App will be reachable at ${auth_url} (host bind ${app_host}:${app_port})"
}

ensure_docker() {
  if ! docker_bin_present; then
    die "Docker not found. Run: sudo $0 install"
  fi
  if ! compose_available; then
    die "Docker Compose not found. Run: sudo $0 install"
  fi
  if ! docker_daemon_running; then
    if docker_permission_denied; then
      die "Cannot talk to Docker (permission denied). After install, log out and back in — or run: newgrp docker"
    fi
    if [[ "${EUID}" -eq 0 ]] && start_docker_daemon; then
      ok "Started Docker daemon."
    else
      die "Docker daemon is not running. Try: sudo systemctl start docker"
    fi
  fi
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    die "Missing ${COMPOSE_FILE}"
  fi
  refresh_compose_cmd
}

cmd_deploy() {
  ensure_docker
  [[ -f "${ENV_FILE}" ]] || die "Missing .env. Run: $0 configure"
  cd "${ROOT}"
  prod_ensure_backup_dir
  chmod_deploy_scripts
  ensure_env_defaults
  copy_minio_if_needed

  info "Building and starting production stack..."
  compose up -d --build --remove-orphans
  ok "Stack is up."
  sync_postgres_role_password
  install_host_jobs
  run_fx_once
  log ""
  compose ps
  log ""
  local url port
  url="$(env_get BETTER_AUTH_URL)"
  port="$(env_get APP_PORT)"
  info "Open: ${url:-http://SERVER:${port:-3000}}"
  info "Logs:  $0 logs"
  info "Status: $0 status"
}

cmd_light() {
  ensure_docker
  [[ -f "${ENV_FILE}" ]] || die "Missing .env. Run: $0 configure"
  cd "${ROOT}"
  git_pull_if_repo
  prod_ensure_backup_dir
  chmod_deploy_scripts
  ensure_env_defaults
  copy_minio_if_needed

  info "Pulling GHCR image (no build on this machine)..."
  if ! compose pull app; then
    die "Could not pull ghcr.io/nikitasobolev2/pay_tracker. Publish the package as Public, set GitHub Actions variables, then retry — or first-time build with: $0 deploy"
  fi
  compose up -d --no-build --remove-orphans
  ok "Stack is up from GHCR."
  sync_postgres_role_password
  install_host_jobs
  run_fx_once
  log ""
  compose ps
}

cmd_export() {
  ensure_docker
  chmod +x "${ROOT}/scripts/export-data.sh" || true
  "${ROOT}/scripts/export-data.sh" "$@"
}

cmd_import() {
  ensure_docker
  chmod +x "${ROOT}/scripts/import-data.sh" || true
  "${ROOT}/scripts/import-data.sh" "$@"
}

cmd_update() {
  ensure_docker
  cd "${ROOT}"
  git_pull_if_repo
  cmd_deploy
}

cmd_up() {
  ensure_docker
  compose up -d
  sync_postgres_role_password
  ok "Started."
  compose ps
}

cmd_down() {
  ensure_docker
  compose down
  ok "Stopped. Named volumes (postgres + files) were kept — data was not deleted."
}

cmd_status() {
  ensure_docker
  compose ps
  log ""
  info "Disk (backups):"
  du -sh "${ROOT}/backups" 2>/dev/null || log "(no backups yet)"
}

cmd_logs() {
  ensure_docker
  local service="${1:-app}"
  compose logs -f --tail=200 "${service}"
}

print_menu() {
  cat <<EOF

${BOLD}PayTracker deploy${RESET}  ${CYAN}(Ubuntu 22)${RESET}
  1) Install / verify Docker (skip if preinstalled)
  2) Configure .env
  3) Deploy / rebuild (on this machine)
  4) Redeploy (git pull + rebuild)
  5) Light redeploy (git pull + GHCR, no build)
  6) Start
  7) Stop
  8) Status
  9) Logs (app)
  e) Export data zip
  i) Import data zip
  h) Help
  0) Exit

EOF
}

cmd_menu() {
  while true; do
    print_menu
    local choice=""
    read -r -p "Select: " choice || true
    case "${choice}" in
      1) cmd_install ;;
      2) cmd_configure ;;
      3) cmd_deploy ;;
      4) cmd_update ;;
      5) cmd_light ;;
      6) cmd_up ;;
      7) cmd_down ;;
      8) cmd_status ;;
      9) cmd_logs app ;;
      e|E)
        local zip_path=""
        read -r -p "Zip path (empty = default under ./backups): " zip_path || true
        if [[ -n "${zip_path}" ]]; then
          cmd_export "${zip_path}"
        else
          cmd_export
        fi
        ;;
      i|I)
        local import_path=""
        read -r -p "Zip to import: " import_path || true
        cmd_import "${import_path}"
        ;;
      h|H|help) cmd_help ;;
      0|q|Q) ok "Bye."; exit 0 ;;
      *) warn "Unknown option: ${choice}" ;;
    esac
    log ""
    read -r -p "Press Enter to continue..." _ || true
  done
}

main() {
  cd "${ROOT}"
  local cmd="${1:-menu}"
  shift || true
  case "${cmd}" in
    install) cmd_install ;;
    configure|config) cmd_configure ;;
    deploy) cmd_deploy ;;
    update|redeploy|pull) cmd_update ;;
    light) cmd_light ;;
    export) cmd_export "$@" ;;
    import) cmd_import "$@" ;;
    up|start) cmd_up ;;
    down|stop) cmd_down ;;
    status|ps) cmd_status ;;
    logs) cmd_logs "${1:-app}" ;;
    menu) cmd_menu ;;
    help|-h|--help) cmd_help ;;
    *)
      err "Unknown command: ${cmd}"
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
