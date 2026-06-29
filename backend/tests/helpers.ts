import supertest from "supertest";
import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/http/app";
import { hashPassword, signToken, type AuthUser } from "../src/lib/auth";
import type { Status } from "../src/domain/transitions";

export const app = createApp();
export const api = () => supertest(app);

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "LogEntry","Application","WorkflowStep","GrantDocument","Grant","User" RESTART IDENTITY CASCADE',
  );
}

export async function disconnectDb() {
  await prisma.$disconnect();
}

export interface SeededUsers {
  applicantA: AuthUser;
  applicantB: AuthUser;
  reviewer: AuthUser;
  /** A REVIEWER who will also own an application — for the conflict-of-interest test. */
  reviewerOwner: AuthUser;
}

export async function createUsers(): Promise<SeededUsers> {
  const passwordHash = await hashPassword("password123");
  const mk = (email: string, name: string, role: "APPLICANT" | "REVIEWER") =>
    prisma.user.create({ data: { email, name, role, passwordHash } });
  const [applicantA, applicantB, reviewer, reviewerOwner] = await Promise.all([
    mk("a@test.dev", "Applicant A", "APPLICANT"),
    mk("b@test.dev", "Applicant B", "APPLICANT"),
    mk("r@test.dev", "Reviewer R", "REVIEWER"),
    mk("ro@test.dev", "Reviewer Owner", "REVIEWER"),
  ]);
  return { applicantA, applicantB, reviewer, reviewerOwner };
}

export function tokenFor(u: { id: string; email: string; name: string; role: "APPLICANT" | "REVIEWER" }) {
  return signToken({ id: u.id, email: u.email, name: u.name, role: u.role });
}

export function authHeader(u: { id: string; email: string; name: string; role: "APPLICANT" | "REVIEWER" }) {
  return `Bearer ${tokenFor(u)}`;
}

// Deterministic, always-unique 3-letter short codes for fixtures (AAA, AAB, …).
let shortCodeSeq = 0;
export function nextShortCode(): string {
  const n = shortCodeSeq++;
  return (
    String.fromCharCode(65 + (Math.floor(n / 676) % 26)) +
    String.fromCharCode(65 + (Math.floor(n / 26) % 26)) +
    String.fromCharCode(65 + (n % 26))
  );
}

interface GrantOverrides {
  name?: string;
  shortCode?: string;
  category?: "SPORT" | "TECHNOLOGY" | "GENERAL_EDUCATION" | "QUALITY_OF_LIFE";
  fundsAllocated?: number;
  openUntil?: Date;
  status?: "OPEN" | "CLOSED";
  steps?: string[];
}

/** Insert a grant directly (bypassing the API). */
export async function makeGrant(createdById: string, over: GrantOverrides = {}) {
  return prisma.grant.create({
    data: {
      name: over.name ?? "Sample Grant",
      shortCode: over.shortCode ?? nextShortCode(),
      category: over.category ?? "SPORT",
      description: "A sample grant.",
      fundsAllocated: over.fundsAllocated ?? 100000,
      openUntil: over.openUntil ?? new Date("2999-12-31"),
      status: over.status ?? "OPEN",
      createdById,
      steps: {
        create: (over.steps ?? ["Screening", "Decision"]).map((name, i) => ({ name, position: i })),
      },
    },
    include: { steps: { orderBy: { position: "asc" } }, documents: true },
  });
}

let caseSeq = 0;
/** Insert an application directly (bypassing the API) in a chosen state. Auto-creates a grant.
 *  For IN_REVIEW, the case is placed on the grant's first workflow step. */
export async function makeApplication(
  ownerId: string,
  status: Status = "DRAFT",
  extra: Record<string, unknown> = {},
) {
  const grant = await makeGrant(ownerId);
  const currentStepId = status === "IN_REVIEW" ? grant.steps[0].id : null;
  return prisma.application.create({
    data: {
      caseNumber: `${grant.shortCode}-01-99-${100 + (caseSeq++ % 900)}`,
      grantId: grant.id,
      ownerId,
      title: "Test application",
      category: grant.category,
      description: "",
      amount: 100,
      needBy: new Date("2026-12-01"),
      status,
      currentStepId,
      ...extra,
    },
  });
}

/** The CASE log rows for an application, chronological. */
export async function auditFor(applicationId: string) {
  return prisma.logEntry.findMany({
    where: { applicationId, category: "CASE" },
    orderBy: { createdAt: "asc" },
  });
}
