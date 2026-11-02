import type Database from 'better-sqlite3';

/**
 * Expenses get a fixed type (utility bill, stock bought, taken by a team
 * member, other) and file attachments such as a photo of the bill.
 *
 * The table is rebuilt because SQLite cannot add a CHECK to an existing
 * column. The app never had an expenses screen, so old rows are unlikely; any
 * that exist become 'other', with their notes folded into the description.
 *
 * Attachments live in the database, not in uploads/, so every backup and
 * restore carries them.
 */
export const migration_004_expense_types = {
  version: 4,
  name: 'expense_types',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE expenses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'other'
          CHECK (type IN ('utility','stock','staff','other')),
        amount REAL NOT NULL CHECK (amount >= 0),
        description TEXT,
        incurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO expenses_new (id, type, amount, description, incurred_at, created_at, updated_at)
      SELECT id, 'other', amount,
             description || COALESCE(' - ' || NULLIF(notes, ''), ''),
             incurred_at, created_at, updated_at
      FROM expenses;

      DROP TABLE expenses;
      ALTER TABLE expenses_new RENAME TO expenses;
      CREATE INDEX idx_expenses_date ON expenses(incurred_at);
      CREATE INDEX idx_expenses_type ON expenses(type);

      CREATE TABLE expense_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','application/pdf')),
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
        data BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_expense_attachments_expense ON expense_attachments(expense_id);
    `);
  },
};
