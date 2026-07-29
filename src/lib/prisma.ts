import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One client (and therefore one connection pool) per process. In dev the
 * module graph is re-evaluated on every hot reload, so the instance is
 * cached on globalThis to avoid exhausting MySQL connections.
 *
 * Built lazily behind a Proxy: `next build` imports every route module
 * (even fully dynamic ones) while collecting page data, and that must
 * succeed even when DATABASE_URL isn't available at build time — only
 * an actual query at request time needs it.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.");
  }
  return new PrismaClient({
    adapter: new PrismaMariaDb(connectionString),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
