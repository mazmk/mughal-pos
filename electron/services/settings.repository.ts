import { getDatabase } from '../database/connection';
import type { Setting } from '../../shared/ipc-types';

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

const toSetting = (row: SettingRow): Setting => ({
  key: row.key,
  value: row.value,
  updatedAt: row.updated_at,
});

export const settingsRepository = {
  get(key: string): Setting | null {
    const row = getDatabase().prepare(`SELECT * FROM settings WHERE key = ?`).get(key) as
      | SettingRow
      | undefined;
    return row ? toSetting(row) : null;
  },

  list(): Setting[] {
    const rows = getDatabase().prepare(`SELECT * FROM settings ORDER BY key`).all() as SettingRow[];
    return rows.map(toSetting);
  },

  set(key: string, value: string): Setting {
    getDatabase()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .run(key, value);
    const next = this.get(key);
    if (!next) throw new Error(`Setting ${key} missing after upsert`);
    return next;
  },
};
