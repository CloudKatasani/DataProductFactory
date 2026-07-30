import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma instance. Next.js dev-mode hot reload re-evaluates modules on
 * every edit, so without this the process accumulates one connection pool per
 * reload until SQLite starts refusing to open the file.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
