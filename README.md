# The Demo Foundation — grant application & review platform

A two-sided app for a community-funding foundation. **Reviewers** publish grants and define the
review workflow; **Applicants** apply to an open grant and track their case. The core is a
**dynamic, reviewer-configured workflow** that the backend enforces, with a full audit trail, case
numbers, and a monitor view of each case's progress.

---

## Live demo

**URL:** https://demofoundation.sentineltech.cc

| Role | Email | Password |
|------|-------|----------|
| Applicant | `applicant@demo.test` | `password123` |
| Applicant (second) | `applicant2@demo.test` | `password123` |
| Reviewer | `reviewer@demo.test` | `password123` |

---

## Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React + TypeScript (Vite), React Router, TanStack Query |
| Backend  | Node + TypeScript, Express, Prisma ORM |
| Database | PostgreSQL (migration + seed script) |
| Auth     | JWT (seeded users, bcrypt) — real, server-side role checks |
| Tests    | Vitest + Supertest (121 tests, run against a throwaway embedded Postgres) |
| Run      | `docker-compose` (Postgres + backend); frontend run separately |

---

## Quick start

### Backend + DB (Docker)
```bash
docker compose up --build      # Postgres + API on http://localhost:4000 (migrates + seeds)
```
### Frontend (separate terminal)
```bash
cd frontend && npm install && npm run dev    # http://localhost:5173
```
### No Docker?
```bash
cd backend && npm install && npm run dev:standalone   # embedded Postgres + API, no Docker
```

**Seeded users** (password `password123`): `applicant@demo.test`, `applicant2@demo.test`,
`reviewer@demo.test`.

### Email notifications (optional)

Add the following to `backend/.env` to enable SMTP notifications on status change.
Leave blank (or omit the file) to run fully offline — all workflow actions still work.

```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=you@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (not your account password)
MAIL_FROM_ADDRESS=you@gmail.com
MAIL_FROM_NAME=Demo Foundation
```

---

## Data model

```
User
  id, email (login / username), name, passwordHash, role (APPLICANT | REVIEWER)

Grant
  id, name, shortCode (3 letters, unique), category, description,
  fundsAllocated, openUntil, status (OPEN | CLOSED), createdById → User

WorkflowStep          -- ordered review stages defined by the reviewer
  id, grantId → Grant, name, position

GrantDocument         -- supporting docs attached by the reviewer
  id, grantId → Grant, filename, mime, size, storedName

Application           -- a case: one applicant ↔ one grant
  id, caseNumber (SHORTCODE-MM-YY-NNN), title, category, description,
  amount, needBy, status (DRAFT | IN_REVIEW | APPROVED | REJECTED),
  grantId → Grant, ownerId → User, reviewerId → User,
  currentStepId → WorkflowStep,
  attachmentFilename, attachmentMime, attachmentSize, attachmentStored

LogEntry              -- append-only audit trail
  id, category (SYSTEM | CASE), action, applicationId → Application,
  caseNumber, actorId → User, fromStep, toStep, fromStatus, toStatus,
  comment, message, createdAt
```

**Derived folder** (never stored — computed on read from status + step position + last action):

| DB status | Condition | Folder shown |
|-----------|-----------|-------------|
| DRAFT | no prior `submit` log | `DRAFT` |
| DRAFT | has prior `submit` log | `REVERTED` |
| IN_REVIEW | currentStep.position = 0 | `SUBMITTED` |
| IN_REVIEW | currentStep.position ≥ 1 | `UNDER_REVIEW` |
| APPROVED | — | `APPROVED` |
| REJECTED | — | `REJECTED` |

---

## The workflow (dynamic, enforced server-side)

```
DRAFT ──submit──► SUBMITTED ──start review──► UNDER_REVIEW ──approve──► APPROVED
  ▲                                                        └──reject───► REJECTED
  └─────────────────── return for changes ─────────────────────────────┘
```

