import Database from 'better-sqlite3';
import { app, dialog, shell, type BrowserWindow } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type {
  BackupCheck,
  BackupCounts,
  BackupCurrentState,
  BackupInfo,
  BackupKind,
  BackupStatus,
  ClearShopResult,
  RestoreResult,
} from '../../shared/ipc-types';
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  getSchemaVersion,
  initializeDatabase,
} from '../database/connection';
import { LATEST_SCHEMA_VERSION, readSchemaVersion, runMigrations } from '../database/migrations';
import { isInMaintenance, setMaintenance } from '../ipc/ipc-wrapper';
import { getAppPaths } from '../main/paths';
import { settingsRepository } from './settings.repository';

/**
 * Backup & restore for the local SQLite database.
 *
 * Safety model:
 *   - Every backup is written to a staging file first, converted to a
 *     self-contained (non-WAL) file, integrity-checked, hashed (SHA-256), and
 *     only then moved into backups/ next to a JSON manifest. A partially
 *     written or corrupt file never appears in the list.
 *   - Validation always runs on a COPY — originals (including files picked from
 *     a USB drive) are never opened for writing.
 *   - Restore: verify → lock IPC → snapshot current data ("pre-restore", the
 *     undo point) → prepare + upgrade a copy → swap files → reopen. If anything
 *     after the swap fails, the original database is put back.
 *   - Existing data is snapshotted before any schema upgrade ("pre-migration").
 *   - Automatic daily backups with retention; manual/imported are never pruned.
 */

const MANIFEST_FORMAT = 1;
const BACKUP_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.db$/;
const KIND_IN_NAME = /-(manual|auto|pre-restore|pre-migration|pre-clear|imported)\.db$/;

/**
 * Tables a backup must contain to be accepted. Keep in sync with migrations:
 * tables added later are fine; renaming/dropping one of these needs an update.
 */
const REQUIRED_TABLES = [
  'schema_migrations',
  'settings',
  'categories',
  'suppliers',
  'products',
  'stock_movements',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
] as const;

const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_FIRST_CHECK_DELAY_MS = 15 * 1000;
const AUTO_MIN_AGE_MS = 20 * 60 * 60 * 1000;
const AUTO_KEEP_DEFAULT = 14;
const SAFETY_KEEP = 10;

/** What a cleared shop starts with: the same values migration 001 seeds. */
const DEFAULT_SETTINGS = [
  ['shop.name', 'Mughal Tuck Shop'],
  ['shop.currency', 'PKR'],
  ['shop.locale', 'en-PK'],
  ['theme.mode', 'system'],
] as const;

interface Manifest {
  format: number;
  kind: BackupKind;
  createdAt: string;
  appVersion: string | null;
  schemaVersion: number | null;
  sha256: string | null;
  sizeBytes: number;
  counts: BackupCounts | null;
  lastSaleAt: string | null;
  note: string | null;
  status: BackupStatus;
  verifiedAt: string | null;
}

interface Inspection {
  problems: string[];
  schemaVersion: number | null;
  counts: BackupCounts | null;
  lastSaleAt: string | null;
}

let restoring = false;
let autoTimer: NodeJS.Timeout | null = null;
let autoFirstRun: NodeJS.Timeout | null = null;

