CREATE TABLE exclusions (
  date TEXT PRIMARY KEY,           -- YYYY-MM-DD
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
