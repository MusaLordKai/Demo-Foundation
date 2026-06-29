/**
 * Convenience launcher for environments WITHOUT Docker or a system Postgres.
 * Boots an ephemeral embedded PostgreSQL, applies migrations, seeds demo data,
 * then starts the API — all in one process. Not used by docker-compose (which
 * uses a real Postgres service); this is purely a local fallback.
 *
 *   npm run dev:standalone
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5432;
const DATA_DIR = "./.pgdata-dev";
const DATABASE_URL = `postgresql://postgres:password@localhost:${PORT}/caseproc?schema=public`;

async function main() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: "postgres",
    password: "password",
    persistent: false,
  });

  console.log("Starting embedded PostgreSQL…");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("caseproc");

  const env = { ...process.env, DATABASE_URL };
  console.log("Applying migrations…");
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  console.log("Seeding demo data…");
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

  // The server reads DATABASE_URL at import time — set it before importing.
  process.env.DATABASE_URL = DATABASE_URL;
  await import("../src/server");

  const stop = async () => {
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
