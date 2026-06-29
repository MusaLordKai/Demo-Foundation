import type { Folder } from "../api/types";

const LABELS: Record<Folder, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  REVERTED: "Reverted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * Shows a case's derived state — the assignment's machine:
 * DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED, plus REVERTED
 * (a draft a reviewer sent back). Driven by the server-derived `folder`.
 */
export function StatusBadge({ state }: { state: Folder }) {
  return <span className={`badge badge-${state.toLowerCase()}`}>{LABELS[state]}</span>;
}
