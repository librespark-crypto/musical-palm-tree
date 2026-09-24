# JEE Command Center

A local-first preparation workspace for **JEE Main + JEE Advanced**: the complete official
syllabus with per-subtopic tracking, a day/week planner, a backlog that never hides work,
spaced revision, mock-test analytics, a mistake book, and an AI coach that is grounded in the
data you actually recorded.

It replaces the original single-file `jee-tracker.html` prototype. The prototype is kept in
[`legacy/`](legacy) as a functional reference, and its `localStorage` data is migrated
automatically the first time you open the new app.

> **Your data never leaves the device.** Everything is stored in IndexedDB in your browser.
> The only outbound request is the optional AI coach call, which goes to this app's own
> server route (`/api/ai/*`) — never straight from the browser to a third party.

---

## What it does

| Area | Highlights |
| --- | --- |
| **Dashboard** | Countdown to both exams, today's plan with one-tap completion, pending tasks, lecture backlog, revisions due, study time against your daily goal, questions solved, syllabus completion, recent test scores, streak and subject progress. |
| **Syllabus** | The full official syllabus (subject → chapter → topic → subtopic) with JEE Main / JEE Advanced scoping. Per subtopic: theory/lecture/DPP/PYQ/practice status, revision count, confidence, difficulty, notes, time spent, last studied and the next revision. |
| **Planner** | Day, week and backlog views. Tasks of every type (lecture, theory, DPP, PYQ, practice, revision, mock test, mistake revision, custom) with priority, estimated vs actual minutes, deadlines and a workload warning when a day is over-committed. |
| **Study timer** | Start/pause/stop a session against a subject and task; time is credited to the topic, the subject and the day, and can also be logged by hand. |
| **Backlog** | Everything that slipped: unfinished tasks from previous days, unwatched lectures and half-finished topics, with suggestions you can turn into real tasks. |
| **Revision** | Spaced-repetition queue (1 / 3 / 7 / 16 / 35-day ladder, configurable), overdue/today/upcoming buckets, revision history, confidence tracking and a consistency score. |
| **Mock tests** | Record score, marks, attempted/correct/wrong/unattempted, per-subject splits, percentile and rank (when you enter them). Trend charts, per-test analysis and marks lost by subject. |
| **Mistake book** | Log the question, the mistake type, what went wrong and the correct concept; status workflow (open → revised → mastered), filtering and repeated-topic detection. |
| **Analytics** | Syllabus progress, study hours, questions solved, revision consistency, test scores and accuracy, weak/strong topics and backlog trends — every chart is computed from stored records, and every chart has a data table behind it. |
| **AI coach** | Chat plus a plan built from your real data. With `GEMINI_API_KEY` configured the answers come from Gemini; without it (or offline) the deterministic rule-based coach answers from the same stored facts. |
| **Settings** | Profile and exam dates, targets, theme, revision intervals, AI status, JSON export/import, three in-app backup slots, sample data and a reset with confirmation. |

Nothing is decorative: there are no fake statistics, no placeholder buttons and no dead links.

---

## Tech stack

- **Next.js 16** (App Router, React 19, server components where they help, route handlers for the AI)
- **TypeScript** in `strict` mode with `noUncheckedIndexedAccess`; no `any` anywhere in `src/`
- **Tailwind CSS v4** with design tokens in `src/app/globals.css` (light/dark, no glassmorphism)
- **Radix UI** primitives for accessible dialogs and tabs, wrapped by a small in-house UI kit
- **Recharts** for charts, with a table fallback for every chart
- **IndexedDB** as the primary store, behind a typed repository layer (no external IDB library)
- **Vitest** for unit tests, **ESLint** (flat config, `eslint-config-next`) for linting
- **PWA**: installable, offline-capable, service worker in `public/sw.js`

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional AI coach:

```bash
cp .env.example .env.local
# then set GEMINI_API_KEY=...   (Google AI Studio key)
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint over the whole project |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (calculations, persistence, migration, transfer) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build:syllabus` | Regenerate `src/data/syllabus.json` from the official sources (`--check` verifies without writing) |
| `npm run verify` | lint → typecheck → test → build |

Node.js **20.9+** is required.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Server-side key for the AI coach. Read **only** by `/api/ai/*`. |
| `GEMINI_MODEL` | No | Overrides the model (defaults to `gemini-2.5-flash`). |
| `AI_ENABLED` | No | Set to `false` to disable the AI routes entirely; the coach falls back to rules. |

Secrets are never sent to the browser and never stored in IndexedDB. A legacy key found in
old `localStorage` data is deliberately **not** migrated, and the app tells you so.

---

## Architecture

