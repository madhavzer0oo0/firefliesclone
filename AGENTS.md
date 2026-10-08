# Fireflies clone foundation

## Architecture
- `frontend/` is a standalone Next.js App Router TypeScript application with Tailwind v4 and local shadcn/ui components. Keep routes in `src/app`, UI components in `src/components/ui`, API code in `src/lib/api.ts`, and contracts in `src/types/api.ts`.
- `backend/` is a standalone FastAPI application using Pydantic v2, SQLAlchemy v2, SQLite, and Alembic. `app/api.py` owns HTTP routing, `schemas.py` validates requests/responses, `models.py` defines persistence, `database.py` owns connections and sessions, and `config.py` owns environment configuration.
- `/api/v1` is the API prefix; OpenAPI is served at `/docs`. The frontend talks directly to FastAPI; do not add a duplicate Next.js data API.
- Enable SQLite foreign keys on every connection. Meeting-owned records cascade; reusable participants remain. Speaker/assignee membership uses composite foreign keys. Preserve request transactions and validate before replacing content.
- The live `/meetings` library and `/meetings/[id]` Overview are implemented. Keep reusable workspace/library components separate from `hooks/use-meetings.ts` and `lib/meetings.ts`.
- Detail components live in `components/meeting-detail/`; `hooks/use-meeting-detail.ts` owns cancellation/retries and `lib/meeting-detail.ts` owns composed API access. Metadata loads first; summary/chapters/actions then load concurrently with independent errors. A summary 404 means missing content, not a missing meeting.
- Keep the detail header, tabs, summary panel, and context panel reusable for future Transcript/Action Items work. Those tabs and all unimplemented detail controls must stay disabled/Coming Soon. Do not simulate task completion, sharing, playback, editing, or AI regeneration.
- Summary text and discussion points must preserve backend content; never invent facts in React. Chapter expansion, section navigation, refresh, participant disclosure, and copy controls are real interactions.
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
- Use integer IDs, UTC ISO 8601 datetimes with timezone, ISO dates for task deadlines, and integer seconds relative to meeting start. Ordered content uses zero-based `position`.
- Use PATCH for partial metadata/task edits. Omission preserves values; only optional assignee/deadline fields accept null. PUT replaces complete transcript/chapter collections and upserts the summary.
- Identify participants by lowercased unique email. Meeting edits change membership; they do not rename shared participants globally.
- Add database changes as new frozen Alembic migrations; do not import live model metadata into migration revisions. Keep TypeScript contracts aligned with Pydantic and update README when API behavior changes.

## Verification requirements
- After backend/schema changes run `python -m pytest -q` from backend using `.venv`. Tests must use isolated migrated SQLite databases, never the development database.
- Test meaningful behavior: persistence, validation, scoped relationships, atomic replacement, literal search, deterministic pagination, cascading deletes, and migration upgrade/downgrade/schema parity.
- After frontend/contract changes run `npm run lint`, `npm run typecheck`, and `npm run build` from frontend. Keep production builds independent of a running backend or network fonts. Lint covers TypeScript, React Hooks, and JSX accessibility without the framework glob plugin.
- For library/detail interactions run `npm run test:e2e` with the seeded backend running. Set `PLAYWRIGHT_CHANNEL=msedge` on Windows to use installed Edge, or install Playwright Chromium. Tests use live data; request interception is restricted to empty/failure scenarios. Never mutate a user's database from browser tests.
- List items expose `preview` from stored summaries. `search_scope=library` matches title OR participant; the default search scope preserves transcript search. Cancel stale requests and preserve local date/DST boundaries.
- Check dependency lockfiles into source control. Regenerate `requirements.lock.txt` and `package-lock.json` when dependencies change.
- Never commit `.env`, SQLite files, virtual environments, `node_modules`, or `.next`. Seed only an empty meetings table; never silently overwrite user records.
