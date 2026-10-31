import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;
let currentSchemaVersion = 0;
let dbPath = '';

export function initializeDatabase(filePath: string): Database.Database {
  if (db) return db;

  dbPath = filePath;
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  currentSchemaVersion = runMigrations(db);
  console.log(`[db] ready at ${filePath} (schema v${currentSchemaVersion})`);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getSchemaVersion(): number {
  return currentSchemaVersion;
}

export function getDatabasePath(): string {
  return dbPath;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
