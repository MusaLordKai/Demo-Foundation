import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  api,
  authHeader,
  createUsers,
  makeApplication,
  makeGrant,
  resetDb,
  disconnectDb,
  type SeededUsers,
} from "./helpers";
import { CASE_NUMBER_RE } from "../src/lib/caseNumber";

let users: SeededUsers;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});
afterAll(disconnectDb);

const validUpdate = { description: "Updated", amount: 500, needBy: "2026-12-31" };

describe("create application (from a grant)", () => {
  let grantId: string;
  let grantName: string;

  beforeEach(async () => {
    const grant = await makeGrant(users.reviewer.id, {
      name: "Community Sports Fund",
      shortCode: "SPT",
      category: "SPORT",
      fundsAllocated: 20000,
    });
    grantId = grant.id;
    grantName = grant.name;
  });

  it("applicant creates a DRAFT (201): title prefilled, case number assigned, category from grant", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId, description: "Our project", amount: 4500, needBy: "2026-12-31" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "DRAFT", title: grantName, category: "SPORT", ownerId: users.applicantA.id });
    expect(res.body.caseNumber).toMatch(CASE_NUMBER_RE);
    expect(res.body.caseNumber.startsWith("SPT-")).toBe(true);
    expect(res.body.grant).toMatchObject({ shortCode: "SPT", category: "SPORT" });
    expect(res.body.caseLog).toHaveLength(1);
    expect(res.body.caseLog[0]).toMatchObject({ action: "CREATE", toStatus: "DRAFT" });
  });

  it("uses a provided title over the grant name", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId, title: "Junior league kit", description: "", amount: 100, needBy: "2026-12-31" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Junior league kit");
  });

  it("reviewer cannot create an application (403)", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.reviewer))
      .send({ grantId, amount: 100, needBy: "2026-12-31" });
    expect(res.status).toBe(403);
  });

  it("rejects a missing grant (422)", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ amount: 100, needBy: "2026-12-31" });
    expect(res.status).toBe(422);
  });

  it("rejects an amount above the grant's funds (422)", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId, amount: 999999, needBy: "2026-12-31" });
    expect(res.status).toBe(422);
  });

  it("rejects a non-positive amount (422)", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId, amount: 0, needBy: "2026-12-31" });
    expect(res.status).toBe(422);
  });

  it("rejects applying to a closed grant (422)", async () => {
    const closed = await makeGrant(users.reviewer.id, { status: "CLOSED" });
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId: closed.id, amount: 100, needBy: "2026-12-31" });
    expect(res.status).toBe(422);
  });

  it("rejects a malformed JSON body (400)", async () => {
    const res = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .set("Content-Type", "application/json")
      .send("{ not json ");
    expect(res.status).toBe(400);
  });
});

describe("list applications", () => {
  beforeEach(async () => {
    await makeApplication(users.applicantA.id, "DRAFT");
    await makeApplication(users.applicantA.id, "IN_REVIEW");
    await makeApplication(users.applicantB.id, "IN_REVIEW");
    await makeApplication(users.applicantB.id, "APPROVED");
  });

  it("applicant sees all of their own cases", async () => {
    const res = await api().get("/api/applications").set("Authorization", authHeader(users.applicantA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((a: { ownerId: string }) => a.ownerId === users.applicantA.id)).toBe(true);
  });

  it("applicant can filter their own list by status", async () => {
    const res = await api()
      .get("/api/applications?status=IN_REVIEW")
      .set("Authorization", authHeader(users.applicantA));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("IN_REVIEW");
  });

  it("reviewer queue shows IN_REVIEW cases across all owners (not DRAFT/APPROVED)", async () => {
    const res = await api().get("/api/applications").set("Authorization", authHeader(users.reviewer));
    expect(res.status).toBe(200);
    const statuses = res.body.map((a: { status: string }) => a.status).sort();
    expect(statuses).toEqual(["IN_REVIEW", "IN_REVIEW"]);
  });

  it("rejects an invalid status filter (422)", async () => {
    const res = await api().get("/api/applications?status=NONSENSE").set("Authorization", authHeader(users.applicantA));
    expect(res.status).toBe(422);
  });
});

describe("get + edit visibility", () => {
  it("applicant gets 404 for another applicant's application (existence hidden)", async () => {
    const other = await makeApplication(users.applicantB.id, "DRAFT");
    const res = await api().get(`/api/applications/${other.id}`).set("Authorization", authHeader(users.applicantA));
    expect(res.status).toBe(404);
  });

  it("reviewer can get any application", async () => {
    const other = await makeApplication(users.applicantB.id, "IN_REVIEW");
    const res = await api().get(`/api/applications/${other.id}`).set("Authorization", authHeader(users.reviewer));
    expect(res.status).toBe(200);
  });

  it("owner edits their own DRAFT (200)", async () => {
    const draft = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .put(`/api/applications/${draft.id}`)
      .set("Authorization", authHeader(users.applicantA))
      .send({ ...validUpdate, title: "Edited title" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Edited title");
  });

  it("cannot edit a non-DRAFT application (409)", async () => {
    const submitted = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await api()
      .put(`/api/applications/${submitted.id}`)
      .set("Authorization", authHeader(users.applicantA))
      .send(validUpdate);
    expect(res.status).toBe(409);
  });

  it("non-owner applicant cannot edit (404 — hidden)", async () => {
    const draft = await makeApplication(users.applicantB.id, "DRAFT");
    const res = await api()
      .put(`/api/applications/${draft.id}`)
      .set("Authorization", authHeader(users.applicantA))
      .send(validUpdate);
    expect(res.status).toBe(404);
  });

  it("reviewer cannot edit an application (403)", async () => {
    const draft = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .put(`/api/applications/${draft.id}`)
      .set("Authorization", authHeader(users.reviewer))
      .send(validUpdate);
    expect(res.status).toBe(403);
  });
});
