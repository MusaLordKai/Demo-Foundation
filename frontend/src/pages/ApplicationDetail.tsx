import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  caseAction,
  deleteApplication,
  downloadAttachment,
  getApplication,
  submitApplication,
} from "../api/applications";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { AuditTrail } from "../components/AuditTrail";
import { Monitor } from "../components/Monitor";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS, type Application, type ReviewerAction } from "../api/types";

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: app, isLoading, error } = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id!),
  });

  const mutation = useMutation({
    mutationFn: (run: () => Promise<Application>) => run(),
    onSuccess: () => {
      setComment("");
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteApplication(app!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate("/applications");
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Could not delete this draft."),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error || !app) return <p className="error">Could not load this case.</p>;

  const isOwner = user?.id === app.ownerId;
  const isReviewer = user?.role === "REVIEWER";
  const reviewerOwnsIt = isReviewer && isOwner;
  const canReview = isReviewer && !isOwner && app.status === "IN_REVIEW";
  const atLastStep =
    app.workflow && app.currentStepIndex !== null && app.currentStepIndex === (app.workflow.length ?? 0) - 1;
  // Deletable only while a brand-new draft (never submitted → folder "DRAFT", not "REVERTED").
  const canDelete = isOwner && app.status === "DRAFT" && app.folder === "DRAFT";

  function runReviewer(action: ReviewerAction) {
    if ((action === "reject" || action === "return") && comment.trim() === "") {
      setActionError(`A comment is required to ${action}.`);
      return;
    }
    mutation.mutate(() => caseAction(app!.id, action, comment.trim() || undefined));
  }

  function onDelete() {
    if (window.confirm("Delete this draft permanently? This cannot be undone.")) {
      deleteMutation.mutate();
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Case {app.caseNumber}</span>
          <h1>{app.title}</h1>
        </div>
        <StatusBadge state={app.folder} />
      </div>

      {app.workflow && app.workflow.length > 0 && (
        <section className="monitor-section">
          <h3>Monitor</h3>
          <Monitor workflow={app.workflow} currentStepIndex={app.currentStepIndex ?? null} status={app.status} />
        </section>
      )}

      <dl className="details">
        <div>
          <dt>Grant</dt>
          <dd>{app.grant?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{CATEGORY_LABELS[app.category]}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{Number(app.amount).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Need by</dt>
          <dd>{app.needBy}</dd>
        </div>
        <div>
          <dt>Applicant</dt>
          <dd>{app.owner?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{app.reviewer?.name ?? "—"}</dd>
        </div>
      </dl>

      {app.description && <p className="description">{app.description}</p>}

      {app.attachment?.filename && (
        <p>
          Attachment:{" "}
          <button className="link-btn" onClick={() => downloadAttachment(app.id, app.attachment!.filename!)}>
            {app.attachment.filename}
          </button>
        </p>
      )}

      {/* Applicant — only on their own DRAFT. */}
      {isOwner && app.status === "DRAFT" && (
        <div className="actions">
          <Link className="btn" to={`/applications/${app.id}/edit`}>
            Edit
          </Link>
          <button onClick={() => mutation.mutate(() => submitApplication(app.id))} disabled={mutation.isPending}>
            Submit for review
          </button>
          {canDelete && (
            <button className="danger" onClick={onDelete} disabled={deleteMutation.isPending}>
              Delete draft
            </button>
          )}
        </div>
      )}

      {reviewerOwnsIt && <p className="muted">You own this case, so you cannot review it.</p>}

      {canReview && (
        <div className="review-panel">
          <h3>Review — {app.currentStep?.name ?? "current step"}</h3>
          <textarea
            placeholder="Comment (required to reject or return)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <div className="actions">
            <button className="ok" onClick={() => runReviewer("advance")} disabled={mutation.isPending}>
              {atLastStep ? "Approve (final step)" : "Advance to next step"}
            </button>
            <button className="warn" onClick={() => runReviewer("return")} disabled={mutation.isPending}>
              Return for changes
            </button>
            <button className="danger" onClick={() => runReviewer("reject")} disabled={mutation.isPending}>
              Reject
            </button>
          </div>
        </div>
      )}

      {actionError && <p className="error">{actionError}</p>}

      <section className="history">
        <h3>Case history</h3>
        <AuditTrail entries={app.caseLog ?? []} />
      </section>
    </div>
  );
}
