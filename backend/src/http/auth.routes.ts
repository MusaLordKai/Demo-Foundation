import { Router } from "express";
import { prisma } from "../lib/prisma";
import { signToken, verifyPassword } from "../lib/auth";
import { loginSchema, parse } from "../lib/validation";
import { asyncHandler, unauthorized } from "./errors";
import { logSystem } from "../services/logService";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Same response for unknown email and wrong password — no user enumeration.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password.");
    }
    const principal = { id: user.id, email: user.email, name: user.name, role: user.role };
    await logSystem("login", { actorId: user.id, message: `${user.email} signed in` });
    res.json({ token: signToken(principal), user: principal });
  }),
);
