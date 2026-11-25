-- Internship Board schema (SQLite). Safe to run repeatedly.
-- Extends the supplied EdVyro starter schema with location, skills, openings,
-- apply_url and timestamps, and adds portfolio_url to applications.

CREATE TABLE IF NOT EXISTS internships (
    id                TEXT PRIMARY KEY CHECK (id GLOB 'INT-[0-9][0-9][0-9]*'),
    title             TEXT NOT NULL,
    domain            TEXT NOT NULL,
    mode              TEXT NOT NULL CHECK (mode IN ('Remote', 'Hybrid', 'On-site')),
    location          TEXT NOT NULL,
    skills            TEXT NOT NULL DEFAULT '[]',            -- JSON array of strings
    openings          INTEGER NOT NULL DEFAULT 0 CHECK (openings >= 0),
    duration_weeks    INTEGER CHECK (duration_weeks IS NULL OR duration_weeks > 0),
    applications_open INTEGER NOT NULL DEFAULT 1 CHECK (applications_open IN (0, 1)),
    apply_url         TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_internships_domain ON internships (domain COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_internships_mode   ON internships (mode);

CREATE TABLE IF NOT EXISTS applications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id   TEXT NOT NULL,
    applicant_name  TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    portfolio_url   TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (internship_id, applicant_email),
    FOREIGN KEY (internship_id) REFERENCES internships (id)
);
