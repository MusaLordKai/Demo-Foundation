import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import { TEST_DATABASE_URL, TEST_PORT } from "./constants";

// Boots a real, throwaway PostgreSQL cluster for the integration suite — no
// Docker or system Postgres required. Schema is applied via the same Prisma
// migrations used in production, then the cluster is torn down (and deleted).
const DATA_DIR = "./.pgdata-test";
let pg: EmbeddedPostgres | undefined;

export async function setup() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: TEST_PORT,
    user: "postgres",
    password: "password",
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("caseproc_test");

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}

export async function teardown() {
  if (pg) await pg.stop();
  rmSync(DATA_DIR, { recursive: true, force: true });
}
