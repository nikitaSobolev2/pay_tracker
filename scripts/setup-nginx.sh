#!/usr/bin/env bash
# PayTracker nginx + Let's Encrypt helper (Ubuntu).
# Puts HTTPS in front of the Docker app on localhost:APP_PORT.
#
# Usage:
#   sudo ./scripts/setup-nginx.sh           # interactive menu
#   sudo ./scripts/setup-nginx.sh setup
#   sudo ./scripts/setup-nginx.sh files
#   sudo ./scripts/setup-nginx.sh status
#   sudo ./scripts/setup-nginx.sh renew
#   ./scripts/setup-nginx.sh help
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
SITE_NAME="pay-tracker"
FILES_SITE_NAME="pay-tracker-files"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
FILES_NGINX_AVAILABLE="/etc/nginx/sites-available/${FILES_SITE_NAME}"
FILES_NGINX_ENABLED="/etc/nginx/sites-enabled/${FILES_SITE_NAME}"

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

host_from_url() {
  local url="${1:-}"
  [[ -n "${url}" ]] || return 0
  url="${url#http://}"
  url="${url#https://}"
  url="${url%%/*}"
  url="${url%%:*}"
  printf '%s' "${url}"
}

path_from_url() {
  local url="${1:-}"
  local rest=""
  [[ -n "${url}" ]] || return 0
  url="${url#http://}"
  url="${url#https://}"
  rest="${url#*/}"
  if [[ "${rest}" == "${url}" ]]; then
    printf ''
    return 0
  fi
  rest="${rest%%\?*}"
  rest="${rest%%\#*}"
  while [[ "${rest}" == */ ]]; do
    rest="${rest%/}"
  done
  [[ -n "${rest}" ]] || return 0
  printf '/%s' "${rest}"
}

default_domain_from_env() {
  host_from_url "$(env_get BETTER_AUTH_URL)"
}

is_dns_hostname() {
  [[ "${1:-}" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$ ]]
}

is_safe_location_prefix() {
  [[ "${1:-}" =~ ^/[A-Za-z0-9._-]+$ ]]
}

