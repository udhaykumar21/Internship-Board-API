# Internship Board API

**EdVyro · Full Stack Development · Task 2 — REST API and Persistent Data**

A Node.js + Express REST API for a fictional student internship board, persisted in SQLite, with input validation, pagination, filtering, consistent error responses and automated tests.

## Short explanation (for reviewers)

- **Stack:** Node.js 22+, Express 4, SQLite through Node's built-in `node:sqlite` module. The only npm dependency is `express`, so there is nothing native to compile.
- **Data model:** `internships` (id, title, domain, mode, location, skills, openings, duration_weeks, applications_open, apply_url, timestamps) and `applications` (unique per internship + email). It extends the supplied starter schema in `internship-board-sample.sql` and seeds from the supplied JSON, **preserving IDs `INT-101` to `INT-105`**.
- **Response format:** every response uses the envelope `{ status, data, pagination? }` for success and `{ status: "error", error: { code, message, details? } }` for failure. Full reference in [`docs/API.md`](docs/API.md).
- **Validation:** hand-written, dependency-free, strict. It rejects missing names, invalid emails, unsafe URLs (`javascript:`, `data:`, credentials in URL), wrong types, unknown fields and duplicate applications, and returns all field errors at once.
- **Safety:** every SQL statement is parameterised, `LIKE` wildcards are escaped, sort fields are whitelisted, body size is capped at 10 KB, and the logger records only method, path, status and timing (never bodies, headers or query strings).

## Project structure

```
├── data/internship-records-sample.json   seed records (IDs preserved)
├── db/schema.sql                         tables, constraints, indexes
├── docs/API.md                           endpoint + error reference
├── docs/curl-examples.sh                 runnable curl examples
├── scripts/init-db.js                    apply the schema
├── scripts/seed.js                       seed (add --reset to wipe first)
├── src/app.js                            Express app factory
├── src/server.js                         entry point
├── src/config.js                         environment variables
├── src/db.js                             SQLite connection
├── src/repository.js                     all SQL
├── src/validation.js                     all validation rules
├── src/routes/internships.js             routes
├── src/middleware/errors.js              error classes + handlers
├── src/middleware/logger.js              safe request logging
└── tests/                                validation, repository and HTTP tests
```

## Setup

Requires **Node.js 22.13 or newer**.

```bash
git clone <your-repo-url>
cd internship-board-api
npm install
cp .env.example .env        # no secrets are needed
npm run db:init             # create tables
npm run db:seed             # load INT-101 … INT-105
npm start                   # http://localhost:3000
```

Try it:

```bash
curl "http://localhost:3000/api/v1/internships?page=1&limit=2"
bash docs/curl-examples.sh
```

### Environment variables (`.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `test` silences the access log |
| `DB_PATH` | `./data/internships.db` | SQLite file (`:memory:` for a throwaway DB) |
| `SEED_ON_START` | `false` | `true` seeds on boot if the table is empty (useful on hosts with ephemeral disks) |

### Schema and seed commands

| Command | Effect |
|---|---|
| `npm run db:init` | Applies `db/schema.sql` (safe to repeat) |
| `npm run db:seed` | Inserts seed records that do not exist yet |
| `npm run db:reset` | Deletes all rows, then seeds again |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/internships` | List with `page`, `limit`, `q`, `domain`, `mode`, `location`, `skill`, `applications_open`, `sort` |
| GET | `/api/v1/internships/:id` | Detail |
| POST | `/api/v1/internships` | Create (201) |
| PUT | `/api/v1/internships/:id` | Replace |
| PATCH | `/api/v1/internships/:id` | Partial update |
| DELETE | `/api/v1/internships/:id` | Delete (204) |
| POST | `/api/v1/internships/:id/applications` | Apply (duplicates rejected with 409) |
| GET | `/health` | Liveness |

Example list response:

```json
{
  "status": "success",
  "data": [
    { "id": "INT-101", "title": "Frontend Intern", "domain": "Full Stack Development", "mode": "Remote",
      "location": "India", "skills": ["HTML", "CSS", "JavaScript"], "openings": 3,
      "duration_weeks": null, "applications_open": true, "apply_url": null,
      "created_at": "2026-11-25T09:00:00.000Z", "updated_at": "2026-11-25T09:00:00.000Z" }
  ],
  "pagination": { "page": 1, "limit": 1, "total": 5, "totalPages": 5, "hasNext": true, "hasPrev": false }
}
```

## Tests

```bash
npm test
```

- `tests/validation.test.js` – field rules, unsafe URLs, query parsing
- `tests/repository.test.js` – seeding, pagination, filters, CRUD, duplicate applications
- `tests/api.test.js` – full HTTP flow with real requests against an in-memory database

**Test results:** _paste the output of `npm test` here before submitting._

## Accessibility and UI note

This task is the API only. The product brief's front-end criteria (keyboard use, loading/empty/error/retry states, 360px layout) belong to the later UI task; the API supports them through stable error codes, `pagination` metadata and empty-list responses.

## Two-minute walkthrough (script)

1. `npm install && npm run db:reset && npm start` (15 s)
2. `GET /api/v1/internships?limit=2` – show the envelope and pagination (20 s)
3. Filter with `?mode=Remote&skill=SQL` and `?q=pune` (15 s)
4. `POST` a valid record → 201; `POST` with `"mode":"Moon"` and a `javascript:` URL → 400 with per-field details (30 s)
5. `PATCH`, then `DELETE` → 204, then `GET` → 404 (20 s)
6. Apply twice with the same email → 201 then 409 (10 s)
7. Show `npm test` passing (10 s)

## Deployed URL

_Add your deployed URL here (for example Render or Railway). Set `SEED_ON_START=true` there._
