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
import { prisma } from "../src/lib/prisma";

let users: SeededUsers;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});
afterAll(disconnectDb);

const del = (id: string, who: SeededUsers[keyof SeededUsers]) =>
  api().delete(`/api/applications/${id}`).set("Authorization", authHeader(who));

const exists = async (id: string) =>
  (await prisma.application.findUnique({ where: { id } })) !== null;

describe("delete application — owner, never-submitted draft only", () => {
  it("owner deletes a fresh draft → 204 and the row is gone", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    const res = await del(app.id, users.applicantA);
    expect(res.status).toBe(204);
    expect(await exists(app.id)).toBe(false);
  });

  it("cannot delete a draft that was already submitted before (returned/reverted) → 409", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    // Simulate prior submission history (a returned draft has a submit in its log).
    await prisma.logEntry.create({
      data: {
        category: "CASE",
        action: "submit",
        applicationId: app.id,
        caseNumber: app.caseNumber,
        toStatus: "IN_REVIEW",
      },
    });
    const res = await del(app.id, users.applicantA);
    expect(res.status).toBe(409);
    expect(await exists(app.id)).toBe(true);
  });

  it("cannot delete a case that is in review → 409", async () => {
    const app = await makeApplication(users.applicantA.id, "IN_REVIEW");
    expect((await del(app.id, users.applicantA)).status).toBe(409);
    expect(await exists(app.id)).toBe(true);
  });

  it("a reviewer cannot delete a case → 403 (role)", async () => {
    const app = await makeApplication(users.applicantA.id, "DRAFT");
    expect((await del(app.id, users.reviewer)).status).toBe(403);
    expect(await exists(app.id)).toBe(true);
  });

  it("another applicant cannot delete someone else's case → 404 (hidden)", async () => {
    const app = await makeApplication(users.applicantB.id, "DRAFT");
    expect((await del(app.id, users.applicantA)).status).toBe(404);
    expect(await exists(app.id)).toBe(true);
  });

  it("deleting a non-existent case → 404", async () => {
    expect((await del("00000000-0000-0000-0000-000000000000", users.applicantA)).status).toBe(404);
  });
});
