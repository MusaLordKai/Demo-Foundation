import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  createGrant,
  getGrant,
  setWorkflowSteps,
  updateGrant,
  uploadGrantDocument,
  downloadGrantDocument,
} from "../api/grants";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "../api/types";
import { ApiError } from "../api/client";
import { WorkflowStepsEditor } from "../components/WorkflowStepsEditor";

const DEFAULT_STEPS = ["Initial Screening", "Committee Review", "Due Diligence", "Final Decision"];

export function GrantForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [category, setCategory] = useState<Category>("SPORT");
  const [description, setDescription] = useState("");
  const [fundsAllocated, setFundsAllocated] = useState("");
  const [openUntil, setOpenUntil] = useState("");
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: ["grant", id], queryFn: () => getGrant(id!), enabled: isEdit });

  useEffect(() => {
    const g = existing.data;
    if (g) {
      setName(g.name);
      setShortCode(g.shortCode);
      setCategory(g.category);
      setDescription(g.description);
      setFundsAllocated(g.fundsAllocated);
      setOpenUntil(g.openUntil);
      setSteps(g.steps.map((s) => s.name));
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        name,
        shortCode,
        category,
        description,
        fundsAllocated: Number(fundsAllocated),
        openUntil,
      };
      if (isEdit) {
        await updateGrant(id!, fields);
        await setWorkflowSteps(id!, steps);
        return id!;
      }
      const grant = await createGrant({ ...fields, steps });
      for (const file of queuedFiles) await uploadGrantDocument(grant.id, file);
      return grant.id;
    },
    onSuccess: (grantId) => {
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      queryClient.invalidateQueries({ queryKey: ["grant", grantId] });
      navigate(`/grants/${grantId}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the grant."),
  });

  const uploadDoc = useMutation({
    mutationFn: (file: File) => uploadGrantDocument(id!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grant", id] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Upload failed."),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isEdit) uploadDoc.mutate(file);
    else setQueuedFiles((q) => [...q, file]);
    e.target.value = "";
  }

  return (
    <div className="card narrow-wide">
      <h1>{isEdit ? "Edit grant" : "New grant"}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <label>
          Grant name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </label>

        <div className="grid-2">
          <label>
            Short code (3 letters)
            <input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              maxLength={3}
              minLength={3}
              pattern="[A-Za-z]{3}"
              placeholder="SPT"
              required
            />
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="grid-2">
          <label>
            Funds allocated
            <input
              type="number"
              min="1"
              step="0.01"
              value={fundsAllocated}
              onChange={(e) => setFundsAllocated(e.target.value)}
              required
            />
          </label>
          <label>
            Open until (closing date)
            <input type="date" value={openUntil} onChange={(e) => setOpenUntil(e.target.value)} required />
          </label>
        </div>

        <div className="field-block">
          <span className="field-label">Workflow steps</span>
          <p className="muted small">Applications to this grant move through these steps in order.</p>
          <WorkflowStepsEditor steps={steps} onChange={setSteps} />
        </div>

        <div className="field-block">
          <span className="field-label">Documents (PDF/PNG/JPEG)</span>
          {isEdit && existing.data && existing.data.documents.length > 0 && (
            <ul className="doc-list">
              {existing.data.documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => downloadGrantDocument(id!, d.id, d.filename)}
                  >
                    {d.filename}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isEdit && queuedFiles.length > 0 && (
            <ul className="doc-list">
              {queuedFiles.map((f, i) => (
                <li key={i}>{f.name} (will upload on create)</li>
              ))}
            </ul>
          )}
          <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={onFile} />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isEdit ? "Save grant" : "Create grant"}
          </button>
          <button type="button" className="link-btn" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
