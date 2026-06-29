import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { Role } from "../domain/transitions";

/** The authenticated principal, derived solely from a verified JWT. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: config.tokenTtlSeconds },
  );
}

/** Verify a token and rebuild the principal. Returns null on any failure. */
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub || (payload.role !== "APPLICANT" && payload.role !== "REVIEWER")) {
      return null;
    }
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role,
    };
  } catch {
    return null;
  }
}