| Action | From | To | Who | Comment |
|--------|------|----|-----|---------|
| `submit` | DRAFT | SUBMITTED | owner (applicant) | — |
| `advance` | SUBMITTED / UNDER_REVIEW | next step → UNDER_REVIEW, or **APPROVED** at last step | reviewer (not owner) | optional |
| `return` | SUBMITTED / UNDER_REVIEW | DRAFT (REVERTED folder) | reviewer (not owner) | **required** |
| `reject` | SUBMITTED / UNDER_REVIEW | REJECTED | reviewer (not owner) | **required** |

**Rules enforced server-side**
- Only the owner edits/submits a DRAFT; only DRAFT is editable.
- Only a reviewer can advance/return/reject — role comes from the verified JWT, never the body.
  An applicant cannot advance even by calling the API directly (→ `403`).
- **Conflict of interest:** a reviewer cannot act on a case they own (→ `403`).
- `return`/`reject` require a comment (→ `422`).
- Every action writes a **CASE** log row (actor, step/status change, comment, timestamp), atomically
  with the state change; concurrent actions are guarded by a conditional update (→ `409`).
- The decision logic is a single **pure function** (`backend/src/domain/transitions.ts`,
  `evaluateCaseAction`) over `(action, status, stepIndex, totalSteps, role, actor, owner, comment)` —
  exhaustively unit-tested with no database or I/O.

**Monitor** — each case detail shows a stepper of the grant's workflow with the current position.

**Logs** — reviewers get a logs view split into **System** (login, grant/workflow changes) and
**Case** (case processing), the latter filterable by case number.

---

## API (`/api`, JWT required except login)

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/auth/login` | public | → `{ token, user }` (writes a SYSTEM log) |
| GET/POST | `/grants` | both / reviewer | list (applicants: open only); reviewer creates (with steps) |
| GET/PUT | `/grants/:id` | both / reviewer | detail; reviewer edits |
| POST | `/grants/:id/close` | reviewer | close grant (hides from applicants, blocks new cases) |
| POST | `/grants/:id/reopen` | reviewer | reopen a closed grant |
| PUT | `/grants/:id/workflow` | reviewer | replace ordered steps (add/remove/reorder) |
| POST/GET | `/grants/:id/documents[/:docId]` | reviewer / both | upload (magic-byte validated); download |
| POST | `/applications` | applicant | apply to a grant (case number assigned) |
| GET | `/applications[?page=&pageSize=&q=&status=]` | both | applicant: own cases; reviewer: paginated queue with free-text search |
| GET/PUT | `/applications/:id` | both / owner | detail (workflow + monitor + case log); edit DRAFT |
| DELETE | `/applications/:id` | owner | delete a brand-new DRAFT (never submitted — preserves audit trail) |
| POST | `/applications/:id/attachment` | owner | single attachment (DRAFT only) |
| POST | `/applications/:id/{submit,advance,return,reject}` | per table | workflow actions |
| GET | `/logs?category=SYSTEM\|CASE&caseNumber=` | reviewer | split logs + case filter |

**Status-code precedence:** `401 → 404 (hidden) → 403 (role/ownership/COI) → 409 (illegal state) →
422 (validation/comment)`; `400` only for malformed JSON.

---

## Tests
```bash
cd backend && npm test          # 121 tests: pure engine + API integration
npm run test:unit               # engine only, no database
```
Coverage: exhaustive transition legality; authorization (incl. *applicant-can't-advance-via-API*,
reviewer conflict-of-interest, role-spoof ignored, visibility 404); comment requirement;
concurrency; case-log correctness; grant CRUD + workflow ordering; case-number format;
apply-only-to-open-grant; attachment/document validation; delete-draft (never-submitted guard);
close/reopen grant; paginated search; email notification message generation.

---

## Project layout
```
backend/
  prisma/{schema.prisma, migrations/, seed.ts}
  src/domain/transitions.ts          # pure dynamic-workflow engine (+ unit tests)
  src/services/{grantService,applicationService,logService,notificationService}.ts
  src/http/{app,auth.routes,grants.routes,applications.routes,logs.routes,middleware,errors}.ts
  src/{upload.ts, lib/{caseNumber,validation,auth,config,prisma,mail}.ts}
  tests/                             # supertest suites + embedded-Postgres harness
