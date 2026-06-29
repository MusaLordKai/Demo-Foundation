import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  api,
  authHeader,
  createUsers,
  makeApplication,
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

const asReviewer = (qs: string) =>
  api().get(`/api/applications${qs}`).set("Authorization", authHeader(users.reviewer));

describe("reviewer queue — pagination + search (power-up)", () => {
  it("no pagination params → plain array (back-compat)", async () => {
    await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await asReviewer("");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("page 1 and page 2 partition the queue with no overlap", async () => {
    await makeApplication(users.applicantA.id, "IN_REVIEW");
    await makeApplication(users.applicantA.id, "IN_REVIEW");
    await makeApplication(users.applicantA.id, "IN_REVIEW");

    const p1 = await asReviewer("?page=1&pageSize=2");
    expect(p1.status).toBe(200);
    expect(p1.body.total).toBe(3);
    expect(p1.body.totalPages).toBe(2);
    expect(p1.body.page).toBe(1);
    expect(p1.body.items).toHaveLength(2);

    const p2 = await asReviewer("?page=2&pageSize=2");
    expect(p2.body.items).toHaveLength(1);

    const ids = new Set([...p1.body.items, ...p2.body.items].map((a: { id: string }) => a.id));
    expect(ids.size).toBe(3); // no row appears on both pages
  });

  it("search by case number returns only the matching case", async () => {
    const target = await makeApplication(users.applicantA.id, "IN_REVIEW");
    await makeApplication(users.applicantA.id, "IN_REVIEW");
    const res = await asReviewer(`?q=${encodeURIComponent(target.caseNumber)}`);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].caseNumber).toBe(target.caseNumber);
  });

  it("search by applicant name matches that owner only", async () => {
    await makeApplication(users.applicantA.id, "IN_REVIEW"); // owner "Applicant A"
    await makeApplication(users.applicantB.id, "IN_REVIEW"); // owner "Applicant B"
    const res = await asReviewer("?q=Applicant%20A");
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].owner.name).toBe("Applicant A");
  });

  it("folder reflects the spec state: SUBMITTED at step 0, UNDER_REVIEW after advancing", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW"); // 2-step grant, step 0
    const before = await asReviewer("?page=1&pageSize=10");
    expect(before.body.items.find((x: { id: string }) => x.id === app.id).folder).toBe("SUBMITTED");

    await api().post(`/api/applications/${app.id}/advance`).set("Authorization", authHeader(users.reviewer)).send({});

    const after = await asReviewer("?page=1&pageSize=10");
    expect(after.body.items.find((x: { id: string }) => x.id === app.id).folder).toBe("UNDER_REVIEW");
  });
});
