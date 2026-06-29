import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { createApplication, getApplication, updateApplication, uploadAttachment } from "../api/applications";
import { getGrant } from "../api/grants";
import { CATEGORY_LABELS } from "../api/types";
import { ApiError } from "../api/client";

export function ApplicationForm() {
  const { grantId, id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [needBy, setNeedBy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Apply mode loads the grant; edit mode loads the existing application.
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

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title, description, amount: Number(amount), needBy };
      if (isEdit) {
        await updateApplication(id!, payload);
        if (file) await uploadAttachment(id!, file);
        return id!;
      }
      const app = await createApplication({ grantId: grantId!, ...payload });
      if (file) await uploadAttachment(app.id, file);
      return app.id;
    },
    onSuccess: (appId) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", appId] });
      navigate(`/applications/${appId}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save your application."),
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

  return (
    <div className="card narrow-wide">
      <h1>{isEdit ? "Edit application" : "Apply for funding"}</h1>

      {grant && (
        <div className="grant-banner">
          <span className="eyebrow">{CATEGORY_LABELS[grant.category]}</span>
          <strong>{grant.name}</strong>
          <span className="muted small">
            Up to {Number(grant.fundsAllocated).toLocaleString()} · closes {grant.openUntil}
          </span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
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
          <button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Submit application as draft"}
          </button>
          <button type="button" className="link-btn" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
