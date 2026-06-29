import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import multer from "multer";
import { config } from "./lib/config";

// Keep the upload in memory so we can sniff its magic bytes BEFORE writing it to
// disk — never trust the client-supplied Content-Type or filename.
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
}).single("file");

const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", test: (b) => b.subarray(0, 4).toString("latin1") === "%PDF" },
  {
    mime: "image/png",
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { mime: "image/jpeg", test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

/** Detect the true content type from magic bytes; null if unrecognized. */
export function sniffMime(buffer: Buffer): string | null {
  return SIGNATURES.find((s) => s.test(buffer))?.mime ?? null;
}

export interface StoredAttachment {
  storedName: string;
  size: number;
}

/** Write validated bytes to UPLOAD_DIR under a random name (never the client's). */
export async function persistAttachment(buffer: Buffer, mime: string): Promise<StoredAttachment> {
  await fs.mkdir(config.uploadDir, { recursive: true });
  const ext = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : ".jpg";
  const storedName = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(config.uploadDir, storedName), buffer);
  return { storedName, size: buffer.length };
}

/** Best-effort delete of a previously stored attachment (e.g. on replace). */
export async function deleteAttachment(storedName: string | null | undefined): Promise<void> {
  if (!storedName) return;
  await fs.rm(path.join(config.uploadDir, storedName), { force: true });
}

export function attachmentPath(storedName: string): string {
  return path.join(config.uploadDir, storedName);
}
