import { Prisma, CaseStatus as PrismaCaseStatus, Role as PrismaRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { evaluateCaseAction, type Action, type Status, type Role } from "../domain/transitions";
import type { AuthUser } from "../lib/auth";
import type { ApplicationInput, ApplicationUpdate } from "../lib/validation";
import { conflict, forbidden, notFound, transitionError, unprocessable } from "../http/errors";
import { deleteAttachment, persistAttachment, sniffMime } from "../upload";
import { config } from "../lib/config";
import { generateCaseNumber } from "../lib/caseNumber";
import { isGrantOpen } from "./grantService";
import { notifyCaseEvent } from "./notificationService";

// --- Compile-time drift guards: domain unions must equal the Prisma enums. ---
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _statusDrift: AssertEqual<Status, PrismaCaseStatus> = true;
const _roleDrift: AssertEqual<Role, PrismaRole> = true;
void _statusDrift;
void _roleDrift;

const listInclude = {
  owner: true,
  reviewer: true,
  grant: true,
  currentStep: true,
  logs: { orderBy: { createdAt: "desc" }, take: 1 }, // last action → folder derivation
} satisfies Prisma.ApplicationInclude;

const detailInclude = {
  owner: true,
  reviewer: true,
  grant: { include: { steps: { orderBy: { position: "asc" } } } },
  currentStep: true,
  logs: { where: { category: "CASE" }, include: { actor: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ApplicationInclude;

type ListApp = Prisma.ApplicationGetPayload<{ include: typeof listInclude }>;
type DetailApp = Prisma.ApplicationGetPayload<{ include: typeof detailInclude }>;

function person(u: { id: string; name: string; email: string } | null) {
  return u ? { id: u.id, name: u.name, email: u.email } : null;
}

// Every case maps to exactly one applicant-facing folder, derived from its
// status, workflow position, and the last action taken. These mirror the
// assignment's state machine: SUBMITTED = just submitted (step 0), UNDER_REVIEW
// = advanced past step 0; REVERTED = a DRAFT that a reviewer sent back.
export type Folder = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVERTED" | "APPROVED" | "REJECTED";

function deriveFolder(status: Status, pos: number | null, lastAction: string | null): Folder {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "DRAFT") return lastAction === "return" ? "REVERTED" : "DRAFT";
  return (pos ?? 0) === 0 ? "SUBMITTED" : "UNDER_REVIEW"; // IN_REVIEW @ step 0 = just submitted
}

function serializeBase(app: ListApp, lastAction: string | null) {
  return {
    id: app.id,
    caseNumber: app.caseNumber,
    folder: deriveFolder(app.status, app.currentStep?.position ?? null, lastAction),
    title: app.title,
    category: app.category,
    description: app.description,
    amount: app.amount.toString(),
    needBy: app.needBy.toISOString().slice(0, 10),
    status: app.status,
    grantId: app.grantId,
    grant: app.grant
      ? {
          id: app.grant.id,
          name: app.grant.name,
          shortCode: app.grant.shortCode,
          category: app.grant.category,
          fundsAllocated: app.grant.fundsAllocated.toString(),
          openUntil: app.grant.openUntil.toISOString().slice(0, 10),
          status: app.grant.status,
        }
      : null,
    currentStep: app.currentStep
      ? { id: app.currentStep.id, name: app.currentStep.name, position: app.currentStep.position }
      : null,
    ownerId: app.ownerId,
    owner: person(app.owner),
    reviewerId: app.reviewerId,
    reviewer: person(app.reviewer),
    attachment: app.attachmentStored
      ? { filename: app.attachmentFilename, mime: app.attachmentMime, size: app.attachmentSize }
      : null,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function serializeDetail(app: DetailApp) {
  return {
    ...serializeBase(app, app.logs.at(-1)?.action ?? null),
    // Monitor data: the ordered workflow and how far the case has progressed.
    workflow: app.grant.steps.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    currentStepIndex: app.currentStep ? app.currentStep.position : null,
    caseLog: app.logs.map((l) => ({
      id: l.id,
      action: l.action,
      fromStep: l.fromStep,
      toStep: l.toStep,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      comment: l.comment,
      actor: person(l.actor),
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

/** Load an application enforcing applicant visibility (others' rows → 404). */
async function loadVisibleDetail(appId: string, actor: AuthUser): Promise<DetailApp> {
  const app = await prisma.application.findUnique({ where: { id: appId }, include: detailInclude });
  if (!app) throw notFound("Application not found.");
  if (actor.role === "APPLICANT" && app.ownerId !== actor.id) {
    throw notFound("Application not found."); // hide existence from non-owner applicants
  }
  return app;
}

/** Generate a case number not already taken (random suffix → rare collisions). */
async function uniqueCaseNumber(shortCode: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const candidate = generateCaseNumber(shortCode, new Date());
    const taken = await prisma.application.findUnique({ where: { caseNumber: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw conflict("Could not allocate a unique case number; please retry.");
}

export async function createApplication(actor: AuthUser, input: ApplicationInput) {
  const grant = await prisma.grant.findUnique({ where: { id: input.grantId } });
  if (!grant) throw notFound("Grant not found.");
  if (!isGrantOpen(grant)) throw unprocessable("This grant is not open for applications.");
  if (input.amount > Number(grant.fundsAllocated)) {
    throw unprocessable("Requested amount exceeds the funds allocated for this grant.");
  }

  const title = input.title?.trim() || grant.name;
  const caseNumber = await uniqueCaseNumber(grant.shortCode);

  const created = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        caseNumber,
        title,
        category: grant.category,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        needBy: input.needBy,
        status: "DRAFT",
        grantId: grant.id,
        ownerId: actor.id,
      },
    });
    await tx.logEntry.create({
      data: {
        category: "CASE",
        action: "CREATE",
        applicationId: app.id,
        caseNumber,
        actorId: actor.id,
        toStatus: "DRAFT",
      },
    });
    return tx.application.findUniqueOrThrow({ where: { id: app.id }, include: detailInclude });
  });
  return serializeDetail(created);
}

export async function updateApplication(appId: string, actor: AuthUser, input: ApplicationUpdate) {
  const app = await loadVisibleDetail(appId, actor);
  if (app.ownerId !== actor.id) throw forbidden("Only the owner may edit this application.");
  if (app.status !== "DRAFT") throw conflict("Only a DRAFT application can be edited.");
  if (input.amount > Number(app.grant.fundsAllocated)) {
    throw unprocessable("Requested amount exceeds the funds allocated for this grant.");
  }

  const updated = await prisma.application.update({
    where: { id: appId },
    data: {
      title: input.title?.trim() || app.grant.name,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      needBy: input.needBy,
    },
    include: detailInclude,
  });
  return serializeDetail(updated);
}

export interface ListFilter {
  status?: Status;
}

/** Build the visibility + filter predicate shared by list and search. */
function buildListWhere(actor: AuthUser, status?: Status, q?: string): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput =
    actor.role === "APPLICANT"
      ? { ownerId: actor.id, ...(status ? { status } : {}) }
      : status
        ? { status }
        : { status: "IN_REVIEW" }; // reviewer queue defaults to cases in review
  const text = q?.trim();
  if (text) {
    where.OR = [
      { caseNumber: { contains: text, mode: "insensitive" } },
      { title: { contains: text, mode: "insensitive" } },
      { owner: { is: { name: { contains: text, mode: "insensitive" } } } },
      { owner: { is: { email: { contains: text, mode: "insensitive" } } } },
    ];
  }
  return where;
}

export async function listApplications(actor: AuthUser, filter: ListFilter) {
  const where = buildListWhere(actor, filter.status);
  const apps = await prisma.application.findMany({ where, include: listInclude, orderBy: { updatedAt: "desc" } });
  return apps.map((a) => serializeBase(a, a.logs[0]?.action ?? null));
}

export interface SearchParams {
  status?: Status;
  q?: string;
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Paginated + free-text search over the listing (reviewer queue power-up). */
export async function searchApplications(actor: AuthUser, params: SearchParams) {
  const page = Math.max(1, Math.floor(params.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(params.pageSize) || 10));
  const where = buildListWhere(actor, params.status, params.q);
  const [rows, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);
  return {
    items: rows.map((a) => serializeBase(a, a.logs[0]?.action ?? null)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getApplication(appId: string, actor: AuthUser) {
  const app = await loadVisibleDetail(appId, actor);
  return serializeDetail(app);
}

/**
 * Delete a case. Allowed ONLY for the owner and ONLY on a brand-new draft that
 * has never been submitted — once a case has entered review it carries an audit
 * trail that must be preserved, so it can no longer be deleted (the workflow
 * resolves it instead). Reviewers cannot delete a case (enforced at the route).
 */
export async function deleteApplication(appId: string, actor: AuthUser) {
  const app = await loadVisibleDetail(appId, actor); // 404 hides other people's cases
  if (app.ownerId !== actor.id) throw forbidden("Only the owner may delete this application.");
  if (app.status !== "DRAFT") throw conflict("Only a draft can be deleted.");
  const everSubmitted = await prisma.logEntry.count({
    where: { applicationId: appId, action: "submit" },
  });
  if (everSubmitted > 0) {
    throw conflict("This draft has already been submitted once and can no longer be deleted.");
  }

  const storedName = app.attachmentStored;
  await prisma.application.delete({ where: { id: appId } }); // CASE logs cascade away
  await deleteAttachment(storedName); // best-effort attachment cleanup
}

/**
 * Execute a case action through the pure step engine, then apply the status +
 * step change and write a CASE log atomically. Concurrency is guarded by a
 * conditional updateMany on the expected (status, currentStep).
 */
export async function performCaseAction(appId: string, action: Action, actor: AuthUser, comment?: string) {
  const app = await loadVisibleDetail(appId, actor);
  const steps = app.grant.steps; // ordered by position
  const stepIndex = app.currentStep ? app.currentStep.position : -1;

  const decision = evaluateCaseAction({
    action,
    status: app.status,
    stepIndex,
    totalSteps: steps.length,
    actorRole: actor.role,
    actorId: actor.id,
    ownerId: app.ownerId,
    comment,
  });
  if (!decision.ok) throw transitionError(decision.reason, decision.message);

  const toStep = decision.toStepIndex === null ? null : steps[decision.toStepIndex];

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.application.updateMany({
      where: { id: appId, status: app.status, currentStepId: app.currentStepId },
      data: {
        status: decision.toStatus,
        currentStepId: toStep ? toStep.id : null,
        ...(actor.role === "REVIEWER" ? { reviewerId: actor.id } : {}),
      },
    });
    if (changed.count === 0) throw conflict("Application state changed concurrently; please retry.");

    await tx.logEntry.create({
      data: {
        category: "CASE",
        action,
        applicationId: appId,
        caseNumber: app.caseNumber,
        actorId: actor.id,
        fromStep: app.currentStep?.name ?? null,
        toStep: toStep?.name ?? null,
        fromStatus: app.status,
        toStatus: decision.toStatus,
        comment: comment && comment.trim() ? comment.trim() : null,
      },
    });
    return tx.application.findUniqueOrThrow({ where: { id: appId }, include: detailInclude });
  });

  // Best-effort notification on status change — never blocks or fails the action.
  notifyCaseEvent(
    {
      caseNumber: result.caseNumber,
      title: result.title,
      ownerEmail: result.owner?.email ?? null,
      ownerName: result.owner?.name ?? null,
    },
    action,
    result.status,
    result.currentStep?.name ?? null,
    comment && comment.trim() ? comment.trim() : null,
  ).catch((err) => console.error("[notify] case event failed:", err));

  return serializeDetail(result);
}

export async function setAttachment(
  appId: string,
  actor: AuthUser,
  file: { buffer: Buffer; originalname: string },
) {
  const app = await loadVisibleDetail(appId, actor);
  if (app.ownerId !== actor.id) throw forbidden("Only the owner may attach a file.");
  if (app.status !== "DRAFT") throw conflict("Attachments can only change while in DRAFT.");

  const mime = sniffMime(file.buffer);
  if (!mime || !config.allowedMime.includes(mime)) {
    throw unprocessable(`Unsupported file type. Allowed: ${config.allowedMime.join(", ")}.`);
  }

  const stored = await persistAttachment(file.buffer, mime);
  await deleteAttachment(app.attachmentStored);

  const updated = await prisma.application.update({
    where: { id: appId },
    data: {
      attachmentFilename: file.originalname,
      attachmentMime: mime,
      attachmentSize: stored.size,
      attachmentStored: stored.storedName,
    },
    include: detailInclude,
  });
  return serializeDetail(updated);
}

export async function getAttachmentMeta(appId: string, actor: AuthUser) {
  const app = await loadVisibleDetail(appId, actor);
  if (!app.attachmentStored) throw notFound("No attachment on this application.");
  return {
    storedName: app.attachmentStored,
    filename: app.attachmentFilename ?? "attachment",
    mime: app.attachmentMime ?? "application/octet-stream",
  };
}
