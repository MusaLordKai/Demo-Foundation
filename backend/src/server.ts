import { promises as fs } from "node:fs";
import { createApp } from "./http/app";
import { config } from "./lib/config";
import { prisma } from "./lib/prisma";

async function main() {
  await fs.mkdir(config.uploadDir, { recursive: true });
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
