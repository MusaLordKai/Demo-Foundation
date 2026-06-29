import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { api, resetDb, disconnectDb } from "./helpers";

beforeEach(resetDb);
afterAll(disconnectDb);

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        email: "user@test.dev",
        name: "Test User",
        role: "APPLICANT",
        passwordHash: await hashPassword("password123"),
      },
    });
  });

  it("returns a token and the principal on valid credentials", async () => {
    const res = await api().post("/api/auth/login").send({ email: "user@test.dev", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user).toMatchObject({ email: "user@test.dev", role: "APPLICANT" });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a wrong password with 401", async () => {
    const res = await api().post("/api/auth/login").send({ email: "user@test.dev", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401 (no user enumeration)", async () => {
    const res = await api().post("/api/auth/login").send({ email: "nobody@test.dev", password: "password123" });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed body with 422", async () => {
    const res = await api().post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
  });
});

describe("authentication guard", () => {
  it("rejects a protected route with no token (401)", async () => {
    const res = await api().get("/api/applications");
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with an invalid token (401)", async () => {
    const res = await api().get("/api/applications").set("Authorization", "Bearer not.a.real.token");
    expect(res.status).toBe(401);
  });
});
