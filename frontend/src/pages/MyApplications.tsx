import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { listApplications } from "../api/applications";
import { StatusBadge } from "../components/StatusBadge";
import { CATEGORY_LABELS, FOLDERS, type Folder } from "../api/types";

export function MyApplications() {
  const { folder } = useParams<{ folder?: Folder }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", "mine"],
    queryFn: () => listApplications(),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="error">Failed to load your cases.</p>;

  const all = data ?? [];
  const cases = folder ? all.filter((a) => a.folder === folder) : all;
  const heading = folder ? FOLDERS.find((f) => f.key === folder)?.label ?? "Cases" : "All cases";

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h1>{heading}</h1>
          <p className="muted">
            {cases.length} {cases.length === 1 ? "case" : "cases"}
          </p>
        </div>
        <Link className="btn" to="/grants">
          Browse grants
        </Link>
      </div>
      {cases.length === 0 ? (
        <p className="muted">
          No cases here. <Link to="/grants">Browse open grants</Link> to apply.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Case number</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/applications/${a.id}`}>{a.caseNumber}</Link>
                </td>
                <td>{a.title}</td>
                <td>{CATEGORY_LABELS[a.category]}</td>
                <td>{Number(a.amount).toLocaleString()}</td>
                <td>
                  <StatusBadge state={a.folder} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
