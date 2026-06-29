import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { sendMail } from "../lib/mail";
import type { Action } from "../domain/transitions";

/**
 * In-app/email notifications on case status change (stretch goal).
 * The message-building is a PURE function (`caseEventEmails`) so it is unit
 * tested without SMTP or a database; `notifyCaseEvent` orchestrates recipient
 * lookup + sending and is a safe no-op when mail is disabled.
 */

export interface CaseEmail {
  to: string;
  subject: string;
  text: string;
}

export interface CaseLike {
  caseNumber: string;
  title: string;
  ownerEmail: string | null;
  ownerName: string | null;
}

/** Human label for the new state, used in subjects. */
const STATE_WORD: Record<string, string> = {
  IN_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DRAFT: "Returned for changes",
};

/**
 * PURE: produce the emails a status change should generate. No I/O.
 * - submit  → confirm to the applicant + alert every reviewer (new in queue).
 * - advance/return/reject → notify the owner of the new state (+ any comment).
 */
export function caseEventEmails(
  c: CaseLike,
  action: Action,
  toStatus: string,
  toStep: string | null,
  comment: string | null,
  reviewerEmails: string[],
): CaseEmail[] {
  const out: CaseEmail[] = [];
  const tag = `[${c.caseNumber}]`;
  const greeting = `Hi ${c.ownerName ?? "there"},`;

  if (action === "submit") {
    if (c.ownerEmail) {
      out.push({
        to: c.ownerEmail,
        subject: `${tag} Application submitted`,
        text: `${greeting}\n\nYour application "${c.title}" (${c.caseNumber}) has been submitted and is now awaiting review.\n\n— Demo Foundation`,
      });
    }
    for (const email of reviewerEmails) {
      out.push({
        to: email,
        subject: `${tag} New application awaiting review`,
        text: `A new application "${c.title}" (${c.caseNumber}) has entered the review queue.\n\n— Demo Foundation`,
      });
    }
    return out;
  }

  if (!c.ownerEmail) return out;

  let headline: string;
  if (action === "advance" && toStatus === "APPROVED") headline = "has been approved";
  else if (action === "advance") headline = toStep ? `has advanced to "${toStep}"` : "has advanced";
  else if (action === "return") headline = "has been returned for changes";
  else headline = "has been rejected";

  const lines = [greeting, "", `Your application "${c.title}" (${c.caseNumber}) ${headline}.`];
  if (comment) lines.push("", `Reviewer comment: ${comment}`);
  lines.push("", "— Demo Foundation");

  out.push({
    to: c.ownerEmail,
    subject: `${tag} ${STATE_WORD[toStatus] ?? toStatus}`,
    text: lines.join("\n"),
  });
  return out;
}

/** Gather recipients and send (best-effort). No-op when mail is disabled. */
export async function notifyCaseEvent(
  c: CaseLike,
  action: Action,
  toStatus: string,
  toStep: string | null,
  comment: string | null,
): Promise<void> {
  if (!config.mail.enabled) return; // skip the reviewer lookup + sends entirely

  let reviewerEmails: string[] = [];
  if (action === "submit") {
    const reviewers = await prisma.user.findMany({ where: { role: "REVIEWER" }, select: { email: true } });
    reviewerEmails = reviewers.map((r) => r.email);
  }

  const emails = caseEventEmails(c, action, toStatus, toStep, comment, reviewerEmails);
  await Promise.all(emails.map((e) => sendMail(e)));
}
