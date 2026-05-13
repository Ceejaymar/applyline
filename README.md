# Applyline

A local-first job application tracker that runs entirely in your browser. No account, no server, no cloud sync required.

## Overview

Applyline is a Kanban-style pipeline for tracking job applications. You drag cards through columns, log contacts, and get a metrics view of your pipeline health. Everything is stored in IndexedDB on your device.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS + shadcn/ui + Radix UI primitives |
| Database | Dexie.js (IndexedDB wrapper, live queries) |
| UI state | Zustand (persisted via localStorage) |
| Forms | React Hook Form + Zod |
| Drag-and-drop | @dnd-kit (pointer + keyboard sensors) |
| Testing | Vitest + Testing Library + fake-indexeddb |

## Running locally

```bash
npm install
npm run dev         # dev server → http://localhost:3000
npm run build       # production build
npm run typecheck   # TypeScript type check
npm run lint        # ESLint
npm test            # Vitest in watch mode
npm run test:run    # Vitest single run
```

## How data persistence works

All data lives in your browser's **IndexedDB** via [Dexie.js](https://dexie.org). There is no backend or cloud storage.

**Tables:**

| Table | Purpose |
|---|---|
| `jobs` | Applications with status, dates, notes, tags, compensation |
| `columns` | Kanban stages (defaults: Wishlist → Applied → Interview → Offer → No Response → Rejected → Archived) |
| `companies` | Company records shared across jobs |
| `contacts` | People in your hiring network |
| `jobContacts` | Many-to-many links between jobs and contacts |
| `sources` | Where applications came from (LinkedIn, Greenhouse, Lever, etc.) |
| `activities` | Append-only audit trail per job (moves, edits, contact links) |

The UI subscribes to live queries via `dexie/liveQuery`, so the board re-renders whenever the underlying data changes — no manual sync required.

**Data isolation:** Each browser profile has its own separate IndexedDB. Clearing site data in your browser settings will permanently delete all Applyline data that has not been exported.

## How backups work

Open **Settings → Data** to manage your data:

- **Export Backup JSON** — downloads a full snapshot of every table as a single `.json` file. Keep this somewhere safe (cloud storage, external drive).
- **Export Jobs CSV** — downloads all job applications in a spreadsheet-compatible format.
- **Import Backup JSON** — restores a previous backup. Two modes:
  - *Merge* — adds records with new IDs; skips records whose IDs already exist. Safe for adding missing data.
  - *Replace* — wipes all local data first, then imports the backup. Use when moving to a new browser.

Export regularly. If you switch browsers, clear cookies, or reset the browser profile, anything not exported is gone.

## Project structure

```
src/
├── app/                  # Next.js pages (board, metrics, contacts, settings)
├── components/
│   ├── app/              # App shell, nav, theme toggle
│   └── ui/               # shadcn/ui base components
├── features/
│   ├── jobs/             # Board, columns, job cards, drawer, forms
│   ├── contacts/         # Contact list and dialogs
│   ├── metrics/          # KPI cards, bar charts, needs-attention table
│   └── settings/         # Theme, storage info, import/export
├── lib/
│   ├── db.ts             # Dexie database class + all CRUD operations
│   ├── schemas.ts        # Zod schemas + TypeScript types + seed data
│   ├── use-jobs.ts       # Live-query hook that builds BoardJob view model
│   └── backup.ts         # Export/import serialisation
└── store/
    └── applyline-ui-store.ts  # Zustand store (active job, dialog state)
```

## Running the tests

Tests cover pure logic only — no UI rendering tests.

```bash
npm run test:run
```

| File | What it tests |
|---|---|
| `src/lib/schemas.test.ts` | Zod schema validation (required fields, URL/email formats, cross-field rules) |
| `src/features/jobs/job-helpers.test.ts` | Text/URL normalisation, stale-job detection, duplicate detection, source inference |
| `src/features/metrics/metrics-utils.test.ts` | KPI calculations, rate formulas, stale-job counts, top-source/tag ranking |
| `src/lib/db.test.ts` | `moveJobToColumn` integration — column updates, timestamp writes, `appliedAt`/`rejectedAt` side-effects, activity creation |

## Future roadmap

- Recurring follow-up reminders per application
- Column archiving / hiding
- Multi-device sync via CRDTs or an optional self-hosted backend
- Resume version file attachments
- Interview prep checklist per application
- Dark-mode chart theming
