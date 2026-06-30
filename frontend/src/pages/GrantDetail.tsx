import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getGrant, downloadGrantDocument, closeGrant, reopenGrant } from "../api/grants";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS } from "../api/types";

export function GrantDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isReviewer = user?.role === "REVIEWER";
  const { data: grant, isLoading, error } = useQuery({ queryKey: ["grant", id], queryFn: () => getGrant(id!) });

  const statusMutation = useMutation({
    mutationFn: () => (grant!.status === "OPEN" ? closeGrant(grant!.id) : reopenGrant(grant!.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant", id] });
      queryClient.invalidateQueries({ queryKey: ["grants"] });
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (error || !grant) return <p className="error">Could not load this grant.</p>;

  const open = grant.status === "OPEN";

  function toggleStatus() {
    const msg = open
      ? "Close this grant? Applicants will no longer be able to apply."
      : "Reopen this grant for applications?";
    if (window.confirm(msg)) statusMutation.mutate();
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">{CATEGORY_LABELS[grant.category]}</span>
          <h1>{grant.name}</h1>
        </div>
        {isReviewer ? (
          <div className="actions">
            <Link className="btn" to={`/grants/${grant.id}/edit`}>
              Edit grant
            </Link>
            <button className={open ? "warn" : "ok"} onClick={toggleStatus} disabled={statusMutation.isPending}>
              {open ? "Close grant" : "Reopen grant"}
            </button>
          </div>
        ) : (
          open && (
            <Link className="btn" to={`/grants/${grant.id}/apply`}>
              Apply for this grant
            </Link>
          )
        )}
      </div>

      <dl className="details">
        <div>
          <dt>Short code</dt>
          <dd>{grant.shortCode}</dd>
        </div>
        <div>
          <dt>Funds allocated</dt>
          <dd>{Number(grant.fundsAllocated).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Closing date</dt>
          <dd>{grant.openUntil}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{grant.status}</dd>
        </div>
      </dl>

      {grant.description && <p className="description">{grant.description}</p>}

      <section className="history">
        <h3>Documents</h3>
        {grant.documents.length === 0 ? (
          <p className="muted">No documents attached.</p>
        ) : (
          <ul className="doc-list">
            {grant.documents.map((d) => (
              <li key={d.id}>
                <button className="link-btn" onClick={() => downloadGrantDocument(grant.id, d.id, d.filename)}>
                  {d.filename}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="history">
        <h3>Review workflow</h3>
        <ol className="workflow-steps">
          {grant.steps.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
