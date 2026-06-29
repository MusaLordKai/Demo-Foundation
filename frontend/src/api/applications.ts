import { apiGet, apiPost, apiPut, apiUpload, getToken } from "./client";
import type { Application, ApplicationInput, ApplicationUpdate, ReviewerAction, Status } from "./types";

export const listApplications = (status?: Status) =>
  apiGet<Application[]>(`/applications${status ? `?status=${status}` : ""}`);

export const getApplication = (id: string) => apiGet<Application>(`/applications/${id}`);

export const createApplication = (input: ApplicationInput) =>
  apiPost<Application>("/applications", input);

export const updateApplication = (id: string, input: ApplicationUpdate) =>
  apiPut<Application>(`/applications/${id}`, input);

export const submitApplication = (id: string) => apiPost<Application>(`/applications/${id}/submit`);

/** Reviewer step actions: advance / return / reject. */
export const caseAction = (id: string, action: ReviewerAction, comment?: string) =>
  apiPost<Application>(`/applications/${id}/${action}`, comment ? { comment } : {});

export const uploadAttachment = (id: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return apiUpload<Application>(`/applications/${id}/attachment`, fd);
};

/** Build an authenticated download URL is not possible (token in header), so
 * fetch the file as a blob and trigger a browser download. */
export async function downloadAttachment(id: string, filename: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/applications/${id}/attachment`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
