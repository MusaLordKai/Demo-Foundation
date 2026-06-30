import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { createApplication, getApplication, submitApplication, updateApplication, uploadAttachment } from "../api/applications";
import { getGrant } from "../api/grants";
import { CATEGORY_LABELS } from "../api/types";
import { ApiError } from "../api/client";

export function ApplicationForm() {
  const { grantId, id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [savedId, setSavedId] = useState<string | null>(isEdit ? id! : null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [needBy, setNeedBy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grantQuery = useQuery({ queryKey: ["grant", grantId], queryFn: () => getGrant(grantId!), enabled: !isEdit });
  const appQuery = useQuery({ queryKey: ["application", id], queryFn: () => getApplication(id!), enabled: isEdit });

  useEffect(() => {
    if (!isEdit && grantQuery.data) setTitle((t) => t || grantQuery.data.name);
  }, [grantQuery.data, isEdit]);

  useEffect(() => {
    const a = appQuery.data;
    if (a) {
      setTitle(a.title);
      setDescription(a.description);
      setAmount(a.amount);
      setNeedBy(a.needBy);
    }
  }, [appQuery.data]);

  const grant = isEdit ? appQuery.data?.grant : grantQuery.data;

  // Save as draft and advance to step 2.
  // Re-uses the existing draft ID if the user went back from step 2 to edit.
  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload = { title, description, amount: Number(amount), needBy };
      const existingId = isEdit ? id! : savedId;
      if (existingId) {
        await updateApplication(existingId, payload);
        if (file) await uploadAttachment(existingId, file);
        return existingId;
      }
      const app = await createApplication({ grantId: grantId!, ...payload });
      if (file) await uploadAttachment(app.id, file);
      return app.id;
    },
    onSuccess: (appId) => {
      setSavedId(appId);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", appId] });
      setError(null);
      setStep(2);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save your application."),
  });

  // Submit from step 2 — transitions the draft into the review queue.
  const submitMutation = useMutation({
    mutationFn: () => submitApplication(savedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", savedId!] });
      navigate(`/applications/${savedId}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not submit your application."),
  });

  if (isEdit && appQuery.data && appQuery.data.status !== "DRAFT") {
    return (
      <div className="card narrow">
        <p className="error">This application can no longer be edited (it has left DRAFT).</p>
        <button className="link-btn" onClick={() => navigate(`/applications/${id}`)}>
          Back to case
        </button>
      </div>
    );
  }

  const GrantBanner = grant ? (
    <div className="grant-banner">
      <span className="eyebrow">{CATEGORY_LABELS[grant.category]}</span>
      <strong>{grant.name}</strong>
      <span className="muted small">
        Up to {Number(grant.fundsAllocated).toLocaleString()} · closes {grant.openUntil}
      </span>
    </div>
  ) : null;

  return (
    <div className="card narrow-wide">
      {/* Step indicator */}
      <div className="form-steps">
        <div className={`form-step${step >= 1 ? " form-step-active" : ""}`}>
          <span className="form-step-num">1</span>
          <span>Application details</span>
        </div>
        <div className="form-step-connector" />
        <div className={`form-step${step >= 2 ? " form-step-active" : ""}`}>
          <span className="form-step-num">2</span>
          <span>Review &amp; submit</span>
        </div>
      </div>

      {/* ── Step 1: fill the form ── */}
      {step === 1 && (
        <>
          <h1 style={{ marginBottom: "1rem" }}>{isEdit ? "Edit application" : "Apply for funding"}</h1>
          {GrantBanner}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              saveDraft.mutate();
            }}
          >
            <label>
              Application title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </label>
            <label>
              Project description
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="grid-2">
              <label>
                Amount requested
                <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </label>
              <label>
                Need by
                <input type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} required />
              </label>
            </div>
            <label>
              Supporting document (PDF/PNG/JPEG, optional)
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button type="submit" disabled={saveDraft.isPending}>
                {saveDraft.isPending ? "Saving draft…" : "Continue to review →"}
              </button>
              <button type="button" className="link-btn" onClick={() => navigate(-1)}>
                Cancel
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── Step 2: preview and submit ── */}
      {step === 2 && (
        <>
          <h1 style={{ marginBottom: "0.25rem" }}>Review your application</h1>
          <p className="muted" style={{ marginBottom: "1.25rem" }}>
            Your draft has been saved. Confirm the details below, then submit for review.
          </p>

          {GrantBanner}

          <dl className="details">
            <div>
              <dt>Title</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt>Amount requested</dt>
              <dd>{Number(amount).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Need by</dt>
              <dd>{needBy}</dd>
            </div>
            {file && (
              <div>
                <dt>Attachment</dt>
                <dd>{file.name}</dd>
              </div>
            )}
          </dl>

          {description && <p className="description">{description}</p>}

          {error && <p className="error">{error}</p>}

          <div className="form-actions">
            <button onClick={() => { setError(null); submitMutation.mutate(); }} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting…" : "Submit for review"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setError(null); setStep(1); }}
              disabled={submitMutation.isPending}
            >
              ← Back to edit
            </button>
            <button
              className="link-btn"
              onClick={() => navigate(`/applications/${savedId}`)}
              disabled={submitMutation.isPending}
            >
              Save as draft &amp; exit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
