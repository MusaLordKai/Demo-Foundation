import { Router } from "express";
import { requireAuth, requireRole } from "./middleware";
import { asyncHandler, unprocessable } from "./errors";
import { listLogs } from "../services/logService";
import type { LogCategory } from "@prisma/client";

export const logsRouter = Router();

// Logs are an operations view — reviewers only.
logsRouter.use(requireAuth, requireRole("REVIEWER"));

logsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rawCat = req.query.category;
    let category: LogCategory | undefined;
    if (typeof rawCat === "string" && rawCat.length > 0) {
      if (rawCat !== "SYSTEM" && rawCat !== "CASE") throw unprocessable("Invalid log category.");
      category = rawCat;
    }
    const caseNumber =
      typeof req.query.caseNumber === "string" && req.query.caseNumber.trim()
        ? req.query.caseNumber.trim()
        : undefined;
    res.json(await listLogs({ category, caseNumber }));
  }),
);
