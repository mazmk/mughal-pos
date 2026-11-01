import type Database from 'better-sqlite3';
import { migration_001_initial } from './migrations/001_initial';
import { migration_002_products_soft_delete } from './migrations/002_products_soft_delete';

/**
 * Each migration bumps schema_version by exactly 1.
 * Register new migrations in the `migrations` array in order.
 */
interface Migration {
  version: number;
  name: string;
  /**
   * Set when rebuilding a table others reference: DROP TABLE would otherwise
   * trip ON DELETE RESTRICT. SQLite ignores this pragma inside a transaction,
   * so the runner sets it around the migration.
   */
  foreignKeysOff?: boolean;
  up(db: Database.Database): void;
}

const migrations: readonly Migration[] = [
  migration_001_initial,
  migration_002_products_soft_delete,
];

/** Highest schema version this build of the app knows how to run. */
export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;

/**
 * Schema version recorded in an existing database, or 0 for a brand-new file
 * (no schema_migrations table yet). Does not modify the database.
 */
export function readSchemaVersion(db: Database.Database): number {
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`)
    .get();
  if (!table) return 0;
  const row = db.prepare(`SELECT MAX(version) AS v FROM schema_migrations`).get() as {
    v: number | null;
  };
  return row.v ?? 0;
}

export function runMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare(`SELECT version FROM schema_migrations`)
      .all()
      .map((row) => (row as { version: number }).version)
  );

  let highest = 0;
  for (const m of migrations) {
    if (applied.has(m.version)) {
      highest = Math.max(highest, m.version);
      continue;
    }
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`).run(
        m.version,
        m.name
      );
    });
    if (m.foreignKeysOff) db.pragma('foreign_keys = OFF');
    try {
      tx();
    } finally {
      if (m.foreignKeysOff) db.pragma('foreign_keys = ON');
    }
    console.log(`[db] applied migration ${m.version}: ${m.name}`);
    highest = Math.max(highest, m.version);
  }

  return highest;
}
