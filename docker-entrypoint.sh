#!/bin/sh
#
# Applies any pending database migrations, then starts the server.
#
# This replaces Railway's "Release Command". `prisma migrate deploy` is
# idempotent — it applies only migrations missing from the _prisma_migrations
# table — so it is safe on every boot, restart and redeploy. Because `set -e`
# aborts on failure, a container that cannot reach the database never starts
# serving: a bad DATABASE_URL fails the deploy instead of quietly going live
# with a broken app.
set -e

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
# exec so the server becomes PID 1 and receives Docker's SIGTERM directly,
# which lets Coolify stop and redeploy the container cleanly.
exec npm run start
