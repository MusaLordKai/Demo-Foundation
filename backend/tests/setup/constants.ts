// Fixed connection details for the ephemeral embedded Postgres used in tests.
// Both the global setup (which boots the cluster) and the vitest `env` (which
// the per-worker Prisma client reads) reference these, so they always agree.
export const TEST_PORT = 5433;
export const TEST_DATABASE_URL = `postgresql://postgres:password@localhost:${TEST_PORT}/caseproc_test?schema=public`;
