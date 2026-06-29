import { prisma } from "../lib/prisma";

/** Foundation-wide statistics for the reviewer dashboard. */
export async function getReviewerStats() {
  const grants = await prisma.grant.findMany({
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: "asc" },
  });

  const totalApplications = await prisma.application.count();
  const grouped = await prisma.application.groupBy({ by: ["status"], _count: { _all: true } });
  const statusCounts = { DRAFT: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of grouped) statusCounts[g.status] = g._count._all;

  const requested = await prisma.application.aggregate({ _sum: { amount: true } });
  const approvedAgg = await prisma.application.aggregate({
    where: { status: "APPROVED" },
    _sum: { amount: true },
  });
  const appsByCategory = await prisma.application.groupBy({ by: ["category"], _count: { _all: true } });

  const grantsCount = grants.length;
  const openGrants = grants.filter((g) => g.status === "OPEN").length;
  const totalFunds = grants.reduce((s, g) => s + Number(g.fundsAllocated), 0);
  const decided = statusCounts.APPROVED + statusCounts.REJECTED;

  // Funds allocated per category (from grants).
  const fundsByCategory: Record<string, number> = {};
  for (const g of grants) fundsByCategory[g.category] = (fundsByCategory[g.category] ?? 0) + Number(g.fundsAllocated);
  const appCountByCategory: Record<string, number> = {};
  for (const a of appsByCategory) appCountByCategory[a.category] = a._count._all;
  const categories = Array.from(new Set([...Object.keys(fundsByCategory), ...Object.keys(appCountByCategory)]));

  // Applications created over the last 6 months (trend line).
  const appDates = await prisma.application.findMany({ select: { createdAt: true } });
  const now = new Date();
  const months: { label: string; count: number }[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthIndex.set(`${d.getFullYear()}-${d.getMonth()}`, months.length);
    months.push({ label: d.toLocaleString("en-US", { month: "short" }), count: 0 });
  }
  for (const a of appDates) {
    const idx = monthIndex.get(`${a.createdAt.getFullYear()}-${a.createdAt.getMonth()}`);
    if (idx !== undefined) months[idx].count++;
  }

  return {
    applicationsOverTime: months,
    grants: grantsCount,
    openGrants,
    closedGrants: grantsCount - openGrants,
    totalApplications,
    avgApplicationsPerGrant: grantsCount ? Math.round((totalApplications / grantsCount) * 10) / 10 : 0,
    approved: statusCounts.APPROVED,
    rejected: statusCounts.REJECTED,
    pending: statusCounts.IN_REVIEW,
    draft: statusCounts.DRAFT,
    approvalRate: decided ? Math.round((statusCounts.APPROVED / decided) * 100) : 0,
    totalFunds,
    requestedFunds: Number(requested._sum.amount ?? 0),
    approvedFunds: Number(approvedAgg._sum.amount ?? 0),
    byGrant: grants.map((g) => ({
      id: g.id,
      name: g.name,
      shortCode: g.shortCode,
      funds: Number(g.fundsAllocated),
      applications: g._count.applications,
    })),
    byStatus: [
      { status: "DRAFT", count: statusCounts.DRAFT },
      { status: "IN_REVIEW", count: statusCounts.IN_REVIEW },
      { status: "APPROVED", count: statusCounts.APPROVED },
      { status: "REJECTED", count: statusCounts.REJECTED },
    ],
    byCategory: categories.map((c) => ({
      category: c,
      applications: appCountByCategory[c] ?? 0,
      funds: fundsByCategory[c] ?? 0,
    })),
  };
}