cmd_help() {
  cat <<EOF
${BOLD}PayTracker nginx + TLS setup${RESET}

${CYAN}Commands${RESET}
  setup     Install nginx/certbot, write site config, issue certificate
  files     Proxy an existing files.* subdomain to the app /files route
  status    Show nginx + certificate status
  renew     Renew Let's Encrypt certificates now
  menu      Interactive menu (default)
  help      Show this help

${CYAN}Typical run${RESET}
  sudo ./scripts/setup-nginx.sh setup

Proxies your app domain (port 80/443) → 127.0.0.1:APP_PORT (default 3000).
After TLS works, set BETTER_AUTH_URL=https://your.domain and redeploy the app.

${CYAN}files.* subdomain${RESET}
Only needed when the database already stores cover URLs on a separate host
(e.g. https://files.pay-tracker.site/paytracker/...). New installs serve
uploads at https://your.domain/files and do not need this.

  sudo ./scripts/setup-nginx.sh files
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

ensure_limit_zone() {
  cat >"/etc/nginx/conf.d/paytracker-limits.conf" <<'EOF'
limit_conn_zone $binary_remote_addr zone=pt_conn:10m;
EOF
}

write_nginx_config() {
  local domain="$1"
  local with_www="$2"
  local app_port="$3"
  local server_names="${domain}"

  if [[ "${with_www}" == "1" ]]; then
    server_names="${domain} www.${domain}"
  fi

  # Abuse guard only. Home networks share a single NAT address across every
  # device, and an idle keep-alive connection holds its slot for the full
  # keepalive_timeout, so a low cap locks out ordinary visitors.
  ensure_limit_zone

  info "Writing ${NGINX_AVAILABLE}..."
  cat >"${NGINX_AVAILABLE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_names};

    location / {
        limit_conn pt_conn 100;
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        # Do not force Connection: upgrade on normal requests (Safari/HTTP keep-alive footgun).
    }
}
EOF

  ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  ok "nginx config active (HTTP → 127.0.0.1:${app_port})."
}

write_files_nginx_config() {
  local files_domain="$1"
  local location_prefix="$2"
  local app_port="$3"

  ensure_limit_zone

  info "Writing ${FILES_NGINX_AVAILABLE}..."
  cat >"${FILES_NGINX_AVAILABLE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${files_domain};

    location ${location_prefix}/travels/tickets/ {
        return 404;
    }

    location ${location_prefix}/ {
        limit_conn pt_conn 100;
        proxy_pass http://127.0.0.1:${app_port}/files/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

  ln -sf "${FILES_NGINX_AVAILABLE}" "${FILES_NGINX_ENABLED}"
  nginx -t
  systemctl reload nginx
  ok "files vhost active (${files_domain}${location_prefix}/ → 127.0.0.1:${app_port}/files/)."
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
  ok "TLS certificate installed for ${domain}."
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
  is_dns_hostname "${domain}" || die "Domain must be a hostname (e.g. pay-tracker.site)."

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

  maybe_offer_files_vhost "${domain}" "${app_port}" "${email}"
}

maybe_offer_files_vhost() {
  local app_domain="$1"
  local app_port="$2"
  local email="$3"
  local s3_url s3_host s3_path

  s3_url="$(env_get S3_PUBLIC_URL)"
  s3_host="$(host_from_url "${s3_url}")"
  s3_path="$(path_from_url "${s3_url}")"

  [[ -n "${s3_host}" ]] || return 0
  if [[ "${s3_host}" == "${app_domain}" || "${s3_host}" == "www.${app_domain}" ]]; then
    return 0
  fi
  [[ -n "${s3_path}" ]] || return 0
  is_dns_hostname "${s3_host}" || return 0
  is_safe_location_prefix "${s3_path}" || return 0

  log ""
  info "S3_PUBLIC_URL points at ${s3_host}${s3_path} (not ${app_domain})."
  if confirm "Also proxy that files host so existing cover URLs keep working?"; then
    apply_files_vhost "${s3_host}" "${s3_path}" "${app_port}" "${email}"
  fi
}

apply_files_vhost() {
  local files_domain="$1"
  local location_prefix="$2"
  local app_port="$3"
  local email="$4"

  write_files_nginx_config "${files_domain}" "${location_prefix}" "${app_port}"
  open_firewall
  issue_certificate "${files_domain}" "0" "${email}"
  warn "Disable any leftover MinIO nginx site for ${files_domain}."
  warn "Keep S3_PUBLIC_URL as https://${files_domain}${location_prefix}"
}

cmd_files() {
  need_root files
  log ""
  info "Legacy files.* subdomain → app /files"
  log ""

  local s3_url app_url files_domain location_prefix app_port email
  local default_port app_host

  s3_url="$(env_get S3_PUBLIC_URL)"
  app_url="$(env_get BETTER_AUTH_URL)"
  app_host="$(host_from_url "${app_url}")"
  default_port="$(env_get APP_PORT)"
  default_port="${default_port:-3000}"

  files_domain="$(prompt "Files hostname" "$(host_from_url "${s3_url}")")"
  [[ -n "${files_domain}" ]] || die "Files hostname is required."
  files_domain="${files_domain#http://}"
  files_domain="${files_domain#https://}"
  files_domain="${files_domain%%/*}"
  files_domain="${files_domain%%:*}"
  is_dns_hostname "${files_domain}" || die "Files hostname must be a DNS name (e.g. files.pay-tracker.site)."

  if [[ -n "${app_host}" && "${files_domain}" == "${app_host}" ]]; then
    ok "Files host is the app host — uploads are already at ${app_url%/}/files."
    ok "No separate files vhost needed."
    return 0
  fi

  location_prefix="$(prompt "URL path prefix (MinIO bucket path)" "$(path_from_url "${s3_url}")")"
  location_prefix="${location_prefix%/}"
  [[ "${location_prefix}" == /* ]] || location_prefix="/${location_prefix}"
  [[ -n "${location_prefix}" && "${location_prefix}" != "/" ]] || die "Path prefix is required (e.g. /paytracker)."
  is_safe_location_prefix "${location_prefix}" || die "Path prefix must look like /paytracker."

  app_port="$(prompt "App port (Docker published port)" "${default_port}")"
  [[ "${app_port}" =~ ^[0-9]+$ ]] || die "App port must be a number."

  email="$(prompt "Let's Encrypt email (Enter to skip)" "")"

  log ""
  info "Will configure:"
  log "  ${files_domain}${location_prefix}/ → http://127.0.0.1:${app_port}/files/"
  log "  ${files_domain}${location_prefix}/travels/tickets/ → 404 (tickets stay on the app)"
  log ""
  warn "Point DNS for ${files_domain} at this VPS before requesting a certificate."
  confirm "Proceed?" || die "Cancelled."

  install_packages
  apply_files_vhost "${files_domain}" "${location_prefix}" "${app_port}" "${email}"

  log ""
  ok "Done. Existing URLs under https://${files_domain}${location_prefix}/ should resolve."
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

  if [[ -f "${FILES_NGINX_AVAILABLE}" ]]; then
    log ""
    ok "files config: ${FILES_NGINX_AVAILABLE}"
    grep -E 'server_name|proxy_pass|listen|return 404' "${FILES_NGINX_AVAILABLE}" | sed 's/^/  /' || true
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
  2) Files subdomain (legacy MinIO URLs)
  3) Status
  4) Renew certificates
  5) Help
  0) Exit

EOF
}

cmd_menu() {
  while true; do
    print_menu
    local choice=""
    read -r -p "Select [0-5]: " choice || true
    case "${choice}" in
      1) cmd_setup ;;
      2) cmd_files ;;
      3) cmd_status ;;
      4) cmd_renew ;;
      5) cmd_help ;;
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
    files) cmd_files ;;
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
