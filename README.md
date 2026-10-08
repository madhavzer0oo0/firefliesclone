# Fireflies clone - application foundation

Separate Next.js App Router/TypeScript and FastAPI applications, with SQLite/SQLAlchemy persistence, Alembic migrations, Tailwind CSS, and shadcn/ui. This phase provides the API, typed client, original sample data, and a minimal landing shell. The complete library/detail UI is intentionally deferred.

## Quick start on Windows

Requires Python 3.11+ and Node.js 20.9+ with npm. Run from the repository root:

```powershell
./scripts/setup.ps1
./scripts/init-db.ps1
./scripts/seed.ps1
./scripts/run-backend.ps1
# In another terminal:
./scripts/run-frontend.ps1
```

Frontend: http://localhost:3000. API documentation: http://localhost:8000/docs. Health: http://localhost:8000/health.
Scripts stop on a failed command. If local PowerShell execution policy blocks scripts, run the commands below directly rather than changing machine-wide policy.

## Linux/macOS or manual setup

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# Another terminal, from repository root:
cd frontend
npm ci
npm run dev
```

On Windows substitute `.venv/Scripts/python.exe` and `python` for the corresponding Python commands.
The database defaults to `backend/fireflies.db` regardless of your current directory. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local` only when configuration overrides are needed. Relative `DATABASE_URL` overrides resolve against the service working directory. `CORS_ORIGINS` is a JSON list. `NEXT_PUBLIC_API_URL` includes `/api/v1` and is embedded at frontend build time. Keep `.env` files private.

## Architecture and database

| Table | Role and relationships |
| --- | --- |
| meetings | Title, UTC start, duration, processing/completed/failed status, source, created/updated timestamps |
| participants | Reusable person, unique lowercased email and name |
| meeting_participants | Many-to-many association; composite meeting/person primary key |
| transcript_segments | Meeting, participant speaker, ordered position, start/end seconds, text |
| summaries | One per meeting; overview and plain-text notes |
| chapters | Meeting outline, ordered position, title/description, start/end seconds |
| action_items | Meeting task, optional participant assignee, open/completed status, optional due date |

Meeting deletion cascades to membership, transcript, summary, chapters, and action items. Shared participants remain. Composite foreign keys enforce that speakers and assignees belong to their meeting. Removing referenced participants is rejected by the API. Summary meeting IDs and timeline positions are unique; timing and status have database checks. Indexes support date sorting, status/title, email, participant lookup, timeline lookup, and task status/assignee.

SQLite stores UTC datetimes without timezone metadata; API responses restore UTC explicitly. Meeting creation and date filters require timezone-aware input. Duration cannot be shortened below existing content. Transcript/chapters must have unique positions and non-overlapping ordered ranges within duration. Gaps are allowed. PUT validates all content before replacement and commits once.

`app/config.py` and `database.py` configure sessions; `models.py` owns the schema; `schemas.py` owns typed validation; `api.py` exposes HTTP routes. Alembic owns database initialization: startup does not silently create tables. Frontend API methods and DTOs are under `src/lib/api.ts` and `src/types/api.ts`; `ApiError` exposes HTTP status and validation detail. Components use local shadcn/ui source and semantic Tailwind theme tokens.

## API contracts

Prefix: `/api/v1`. Interactive request/response schemas: `/docs`; machine-readable contract: `/openapi.json`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /meetings | `{items,total,limit,offset}` with search/filter/sort |
| POST | /meetings | Create metadata and participants; 201 with meeting |
| GET / PATCH / DELETE | /meetings/{id} | Read/edit metadata or delete; DELETE returns 204 |
| GET / PUT | /meetings/{id}/transcript | Read segments, optionally `q`; atomically replace array |
| GET / PUT | /meetings/{id}/summary | Read or upsert one summary |
| GET / PUT | /meetings/{id}/chapters | Read or atomically replace chapter array |
| GET / POST | /meetings/{id}/action-items | List with optional `status`; create (201) |
| GET / PATCH / DELETE | /meetings/{id}/action-items/{item_id} | Read/edit/delete a meeting-scoped task |

Meeting list query parameters: `q` matches title or transcript text; `participant` matches name/email; `status`; inclusive `date_from`/`date_to`; `sort=started_at|title|duration_seconds`; `order=asc|desc`; `limit=1..100` (default 20); `offset>=0` (default 0). Default order is newest first; IDs break ties. Text matching is case-insensitive for ASCII and treats SQL wildcard characters literally. SQLite's default lower-case matching is not full Unicode case folding. This small dataset uses substring matching; title indexes do not accelerate arbitrary substring searches.

Example meeting creation:

```json
{
  "title": "Product planning",
  "started_at": "2026-10-08T10:00:00+05:30",
  "duration_seconds": 300,
  "source": "manual",
  "participants": [{ "name": "Priya Sharma", "email": "priya@example.com" }]
}
```

Creation returns participant IDs for subsequent transcript and task writes. Metadata is created first, then transcript/summary/chapters/tasks can be submitted through their endpoints. Transcript and chapter PUT accept arrays, including `[]` to clear. Summary PUT requires `overview` and defaults `notes` to empty. Task creation requires `text`; assignee and deadline are optional. PATCH omission preserves fields; `assignee_id` and `due_date` accept null to clear. A participant's email resolves an existing person without renaming that person across other meetings.

Missing records return 404; invalid fields, timestamps, or memberships return 422; database conflicts return 409. Validation uses FastAPI's standard `detail` shape; relational validation uses a detail string. No authentication is implemented; this is a local default-user assignment workspace. CORS defaults to the two local frontend origins. Media, bot integrations, and speech-to-text are out of scope. No calls to real AI services occur.

## Seed and migration workflow

The seed contains seven original 2.5-minute working meetings, five shared participants, 70 timestamped segments, seven summaries, 21 chapters, and 14 assigned action items. Each short conversation starts with context and ends with owners/next steps; transcripts are complete rather than excerpts. Every meeting has at least three speakers. Running the seed again preserves existing meetings and returns zero additions. Empty meetings are permitted during form creation/import.

```powershell
cd backend
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m alembic check
# After changing models, create and review a new revision:
./.venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe schema change"
```

Downgrading the initial revision removes all application tables and data; use only a disposable database for round-trip checks. Tests perform this on isolated temporary SQLite files.

## Verification

```powershell
./scripts/verify.ps1
# Or manually, using the project Python:
cd backend
./.venv/Scripts/python.exe -m pytest -q
cd ../frontend
npm run typecheck
npm run build
```

Tests initialize their databases from the actual migration and exercise CRUD persistence, literal search and filters, pagination/sort, transcript replacement rollback, timeline validation, cross-meeting references, summary upsert, task completion, seed completeness/idempotence, cascade deletion, CORS, and migration upgrade/downgrade/schema parity. Frontend builds need neither a running backend nor remote fonts.

The typecheck script first runs `next typegen` so it also works on a clean checkout without a previous build. Next.js generates `next-env.d.ts` locally; it is ignored in Git. The framework-generated `frontend/AGENTS.md` provides additional version-specific guidance.

The full product UI, upload parsing, playback interactions, toasts, and hosted demo will be built in later phases. Nothing has been published or deployed by these setup scripts.
