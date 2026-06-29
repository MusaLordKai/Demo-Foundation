#!/bin/sh
set -e

echo "Applying database migrations…"
npx prisma migrate deploy

if [ "${SEED_ON_START}" = "true" ]; then
  echo "Seeding demo data (idempotent)…"
  node dist/prisma/seed.js
fi

echo "Starting API…"
exec node dist/src/server.js
