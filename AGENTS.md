# Fireflies clone foundation

## Architecture
- `frontend/` is a standalone Next.js App Router TypeScript application with Tailwind v4 and local shadcn/ui components. Keep routes in `src/app`, UI components in `src/components/ui`, API code in `src/lib/api.ts`, and contracts in `src/types/api.ts`.
- `backend/` is a standalone FastAPI application using Pydantic v2, SQLAlchemy v2, SQLite, and Alembic. `app/api.py` owns HTTP routing, `schemas.py` validates requests/responses, `models.py` defines persistence, `database.py` owns connections and sessions, and `config.py` owns environment configuration.
- `/api/v1` is the API prefix; OpenAPI is served at `/docs`. The frontend talks directly to FastAPI; do not add a duplicate Next.js data API.
- Enable SQLite foreign keys on every connection. Meeting-owned records cascade; reusable participants remain. Speaker/assignee membership uses composite foreign keys. Preserve request transactions and validate before replacing content.
- The live `/meetings` library and `/meetings/[id]` Overview, Transcript, and Action Items are implemented. Keep reusable workspace/library components separate from `hooks/use-meetings.ts` and `lib/meetings.ts`.
- Detail components live in `components/meeting-detail/`; `hooks/use-meeting-detail.ts` owns cancellation/retries and `lib/meeting-detail.ts` owns composed API access. Metadata loads first; summary/chapters/actions/transcript then load concurrently with independent errors. A summary 404 means missing content, not a missing meeting.
- Keep the detail header, tabs, summary panel, and context panel reusable. Unimplemented detail controls stay disabled/Coming Soon. Do not simulate task completion, sharing, editing, or AI regeneration. Action-item writes use the existing API and update the shared detail snapshot only after server success; preserve completed status when editing descriptions. `hooks/use-action-items.ts` serializes mutations, exposes errors, and prevents stale UI callbacks after unmount. Refresh is disabled during writes. Native modal dialogs provide focus trapping, Escape handling, and focus restoration. Transcript playback is explicitly simulated because no recording exists: `hooks/use-playback-clock.ts` owns a single authoritative reducer time, monotonic elapsed ticks, visibility pause, and cleanup. `lib/playback.ts` owns half-open segment matching, clamped seeking, literal search, and stable speaker colors. Preserve playback/search/tab state when refreshing the same meeting; changing meeting IDs resets it. Manual scrolling pauses auto-follow until resumed.
- Summary text and discussion points must preserve backend content; never invent facts in React. Chapter expansion, section navigation, refresh, participant disclosure, and copy controls are real interactions.
- Create/import is at `/meetings/new` and `POST /api/v1/meetings/import`. `app/transcript_import.py` parses TXT/VTT/JSON; validate the whole import before writing and commit the meeting, memberships, segments, summary, and tasks once. Keep supplied speaker labels separate from shared participant names. Unmatched labels use explicitly documented `@transcript.invalid` placeholders. Unstructured text uses uniformly spaced estimated timing, recorded in `timing_source` and shown after refresh. Preserve fractional VTT timestamps and migration CHECKs. File text travels as UTF-8 JSON content plus format/filename, not multipart.
- No real auth, live bots, speech-to-text, or external AI services. Demo transcripts are original seed data. Never copy existing clone repositories.

## Commands (PowerShell, from repository root)
```powershell
./scripts/setup.ps1
./scripts/init-db.ps1
./scripts/seed.ps1
./scripts/run-backend.ps1
./scripts/run-frontend.ps1  # separate terminal
./scripts/verify.ps1
```
See README for equivalent Linux/macOS commands. Python 3.11+ and Node 20.9+ required. Backend runs on 8000; frontend on 3000. Backend environment is `backend/.env`; frontend is `frontend/.env.local`.

