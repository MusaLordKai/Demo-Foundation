import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  api,
  authHeader,
  createUsers,
  makeApplication,
  makeGrant,
  auditFor,
  resetDb,
  disconnectDb,
  type SeededUsers,
} from "./helpers";

let users: SeededUsers;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});
afterAll(disconnectDb);

const post = (id: string, action: string, who: SeededUsers[keyof SeededUsers], body?: object) =>
  api().post(`/api/applications/${id}/${action}`).set("Authorization", authHeader(who)).send(body ?? {});

describe("authorization — forbidden case actions", () => {
  it("HEADLINE: an applicant cannot advance their own case via the API (403)", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "advance", users.applicantA)).status).toBe(403);
  });

  it("an applicant cannot return / reject (403)", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    for (const action of ["return", "reject"]) {
      expect((await post(app.id, action, users.applicantA, { comment: "x" })).status, action).toBe(403);
    }
  });

  it("a reviewer cannot submit (owner-only) (403)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    expect((await post(app.id, "submit", users.reviewer)).status).toBe(403);
  });

  it("a reviewer cannot act on their OWN case — conflict of interest (403)", async () => {
    const app = await makeApplication(users.reviewerOwner.id, "IN_REVIEW");
    expect((await post(app.id, "advance", users.reviewerOwner)).status).toBe(403);
  });

  it("a forged role in the body is ignored — applicant still cannot advance (403)", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "advance", users.applicantA, { role: "REVIEWER" })).status).toBe(403);
  });

  it("acting on another applicant's case is hidden (404)", async () => {
    const app = await makeApplication(users.applicantB.id, "DRAFT");
    expect((await post(app.id, "submit", users.applicantA)).status).toBe(404);
  });

  it("acting on a non-existent case is 404", async () => {
    expect((await post("00000000-0000-0000-0000-000000000000", "advance", users.reviewer)).status).toBe(404);
  });
});

describe("workflow legality (2-step grants)", () => {
  it("owner submits a DRAFT -> IN_REVIEW at step 0", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await post(app.id, "submit", users.applicantA);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.currentStepIndex).toBe(0);
  });

  it("reviewer advances within the workflow then to APPROVED", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW"); // step 0 of 2
    const step1 = await post(app.id, "advance", users.reviewer);
    expect(step1.body.status).toBe("IN_REVIEW");
    expect(step1.body.currentStepIndex).toBe(1);
    const approved = await post(app.id, "advance", users.reviewer);
    expect(approved.body.status).toBe("APPROVED");
    expect(approved.body.currentStep).toBeNull();
  });

  it("reviewer cannot advance a DRAFT (409)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    expect((await post(app.id, "advance", users.reviewer)).status).toBe(409);
  });

  it("cannot act on a terminal case (409)", async () => {
    const app = await makeApplication(users.applicantA.id, "APPROVED");
    expect((await post(app.id, "advance", users.reviewer)).status).toBe(409);
  });

  it("cannot submit a non-DRAFT (409)", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "submit", users.applicantA)).status).toBe(409);
  });
});

describe("comment requirement", () => {
  it("return without a comment is 422", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "return", users.reviewer)).status).toBe(422);
  });

  it("reject with whitespace-only comment is 422", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "reject", users.reviewer, { comment: "   " })).status).toBe(422);
  });

  it("reject with a comment succeeds and stores it", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await post(app.id, "reject", users.reviewer, { comment: "Out of scope" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect((await auditFor(app.id)).at(-1)).toMatchObject({ action: "reject", comment: "Out of scope" });
  });

  it("advance does not require a comment", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await post(app.id, "advance", users.reviewer)).status).toBe(200);
  });

  it("return sends the case back to DRAFT", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await post(app.id, "return", users.reviewer, { comment: "Add detail" });
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.currentStep).toBeNull();
  });
});

describe("case log correctness", () => {
  it("a successful action writes one CASE log with step/status/actor", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    await post(app.id, "advance", users.reviewer);
    const log = await auditFor(app.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: "advance",
      fromStatus: "IN_REVIEW",
      toStatus: "IN_REVIEW",
      actorId: users.reviewer.id,
    });
    expect(log[0].toStep).toBeTruthy();
  });

  it("a failed action writes no CASE log", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    await post(app.id, "return", users.reviewer); // 422
    expect(await auditFor(app.id)).toHaveLength(0);
  });
});

describe("concurrency", () => {
  it("two reviewers advancing the same case: one 200, one 409", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const [a, b] = await Promise.all([
      post(app.id, "advance", users.reviewer),
      post(app.id, "advance", users.reviewerOwner),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await auditFor(app.id)).toHaveLength(1);
  });
});

describe("monitor data + full round-trip", () => {
  it("detail exposes the workflow and current position", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await api().get(`/api/applications/${app.id}`).set("Authorization", authHeader(users.reviewer));
    expect(res.body.workflow.length).toBe(2);
    expect(res.body.currentStepIndex).toBe(0);
  });

  it("create -> submit -> advance -> return -> edit -> submit -> advance×2 -> APPROVED", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "RTP", steps: ["Screening", "Decision"], fundsAllocated: 10000 });
    const created = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId: grant.id, amount: 500, needBy: "2026-12-01" });
    const id = created.body.id;

    expect((await post(id, "submit", users.applicantA)).body.status).toBe("IN_REVIEW");
    expect((await post(id, "advance", users.reviewer)).body.currentStepIndex).toBe(1);
    expect((await post(id, "return", users.reviewer, { comment: "Revise budget" })).body.status).toBe("DRAFT");

    const edit = await api()
      .put(`/api/applications/${id}`)
      .set("Authorization", authHeader(users.applicantA))
      .send({ amount: 600, needBy: "2026-12-05" });
    expect(edit.status).toBe(200);

    expect((await post(id, "submit", users.applicantA)).body.status).toBe("IN_REVIEW");
    await post(id, "advance", users.reviewer); // -> step 1
    expect((await post(id, "advance", users.reviewer)).body.status).toBe("APPROVED");

    const actions = (await auditFor(id)).map((l) => l.action);
    expect(actions).toEqual(["CREATE", "submit", "advance", "return", "submit", "advance", "advance"]);
  });
});
