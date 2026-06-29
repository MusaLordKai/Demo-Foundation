import type { CaseLogEntry } from "../api/types";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "created the case",
  submit: "submitted for review",
  advance: "advanced the case",
  return: "returned for changes",
  reject: "rejected the case",
};

function describe(entry: CaseLogEntry): string {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  if (entry.action === "advance" && entry.toStep) return `advanced to “${entry.toStep}”`;
  if (entry.action === "advance" && entry.toStatus === "APPROVED") return "approved (final step)";
  return label;
}

export function AuditTrail({ entries }: { entries: CaseLogEntry[] }) {
  if (entries.length === 0) return <p className="muted">No history yet.</p>;
  return (
    <ol className="audit">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="audit-head">
            <strong>{e.actor?.name ?? "System"}</strong> {describe(e)}
            <time>{new Date(e.createdAt).toLocaleString()}</time>
          </div>
          {e.comment && <div className="audit-comment">“{e.comment}”</div>}
        </li>
      ))}
    </ol>
  );
}
