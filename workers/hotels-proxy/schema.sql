CREATE TABLE IF NOT EXISTS hotels (
  place_id       TEXT PRIMARY KEY,
  eclipse_cat    TEXT NOT NULL,
  name           TEXT NOT NULL,
  lat            REAL NOT NULL,
  lng            REAL NOT NULL,
  rating         REAL,
  rating_count   INTEGER,
  price_level    INTEGER,
  photo_ref      TEXT,
  address        TEXT,
  cached_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eclipse ON hotels(eclipse_cat);
