#!/bin/sh
set -e

CRON="${FX_FETCH_CRON:-0 2 * * *}"

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

# Ensure the schema exists before the first fetch. `migrate deploy` uses an
# advisory lock, so running it alongside the app container is safe.
echo "FX worker: applying migrations"
npx prisma migrate deploy || echo "migrate deploy failed (will still try to fetch)"

echo "FX worker starting — initial fetch"
npx tsx scripts/fetch-exchange-rates.ts || echo "Initial FX fetch failed (will retry on schedule)"

echo "FX worker scheduling on cron: ${CRON}"
while true; do
  DELAY=$(seconds_until_cron "$CRON")
  echo "FX worker sleeping ${DELAY}s until next run"
  sleep "$DELAY"
  echo "FX worker tick"
  npx tsx scripts/fetch-exchange-rates.ts || echo "FX fetch failed"
done
