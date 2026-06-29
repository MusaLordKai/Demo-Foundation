/**
 * Seed: users, grants (with workflow steps + a sample document), and sample
 * applications spanning the dynamic lifecycle (DRAFT / IN_REVIEW@step /
 * APPROVED / REJECTED) with CASE logs, plus a few SYSTEM logs.
 * Idempotent: skips sample data if grants already exist.
 */
import { PrismaClient, Prisma, type CaseStatus, type Category } from "@prisma/client";
import bcrypt from "bcryptjs";
import { persistAttachment } from "../src/upload";
import { DEFAULT_WORKFLOW_STEPS } from "../src/lib/validation";

const prisma = new PrismaClient();
const PASSWORD = "password123";
const SAMPLE_PDF = Buffer.from("%PDF-1.4 The Demo Foundation — sample grant guidelines.\n", "latin1");

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [applicantA, applicantB, reviewer] = await Promise.all([
    prisma.user.upsert({ where: { email: "applicant@demo.test" }, update: {}, create: { email: "applicant@demo.test", name: "Aisha Applicant", role: "APPLICANT", passwordHash } }),
    prisma.user.upsert({ where: { email: "applicant2@demo.test" }, update: {}, create: { email: "applicant2@demo.test", name: "Ben Applicant", role: "APPLICANT", passwordHash } }),
    prisma.user.upsert({ where: { email: "reviewer@demo.test" }, update: {}, create: { email: "reviewer@demo.test", name: "Rita Reviewer", role: "REVIEWER", passwordHash } }),
  ]);

  if ((await prisma.grant.count()) > 0) {
    // eslint-disable-next-line no-console
    console.log("Grants already present — skipping sample data.");
    return;
  }

  const grantDefs = [
    { name: "Community Sports Fund 2026", shortCode: "SPT", category: "SPORT" as Category, funds: 50000, openUntil: "2026-12-31" },
    { name: "Digital Skills Initiative", shortCode: "TEC", category: "TECHNOLOGY" as Category, funds: 80000, openUntil: "2026-11-30" },
    { name: "Schools Literacy Grant", shortCode: "EDU", category: "GENERAL_EDUCATION" as Category, funds: 60000, openUntil: "2026-10-15" },
    { name: "Healthy Communities Fund", shortCode: "QOL", category: "QUALITY_OF_LIFE" as Category, funds: 45000, openUntil: "2026-09-30" },
  ];

  const grants: Prisma.GrantGetPayload<{ include: { steps: true } }>[] = [];
  for (const g of grantDefs) {
    const doc = await persistAttachment(SAMPLE_PDF, "application/pdf");
    const grant = await prisma.grant.create({
      data: {
        name: g.name,
        shortCode: g.shortCode,
        category: g.category,
        description: `Funding for ${g.name.toLowerCase()} — supporting community projects across the region.`,
        fundsAllocated: g.funds,
        openUntil: new Date(g.openUntil),
        createdById: reviewer.id,
        steps: { create: DEFAULT_WORKFLOW_STEPS.map((name, i) => ({ name, position: i })) },
        documents: { create: { filename: "grant-guidelines.pdf", mime: "application/pdf", size: doc.size, storedName: doc.storedName } },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    grants.push(grant);
    await prisma.logEntry.create({
      data: { category: "SYSTEM", action: "grant.created", actorId: reviewer.id, message: `Created grant ${grant.name} (${grant.shortCode})` },
    });
  }

  let suffix = 100;
  async function makeCase(opts: {
    grantIndex: number;
    ownerId: string;
    amount: number;
    needBy: string;
    status: CaseStatus;
    currentStepPos: number | null;
    reviewerId?: string;
    logs: { actorId: string; action: string; fromStep?: string; toStep?: string; fromStatus?: CaseStatus; toStatus: CaseStatus; comment?: string }[];
  }) {
    const grant = grants[opts.grantIndex];
    const caseNumber = `${grant.shortCode}-06-26-${suffix++}`;
    const currentStepId = opts.currentStepPos === null ? null : grant.steps[opts.currentStepPos].id;
    const app = await prisma.application.create({
      data: {
        caseNumber,
        title: grant.name,
        category: grant.category,
        description: `Project proposal for ${grant.name}.`,
        amount: opts.amount,
        needBy: new Date(opts.needBy),
        status: opts.status,
        grantId: grant.id,
        ownerId: opts.ownerId,
        reviewerId: opts.reviewerId,
        currentStepId,
      },
    });
    for (const l of opts.logs) {
      await prisma.logEntry.create({
        data: {
          category: "CASE",
          action: l.action,
          applicationId: app.id,
          caseNumber,
          actorId: l.actorId,
          fromStep: l.fromStep ?? null,
          toStep: l.toStep ?? null,
          fromStatus: l.fromStatus ?? null,
          toStatus: l.toStatus,
          comment: l.comment ?? null,
        },
      });
    }
  }

  const steps = grants[0].steps.map((s) => s.name); // same default steps for all

  await makeCase({
    grantIndex: 0, ownerId: applicantA.id, amount: 4500, needBy: "2026-09-01", status: "DRAFT", currentStepPos: null,
    logs: [{ actorId: applicantA.id, action: "CREATE", toStatus: "DRAFT" }],
  });
  await makeCase({
    grantIndex: 1, ownerId: applicantA.id, amount: 12000, needBy: "2026-10-01", status: "IN_REVIEW", currentStepPos: 1, reviewerId: reviewer.id,
    logs: [
      { actorId: applicantA.id, action: "CREATE", toStatus: "DRAFT" },
      { actorId: applicantA.id, action: "submit", fromStatus: "DRAFT", toStatus: "IN_REVIEW", toStep: steps[0] },
      { actorId: reviewer.id, action: "advance", fromStatus: "IN_REVIEW", toStatus: "IN_REVIEW", fromStep: steps[0], toStep: steps[1] },
    ],
  });
  await makeCase({
    grantIndex: 2, ownerId: applicantB.id, amount: 8000, needBy: "2026-08-20", status: "IN_REVIEW", currentStepPos: 0, reviewerId: reviewer.id,
    logs: [
      { actorId: applicantB.id, action: "CREATE", toStatus: "DRAFT" },
      { actorId: applicantB.id, action: "submit", fromStatus: "DRAFT", toStatus: "IN_REVIEW", toStep: steps[0] },
    ],
  });
  await makeCase({
    grantIndex: 3, ownerId: applicantB.id, amount: 15000, needBy: "2026-09-10", status: "APPROVED", currentStepPos: null, reviewerId: reviewer.id,
    logs: [
      { actorId: applicantB.id, action: "CREATE", toStatus: "DRAFT" },
      { actorId: applicantB.id, action: "submit", fromStatus: "DRAFT", toStatus: "IN_REVIEW", toStep: steps[0] },
      { actorId: reviewer.id, action: "advance", fromStatus: "IN_REVIEW", toStatus: "IN_REVIEW", fromStep: steps[0], toStep: steps[1] },
      { actorId: reviewer.id, action: "advance", fromStatus: "IN_REVIEW", toStatus: "APPROVED", fromStep: steps[steps.length - 1], comment: "Strong proposal — approved." },
    ],
  });
  await makeCase({
    grantIndex: 0, ownerId: applicantA.id, amount: 30000, needBy: "2026-08-30", status: "REJECTED", currentStepPos: null, reviewerId: reviewer.id,
    logs: [
      { actorId: applicantA.id, action: "CREATE", toStatus: "DRAFT" },
      { actorId: applicantA.id, action: "submit", fromStatus: "DRAFT", toStatus: "IN_REVIEW", toStep: steps[0] },
      { actorId: reviewer.id, action: "reject", fromStatus: "IN_REVIEW", toStatus: "REJECTED", fromStep: steps[0], comment: "Requested amount too high for this round." },
    ],
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete. Users (password '%s'): applicant@demo.test, applicant2@demo.test, reviewer@demo.test", PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
