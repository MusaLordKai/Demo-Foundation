import { apiGet } from "./client";

export interface GrantStat {
  id: string;
  name: string;
  shortCode: string;
  funds: number;
  applications: number;
}

export interface Stats {
  grants: number;
  openGrants: number;
  closedGrants: number;
  totalApplications: number;
  avgApplicationsPerGrant: number;
  approved: number;
  rejected: number;
  pending: number;
  draft: number;
  approvalRate: number;
  totalFunds: number;
  requestedFunds: number;
  approvedFunds: number;
  byGrant: GrantStat[];
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; applications: number; funds: number }[];
  applicationsOverTime: { label: string; count: number }[];
}

export const getStats = () => apiGet<Stats>("/stats");
