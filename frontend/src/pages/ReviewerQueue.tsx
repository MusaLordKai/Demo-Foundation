import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listApplications } from "../api/applications";
import { StatusBadge } from "../components/StatusBadge";
import { CATEGORY_LABELS, STATUSES, type Status } from "../api/types";

export function ReviewerQueue() {
  const [filter, setFilter] = useState<Status | "QUEUE">("QUEUE");
  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", "queue", filter],
    queryFn: () => listApplications(filter === "QUEUE" ? undefined : filter),
  });

  return (
    <div className="card">
      <div className="card-head">
        <h1>Review queue</h1>
        <label className="inline">
          Filter
          <select value={filter} onChange={(e) => setFilter(e.target.value as Status | "QUEUE")}>
            <option value="QUEUE">Awaiting review (default)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p className="error">Failed to load the queue.</p>}
      {data && data.length === 0 && <p className="muted">Nothing here.</p>}

      {data && data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Case number</th>
              <th>Title</th>
              <th>Applicant</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/applications/${a.id}`}>{a.caseNumber}</Link>
                </td>
                <td>{a.title}</td>
                <td>{a.owner?.name ?? "—"}</td>
                <td>{CATEGORY_LABELS[a.category]}</td>
                <td>{Number(a.amount).toLocaleString()}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
