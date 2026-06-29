import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config";

/**
 * Thin SMTP wrapper. Email is a best-effort side effect: it must never block or
 * fail a workflow action, and it is disabled automatically when no SMTP
 * credentials are configured (so tests / CI stay fully offline).
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.mail.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send one email. Returns false (never throws) when disabled or on failure. */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false; // mail disabled — no creds (tests/local without SMTP)
  try {
    await tx.sendMail({
      from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (err) {
    console.error("[mail] send failed:", (err as Error).message);
    return false;
  }
}
