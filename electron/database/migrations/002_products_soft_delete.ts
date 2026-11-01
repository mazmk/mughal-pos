import type Database from 'better-sqlite3';

/**
 * Soft delete for products: sales, purchases and the stock ledger keep pointing
 * at a deleted product, so its row has to stay.
 *
 * The table is rebuilt because SQLite cannot drop the inline UNIQUE on sku and
 * barcode. Those become partial indexes, so a deleted product's SKU and barcode
 * can be used again.
 */
export const migration_002_products_soft_delete = {
  version: 2,
  name: 'products_soft_delete',
  foreignKeysOff: true,
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE products_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL,
        barcode TEXT,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
        cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
        tax_rate REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
        image_path TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
        stock_on_hand REAL NOT NULL DEFAULT 0,
        reorder_level REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO products_new
        (id, sku, barcode, name, category_id, unit_price, cost_price, tax_rate,
         image_path, is_active, stock_on_hand, reorder_level, created_at, updated_at)
      SELECT
         id, sku, barcode, name, category_id, unit_price, cost_price, tax_rate,
         image_path, is_active, stock_on_hand, reorder_level, created_at, updated_at
      FROM products;

      DROP TABLE products;
      ALTER TABLE products_new RENAME TO products;

      CREATE UNIQUE INDEX uq_products_sku ON products(sku) WHERE is_deleted = 0;
      CREATE UNIQUE INDEX uq_products_barcode ON products(barcode) WHERE is_deleted = 0;
      CREATE INDEX idx_products_name ON products(name);
      CREATE INDEX idx_products_category ON products(category_id);
      CREATE INDEX idx_products_active ON products(is_active);
    `);
  },
};
