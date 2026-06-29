import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { api, authHeader, createUsers, makeGrant, resetDb, disconnectDb, type SeededUsers } from "./helpers";

let users: SeededUsers;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});
afterAll(disconnectDb);

const validGrant = {
  name: "Community Sports Fund",
  shortCode: "spt", // lowercase on purpose — should be upper-cased
  category: "SPORT",
  description: "Funding for grassroots sport.",
  fundsAllocated: 50000,
  openUntil: "2026-12-31",
};

describe("grant creation", () => {
  it("reviewer creates a grant (201) with default workflow steps; shortcode upper-cased", async () => {
    const res = await api().post("/api/grants").set("Authorization", authHeader(users.reviewer)).send(validGrant);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Community Sports Fund", shortCode: "SPT", category: "SPORT", status: "OPEN" });
    expect(res.body.steps.length).toBeGreaterThanOrEqual(1);
    expect(res.body.steps.map((s: { position: number }) => s.position)).toEqual(
      res.body.steps.map((_: unknown, i: number) => i),
    );
  });

  it("accepts custom initial steps in order", async () => {
    const res = await api()
      .post("/api/grants")
      .set("Authorization", authHeader(users.reviewer))
      .send({ ...validGrant, shortCode: "ABC", steps: ["A", "B", "C"] });
    expect(res.status).toBe(201);
    expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("applicant cannot create a grant (403)", async () => {
    const res = await api().post("/api/grants").set("Authorization", authHeader(users.applicantA)).send(validGrant);
    expect(res.status).toBe(403);
  });

  it("rejects a short code that is not exactly 3 letters (422)", async () => {
    for (const shortCode of ["AB", "ABCD", "12A", "A1B"]) {
      const res = await api()
        .post("/api/grants")
        .set("Authorization", authHeader(users.reviewer))
        .send({ ...validGrant, shortCode });
      expect(res.status, shortCode).toBe(422);
    }
  });

  it("rejects a duplicate short code (422)", async () => {
    await makeGrant(users.reviewer.id, { shortCode: "DUP" });
    const res = await api()
      .post("/api/grants")
      .set("Authorization", authHeader(users.reviewer))
      .send({ ...validGrant, shortCode: "DUP" });
    expect(res.status).toBe(422);
  });
});

describe("grant listing & visibility", () => {
  beforeEach(async () => {
    await makeGrant(users.reviewer.id, { shortCode: "OPN", status: "OPEN", openUntil: new Date("2999-01-01") });
    await makeGrant(users.reviewer.id, { shortCode: "CLS", status: "CLOSED" });
    await makeGrant(users.reviewer.id, { shortCode: "PST", status: "OPEN", openUntil: new Date("2000-01-01") });
  });

  it("applicant sees only grants open for application", async () => {
    const res = await api().get("/api/grants").set("Authorization", authHeader(users.applicantA));
    expect(res.status).toBe(200);
    expect(res.body.map((g: { shortCode: string }) => g.shortCode)).toEqual(["OPN"]);
  });

  it("reviewer sees all grants", async () => {
    const res = await api().get("/api/grants").set("Authorization", authHeader(users.reviewer));
    expect(res.body).toHaveLength(3);
  });
});

describe("grant editing & workflow steps", () => {
  it("reviewer updates a grant (200)", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "EDT" });
    const res = await api()
      .put(`/api/grants/${grant.id}`)
      .set("Authorization", authHeader(users.reviewer))
      .send({ ...validGrant, shortCode: "EDT", name: "Renamed Fund" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Fund");
  });

  it("applicant cannot edit a grant (403)", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "NOP" });
    const res = await api()
      .put(`/api/grants/${grant.id}`)
      .set("Authorization", authHeader(users.applicantA))
      .send({ ...validGrant, shortCode: "NOP" });
    expect(res.status).toBe(403);
  });

  it("reviewer replaces workflow steps (reorder / add / remove) and order is preserved", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "WFL", steps: ["One", "Two"] });
    const res = await api()
      .put(`/api/grants/${grant.id}/workflow`)
      .set("Authorization", authHeader(users.reviewer))
      .send({ steps: ["Due Diligence", "Screening", "Committee", "Decision"] });
    expect(res.status).toBe(200);
    expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual([
      "Due Diligence",
      "Screening",
      "Committee",
      "Decision",
    ]);
    expect(res.body.steps.map((s: { position: number }) => s.position)).toEqual([0, 1, 2, 3]);
  });

  it("rejects an empty workflow (422)", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "EMP" });
    const res = await api()
      .put(`/api/grants/${grant.id}/workflow`)
      .set("Authorization", authHeader(users.reviewer))
      .send({ steps: [] });
    expect(res.status).toBe(422);
  });
});

describe("grant documents", () => {
  const PDF = Buffer.from("%PDF-1.4 guidelines", "latin1");

  it("reviewer uploads a document; any user can download it", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "DOC" });
    const up = await api()
      .post(`/api/grants/${grant.id}/documents`)
      .set("Authorization", authHeader(users.reviewer))
      .attach("file", PDF, { filename: "guidelines.pdf", contentType: "application/pdf" });
    expect(up.status).toBe(200);
    expect(up.body.documents).toHaveLength(1);

    const docId = up.body.documents[0].id;
    const dl = await api()
      .get(`/api/grants/${grant.id}/documents/${docId}`)
      .set("Authorization", authHeader(users.applicantA));
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain("guidelines.pdf");
  });

  it("applicant cannot upload a document (403)", async () => {
    const grant = await makeGrant(users.reviewer.id, { shortCode: "NDU" });
    const res = await api()
      .post(`/api/grants/${grant.id}/documents`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });
});