/* ----------------------------------------------------------------- helpers */

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
const uid = () => `${Date.now()}-${randomBytes(3).toString('hex')}`;

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function backupsDir(): string {
  const dir = getAppPaths().backups;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function stagingDir(): string {
  const dir = join(backupsDir(), '.staging');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function removeWithSidecars(file: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(file + suffix, { force: true });
}

function uniqueBackupPath(kind: BackupKind): string {
  const base = `tuckshop-${timestamp()}-${kind}`;
  let candidate = join(backupsDir(), `${base}.db`);
  for (let n = 2; existsSync(candidate); n++) candidate = join(backupsDir(), `${base}-${n}.db`);
  return candidate;
}

/** Resolves a renderer-supplied filename to a file inside backups/ (no path traversal). */
function resolveBackup(filename: string): string {
  if (basename(filename) !== filename || !BACKUP_FILE.test(filename)) {
    throw new Error('Invalid backup file name');
  }
  const file = join(backupsDir(), filename);
  if (!existsSync(file)) throw new Error(`Backup "${filename}" no longer exists`);
  return file;
}

/** Chunked so large databases are hashed without loading them into memory. */
function sha256File(file: string): string {
  const hash = createHash('sha256');
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1024 * 1024);
    let read: number;
    while ((read = readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, read));
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

function countRows(db: Database.Database): BackupCounts {
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  // Backups older than schema v2 have no is_deleted column.
  const softDeletes = (db.pragma('table_info(products)') as { name: string }[]).some(
    (column) => column.name === 'is_deleted'
  );
  return {
    products: count(softDeletes ? 'products WHERE is_deleted = 0' : 'products'),
    categories: count('categories'),
    sales: count('sales'),
    expenses: count('expenses'),
  };
}

/** Latest sale as ISO-8601 UTC (sold_at is stored as SQLite `datetime('now')`, UTC without a zone). */
function lastSaleAt(db: Database.Database): string | null {
  const at = (db.prepare(`SELECT MAX(sold_at) AS at FROM sales`).get() as { at: string | null }).at;
  if (!at) return null;
  const parsed = new Date(/[TZ]/.test(at) ? at : `${at.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Opens a STAGED COPY (never an original), makes it self-contained (rollback
 * journal instead of WAL) and checks it is a healthy Mughal POS database.
 */
function inspect(stagedFile: string): Inspection {
  const result: Inspection = { problems: [], schemaVersion: null, counts: null, lastSaleAt: null };
  let db: Database.Database;
  try {
    db = new Database(stagedFile, { fileMustExist: true });
  } catch (err) {
    result.problems.push(`Not a readable database file (${errorMessage(err)}).`);
    return result;
  }
  try {
    db.pragma('journal_mode = DELETE');

    const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      const detail = integrity.slice(0, 3).map((r) => r.integrity_check).join('; ');
      result.problems.push(`The database is damaged (${detail}).`);
    }

    const tables = new Set(
      (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
        (r) => r.name
      )
    );
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
    if (missing.length) {
      result.problems.push(`This is not a Mughal POS backup (missing: ${missing.join(', ')}).`);
      return result;
    }

    const brokenLinks = (db.pragma('foreign_key_check') as unknown[]).length;
    if (brokenLinks) result.problems.push(`${brokenLinks} record(s) point to missing data.`);

    result.schemaVersion = readSchemaVersion(db);
    if (result.schemaVersion > LATEST_SCHEMA_VERSION) {
      result.problems.push(
        `It was made by a newer version of Mughal POS (data v${result.schemaVersion}, this app supports v${LATEST_SCHEMA_VERSION}). Update the app first.`
      );
    }
    result.counts = countRows(db);
    result.lastSaleAt = lastSaleAt(db);
  } catch (err) {
    result.problems.push(`Could not read the backup (${errorMessage(err)}).`);
  } finally {
    db.close();
  }
  return result;
}

function manifestPath(dbFile: string): string {
  return dbFile.replace(/\.db$/, '.json');
}

function readManifest(dbFile: string): Manifest | null {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath(dbFile), 'utf8')) as Manifest;
    return parsed.format === MANIFEST_FORMAT ? parsed : null;
  } catch {
    return null;
  }
}

function writeManifest(dbFile: string, manifest: Manifest): void {
  const target = manifestPath(dbFile);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  renameSync(tmp, target);
}

/** Backups made before manifests existed (or whose manifest was lost). */
function legacyManifest(dbFile: string): Manifest {
  const stat = statSync(dbFile);
  return {
    format: MANIFEST_FORMAT,
    kind: (KIND_IN_NAME.exec(basename(dbFile))?.[1] as BackupKind | undefined) ?? 'manual',
    createdAt: new Date(stat.mtimeMs).toISOString(),
    appVersion: null,
    schemaVersion: null,
    sha256: null,
    sizeBytes: stat.size,
    counts: null,
    lastSaleAt: null,
    note: null,
    status: 'unverified',
    verifiedAt: null,
  };
}

function toInfo(dbFile: string, manifest: Manifest | null): BackupInfo {
  const m = manifest ?? legacyManifest(dbFile);
  return {
    filename: basename(dbFile),
    path: dbFile,
    sizeBytes: statSync(dbFile).size,
    createdAt: m.createdAt,
    kind: m.kind,
    status: m.status,
    schemaVersion: m.schemaVersion,
    appVersion: m.appVersion,
    sha256: m.sha256,
    counts: m.counts,
    note: m.note,
    lastSaleAt: m.lastSaleAt,
  };
}

/** Validates a staged snapshot and atomically publishes it into backups/. */
function finalizeSnapshot(stagedFile: string, kind: BackupKind, note: string | null): BackupInfo {
  const inspection = inspect(stagedFile);
  if (inspection.problems.length) {
    throw new Error(inspection.problems.join(' '));
  }
  for (const suffix of ['-wal', '-shm', '-journal']) rmSync(stagedFile + suffix, { force: true });

  const dest = uniqueBackupPath(kind);
  const sha256 = sha256File(stagedFile);
  renameSync(stagedFile, dest);
  const manifest: Manifest = {
    format: MANIFEST_FORMAT,
    kind,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    schemaVersion: inspection.schemaVersion,
    sha256,
    sizeBytes: statSync(dest).size,
    counts: inspection.counts,
    lastSaleAt: inspection.lastSaleAt,
    note,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  };
  writeManifest(dest, manifest);
  return toInfo(dest, manifest);
}

/** Copy of a backup, opened read-write, upgraded to the current schema and re-checked. */
function prepareRestoreCandidate(candidate: string): void {
  const db = new Database(candidate, { fileMustExist: true });
  try {
    db.pragma('journal_mode = DELETE');
    db.pragma('foreign_keys = ON');
    if (readSchemaVersion(db) < LATEST_SCHEMA_VERSION) runMigrations(db);
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`prepared copy failed integrity check (${integrity})`);
  } finally {
    db.close();
  }
  for (const suffix of ['-wal', '-shm', '-journal']) rmSync(candidate + suffix, { force: true });
}

/**
 * Replaces the live database file with `candidate`. Synchronous from start to
 * finish, so no IPC handler can run in the middle. On any failure the original
 * file is moved back and reopened.
 */
function swapLiveDatabase(candidate: string): void {
  const live = getDatabasePath();
  const parked = `${live}.replaced-${timestamp()}`;
  const sidecars = ['-wal', '-shm'];

  // Fold the WAL into the main file so the parked copy is complete on its own.
  getDatabase().pragma('wal_checkpoint(TRUNCATE)');
  closeDatabase();

  let liveParked = false;
  try {
    renameSync(live, parked);
    liveParked = true;
    for (const s of sidecars) if (existsSync(live + s)) renameSync(live + s, parked + s);
    renameSync(candidate, live);
    initializeDatabase(live);
    const check = getDatabase().pragma('quick_check', { simple: true });
    if (check !== 'ok') throw new Error(`restored database failed quick check (${check})`);
  } catch (err) {
    closeDatabase();
    if (liveParked) {
      for (const s of ['', ...sidecars]) rmSync(live + s, { force: true });
      renameSync(parked, live);
      for (const s of sidecars) if (existsSync(parked + s)) renameSync(parked + s, live + s);
    }
    initializeDatabase(live);
    throw new Error(`Restore failed, your original data was put back (${errorMessage(err)}).`);
  }
  for (const s of ['', ...sidecars]) rmSync(parked + s, { force: true });
}

/**
 * Empties every table except the migration history, so tables added by later
 * migrations are covered too. Foreign keys go off because ON DELETE RESTRICT
 * fires even when deferred; SQLite ignores the pragma inside a transaction.
 */
function deleteAllRecords(db: Database.Database): void {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'`
    )
    .all() as { name: string }[];

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const { name } of tables) db.prepare(`DELETE FROM "${name}"`).run();
      db.prepare(`DELETE FROM sqlite_sequence`).run();
      const seed = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
      for (const [key, value] of DEFAULT_SETTINGS) seed.run(key, value);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function readSetting(key: string, fallback: string): string {
  try {
    return settingsRepository.get(key)?.value ?? fallback;
  } catch {
    return fallback;
  }
}

function autoKeep(): number {
  const n = Number.parseInt(readSetting('backup.auto.keep', String(AUTO_KEEP_DEFAULT)), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 365) : AUTO_KEEP_DEFAULT;
}

/* --------------------------------------------------------------- public API */

export const backupService = {
  /**
   * Online snapshot via SQLite's backup API (the database stays writable),
   * verified before it is published.
   */
  async create(note: string | null = null, kind: BackupKind = 'manual'): Promise<BackupInfo> {
    const staged = join(stagingDir(), `snapshot-${uid()}.partial`);
    try {
      await getDatabase().backup(staged);
      return finalizeSnapshot(staged, kind, note?.trim() || null);
    } catch (err) {
      throw new Error(`Backup failed: ${errorMessage(err)}`);
    } finally {
      removeWithSidecars(staged);
    }
  },

  list(): BackupInfo[] {
    return readdirSync(backupsDir())
      .filter((f) => BACKUP_FILE.test(f))
      .map((f) => {
        const file = join(backupsDir(), f);
        return toInfo(file, readManifest(file));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  current(): BackupCurrentState {
    const db = getDatabase();
    return {
      counts: countRows(db),
      lastSaleAt: lastSaleAt(db),
      schemaVersion: getSchemaVersion(),
      backupsFolder: backupsDir(),
    };
  },

  /** Re-checks checksum + database health on a copy and records the result. */
  verify(filename: string): BackupCheck {
    const file = resolveBackup(filename);
    const manifest = readManifest(file);
    const problems: string[] = [];

    const sha256 = sha256File(file);
    if (manifest?.sha256 && manifest.sha256 !== sha256) {
      problems.push('The file has changed since the backup was made (checksum mismatch).');
    }

    const staged = join(stagingDir(), `verify-${uid()}.db`);
    let inspection: Inspection;
    try {
      copyFileSync(file, staged);
      inspection = inspect(staged);
    } finally {
      removeWithSidecars(staged);
    }
    problems.push(...inspection.problems);

    const base = manifest ?? legacyManifest(file);
    const next: Manifest = {
      ...base,
      sha256: base.sha256 ?? sha256,
      sizeBytes: statSync(file).size,
      schemaVersion: inspection.schemaVersion ?? base.schemaVersion,
      counts: inspection.counts ?? base.counts,
      lastSaleAt: inspection.lastSaleAt ?? base.lastSaleAt,
      status: problems.length ? 'damaged' : 'verified',
      verifiedAt: new Date().toISOString(),
    };
    writeManifest(file, next);
    return { ok: problems.length === 0, problems, info: toInfo(file, next) };
  },

  async restore(filename: string): Promise<RestoreResult> {
    if (restoring) throw new Error('A restore is already running.');
    restoring = true;
    const candidate = join(stagingDir(), `restore-${uid()}.db`);
    try {
      const check = this.verify(filename);
      if (!check.ok) throw new Error(`This backup can't be restored. ${check.problems.join(' ')}`);

      setMaintenance('A backup is being restored.');

      // 1. Undo point: the data about to be replaced.
      const safetyBackup = await this.create(
        `Safety copy taken automatically before restoring ${filename}`,
        'pre-restore'
      );

      // 2. Work on a copy, upgraded to this app's schema, re-checked.
      copyFileSync(resolveBackup(filename), candidate);
      prepareRestoreCandidate(candidate);

      // 3. Swap (rolls back on failure).
      swapLiveDatabase(candidate);
      this.prune();
      console.log(`[backup] restored ${filename}; safety copy ${safetyBackup.filename}`);
      return { restored: check.info, safetyBackup };
    } finally {
      removeWithSidecars(candidate);
      setMaintenance(null);
      restoring = false;
    }
  },

  /**
   * Deletes every record and puts settings back to their defaults. Backups stay.
   * Same safety model as restore: lock IPC, then take a safety copy, so nothing
   * is deleted unless the undo point exists.
   */
  async clearShop(): Promise<ClearShopResult> {
    if (restoring) throw new Error('A restore is already running.');
    restoring = true;
    try {
      setMaintenance('The shop is being cleared.');
      const safetyBackup = await this.create(
        'Safety copy taken automatically before clearing the shop',
        'pre-clear'
      );
      deleteAllRecords(getDatabase());
      this.prune();
      console.log(`[backup] shop cleared; safety copy ${safetyBackup.filename}`);
      return { safetyBackup };
    } finally {
      setMaintenance(null);
      restoring = false;
    }
  },

  /** Copies an external backup (e.g. from USB) into backups/ after validating it. */
  async import(parent: BrowserWindow | null): Promise<BackupInfo | null> {
    const options: Electron.OpenDialogOptions = {
      title: 'Import a Mughal POS backup',
      filters: [{ name: 'Mughal POS backup', extensions: ['db', 'sqlite', 'bak'] }],
      properties: ['openFile'],
    };
    const picked = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    const source = picked.filePaths[0];
    if (picked.canceled || !source) return null;

    const staged = join(stagingDir(), `import-${uid()}.partial`);
    try {
      copyFileSync(source, staged);
      return finalizeSnapshot(staged, 'imported', `Imported from ${basename(source)}`);
    } catch (err) {
      throw new Error(`Import failed: ${errorMessage(err)}`);
    } finally {
      removeWithSidecars(staged);
    }
  },

  /** Saves a copy elsewhere (USB drive, shared folder) and verifies the copy byte-for-byte. */
  async export(filename: string, parent: BrowserWindow | null): Promise<string | null> {
    const file = resolveBackup(filename);
    const options: Electron.SaveDialogOptions = {
      title: 'Export backup',
      defaultPath: join(app.getPath('documents'), filename),
      filters: [{ name: 'Mughal POS backup', extensions: ['db'] }],
    };
    const picked = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options);
    if (picked.canceled || !picked.filePath) return null;

    const dest = picked.filePath;
    if (resolve(dest) === resolve(file)) return dest;
    copyFileSync(file, dest);
    if (sha256File(dest) !== sha256File(file)) {
      rmSync(dest, { force: true });
      throw new Error('The exported copy did not match the original. The drive may be faulty; try another location.');
    }
    return dest;
  },

  remove(filename: string): { filename: string } {
    const file = resolveBackup(filename);
    rmSync(file);
    rmSync(manifestPath(file), { force: true });
    return { filename };
  },

  async openFolder(): Promise<void> {
    const error = await shell.openPath(backupsDir());
    if (error) throw new Error(error);
  },

  /**
   * Called by initializeDatabase before a schema upgrade. Uses VACUUM INTO
   * (synchronous, consistent). Refuses to continue if the copy fails, so data
   * is never migrated without a way back.
   */
  preMigrationSnapshot(db: Database.Database, fromVersion: number, toVersion: number): void {
    const staged = join(stagingDir(), `premigrate-${uid()}.partial`);
    try {
      db.prepare('VACUUM INTO ?').run(staged);
      const info = finalizeSnapshot(
        staged,
        'pre-migration',
        `Safety copy taken automatically before upgrading data from v${fromVersion} to v${toVersion}`
      );
      console.log(`[backup] pre-migration snapshot ${info.filename}`);
    } catch (err) {
      throw new Error(`Could not create a safety backup before updating the database: ${errorMessage(err)}`);
    } finally {
      removeWithSidecars(staged);
    }
  },

  /** Deletes old automatic backups beyond the retention setting, and old safety copies. */
  prune(): void {
    const all = this.list();
    const excess = (kind: BackupKind, keep: number) =>
      all.filter((b) => b.kind === kind).slice(keep);
    const doomed = [
      ...excess('auto', autoKeep()),
      ...excess('pre-restore', SAFETY_KEEP),
      ...excess('pre-migration', SAFETY_KEEP),
      ...excess('pre-clear', SAFETY_KEEP),
    ];
    for (const b of doomed) {
      try {
        this.remove(b.filename);
      } catch (err) {
        console.error(`[backup] could not prune ${b.filename}:`, errorMessage(err));
      }
    }
  },

  async runAutoBackupIfDue(): Promise<BackupInfo | null> {
    if (restoring || isInMaintenance()) return null;
    if (readSetting('backup.auto.enabled', 'true') === 'false') return null;
    const latest = this.list().find((b) => b.kind === 'auto');
    if (latest && Date.now() - Date.parse(latest.createdAt) < AUTO_MIN_AGE_MS) return null;
    const info = await this.create(null, 'auto');
    this.prune();
    console.log(`[backup] automatic backup ${info.filename}`);
    return info;
  },

  startAutoBackups(): void {
    const tick = () =>
      void this.runAutoBackupIfDue().catch((err) =>
        console.error('[backup] automatic backup failed:', errorMessage(err))
      );
    autoFirstRun = setTimeout(tick, AUTO_FIRST_CHECK_DELAY_MS);
    autoTimer = setInterval(tick, AUTO_CHECK_INTERVAL_MS);
  },

  stopAutoBackups(): void {
    if (autoFirstRun) clearTimeout(autoFirstRun);
    if (autoTimer) clearInterval(autoTimer);
    autoFirstRun = autoTimer = null;
  },

  /** Removes leftovers of an interrupted backup/restore. Call before opening the DB. */
  cleanupStaging(): void {
    rmSync(join(backupsDir(), '.staging'), { recursive: true, force: true });
  },
};
