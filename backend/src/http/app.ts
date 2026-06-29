import express from "express";
import cors from "cors";
import { config } from "../lib/config";
import { authRouter } from "./auth.routes";
import { applicationsRouter } from "./applications.routes";
import { grantsRouter } from "./grants.routes";
import { logsRouter } from "./logs.routes";
import { statsRouter } from "./stats.routes";
import { errorHandler } from "./errors";

/** Build the Express app (no network listen) so tests can mount it directly. */
export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api/grants", grantsRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/stats", statsRouter);

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } }));
  app.use(errorHandler);
  return app;
}
