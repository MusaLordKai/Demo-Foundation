import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  api,
  authHeader,
  createUsers,
  makeGrant,
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

const close = (id: string, who: SeededUsers[keyof SeededUsers]) =>
  api().post(`/api/grants/${id}/close`).set("Authorization", authHeader(who));
const reopen = (id: string, who: SeededUsers[keyof SeededUsers]) =>
  api().post(`/api/grants/${id}/reopen`).set("Authorization", authHeader(who));

describe("close / reopen grant — reviewer only", () => {
  it("reviewer closes an open grant → status CLOSED", async () => {
    const grant = await makeGrant(users.reviewer.id, { status: "OPEN" });
    const res = await close(grant.id, users.reviewer);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CLOSED");
  });

  it("closing hides the grant from applicants and blocks new applications", async () => {
    const grant = await makeGrant(users.reviewer.id, { status: "OPEN" });
    await close(grant.id, users.reviewer);

    const list = await api().get("/api/grants").set("Authorization", authHeader(users.applicantA));
    expect(list.body.find((g: { id: string }) => g.id === grant.id)).toBeUndefined();

    const apply = await api()
      .post("/api/applications")
      .set("Authorization", authHeader(users.applicantA))
      .send({ grantId: grant.id, amount: 100, needBy: "2026-12-01" });
    expect(apply.status).toBe(422);
  });

  it("reviewer can reopen a closed grant", async () => {
    const grant = await makeGrant(users.reviewer.id, { status: "CLOSED" });
    const res = await reopen(grant.id, users.reviewer);
    expect(res.body.status).toBe("OPEN");
  });

  it("an applicant cannot close a grant → 403", async () => {
    const grant = await makeGrant(users.reviewer.id, { status: "OPEN" });
    expect((await close(grant.id, users.applicantA)).status).toBe(403);
  });

  it("closing writes a SYSTEM log entry", async () => {
    const grant = await makeGrant(users.reviewer.id, { status: "OPEN" });
    await close(grant.id, users.reviewer);
    const logs = await api().get("/api/logs?category=SYSTEM").set("Authorization", authHeader(users.reviewer));
    expect(logs.body.some((l: { action: string }) => l.action === "grant.closed")).toBe(true);
  });

  it("closing a non-existent grant → 404", async () => {
    const res = await close("00000000-0000-0000-0000-000000000000", users.reviewer);
    expect(res.status).toBe(404);
  });
});
