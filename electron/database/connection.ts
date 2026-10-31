import Database from 'better-sqlite3';
import { LATEST_SCHEMA_VERSION, readSchemaVersion, runMigrations } from './migrations';

let db: Database.Database | null = null;
let currentSchemaVersion = 0;
let dbPath = '';

export interface InitializeOptions {
  /**
   * Called when an existing database is about to be upgraded (not for a brand
   * new file). Runs before any migration touches the data, so it can snapshot.
   */
  beforeMigrate?: (db: Database.Database, fromVersion: number, toVersion: number) => void;
}

let initOptions: InitializeOptions = {};

export function initializeDatabase(
  filePath: string,
  options: InitializeOptions = initOptions
): Database.Database {
  if (db) return db;

  dbPath = filePath;
  initOptions = options;
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  const existingVersion = readSchemaVersion(db);
  if (existingVersion > LATEST_SCHEMA_VERSION) {
    db.close();
    db = null;
    throw new Error(
      `Database schema v${existingVersion} is newer than this app supports (v${LATEST_SCHEMA_VERSION}). Update Mughal POS.`
    );
  }
  if (existingVersion > 0 && existingVersion < LATEST_SCHEMA_VERSION) {
    options.beforeMigrate?.(db, existingVersion, LATEST_SCHEMA_VERSION);
  }

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
