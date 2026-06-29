import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { LogCategory } from "@prisma/client";

const include = { actor: true } satisfies Prisma.LogEntryInclude;
type LogWithActor = Prisma.LogEntryGetPayload<{ include: typeof include }>;

function serialize(l: LogWithActor) {
  return {
    id: l.id,
    category: l.category,
    action: l.action,
    actor: l.actor ? { id: l.actor.id, name: l.actor.name, email: l.actor.email } : null,
    caseNumber: l.caseNumber,
    fromStep: l.fromStep,
    toStep: l.toStep,
    fromStatus: l.fromStatus,
    toStatus: l.toStatus,
    comment: l.comment,
    message: l.message,
    createdAt: l.createdAt.toISOString(),
  };
}

/** Record a SYSTEM event (login, grant/workflow changes, …). Best-effort. */
export async function logSystem(action: string, opts: { actorId?: string; message?: string } = {}) {
  await prisma.logEntry.create({
    data: { category: "SYSTEM", action, actorId: opts.actorId ?? null, message: opts.message ?? null },
  });
}

export async function listLogs(filter: { category?: LogCategory; caseNumber?: string }) {
  const where: Prisma.LogEntryWhereInput = {};
  if (filter.category) where.category = filter.category;
  if (filter.caseNumber) where.caseNumber = { contains: filter.caseNumber, mode: "insensitive" };
  const logs = await prisma.logEntry.findMany({
    where,
    include,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return logs.map(serialize);
}
