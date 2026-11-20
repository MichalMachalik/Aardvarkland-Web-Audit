CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, customer_hash TEXT NOT NULL, service_hash TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS workspaces_expiry ON workspaces(expires);
CREATE TABLE IF NOT EXISTS orders (
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL, contact TEXT NOT NULL, slot TEXT NOT NULL,
  units INTEGER NOT NULL, area TEXT NOT NULL, total INTEGER NOT NULL,
  created TEXT NOT NULL, accepted TEXT,
  PRIMARY KEY (workspace,id)
);
CREATE INDEX IF NOT EXISTS orders_by_time ON orders(workspace,created);
