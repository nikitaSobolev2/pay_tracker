#!/usr/bin/env bash
# PayTracker nginx + Let's Encrypt helper (Ubuntu).
# Puts HTTPS in front of the Docker app on localhost:APP_PORT.
#
# Usage:
#   sudo ./scripts/setup-nginx.sh           # interactive menu
#   sudo ./scripts/setup-nginx.sh setup
#   sudo ./scripts/setup-nginx.sh status
#   sudo ./scripts/setup-nginx.sh renew
#   ./scripts/setup-nginx.sh help
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
SITE_NAME="pay-tracker"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

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

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "This command needs root. Re-run with: sudo $0 $*"
  fi
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

confirm() {
  local label="${1:-Continue?}"
  local answer=""
  read -r -p "${label} [Y/n]: " answer || true
  [[ -z "${answer}" || "${answer}" =~ ^[Yy]$ ]]
}

env_get() {
  local key="$1"
  [[ -f "${ENV_FILE}" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 || true)"
  [[ -n "${line}" ]] || return 0
  printf '%s' "${line#*=}"
}

default_domain_from_env() {
  local url
  url="$(env_get BETTER_AUTH_URL)"
  [[ -n "${url}" ]] || return 0
  # Strip scheme and path: https://pay-tracker.site/foo -> pay-tracker.site
  url="${url#http://}"
  url="${url#https://}"
  url="${url%%/*}"
  url="${url%%:*}"
  printf '%s' "${url}"
}

cmd_help() {
  cat <<EOF
${BOLD}PayTracker nginx + TLS setup${RESET}

${CYAN}Commands${RESET}
  setup     Install nginx/certbot, write site config, issue certificate
  status    Show nginx + certificate status
  renew     Renew Let's Encrypt certificates now
  menu      Interactive menu (default)
  help      Show this help

${CYAN}Typical run${RESET}
  sudo ./scripts/setup-nginx.sh setup

Proxies ${BOLD}pay-tracker.site${RESET} (port 80/443) → ${BOLD}127.0.0.1:APP_PORT${RESET} (default 3000).
After TLS works, set BETTER_AUTH_URL=https://your.domain and redeploy the app.
EOF
}

install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  info "Installing nginx, certbot..."
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx
  systemctl enable --now nginx
  ok "Packages ready."
}

write_nginx_config() {
  local domain="$1"
  local with_www="$2"
  local app_port="$3"
  local server_names="${domain}"

  if [[ "${with_www}" == "1" ]]; then
    server_names="${domain} www.${domain}"
  fi

  info "Writing ${NGINX_AVAILABLE}..."
  cat >"${NGINX_AVAILABLE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};

    location / {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  ok "nginx config active (HTTP → 127.0.0.1:${app_port})."
}

open_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    warn "ufw not installed — skip firewall rules."
    return 0
  fi
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  if ufw status 2>/dev/null | grep -qi inactive; then
    warn "ufw is inactive. Enable with: sudo ufw enable"
  else
    ok "ufw allows 22/80/443."
  fi
}

issue_certificate() {
  local domain="$1"
  local with_www="$2"
  local email="$3"
  local args=(-d "${domain}")

  if [[ "${with_www}" == "1" ]]; then
    args+=(-d "www.${domain}")
  fi

  info "Requesting Let's Encrypt certificate..."
  if [[ -n "${email}" ]]; then
    certbot --nginx --non-interactive --agree-tos --redirect \
      --email "${email}" "${args[@]}"
  else
    certbot --nginx --non-interactive --agree-tos --redirect \
      --register-unsafely-without-email "${args[@]}"
  fi
  ok "TLS certificate installed."
}

cmd_setup() {
  need_root setup
  log ""
  info "Nginx reverse proxy + Let's Encrypt"
  log ""

  local domain app_port email with_www=0
  local default_domain default_port

  default_domain="$(default_domain_from_env)"
  default_port="$(env_get APP_PORT)"
  default_port="${default_port:-3000}"

  domain="$(prompt "Domain (no https://)" "${default_domain:-pay-tracker.site}")"
  [[ -n "${domain}" ]] || die "Domain is required."
  domain="${domain#http://}"
  domain="${domain#https://}"
  domain="${domain%%/*}"
  domain="${domain%%:*}"

  if confirm "Also serve www.${domain}?"; then
    with_www=1
  fi

  app_port="$(prompt "App port (Docker published port)" "${default_port}")"
  [[ "${app_port}" =~ ^[0-9]+$ ]] || die "App port must be a number."

  email="$(prompt "Let's Encrypt email (Enter to skip)" "")"

  log ""
  info "Will configure:"
  log "  domain:  ${domain}$([[ "${with_www}" == "1" ]] && printf ' + www.%s' "${domain}")"
  log "  proxy:   https://${domain} → http://127.0.0.1:${app_port}"
  log "  email:   ${email:-"(none)"}"
  log ""
  confirm "Proceed?" || die "Cancelled."

  install_packages
  write_nginx_config "${domain}" "${with_www}" "${app_port}"
  open_firewall
  issue_certificate "${domain}" "${with_www}" "${email}"

  log ""
  ok "Done. Site should be available at https://${domain}"
  warn "Set BETTER_AUTH_URL=https://${domain} in ${ENV_FILE} (or re-run configure),"
  warn "then: ./scripts/deploy-ubuntu.sh redeploy"
  info "Status: sudo $0 status"
}

cmd_status() {
  need_root status
  if systemctl is-active --quiet nginx; then
    ok "nginx: active"
  else
    warn "nginx: not active"
  fi

  if [[ -f "${NGINX_AVAILABLE}" ]]; then
    ok "site config: ${NGINX_AVAILABLE}"
    grep -E 'server_name|proxy_pass|listen' "${NGINX_AVAILABLE}" | sed 's/^/  /' || true
  else
    warn "site config missing: ${NGINX_AVAILABLE}"
  fi

  if command -v certbot >/dev/null 2>&1; then
    log ""
    info "Certificates:"
    certbot certificates 2>/dev/null || warn "No certificates found."
  fi
}

cmd_renew() {
  need_root renew
  certbot renew --nginx
  systemctl reload nginx
  ok "Renewal attempt finished."
}

print_menu() {
  cat <<EOF

${BOLD}PayTracker nginx / TLS${RESET}
  1) Setup (install nginx + certificate)
  2) Status
  3) Renew certificates
  4) Help
  0) Exit

EOF
}

cmd_menu() {
  while true; do
    print_menu
    local choice=""
    read -r -p "Select [0-4]: " choice || true
    case "${choice}" in
      1) cmd_setup ;;
      2) cmd_status ;;
      3) cmd_renew ;;
      4) cmd_help ;;
      0|q|Q) ok "Bye."; exit 0 ;;
      *) warn "Unknown option: ${choice}" ;;
    esac
    log ""
    read -r -p "Press Enter to continue..." _ || true
  done
}

main() {
  local cmd="${1:-menu}"
  shift || true
  case "${cmd}" in
    setup|install) cmd_setup ;;
    status) cmd_status ;;
    renew) cmd_renew ;;
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
