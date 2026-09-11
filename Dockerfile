# Production image for Coolify (or any Docker host).
#
# Deliberately NOT using Next's `output: "standalone"`. Standalone prunes
# node_modules down to what the server traces, which drops two things this
# app genuinely needs on the box:
#
#   * the `prisma` CLI, used by docker-entrypoint.sh to apply migrations on
#     every boot (Railway did this with a Release Command; Coolify has no
#     direct equivalent, so the container does it itself);
#   * `tsx`, so `npm run db:import -- "./Grocery database.csv"` and
#     `npm run db:seed` can be run from Coolify's terminal against the live
#     database when the master spreadsheet changes.
#
# The image is ~1 GB rather than ~250 MB. It is built on the host that runs
# it and never pulled over a network, so the size costs disk, not deploy time.
#
# Alpine is safe here: Prisma 7 talks to MySQL through the pure-JS
# @prisma/adapter-mariadb driver adapter, so there is no native query engine
# binary to mismatch against musl.

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy the manifests and Prisma schema before the rest of the source: this
# layer is cached until dependencies actually change, and `npm ci` triggers
# the `postinstall: prisma generate` hook, which needs the schema present.
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# `prisma generate` runs again here via the build script. It never connects to
# the database, and src/lib/prisma.ts builds its client lazily behind a Proxy,
# so the whole build works with no DATABASE_URL available.
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# curl is what the container health check uses.
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# The generated Prisma client lives in src/generated/prisma and is gitignored,
# so it only exists as a build artifact — copying the built tree wholesale
# keeps it, along with node_modules, .next, public and the migrations.
COPY --from=builder --chown=node:node /app ./

COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
