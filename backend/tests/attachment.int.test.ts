import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { api, authHeader, createUsers, makeApplication, resetDb, disconnectDb, type SeededUsers } from "./helpers";

let users: SeededUsers;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});
afterAll(disconnectDb);

const PDF = Buffer.from("%PDF-1.4 minimal pdf body", "latin1");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe("attachment upload", () => {
  it("owner uploads a valid PDF to their DRAFT (200), preserving the original filename", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", PDF, { filename: "budget.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(200);
    expect(res.body.attachment).toMatchObject({ filename: "budget.pdf", mime: "application/pdf" });
  });

  it("accepts a PNG by its magic bytes", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", PNG, { filename: "diagram.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.attachment.mime).toBe("image/png");
  });

  it("rejects a disallowed type even when the extension/content-type lie (422)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", Buffer.from("just plain text"), { filename: "evil.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(422);
  });

  it("rejects an oversize file (422)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const big = Buffer.concat([PDF, Buffer.alloc(2048, 0x20)]); // > 1KB test limit
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", big, { filename: "big.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(422);
  });

  it("cannot attach to a non-DRAFT application (409)", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(409);
  });

  it("a non-owner applicant cannot attach (404 — hidden)", async () => {
    const app = await makeApplication(users.applicantB.id, "DRAFT");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.applicantA))
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(404);
  });

  it("a reviewer cannot attach (403 — not the owner)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(users.reviewer))
      .attach("file", PDF, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });
});

describe("attachment download (authz-gated)", () => {
  async function uploadTo(ownerId: string) {
    const app = await makeApplication(ownerId, "DRAFT");
    await api()
      .post(`/api/applications/${app.id}/attachment`)
      .set("Authorization", authHeader(ownerId === users.applicantA.id ? users.applicantA : users.applicantB))
      .attach("file", PDF, { filename: "doc.pdf", contentType: "application/pdf" });
    return app;
  }

  it("the owner can download their attachment (200)", async () => {
    const app = await uploadTo(users.applicantA.id);
    const res = await api().get(`/api/applications/${app.id}/attachment`).set("Authorization", authHeader(users.applicantA));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("doc.pdf");
  });

  it("a reviewer can download any attachment (200)", async () => {
    const app = await uploadTo(users.applicantA.id);
    const res = await api().get(`/api/applications/${app.id}/attachment`).set("Authorization", authHeader(users.reviewer));
    expect(res.status).toBe(200);
  });

  it("another applicant cannot download it (404 — hidden)", async () => {
    const app = await uploadTo(users.applicantA.id);
    const res = await api().get(`/api/applications/${app.id}/attachment`).set("Authorization", authHeader(users.applicantB));
    expect(res.status).toBe(404);
  });
});
