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
  if compose_plugin_present; then
    COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
  elif compose_standalone_present; then
    COMPOSE=(docker-compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
  else
    COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
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

cmd_help() {
  cat <<EOF
${BOLD}PayTracker Ubuntu 22 production deploy${RESET}

${CYAN}Commands${RESET}
  install     Detect preinstalled Docker, or install Engine + Compose if missing
  configure   Interactive .env setup (secrets, URL, port, currencies)
  deploy      Build images and start the full stack (migrate on boot)
  update      git pull (if repo) + rebuild & restart
  redeploy    Same as update (git pull + redeploy)
  up          Start existing containers
  down        Stop containers
  status      Container status + recent health
  logs        Follow app logs (Ctrl+C to exit)
  menu        Interactive menu (default)
  help        Show this help

${CYAN}Typical first run${RESET}
  sudo ./scripts/deploy-ubuntu.sh install   # skips Docker if already present
  ./scripts/deploy-ubuntu.sh configure
  ./scripts/deploy-ubuntu.sh deploy

${CYAN}After code changes${RESET}
  ./scripts/deploy-ubuntu.sh redeploy

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
  apt-get install -y ca-certificates curl gnupg lsb-release openssl

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
  if [[ -n "${deploy_user}" && "${deploy_user}" != "root" ]]; then
    chown -R "${deploy_user}:${deploy_user}" "${ROOT}/backups" || true
  fi

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

  local auth_url app_port app_host app_name currencies currency timezone
  local auth_secret pg_password pg_user pg_db

  auth_url="$(prompt "Public app URL (https://your.domain)" "${existing_url:-http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000}")"
  [[ -n "${auth_url}" ]] || die "BETTER_AUTH_URL is required."

  app_host="$(prompt "Bind host (0.0.0.0 = all interfaces)" "${existing_host:-0.0.0.0}")"
  app_port="$(prompt "Host port" "${existing_port:-3000}")"
  app_name="$(prompt "App display name" "${existing_app_name:-PayTracker}")"
  currencies="$(prompt "Currencies (comma-separated)" "${existing_currencies:-RUB,USD,EUR}")"
  currency="$(prompt "Default currency" "${existing_currency:-RUB}")"
  timezone="$(prompt "Default timezone" "${existing_tz:-UTC}")"
  pg_user="$(prompt "Postgres user" "${existing_pg_user:-paytracker}")"
  pg_db="$(prompt "Postgres database" "${existing_pg_db:-paytracker}")"

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
FX_FETCH_CRON=0 2 * * *
BACKUP_DIR=/backups
BACKUP_CRON=0 3 * * *
EOF

  chmod 600 "${ENV_FILE}" || true
  mkdir -p "${ROOT}/backups"
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
  mkdir -p "${ROOT}/backups"

  info "Building and starting production stack..."
  compose up -d --build
  ok "Stack is up."
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

cmd_update() {
  ensure_docker
  cd "${ROOT}"
  if [[ -d "${ROOT}/.git" ]]; then
    info "Pulling latest git changes..."
    if [[ "${EUID}" -eq 0 && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
      run_as_deploy_user git -C "${ROOT}" pull --ff-only
    else
      git -C "${ROOT}" pull --ff-only
    fi
  else
    warn "Not a git checkout; rebuilding current tree only."
  fi
  cmd_deploy
}

cmd_up() {
  ensure_docker
  compose up -d
  ok "Started."
  compose ps
}

cmd_down() {
  ensure_docker
  compose down
  ok "Stopped."
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
  3) Deploy / rebuild
  4) Redeploy (git pull + rebuild)
  5) Start
  6) Stop
  7) Status
  8) Logs (app)
  9) Help
  0) Exit

EOF
}

cmd_menu() {
  while true; do
    print_menu
    local choice=""
    read -r -p "Select [0-9]: " choice || true
    case "${choice}" in
      1) cmd_install ;;
      2) cmd_configure ;;
      3) cmd_deploy ;;
      4) cmd_update ;;
      5) cmd_up ;;
      6) cmd_down ;;
      7) cmd_status ;;
      8) cmd_logs app ;;
      9) cmd_help ;;
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
