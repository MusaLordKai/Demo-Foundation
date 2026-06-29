import { Prisma, Category as PrismaCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../lib/auth";
import type { GrantInput } from "../lib/validation";
import { DEFAULT_WORKFLOW_STEPS } from "../lib/validation";
import { notFound, unprocessable } from "../http/errors";
import { config } from "../lib/config";
import { persistAttachment, sniffMime } from "../upload";

const grantInclude = {
  documents: { orderBy: { createdAt: "asc" } },
  steps: { orderBy: { position: "asc" } },
  _count: { select: { applications: true } },
} satisfies Prisma.GrantInclude;

type GrantWithRelations = Prisma.GrantGetPayload<{ include: typeof grantInclude }>;

function serialize(grant: GrantWithRelations) {
  return {
    id: grant.id,
    name: grant.name,
    shortCode: grant.shortCode,
    category: grant.category,
    description: grant.description,
    fundsAllocated: grant.fundsAllocated.toString(),
    openUntil: grant.openUntil.toISOString().slice(0, 10),
    status: grant.status,
    applicationCount: grant._count.applications,
    documents: grant.documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      mime: d.mime,
      size: d.size,
      createdAt: d.createdAt.toISOString(),
    })),
    steps: grant.steps.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Reviewers see all grants; applicants see only those open for application. */
export async function listGrants(actor: AuthUser) {
  const where: Prisma.GrantWhereInput =
    actor.role === "APPLICANT" ? { status: "OPEN", openUntil: { gte: startOfToday() } } : {};
  const grants = await prisma.grant.findMany({
    where,
    include: grantInclude,
    orderBy: { createdAt: "desc" },
  });
  return grants.map(serialize);
}

export async function getGrant(id: string) {
  const grant = await prisma.grant.findUnique({ where: { id }, include: grantInclude });
  if (!grant) throw notFound("Grant not found.");
  return serialize(grant);
}

/** True when an applicant may currently apply to this grant. */
export function isGrantOpen(grant: { status: string; openUntil: Date }): boolean {
  return grant.status === "OPEN" && grant.openUntil >= startOfToday();
}

export async function createGrant(actor: AuthUser, input: GrantInput, steps?: string[]) {
  const stepNames = steps && steps.length > 0 ? steps : DEFAULT_WORKFLOW_STEPS;
  try {
    const grant = await prisma.grant.create({
      data: {
        name: input.name,
        shortCode: input.shortCode,
        category: input.category as PrismaCategory,
        description: input.description,
        fundsAllocated: new Prisma.Decimal(input.fundsAllocated),
        openUntil: input.openUntil,
        createdById: actor.id,
        steps: { create: stepNames.map((name, i) => ({ name, position: i })) },
      },
      include: grantInclude,
    });
    return serialize(grant);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw unprocessable(`Short code "${input.shortCode}" is already in use.`);
    }
    throw err;
  }
}

export async function updateGrant(id: string, input: GrantInput) {
  await ensureGrant(id);
  try {
    const grant = await prisma.grant.update({
      where: { id },
      data: {
        name: input.name,
        shortCode: input.shortCode,
        category: input.category as PrismaCategory,
        description: input.description,
        fundsAllocated: new Prisma.Decimal(input.fundsAllocated),
        openUntil: input.openUntil,
      },
      include: grantInclude,
    });
    return serialize(grant);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw unprocessable(`Short code "${input.shortCode}" is already in use.`);
    }
    throw err;
  }
}

/** Replace the grant's ordered workflow steps (covers add / remove / reorder). */
export async function setWorkflowSteps(id: string, steps: string[]) {
  await ensureGrant(id);
  // Phase 1: steps are not yet enforced by the engine, so a full replace is safe.
  await prisma.$transaction([
    prisma.workflowStep.deleteMany({ where: { grantId: id } }),
    prisma.workflowStep.createMany({
      data: steps.map((name, i) => ({ grantId: id, name, position: i })),
    }),
  ]);
  return getGrant(id);
}

export async function addDocument(
  grantId: string,
  file: { buffer: Buffer; originalname: string },
) {
  await ensureGrant(grantId);
  const mime = sniffMime(file.buffer);
  if (!mime || !config.allowedMime.includes(mime)) {
    throw unprocessable(`Unsupported file type. Allowed: ${config.allowedMime.join(", ")}.`);
  }
  const stored = await persistAttachment(file.buffer, mime);
  await prisma.grantDocument.create({
    data: {
      grantId,
      filename: file.originalname,
      mime,
      size: stored.size,
      storedName: stored.storedName,
    },
  });
  return getGrant(grantId);
}

export async function getDocumentMeta(grantId: string, docId: string) {
  const doc = await prisma.grantDocument.findFirst({ where: { id: docId, grantId } });
  if (!doc) throw notFound("Document not found.");
  return { storedName: doc.storedName, filename: doc.filename, mime: doc.mime };
}

async function ensureGrant(id: string) {
  const exists = await prisma.grant.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("Grant not found.");
}
