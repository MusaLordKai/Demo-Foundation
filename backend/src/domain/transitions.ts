/**
 * The heart of the system: a single PURE function deciding whether a case
 * action is allowed, given the application's position within its grant's
 * workflow (an ordered list of steps the reviewer defined). No I/O — so it is
 * exhaustively unit-tested (transitions.test.ts) and reused by every route.
 *
 * Lifecycle: DRAFT --submit--> IN_REVIEW @ step 0 --advance--> … --advance past
 * last step--> APPROVED. From any IN_REVIEW step: return -> DRAFT, reject ->
 * REJECTED. Only DRAFT is editable by the owner.
 */

export const STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"] as const;
export type Status = (typeof STATUSES)[number];

export const ROLES = ["APPLICANT", "REVIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ["submit", "advance", "return", "reject"] as const;
export type Action = (typeof ACTIONS)[number];

export const TERMINAL_STATUSES: readonly Status[] = ["APPROVED", "REJECTED"];

/** Only DRAFT is ever editable (and only by its owner — enforced at the route). */
export function isEditableStatus(status: Status): boolean {
  return status === "DRAFT";
}

export interface CaseActionInput {
  action: Action;
  status: Status;
  /** Current step index within the workflow; -1 when not in review (DRAFT). */
  stepIndex: number;
  /** Number of steps in the grant's workflow. */
  totalSteps: number;
  actorRole: Role;
  actorId: string;
  ownerId: string;
  comment?: string | null;
}

export type TransitionReason = "AUTHZ" | "ILLEGAL" | "COMMENT_REQUIRED";

export type CaseDecision =
  | { ok: true; toStatus: Status; toStepIndex: number | null }
  | { ok: false; reason: TransitionReason; message: string };

interface Rule {
  role: Role;
  requiresOwner: boolean;
  forbidsOwner: boolean;
  fromStatus: Status;
  commentRequired: boolean;
}

const RULES: Record<Action, Rule> = {
  submit: { role: "APPLICANT", requiresOwner: true, forbidsOwner: false, fromStatus: "DRAFT", commentRequired: false },
  advance: { role: "REVIEWER", requiresOwner: false, forbidsOwner: true, fromStatus: "IN_REVIEW", commentRequired: false },
  return: { role: "REVIEWER", requiresOwner: false, forbidsOwner: true, fromStatus: "IN_REVIEW", commentRequired: true },
  reject: { role: "REVIEWER", requiresOwner: false, forbidsOwner: true, fromStatus: "IN_REVIEW", commentRequired: true },
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Decide a case action. Order mirrors the HTTP precedence the API guarantees:
 * authorization (403) before transition legality (409) before payload
 * validation (422) — so an unauthorized caller learns nothing about state.
 */
export function evaluateCaseAction(input: CaseActionInput): CaseDecision {
  const rule = RULES[input.action];

  // 1. Authorization — role then ownership.
  if (input.actorRole !== rule.role) {
    return { ok: false, reason: "AUTHZ", message: `Only a ${rule.role} may ${input.action} a case.` };
  }
  if (rule.requiresOwner && input.actorId !== input.ownerId) {
    return { ok: false, reason: "AUTHZ", message: `Only the owner may ${input.action} this case.` };
  }
  if (rule.forbidsOwner && input.actorId === input.ownerId) {
    return { ok: false, reason: "AUTHZ", message: `A reviewer cannot ${input.action} their own case.` };
  }

  // 2. Transition legality — correct state, and submit needs a workflow.
  if (input.status !== rule.fromStatus) {
    return { ok: false, reason: "ILLEGAL", message: `Cannot ${input.action} a case in ${input.status} state.` };
  }
  if (input.action === "submit" && input.totalSteps < 1) {
    return { ok: false, reason: "ILLEGAL", message: "This grant has no workflow steps configured." };
  }

  // 3. Payload — comment required on return/reject.
  if (rule.commentRequired && !hasText(input.comment)) {
    return { ok: false, reason: "COMMENT_REQUIRED", message: `A comment is required to ${input.action} a case.` };
  }

  // Resolve the resulting status + step index.
  switch (input.action) {
    case "submit":
      return { ok: true, toStatus: "IN_REVIEW", toStepIndex: 0 };
    case "advance":
      return input.stepIndex >= input.totalSteps - 1
        ? { ok: true, toStatus: "APPROVED", toStepIndex: null }
        : { ok: true, toStatus: "IN_REVIEW", toStepIndex: input.stepIndex + 1 };
    case "return":
      return { ok: true, toStatus: "DRAFT", toStepIndex: null };
    case "reject":
      return { ok: true, toStatus: "REJECTED", toStepIndex: null };
  }
}
