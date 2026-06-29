import dotenv from "dotenv";

dotenv.config();

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
};

export type AppConfig = typeof config;
