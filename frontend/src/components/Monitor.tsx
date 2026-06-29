import type { Status, WorkflowStep } from "../api/types";

type StepState = "done" | "current" | "todo";

function stepState(i: number, currentStepIndex: number | null, status: Status): StepState {
  if (status === "APPROVED") return "done";
  if (status === "REJECTED") return "todo";
  if (status === "DRAFT" || currentStepIndex === null) return "todo";
  if (i < currentStepIndex) return "done";
  if (i === currentStepIndex) return "current";
  return "todo";
}

/** Visual workflow progress: where a case sits in its grant's review steps. */
export function Monitor({
  workflow,
  currentStepIndex,
  status,
}: {
  workflow: WorkflowStep[];
  currentStepIndex: number | null;
  status: Status;
}) {
  if (workflow.length === 0) return <p className="muted">No workflow configured.</p>;

  const outcome =
    status === "APPROVED" ? "done" : status === "REJECTED" ? "rejected" : status === "DRAFT" ? "todo" : "todo";

  return (
    <ol className="monitor">
      {workflow.map((step, i) => {
        const state = stepState(i, currentStepIndex ?? null, status);
        return (
          <li key={step.id} className={`monitor-step monitor-${state}`}>
            <span className="monitor-dot">{state === "done" ? "✓" : i + 1}</span>
            <span className="monitor-label">{step.name}</span>
          </li>
        );
      })}
      <li className={`monitor-step monitor-${outcome}`}>
        <span className="monitor-dot">{outcome === "done" ? "✓" : outcome === "rejected" ? "✕" : "★"}</span>
        <span className="monitor-label">
          {status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Decision"}
        </span>
      </li>
    </ol>
  );
}
