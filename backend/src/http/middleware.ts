import type { RequestHandler } from "express";
import { verifyToken, type AuthUser } from "../lib/auth";
import { forbidden, unauthorized } from "./errors";
import type { Role } from "../domain/transitions";

// Augment Express's Request with the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Require a valid Bearer token; attaches req.user or rejects with 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(unauthorized("Missing or malformed Authorization header."));
  }
  const user = verifyToken(token);
  if (!user) {
    return next(unauthorized("Invalid or expired token."));
  }
  // Role is taken from the verified token only — never from the request body.
  req.user = user;
  next();
};

/** Require the authenticated user to hold a specific role (403 otherwise). */
export const requireRole =
  (role: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) {
      return next(forbidden(`This action requires the ${role} role.`));
    }
    next();
  };
