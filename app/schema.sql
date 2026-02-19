CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id         INTEGER UNIQUE NOT NULL,
  firstname         TEXT NOT NULL DEFAULT '',
  access_token      TEXT NOT NULL,          -- encrypted
  refresh_token     TEXT NOT NULL,          -- encrypted
  token_expires_at  INTEGER NOT NULL,       -- unix timestamp
  last_fetched_at   INTEGER,               -- unix timestamp
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS rendered_pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  html        TEXT NOT NULL,
  rendered_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, year)
);
