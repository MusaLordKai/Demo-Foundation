import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Load the backend's .env regardless of the current working directory. The
// pm2/production deploy and local dev both run from the backend dir, but
// resolving relative to this file as well keeps it working when launched from
// elsewhere or from the compiled dist/. In containers the env is injected
// directly (see docker-compose env_file), so a missing file here is fine.
const ENV_CANDIDATES = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"), // src/lib -> backend  (tsx / dev)
  path.resolve(__dirname, "../../../.env"), // dist/src/lib -> backend (compiled)
];
const envPath = ENV_CANDIDATES.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildDatabaseUrl(): string {
  // Prefer an explicit DATABASE_URL if provided.
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Otherwise build from individual parts.
  const user = required("DB_USER");
  const password = encodeURIComponent(required("DB_PASSWORD"));
  const host = required("DB_HOST");
  const port = process.env.DB_PORT ?? "5432";
  const name = required("DB_NAME");
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export const config = {
  databaseUrl: buildDatabaseUrl(),
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
  allowedMime: (process.env.ALLOWED_MIME ?? "application/pdf,image/png,image/jpeg")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  tokenTtlSeconds: 60 * 60 * 8, // 8 hours
  mail: {
    host: process.env.MAIL_HOST ?? "",
    port: Number(process.env.MAIL_PORT ?? 587),
    user: process.env.MAIL_USER ?? "",
    pass: process.env.MAIL_PASS ?? "",
    fromAddress: process.env.MAIL_FROM_ADDRESS ?? "noreply@demofoundation.com",
    fromName: process.env.MAIL_FROM_NAME ?? "Demo Foundation",
    // Best-effort: only "on" when SMTP creds are present, so tests/CI stay offline.
    enabled: Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS),
  },
};

export type AppConfig = typeof config;
