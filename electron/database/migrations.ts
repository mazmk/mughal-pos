import type Database from 'better-sqlite3';
import { migration_001_initial } from './migrations/001_initial';

/**
 * Each migration bumps schema_version by exactly 1.
 * Register new migrations in the `migrations` array in order.
 */
interface Migration {
  version: number;
  name: string;
  up(db: Database.Database): void;
}

const migrations: readonly Migration[] = [migration_001_initial];

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
    tx();
    console.log(`[db] applied migration ${m.version}: ${m.name}`);
    highest = Math.max(highest, m.version);
  }

  return highest;
}
