import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteApplication, listApplications, submitApplication } from "../api/applications";
import { StatusBadge } from "../components/StatusBadge";
import { CATEGORY_LABELS, FOLDERS, type Application, type Folder } from "../api/types";

export function MyApplications() {
  const { folder } = useParams<{ folder?: Folder }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", "mine"],
    queryFn: () => listApplications(),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setActionError(null);
    },
    onError: () => setActionError("Could not submit this application. Try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setActionError(null);
    },
    onError: () => setActionError("Could not delete this draft. Try again."),
  });

  function handleDelete(a: Application) {
    if (window.confirm(`Delete "${a.title}" permanently? This cannot be undone.`)) {
      deleteMutation.mutate(a.id);
    }
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="error">Failed to load your cases.</p>;

  const all = data ?? [];
  const cases = folder ? all.filter((a) => a.folder === folder) : all;
  const heading = folder ? FOLDERS.find((f) => f.key === folder)?.label ?? "Cases" : "All cases";
  const isDraftFolder = folder === "DRAFT";
  const isBusy = submitMutation.isPending || deleteMutation.isPending;

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

      {actionError && <p className="error">{actionError}</p>}

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
              {isDraftFolder && <th>Actions</th>}
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
                {isDraftFolder && (
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn-ghost row-action-btn"
                        onClick={() => navigate(`/applications/${a.id}`)}
                        disabled={isBusy}
                      >
                        View
                      </button>
                      <button
                        className="ok row-action-btn"
                        onClick={() => submitMutation.mutate(a.id)}
                        disabled={isBusy}
                      >
                        Submit
                      </button>
                      <button
                        className="danger row-action-btn"
                        onClick={() => handleDelete(a)}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
