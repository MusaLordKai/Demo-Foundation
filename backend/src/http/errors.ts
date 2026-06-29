import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { TransitionReason } from "../domain/transitions";

/** A typed, HTTP-aware error. Thrown anywhere; mapped to JSON by errorHandler. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (msg = "Not found") => new AppError(404, "NOT_FOUND", msg);
export const forbidden = (msg = "Forbidden") => new AppError(403, "FORBIDDEN", msg);
export const unauthorized = (msg = "Unauthorized") => new AppError(401, "UNAUTHORIZED", msg);
export const conflict = (msg = "Conflict") => new AppError(409, "CONFLICT", msg);
export const unprocessable = (msg = "Unprocessable", details?: unknown) =>
  new AppError(422, "VALIDATION", msg, details);

/** Map a transition guard rejection reason to its HTTP error. */
export function transitionError(reason: TransitionReason, message: string): AppError {
  switch (reason) {
    case "AUTHZ":
      return forbidden(message);
    case "ILLEGAL":
      return conflict(message);
    case "COMMENT_REQUIRED":
      return unprocessable(message);
  }
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Terminal Express error handler — single place that shapes error responses. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: "VALIDATION", message: "Validation failed", details: err.flatten() },
    });
    return;
  }
  // Multer surfaces upload problems (e.g. size limit) as MulterError.
  if (err && typeof err === "object" && (err as { name?: string }).name === "MulterError") {
    const code = (err as { code?: string }).code;
    const message = code === "LIMIT_FILE_SIZE" ? "Attachment exceeds the maximum allowed size." : "Invalid upload.";
    res.status(422).json({ error: { code: "VALIDATION", message } });
    return;
  }
  // express.json() raises a SyntaxError with a `status` for malformed bodies.
  if (err && typeof err === "object" && (err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Malformed JSON body." } });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error." } });
};
