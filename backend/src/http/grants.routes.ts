import path from "node:path";
import { Router } from "express";
import { requireAuth, requireRole } from "./middleware";
import { asyncHandler, unprocessable } from "./errors";
import { createGrantSchema, grantInputSchema, parse, workflowStepsSchema } from "../lib/validation";
import {
  addDocument,
  createGrant,
  getDocumentMeta,
  getGrant,
  listGrants,
  setWorkflowSteps,
  updateGrant,
} from "../services/grantService";
import { attachmentPath, uploadSingle } from "../upload";

export const grantsRouter = Router();

grantsRouter.use(requireAuth);

// List — reviewers see all grants; applicants see only those open to apply.
grantsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listGrants(req.user!));
  }),
);

// Detail — any authenticated user (applicants browse before applying).
grantsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getGrant(req.params.id));
  }),
);

// Create a grant (with optional initial workflow steps) — reviewers only.
grantsRouter.post(
  "/",
  requireRole("REVIEWER"),
  asyncHandler(async (req, res) => {
    const { steps, ...fields } = parse(createGrantSchema, req.body);
    res.status(201).json(await createGrant(req.user!, fields, steps));
  }),
);

grantsRouter.put(
  "/:id",
  requireRole("REVIEWER"),
  asyncHandler(async (req, res) => {
    res.json(await updateGrant(req.params.id, parse(grantInputSchema, req.body)));
  }),
);

// Replace the ordered workflow steps (add / remove / reorder in one call).
grantsRouter.put(
  "/:id/workflow",
  requireRole("REVIEWER"),
  asyncHandler(async (req, res) => {
    const { steps } = parse(workflowStepsSchema, req.body);
    res.json(await setWorkflowSteps(req.params.id, steps));
  }),
);

// Upload a readable document to a grant — reviewers only.
grantsRouter.post(
  "/:id/documents",
  requireRole("REVIEWER"),
  uploadSingle,
  asyncHandler(async (req, res) => {
    if (!req.file) throw unprocessable("A file is required (form field 'file').");
    res.json(await addDocument(req.params.id, req.file));
  }),
);

// Download a grant document — any authenticated user (so people can read them).
grantsRouter.get(
  "/:id/documents/:docId",
  asyncHandler(async (req, res) => {
    const meta = await getDocumentMeta(req.params.id, req.params.docId);
    res.download(path.resolve(attachmentPath(meta.storedName)), meta.filename);
  }),
);
