import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupInfo } from '../../shared/ipc-types';
import { getDatabase } from '../database/connection';
import { getAppPaths } from '../main/paths';

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export const backupService = {
  /**
   * Online SQLite backup. Uses better-sqlite3's native .backup() so the
   * database stays writable throughout.
   */
  async create(): Promise<BackupInfo> {
    const paths = getAppPaths();
    const filename = `tuckshop-${timestamp()}.db`;
    const dest = join(paths.backups, filename);
    await getDatabase().backup(dest);
    const stat = statSync(dest);
    return {
      filename,
      path: dest,
      sizeBytes: stat.size,
      createdAt: new Date(stat.mtimeMs).toISOString(),
    };
  },

  list(): BackupInfo[] {
    const paths = getAppPaths();
    const files = readdirSync(paths.backups).filter((f) => f.endsWith('.db'));
    const result: BackupInfo[] = files.map((filename) => {
      const full = join(paths.backups, filename);
      const stat = statSync(full);
      return {
        filename,
        path: full,
        sizeBytes: stat.size,
        createdAt: new Date(stat.mtimeMs).toISOString(),
      };
    });
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  },
};