frontend/
  src/api/, src/auth/, src/components/ (Brand, Layout sidebar, Monitor, StatusBadge, AuditTrail …)
  src/pages/ (Login, BrowseGrants, GrantDetail, GrantForm, ApplicationForm, MyApplications,
              ApplicationDetail, ReviewerQueue, Logs)
docker-compose.yml
```

---

## Use of AI tools

**Claude Code (Anthropic)** was used throughout this project as a pair-programming assistant.

**What it did:**
- Scaffolded the initial Express + Prisma + Vite project structure and Docker compose setup.
- Wrote the pure `evaluateCaseAction` state-machine function and its full unit-test suite — the
  invariant-heavy logic (role checks, conflict-of-interest, step bounds, comment requirements)
  benefited from having tests generated alongside the implementation.
- Generated the Supertest integration-test harness (embedded Postgres, helper factories, per-suite
  DB reset) and the full test suite for auth, grants, applications, workflow, search, delete, and
  close/reopen.
- Implemented the notification service (`caseEventEmails` pure function + `notifyCaseEvent`
  orchestrator), the paginated search endpoint, and the applicant delete guard (never-submitted
  check via audit log).
- Wrote first drafts of all React pages and components; I directed the UI behaviour and iterated
  on the output.

**How I used it:**
- I reviewed every generated file before accepting it — the engine function, route handlers, and
  test cases were all read and understood before being committed.
- I caught and corrected several mistakes: SMTP credentials being placed in `docker-compose.yml`
  instead of `backend/.env`, a SQL reserved-word collision in a raw query, and an incorrect
  `ownerName` fallback in the notification call.
- Architecture decisions (computed folder vs DB column, optimistic concurrency, best-effort email)
  were discussed with the assistant and evaluated before implementing.
- The assistant did not have access to run the application or tests locally; I ran all test suites
  and verified the live deployment myself.

**Net effect:** AI handled boilerplate and first-pass implementations quickly, freeing me to focus
on correctness, security rules, and the UX details that matter for a two-sided workflow product.

---

## Trade-offs and what I'd add with more time

### Decisions made and why

**Dynamic, reviewer-configured workflow.**
Rather than hard-coding a fixed approval process, each grant carries its own ordered list of
review steps that the reviewer defines before applications open. This was a deliberate design
choice to demonstrate long-term, critical thinking: in a real foundation different grant types
will naturally demand different approval paths — a small community sports grant might need a
single sign-off, while a large technology or infrastructure grant might require committee review,
due-diligence checks, and a board vote. Tying the workflow to the grant rather than to the system
means the platform can accommodate all of these without code changes.

**Seeded users only, no sign-up.**
The assignment didn't call for self-registration, so there is no sign-up flow. All auth is
standard (bcrypt + JWT); adding registration is a small addition.

### Trade-offs

The grant model was kept intentionally simple — name, category, funds, deadline, and a
document list. In a production system grants would carry far more variables: eligibility
criteria, geographic restrictions, co-funding requirements, maximum award caps per applicant,
milestone-based disbursement schedules, and so on. Building around those scenarios would
significantly change the data model, the application form, and the review workflow. For the
scope of this assessment, simplicity was chosen over completeness.

### What I'd add with more time

- **Grant type definitions** — rather than a single generic grant shape, I would model distinct
  grant types (community, capital, research, etc.) and tailor the application form, eligibility
  rules, and approval workflow specifically to each type.
- **Real-time updates** via Server-Sent Events or WebSockets — applicants currently have to
  refresh to see a status change.
- **Role management UI** — reviewers are seeded; a real deployment needs an admin panel to
  promote/demote users.
- **Export / reporting** — the audit log is complete but there is no CSV/PDF export or aggregate
  reporting view for grant administrators.
