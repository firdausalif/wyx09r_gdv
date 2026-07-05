import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { PRAGMA_SQL } from "../schema.js";

const CHECKPOINT_INTERVAL_MS = 60 * 1000;
const RUNTIME_NM = path.join(os.homedir(), ".9router", "runtime", "node_modules");
const AUTOMATION_NM = path.join(os.homedir(), ".9router", "automation-runtime", "node_modules");

function loadDatabase() {
  const tryRequire = (base) => {
    try {
      const req = createRequire(base);
      const mod = req(["better", "sqlite3"].join("-"));
      return mod.default || mod;
    } catch {}
    return null;
  };

  return tryRequire(import.meta.url)
    || tryRequire(path.join(RUNTIME_NM, "better-sqlite3", "package.json"))
    || tryRequire(path.join(AUTOMATION_NM, "better-sqlite3", "package.json"))
    || (() => { throw new Error("better-sqlite3 not found in project node_modules, ~/.9router/runtime, or ~/.9router/automation-runtime"); })();
}

export function createBetterSqliteAdapter(filePath) {
  const Database = loadDatabase();
  const db = new Database(filePath);
  db.exec(PRAGMA_SQL);
  // Schema is created/synced by migrate.js after adapter init

  const stmtCache = new Map();

  function prepare(sql) {
    let stmt = stmtCache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  // Truncate WAL periodically so file stays small for backup/copy
  const checkpointTimer = setInterval(() => {
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {}
  }, CHECKPOINT_INTERVAL_MS);
  if (typeof checkpointTimer.unref === "function") checkpointTimer.unref();

  function gracefulClose() {
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {}
    try { stmtCache.clear(); } catch {}
    try { db.close(); } catch {}
  }

  // Ensure WAL is flushed and -wal/-shm files removed on shutdown
  const onShutdown = () => gracefulClose();
  process.once("beforeExit", onShutdown);
  process.once("SIGINT", () => { onShutdown(); process.exit(0); });
  process.once("SIGTERM", () => { onShutdown(); process.exit(0); });

  return {
    driver: "better-sqlite3",
    run(sql, params = []) { return prepare(sql).run(params); },
    get(sql, params = []) { return prepare(sql).get(params); },
    all(sql, params = []) { return prepare(sql).all(params); },
    exec(sql) { return db.exec(sql); },
    transaction(fn) { return db.transaction(fn)(); },
    checkpoint() { try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {} },
    close() {
      clearInterval(checkpointTimer);
      gracefulClose();
    },
    raw: db,
  };
}
