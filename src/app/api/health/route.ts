import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness probe for Coolify's container health check.
 *
 * Deliberately returns 200 even when the database is unreachable. A failing
 * health check makes Coolify restart the container, and restarting the app
 * cannot fix MySQL — it would just loop while the database recovers on its
 * own. The deploy gate lives elsewhere: `prisma migrate deploy` in
 * docker-entrypoint.sh refuses to start a container that cannot reach the
 * database, so a broken DATABASE_URL never goes live in the first place.
 *
 * `database` is still reported in the body, so a connection problem on a
 * running container is visible at a glance without opening the logs.
 */
export async function GET(): Promise<Response> {
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  return Response.json({
    status: "ok",
    database,
    uptimeSeconds: Math.round(process.uptime()),
  });
}
