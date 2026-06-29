import { PrismaClient } from "@prisma/client";
import { config } from "./config";

// A single shared Prisma client for the process. Tests import this too and
// point DATABASE_URL at an ephemeral embedded Postgres before it is constructed.
export const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
});
