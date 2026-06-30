import { apiGet, apiPost, apiPut, apiUpload, getToken } from "./client";
import type { Grant, GrantInput } from "./types";

export const listGrants = () => apiGet<Grant[]>("/grants");

export const getGrant = (id: string) => apiGet<Grant>(`/grants/${id}`);

export const createGrant = (input: GrantInput & { steps?: string[] }) =>
  apiPost<Grant>("/grants", input);

export const updateGrant = (id: string, input: GrantInput) => apiPut<Grant>(`/grants/${id}`, input);

/** Close a grant to new applications (reviewer). */
export const closeGrant = (id: string) => apiPost<Grant>(`/grants/${id}/close`);

/** Reopen a previously closed grant (reviewer). */
export const reopenGrant = (id: string) => apiPost<Grant>(`/grants/${id}/reopen`);

export const setWorkflowSteps = (id: string, steps: string[]) =>
  apiPut<Grant>(`/grants/${id}/workflow`, { steps });

export const uploadGrantDocument = (id: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return apiUpload<Grant>(`/grants/${id}/documents`, fd);
};

export async function downloadGrantDocument(grantId: string, docId: string, filename: string) {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL ?? ""}/api/grants/${grantId}/documents/${docId}`,
    { headers: { Authorization: `Bearer ${getToken() ?? ""}` } },
  );
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
