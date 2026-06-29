# The Demo Foundation — grant application & review platform

A two-sided app for a community-funding foundation. **Reviewers** publish grants and define the
review workflow; **Applicants** apply to an open grant and track their case. The core is a
**dynamic, reviewer-configured workflow** that the backend enforces, with a full audit trail, case
numbers, and a monitor view of each case's progress.

---

## Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React + TypeScript (Vite), React Router, TanStack Query |
| Backend  | Node + TypeScript, Express, Prisma ORM |
| Database | PostgreSQL (migration + seed script) |
| Auth     | JWT (seeded users, bcrypt) — real, server-side role checks |
| Tests    | Vitest + Supertest (98 tests, run against a throwaway embedded Postgres) |
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

---

## Core concepts

**Grant** (created by reviewers): name, **3-letter short code** (unique), category
(Sport / Technology / General Education / Quality of Life), description, funds allocated, closing
date, any number of **readable documents**, and an ordered **workflow** of review steps the reviewer
can add / rename / remove / reorder.

**Case** (an application): created by an applicant against an **open** grant. Title is prefilled from
the grant; the requested amount must not exceed the grant's funds. Each case gets a **case number**
`SHORTCODE-MM-YY-NNN` (e.g. `SPT-06-26-482`) and carries a single supporting attachment.

**Roles & feel:** the UI is a left-sidebar shell themed by role — applicant = modern (warm gold),
reviewer = professional (cool slate/teal, denser, data-forward).

---

## The workflow (dynamic, enforced server-side)

States: `DRAFT → IN_REVIEW → APPROVED | REJECTED`. While `IN_REVIEW`, the case sits on one of the
grant's workflow steps (tracked by `currentStep`).

| Action | From | To | Who | Comment |
|--------|------|----|-----|---------|
| `submit` | DRAFT | IN_REVIEW @ step 0 | owner (applicant) | — |
| `advance` | IN_REVIEW @ step *i* | step *i+1*, or **APPROVED** past the last step | any reviewer (not owner) | optional |
| `return` | IN_REVIEW | DRAFT (editable again) | any reviewer (not owner) | **required** |
| `reject` | IN_REVIEW | REJECTED | any reviewer (not owner) | **required** |

**Rules enforced server-side**
- Only the owner edits/submits a DRAFT; only DRAFT is editable.
- Only a reviewer can advance/return/reject — role comes from the verified JWT, never the body. An
  applicant cannot advance even by calling the API directly (→ `403`).
- **Conflict of interest:** a reviewer cannot act on a case they own (→ `403`).
- `return`/`reject` require a comment (→ `422`).
- Every action writes a **CASE** log row (actor, step/status change, comment, timestamp), atomically
  with the state change; concurrent actions are guarded by a conditional update (→ `409`).
- The decision logic is a single **pure function** (`backend/src/domain/transitions.ts`,
  `evaluateCaseAction`) over `(action, status, stepIndex, totalSteps, role, actor, owner, comment)` —
  exhaustively unit-tested.

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
| PUT | `/grants/:id/workflow` | reviewer | replace ordered steps (add/remove/reorder) |
| POST/GET | `/grants/:id/documents[/:docId]` | reviewer / both | upload (magic-byte validated); download |
| POST | `/applications` | applicant | apply to a grant (case number assigned) |
| GET | `/applications[?status=]` | both | applicant: own cases; reviewer: queue |
| GET/PUT | `/applications/:id` | both / owner | detail (workflow + monitor + case log); edit DRAFT |
| POST | `/applications/:id/attachment` | owner | single attachment (DRAFT only) |
| POST | `/applications/:id/{submit,advance,return,reject}` | per table | workflow actions |
| GET | `/logs?category=SYSTEM\|CASE&caseNumber=` | reviewer | split logs + case filter |

**Status-code precedence:** `401 → 404 (hidden) → 403 (role/ownership/COI) → 409 (illegal state) →
422 (validation/comment)`; `400` only for malformed JSON.

---

## Tests
```bash
cd backend && npm test          # 98 tests: pure engine + API integration
npm run test:unit               # engine only, no database
```
Coverage: exhaustive transition legality; authorization (incl. *applicant-can't-advance-via-API*,
reviewer conflict-of-interest, role-spoof ignored, visibility 404); comment requirement;
concurrency; case-log correctness; grant CRUD + workflow ordering; case-number format;
apply-only-to-open-grant; attachment/document validation.

---

## Project layout
```
backend/
  prisma/{schema.prisma, migrations/, seed.ts}
  src/domain/transitions.ts          # pure dynamic-workflow engine (+ unit tests)
  src/services/{grantService,applicationService,logService}.ts
  src/http/{app,auth.routes,grants.routes,applications.routes,logs.routes,middleware,errors}.ts
  src/{upload.ts, lib/{caseNumber,validation,auth,config,prisma}.ts}
  tests/                             # supertest suites + embedded-Postgres harness
frontend/
  src/api/, src/auth/, src/components/ (Brand, Layout sidebar, Monitor, StatusBadge, AuditTrail …)
  src/pages/ (Login, BrowseGrants, GrantDetail, GrantForm, ApplicationForm, MyApplications,
              ApplicationDetail, ReviewerQueue, Logs)
docker-compose.yml
```
