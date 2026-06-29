import path from "node:path";
import { Router } from "express";
import { requireAuth, requireRole } from "./middleware";
import { asyncHandler, unprocessable } from "./errors";
import { actionSchema, applicationInputSchema, applicationUpdateSchema, parse } from "../lib/validation";
import { STATUSES, type Action, type Status } from "../domain/transitions";
import {
  createApplication,
  getApplication,
  getAttachmentMeta,
  listApplications,
  performCaseAction,
  setAttachment,
  updateApplication,
} from "../services/applicationService";
import { attachmentPath, uploadSingle } from "../upload";

export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

// Create a draft — applicants only (no transition guard applies to creation).
applicationsRouter.post(
  "/",
  requireRole("APPLICANT"),
  asyncHandler(async (req, res) => {
    const input = parse(applicationInputSchema, req.body);
    const app = await createApplication(req.user!, input);
    res.status(201).json(app);
  }),
);

// List — applicants see their own; reviewers see the queue (or filter by status).
applicationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const raw = req.query.status;
    let status: Status | undefined;
    if (typeof raw === "string" && raw.length > 0) {
      if (!(STATUSES as readonly string[]).includes(raw)) {
        throw unprocessable(`Invalid status filter. One of: ${STATUSES.join(", ")}.`);
      }
      status = raw as Status;
    }
    res.json(await listApplications(req.user!, { status }));
  }),
);

applicationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getApplication(req.params.id, req.user!));
  }),
);

// Edit a draft — owner-only, DRAFT-only (enforced in the service).
applicationsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(applicationUpdateSchema, req.body);
    res.json(await updateApplication(req.params.id, req.user!, input));
  }),
);

// Workflow actions — all authorization + legality flows through performCaseAction,
// which uses the single pure step engine. No role gating here on purpose: the
// engine yields the correct 403/409/422 (and visibility 404) per the precedence.
const ACTION_PATHS: ReadonlyArray<Action> = ["submit", "advance", "return", "reject"];
for (const action of ACTION_PATHS) {
  applicationsRouter.post(
    `/:id/${action}`,
    asyncHandler(async (req, res) => {
      const { comment } = parse(actionSchema, req.body ?? {});
      res.json(await performCaseAction(req.params.id, action, req.user!, comment));
    }),
  );
}

// Upload/replace the single attachment — owner-only, DRAFT-only.
applicationsRouter.post(
  "/:id/attachment",
  uploadSingle,
  asyncHandler(async (req, res) => {
    if (!req.file) throw unprocessable("A file is required (form field 'file').");
    res.json(await setAttachment(req.params.id, req.user!, req.file));
  }),
);

// Download the attachment — gated by visibility (applicants: own rows only).
applicationsRouter.get(
  "/:id/attachment",
  asyncHandler(async (req, res) => {
    const meta = await getAttachmentMeta(req.params.id, req.user!);
    res.download(path.resolve(attachmentPath(meta.storedName)), meta.filename);
  }),
);
