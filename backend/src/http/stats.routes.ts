import { Router } from "express";
import { requireAuth, requireRole } from "./middleware";
import { asyncHandler } from "./errors";
import { getReviewerStats } from "../services/statsService";

export const statsRouter = Router();

// Dashboard statistics — reviewers only.
statsRouter.use(requireAuth, requireRole("REVIEWER"));

statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getReviewerStats());
  }),
);
