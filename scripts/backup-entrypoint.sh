#!/bin/sh
set -e
BACKUP_DIR="${BACKUP_DIR:-/backups}"
CRON="${BACKUP_CRON:-0 3 * * *}"
mkdir -p "$BACKUP_DIR"

# Seconds to wait until the next daily "M H * * *" occurrence (UTC).
# Falls back to 24h for any non-daily / non-numeric expression.
seconds_until_cron() {
  cron="$1"
  minute=$(echo "$cron" | awk '{print $1}')
  hour=$(echo "$cron" | awk '{print $2}')
  case "$minute" in ''|*[!0-9]*) echo 86400; return;; esac
  case "$hour" in ''|*[!0-9]*) echo 86400; return;; esac
  awk -v h="$hour" -v m="$minute" 'BEGIN {
    "date -u +%H:%M:%S" | getline now
    split(now, t, ":")
    now_sec = t[1] * 3600 + t[2] * 60 + t[3]
    target_sec = h * 3600 + m * 60
    delta = (target_sec - now_sec + 86400) % 86400
    if (delta == 0) delta = 86400
    print delta
  }'
}

run_backup() {
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  FILE="$BACKUP_DIR/paytracker-$STAMP.sql"
  echo "Creating backup $FILE"
  pg_dump -h postgres -U paytracker -d paytracker --no-owner --no-acl > "$FILE"
  SIZE=$(wc -c < "$FILE" | tr -d ' ')
  if [ "$SIZE" -lt 100 ]; then
    echo "Backup too small ($SIZE bytes) — discarding"
    rm -f "$FILE"
    return 1
  fi
  if ! grep -qE 'COPY public\."Transaction"|INSERT INTO' "$FILE"; then
    # Allow empty DB first boot: keep schema-only dumps if they contain CREATE TABLE
    if ! grep -q 'CREATE TABLE' "$FILE"; then
      echo "Backup validation failed — discarding"
      rm -f "$FILE"
      return 1
    fi
  fi
  # Keep max 2 backups
  ls -1t "$BACKUP_DIR"/paytracker-*.sql 2>/dev/null | tail -n +3 | while read -r old; do
    echo "Removing old backup $old"
    rm -f "$old"
  done
  echo "Backup complete: $FILE ($SIZE bytes)"
}

echo "Backup worker starting — initial backup"
run_backup || true
echo "Backup worker scheduling on cron: ${CRON}"
while true; do
  DELAY=$(seconds_until_cron "$CRON")
  echo "Backup worker sleeping ${DELAY}s until next run"
  sleep "$DELAY"
  run_backup || true
done
