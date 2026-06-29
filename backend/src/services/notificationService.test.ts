import { describe, it, expect } from "vitest";
import { caseEventEmails, type CaseLike } from "./notificationService";

const base: CaseLike = {
  caseNumber: "SPT-06-26-100",
  title: "Community Sports Fund",
  ownerEmail: "owner@test.dev",
  ownerName: "Aisha",
};

describe("caseEventEmails — pure notification builder", () => {
  it("submit → owner confirmation + one alert per reviewer", () => {
    const out = caseEventEmails(base, "submit", "IN_REVIEW", "Initial Screening", null, [
      "r1@test.dev",
      "r2@test.dev",
    ]);
    expect(out).toHaveLength(3);
    const owner = out.find((e) => e.to === "owner@test.dev")!;
    expect(owner.subject.toLowerCase()).toContain("submitted");
    expect(out.filter((e) => e.subject.includes("awaiting review"))).toHaveLength(2);
  });

  it("reject → single owner email carrying the comment", () => {
    const out = caseEventEmails(base, "reject", "REJECTED", null, "Out of scope", []);
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe("owner@test.dev");
    expect(out[0].subject).toContain("Rejected");
    expect(out[0].text).toContain("has been rejected");
    expect(out[0].text).toContain("Out of scope");
  });

  it("advance to APPROVED → owner 'approved' email", () => {
    const out = caseEventEmails(base, "advance", "APPROVED", null, null, []);
    expect(out).toHaveLength(1);
    expect(out[0].subject).toContain("Approved");
    expect(out[0].text).toContain("has been approved");
  });

  it("advance mid-workflow → owner email names the new step", () => {
    const out = caseEventEmails(base, "advance", "IN_REVIEW", "Committee Review", null, []);
    expect(out[0].text).toContain('advanced to "Committee Review"');
  });

  it("return → owner 'returned for changes' email with comment", () => {
    const out = caseEventEmails(base, "return", "DRAFT", null, "Add budget detail", []);
    expect(out[0].subject).toContain("Returned for changes");
    expect(out[0].text).toContain("returned for changes");
    expect(out[0].text).toContain("Add budget detail");
  });

  it("no owner email → only reviewer alerts are produced on submit", () => {
    const out = caseEventEmails({ ...base, ownerEmail: null }, "submit", "IN_REVIEW", "Initial Screening", null, [
      "r1@test.dev",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe("r1@test.dev");
  });
});