## Naming and contracts
- Python modules/functions, SQL columns, and JSON fields use `snake_case`. TypeScript values use `camelCase`, components/types use `PascalCase`, and API field names remain `snake_case`.
- Use integer IDs, UTC ISO 8601 datetimes with timezone, ISO dates for task deadlines, and seconds relative to meeting start. Transcript timestamps support fractional seconds; chapter timestamps and meeting durations remain integers. Ordered content uses zero-based `position`.
- Use PATCH for partial metadata/task edits. Omission preserves values; only optional assignee/deadline fields accept null. PUT replaces complete transcript/chapter collections and upserts the summary.
- Identify participants by lowercased unique email. Meeting edits change membership; they do not rename shared participants globally.
- Add database changes as new frozen Alembic migrations; do not import live model metadata into migration revisions. Keep TypeScript contracts aligned with Pydantic and update README when API behavior changes.

## Verification requirements
- After backend/schema changes run `python -m pytest -q` from backend using `.venv`. Tests must use isolated migrated SQLite databases, never the development database.
- Test meaningful behavior: persistence, validation, scoped relationships, atomic replacement, literal search, deterministic pagination, cascading deletes, and migration upgrade/downgrade/schema parity.
- After frontend/contract changes run `npm run test:unit`, `npm run lint`, `npm run typecheck`, and `npm run build` from frontend. Keep production builds independent of a running backend or network fonts. Lint covers TypeScript, React Hooks, and JSX accessibility without the framework glob plugin.
- For library/detail interactions run `npm run test:e2e` with the seeded backend running. Set `PLAYWRIGHT_CHANNEL=msedge` on Windows to use installed Edge, or install Playwright Chromium. Tests use live data; request interception is restricted to empty/failure scenarios. Never mutate a user's database from browser tests. Run `scripts/test-e2e.ps1` for the complete suite: it migrates/seeds a disposable SQLite database, starts an isolated API on port 8001, builds against it, and restores the normal frontend build afterward. Stop the frontend on port 3000 first. CRUD tests are skipped unless `PLAYWRIGHT_ISOLATED_DB=1`, set by that script.
- List items expose `preview` from stored summaries. `search_scope=library` matches title OR participant; the default search scope preserves transcript search. Cancel stale requests and preserve local date/DST boundaries.
- Check dependency lockfiles into source control. Regenerate `requirements.lock.txt` and `package-lock.json` when dependencies change.
- Never commit `.env`, SQLite files, virtual environments, `node_modules`, or `.next`. Seed only an empty meetings table; never silently overwrite user records.

- Meeting management lives in `components/meetings/meeting-management.tsx`; reuse native dialogs and `lib/meeting-management.ts` errors/events. Dashboard changes refetch API data; detail edits update canonical metadata without resetting transcript state. Existing contact identities remain shared/read-only. Referenced speakers/assignees cannot be removed. Delete requires explicit confirmation and real API success.
- Independent title/participant/date filters use AND. `search_scope=everywhere` adds transcript content and first chronological matching snippets. Deep links use `tab=transcript`, `segment`, and `q`; apply the initial seek once after transcript loading. Keep literal search highlights shared in `components/ui/highlighted-text.tsx`.

- Shared product styling lives in `src/app/product-polish.css`, imported after route styles. Use semantic Button `data-variant` and existing design tokens; preserve reduced motion, focus visibility, and touch targets. `/settings` contains explicit disabled previews only, except section navigation and the real transcript-import link. Keep sidebar Settings navigation active on that route. UI review must cover desktop/mobile library, overview, transcript, actions, creation, dialogs, and settings; use live API reads and isolated CRUD browser tests.

- Production backend startup is `python -m app.deployment`: require an existing `PERSISTENT_DATA_DIR`, an absolute SQLite URL inside that directory, and explicit HTTPS CORS origins. Migrate at runtime after volume mount; seed only an empty library. Keep one process/instance and use `/ready` for database readiness. `render.yaml` provisions a disk; Railway requires dashboard volume attachment. Vercel uses frontend root and build-time `NEXT_PUBLIC_API_URL`. Never claim hosting or durable storage is verified from configuration alone; run the read-only public smoke script plus a browser CRUD/restart check at actual URLs.
