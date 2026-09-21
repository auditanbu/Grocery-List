#!/usr/bin/env bash
#
# Brings the whole app up from nothing and screenshots it — one command.
#
#   ./scripts/preview.sh                      # DB + dev server + screenshots
#   ./scripts/preview.sh /petrol:petrol       # only these screens
#   KEEP_RUNNING=1 ./scripts/preview.sh       # leave the dev server up
#
# Written for a throwaway dev box (a cloud coding session, a fresh laptop):
# every step is skipped if it has already been done, so re-running it after a
# code change just re-takes the screenshots.
#
# It refuses to touch anything but a local database — the seed below writes
# demo lists, which must never land in the Coolify one.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="${OUT_DIR:-./shots}"
DEV_LOG="${DEV_LOG:-/tmp/grocery-dev.log}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

say() { printf '\n==> %s\n' "$1"; }

# --- database ---------------------------------------------------------------
if [ ! -f .env ]; then
  say "Writing .env (local MySQL)"
  echo 'DATABASE_URL="mysql://root:root@127.0.0.1:3306/grocery"' > .env
fi

DB_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
case "$DB_URL" in
  *@127.0.0.1:*|*@localhost:*|*@mysql:*|*@db:*) ;;
  *) echo "Refusing to run: DATABASE_URL is not local ($DB_URL)." >&2; exit 1 ;;
esac

if ! mariadb -uroot -proot -e "SELECT 1" >/dev/null 2>&1; then
  say "Starting MariaDB"
  if ! command -v mariadbd >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y --no-install-recommends mariadb-server
  fi
  mkdir -p /run/mysqld && chown mysql:mysql /run/mysqld
  nohup mariadbd --user=mysql --bind-address=127.0.0.1 >/tmp/mariadb.log 2>&1 &
  for _ in $(seq 1 30); do
    mariadb -uroot -e "SELECT 1" >/dev/null 2>&1 && break
    sleep 1
  done
  mariadb -uroot -e "CREATE DATABASE IF NOT EXISTS grocery CHARACTER SET utf8mb4;
                     ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;"
fi

# --- app --------------------------------------------------------------------
if [ ! -d node_modules ]; then
  say "Installing dependencies"
  npm ci
fi

say "Applying migrations"
npx prisma migrate deploy

say "Seeding master data + demo lists"
SEED_DEMO=1 npm run db:seed

if ! curl -sf -o /dev/null "$BASE_URL/api/health"; then
  say "Starting the dev server ($DEV_LOG)"
  nohup npm run dev > "$DEV_LOG" 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$BASE_URL/api/health" && break
    sleep 2
  done
fi

curl -sf -o /dev/null "$BASE_URL/api/health" || {
  echo "Dev server never became healthy — see $DEV_LOG" >&2
  tail -20 "$DEV_LOG" >&2
  exit 1
}

# --- screenshots ------------------------------------------------------------
say "Screenshotting into $OUT_DIR"
BASE_URL="$BASE_URL" node scripts/screenshot.mjs "$OUT_DIR" "$@"

if [ -z "${KEEP_RUNNING:-}" ]; then
  say "Done. The dev server is still running — stop it with: pkill -f 'next dev'"
fi