```
src/
├── app/                     routes (App Router) + AI route handlers + PWA manifest
├── components/
│   ├── layout/              app shell, navigation, theme, PWA chrome
│   └── ui/                  primitives, dialogs, charts, toasts, status badges
├── features/                one folder per screen, each with its own data hook
│   ├── dashboard/ syllabus/ planner/ backlog/ revision/ timer/
│   └── lectures/ questions/ tests/ mistakes/ analytics/ coach/ search/ settings/
├── lib/
│   ├── db/                  IndexedDB wrapper, schema/upgrade, defaults, migration, transfer
│   ├── repositories/        typed repositories (one per store) + backup slots
│   ├── calculations/        all domain maths (pure, unit-tested)
│   ├── syllabus/            typed access to the official syllabus data
│   ├── store/               the tracker provider: snapshot in memory, surgical writes to IDB
│   ├── ai/                  context building, prompts, Gemini client, rule-based fallback
│   ├── types.ts             the domain model
│   ├── constants.ts         labels, weights and thresholds
│   └── date.ts / utils.ts   local-date helpers and small utilities
└── data/syllabus.json       generated syllabus bundle (byte-identical to the legacy data)
```

**Data flow.** `lib/db` opens the database; `lib/repositories` exposes typed access;
`lib/store/tracker-store.tsx` loads everything into an immutable snapshot once, then applies
changes as *narrow writes* (only the touched records are persisted) and recomputes a memoised
`DerivedIndex` (`lib/calculations/derive.ts`) once per snapshot. Every calculation module is a
pure function of that index, which is why the maths is unit-tested without a DOM.

### Data model

`Subject → Chapter → Topic → Subtopic`, plus `TopicProgress` (per exam), `StudyTask`,
`Lecture`, `StudySession`, `RevisionRecord`, `TestRecord` + `TestAttempt`, `Mistake`,
`QuestionLog`, `AiChat`/`AiPlan`, `UserSettings` and the app `AppMeta`. Progress, lectures,
questions, mistakes, sessions and revisions are all tracked **separately for JEE Main and JEE
Advanced**.

### Progress maths (unchanged from the prototype)

```
coverage = 0.22·theory + 0.24·lecture + 0.20·dpp + 0.18·pyq + 0.16·practice   (partial = ½)
           scaled by (1 − 0.12) + min(revisionCount / 3, 1) · 0.12
mastery  = coverage × accuracy factor     (accuracy factor once ≥ 5 questions are logged)
           weak topics are capped at 45%, completed topics with >75% coverage floor at 70%
```

### Data safety

- IndexedDB is the primary store; `localStorage` is only read, once, to import legacy data.
- **Export/import**: a full JSON export (and import of both current and legacy files).
- **Backup slots**: three in-app snapshots stored beside your data.
- **Reset**: deletes everything after an explicit confirmation.
- The legacy `localStorage` key is never deleted, so the old app keeps working.

---

## PWA and offline behaviour

The app is installable and works without a network: navigations are network-first with a cache
and offline-page fallback, hashed build assets are cache-first, and `/api/*` is never cached.
If the AI is unreachable (offline, no key, quota) the coach degrades to deterministic,
data-driven advice and says why. App data lives in IndexedDB, not in the service-worker cache,
so a cache eviction can never drop your records.

---

## Deploying to Vercel

1. Push this repository to GitHub and import it in Vercel — the framework preset is detected
   as **Next.js**; no build overrides are needed.
2. Optionally add the environment variables from the table above (`GEMINI_API_KEY`,
   `GEMINI_MODEL`, `AI_ENABLED`) in **Project → Settings → Environment Variables**.
3. Deploy. `npm run verify` (lint → typecheck → tests → build) passes locally, so the build
   should be clean.

---

## Tests

```bash
npm test
```

Covered by unit tests: topic completion and coverage/mastery maths, node aggregation across the
syllabus hierarchy, test scoring and accuracy, per-test analysis and trends, revision scheduling
and buckets, revision chaining, streaks, study-time aggregation, question/subject analytics,
mistake patterns, backlog buckets/sweep/suggestions, the IndexedDB repositories (through
`fake-indexeddb`), the legacy migration, JSON export/import, and the sample dataset.

---

## The legacy prototype

`legacy/` contains the original single-file tracker (`jee-tracker.html`), its modular sources
(`legacy/src/js`), the raw syllabus documents, the build scripts, the screenshots used as UI
references and its own test scripts. It is excluded from lint, typecheck and the build; it
exists so the behaviour of the new app can always be compared against the original.

To rebuild the syllabus bundle after editing the source documents:

```bash
npm run build:syllabus          # writes src/data/syllabus.json
node scripts/build-syllabus.mjs --check   # verifies the checked-in file matches
```

---

## Keyboard and accessibility

- A skip link, semantic landmarks (`nav`/`main`/`header`) and visible focus rings everywhere.
- Dialogs and tabs use Radix primitives, so focus trapping, `Esc` and arrow-key navigation work.
- Charts render as `svg` with `role="img"` plus an accessible description, and every chart can
  be expanded into a real data table.
- Tables use proper `caption`/`scope` markup; links and buttons carry `aria-label`s where the
  visible label is an icon.
- Light and dark themes follow the system by default and are switchable in Settings.
