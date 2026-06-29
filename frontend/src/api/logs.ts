import { apiGet } from "./client";
import type { LogCategory, LogEntry } from "./types";

export const listLogs = (category: LogCategory, caseNumber?: string) => {
  const params = new URLSearchParams({ category });
  if (caseNumber) params.set("caseNumber", caseNumber);
  return apiGet<LogEntry[]>(`/logs?${params.toString()}`);
};
