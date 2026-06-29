import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLogs } from "../api/logs";
import type { LogCategory, LogEntry } from "../api/types";

function detail(l: LogEntry): string {
  if (l.category === "SYSTEM") return l.message ?? "";
  const from = l.fromStep ?? l.fromStatus ?? "—";
  const to = l.toStep ?? l.toStatus ?? "—";
  const transition = `${from} → ${to}`;
  return l.comment ? `${transition} · “${l.comment}”` : transition;
}

export function Logs() {
  const [tab, setTab] = useState<LogCategory>("CASE");
  const [caseNumber, setCaseNumber] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["logs", tab, tab === "CASE" ? caseNumber : ""],
    queryFn: () => listLogs(tab, tab === "CASE" ? caseNumber.trim() || undefined : undefined),
  });

  return (
    <div className="card">
      <div className="card-head">
        <h1>Logs</h1>
        <div className="tabs">
          <button className={tab === "CASE" ? "tab active" : "tab"} onClick={() => setTab("CASE")}>
            Case logs
          </button>
          <button className={tab === "SYSTEM" ? "tab active" : "tab"} onClick={() => setTab("SYSTEM")}>
            System logs
          </button>
        </div>
      </div>

      {tab === "CASE" && (
        <label className="inline" style={{ marginBottom: "1rem" }}>
          Filter by case number
          <input
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="e.g. SPT-06-26-104"
          />
        </label>
      )}

      {isLoading && <p>Loading…</p>}
      {error && <p className="error">Failed to load logs.</p>}
      {data && data.length === 0 && <p className="muted">No log entries.</p>}

      {data && data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              {tab === "CASE" && <th>Case</th>}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.actor?.name ?? "System"}</td>
                <td>{l.action}</td>
                {tab === "CASE" && <td>{l.caseNumber ?? "—"}</td>}
                <td>{detail(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
