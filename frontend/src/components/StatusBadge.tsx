import type { Status } from "../api/types";

const LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
