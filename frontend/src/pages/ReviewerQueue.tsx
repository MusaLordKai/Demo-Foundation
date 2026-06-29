import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { searchApplications } from "../api/applications";
import { StatusBadge } from "../components/StatusBadge";
import { CATEGORY_LABELS, STATUSES, type Status } from "../api/types";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function ReviewerQueue() {
  const [filter, setFilter] = useState<Status | "QUEUE">("QUEUE");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["applications", "queue", filter, q, page],
    queryFn: () =>
      searchApplications({
        status: filter === "QUEUE" ? undefined : filter,
        q: q.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  function changeFilter(value: Status | "QUEUE") {
    setFilter(value);
    setPage(1);
  }
  function changeQuery(value: string) {
    setQ(value);
    setPage(1);
  }

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="card">
      <div className="card-head">
        <h1>Review queue</h1>
        <div className="queue-controls">
          <input
            className="search"
            type="search"
            placeholder="Search case #, title, applicant…"
            value={q}
            onChange={(e) => changeQuery(e.target.value)}
            aria-label="Search the queue"
          />
          <label className="inline">
            Filter
            <select value={filter} onChange={(e) => changeFilter(e.target.value as Status | "QUEUE")}>
              <option value="QUEUE">Awaiting review (default)</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p className="error">Failed to load the queue.</p>}
      {data && items.length === 0 && <p className="muted">Nothing here.</p>}

      {items.length > 0 && (
        <>
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
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/applications/${a.id}`}>{a.caseNumber}</Link>
                  </td>
                  <td>{a.title}</td>
                  <td>{a.owner?.name ?? "—"}</td>
                  <td>{CATEGORY_LABELS[a.category]}</td>
                  <td>{Number(a.amount).toLocaleString()}</td>
                  <td>
                    <StatusBadge state={a.folder} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              className="btn-ghost"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="muted">
              Page {data?.page ?? page} of {totalPages} · {data?.total ?? 0} total
            </span>
            <button
              className="btn-ghost"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
