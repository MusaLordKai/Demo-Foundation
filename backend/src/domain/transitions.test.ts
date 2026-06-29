import { describe, it, expect } from "vitest";
import {
  evaluateCaseAction,
  isEditableStatus,
  type Action,
  type Status,
  type CaseActionInput,
} from "./transitions";

const OWNER = "owner-1";
const OTHER = "other-1";

function input(over: Partial<CaseActionInput> & Pick<CaseActionInput, "action">): CaseActionInput {
  const reviewerAction = over.action !== "submit";
  const commentRequired = over.action === "return" || over.action === "reject";
  return {
    action: over.action,
    status: over.status ?? (over.action === "submit" ? "DRAFT" : "IN_REVIEW"),
    stepIndex: over.stepIndex ?? (over.action === "submit" ? -1 : 0),
    totalSteps: over.totalSteps ?? 4,
    actorRole: over.actorRole ?? (reviewerAction ? "REVIEWER" : "APPLICANT"),
    actorId: over.actorId ?? (reviewerAction ? OTHER : OWNER),
    ownerId: over.ownerId ?? OWNER,
    comment: "comment" in over ? over.comment : commentRequired ? "a reason" : null,
  };
}

describe("submit", () => {
  it("owner submits a DRAFT with a workflow -> IN_REVIEW at step 0", () => {
    expect(evaluateCaseAction(input({ action: "submit" }))).toEqual({
      ok: true,
      toStatus: "IN_REVIEW",
      toStepIndex: 0,
    });
  });
  it("a grant with no steps cannot be submitted -> ILLEGAL", () => {
    const r = evaluateCaseAction(input({ action: "submit", totalSteps: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ILLEGAL");
  });
  it("reviewer cannot submit -> AUTHZ", () => {
    const r = evaluateCaseAction(input({ action: "submit", actorRole: "REVIEWER", actorId: OWNER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AUTHZ");
  });
  it("non-owner applicant cannot submit -> AUTHZ", () => {
    const r = evaluateCaseAction(input({ action: "submit", actorId: OTHER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AUTHZ");
  });
  it("cannot submit a non-DRAFT -> ILLEGAL", () => {
    const r = evaluateCaseAction(input({ action: "submit", status: "IN_REVIEW" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ILLEGAL");
  });
});

describe("advance through the workflow", () => {
  it("advances to the next step when not at the last", () => {
    expect(evaluateCaseAction(input({ action: "advance", stepIndex: 0, totalSteps: 4 }))).toEqual({
      ok: true,
      toStatus: "IN_REVIEW",
      toStepIndex: 1,
    });
  });
  it("advancing past the last step -> APPROVED", () => {
    expect(evaluateCaseAction(input({ action: "advance", stepIndex: 3, totalSteps: 4 }))).toEqual({
      ok: true,
      toStatus: "APPROVED",
      toStepIndex: null,
    });
  });
  it("single-step workflow: advancing from step 0 -> APPROVED", () => {
    expect(evaluateCaseAction(input({ action: "advance", stepIndex: 0, totalSteps: 1 }))).toEqual({
      ok: true,
      toStatus: "APPROVED",
      toStepIndex: null,
    });
  });
  it("applicant cannot advance -> AUTHZ (headline)", () => {
    const r = evaluateCaseAction(input({ action: "advance", actorRole: "APPLICANT", actorId: OWNER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AUTHZ");
  });
  it("reviewer cannot advance their own case (COI) -> AUTHZ", () => {
    const r = evaluateCaseAction(input({ action: "advance", actorId: OWNER, ownerId: OWNER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AUTHZ");
  });
  it("cannot advance a DRAFT -> ILLEGAL", () => {
    const r = evaluateCaseAction(input({ action: "advance", status: "DRAFT" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ILLEGAL");
  });
});

describe("return & reject require a comment", () => {
  for (const action of ["return", "reject"] as Action[]) {
    it(`${action} without a comment -> COMMENT_REQUIRED`, () => {
      const r = evaluateCaseAction(input({ action, comment: null }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("COMMENT_REQUIRED");
    });
    it(`${action} with whitespace-only comment -> COMMENT_REQUIRED`, () => {
      const r = evaluateCaseAction(input({ action, comment: "   " }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("COMMENT_REQUIRED");
    });
    it(`${action} with a comment is allowed`, () => {
      expect(evaluateCaseAction(input({ action, comment: "because" })).ok).toBe(true);
    });
    it(`${action} from DRAFT is ILLEGAL (legality before comment)`, () => {
      const r = evaluateCaseAction(input({ action, status: "DRAFT", comment: null }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("ILLEGAL");
    });
  }
  it("return -> DRAFT", () => {
    expect(evaluateCaseAction(input({ action: "return", comment: "fix" }))).toEqual({
      ok: true,
      toStatus: "DRAFT",
      toStepIndex: null,
    });
  });
  it("reject -> REJECTED", () => {
    expect(evaluateCaseAction(input({ action: "reject", comment: "no" }))).toEqual({
      ok: true,
      toStatus: "REJECTED",
      toStepIndex: null,
    });
  });
});

describe("terminal states are immovable", () => {
  for (const status of ["APPROVED", "REJECTED"] as Status[]) {
    for (const action of ["advance", "return", "reject"] as Action[]) {
      it(`${action} on ${status} -> ILLEGAL`, () => {
        const r = evaluateCaseAction(input({ action, status, comment: "x" }));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("ILLEGAL");
      });
    }
  }
});

describe("authz is decided before legality", () => {
  it("applicant advancing a DRAFT is AUTHZ, not ILLEGAL", () => {
    const r = evaluateCaseAction(input({ action: "advance", status: "DRAFT", actorRole: "APPLICANT", actorId: OWNER }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("AUTHZ");
  });
});

describe("isEditableStatus", () => {
  it("only DRAFT is editable", () => {
    expect(isEditableStatus("DRAFT")).toBe(true);
    for (const s of ["IN_REVIEW", "APPROVED", "REJECTED"] as Status[]) {
      expect(isEditableStatus(s)).toBe(false);
    }
  });
});
