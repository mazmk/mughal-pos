import type Database from 'better-sqlite3';

/**
 * Initial schema.
 *
 * Design notes:
 * - All monetary columns are REAL (SQLite). Multiply by 100 at the service
 *   layer if you need integer-cent precision later.
 * - products.stock_on_hand is a cached projection of stock_movements and is
 *   only ever written by the StockService inside the same transaction as the
 *   movement row (see electron/services/stock.service.ts).
 * - FKs use ON DELETE RESTRICT by default to keep historical records intact.
 */
export const migration_001_initial = {
  version: 1,
  name: 'initial_schema',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_suppliers_name ON suppliers(name);

      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL UNIQUE,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
        cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
        tax_rate REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
        image_path TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        stock_on_hand REAL NOT NULL DEFAULT 0,
        reorder_level REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_products_name ON products(name);
      CREATE INDEX idx_products_category ON products(category_id);
      CREATE INDEX idx_products_active ON products(is_active);

      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        reason TEXT NOT NULL CHECK (
          reason IN ('opening','sale','restock','damage','adjustment','return')
        ),
        quantity REAL NOT NULL,
        unit_cost REAL,
        reference_type TEXT,
        reference_id INTEGER,
        note TEXT,
        occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
      CREATE INDEX idx_stock_movements_reason ON stock_movements(reason);
      CREATE INDEX idx_stock_movements_occurred ON stock_movements(occurred_at);

      CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        reference TEXT,
        total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','received','cancelled')),
        purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
      CREATE INDEX idx_purchases_date ON purchases(purchased_at);

      CREATE TABLE purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
        line_total REAL NOT NULL CHECK (line_total >= 0)
      );
      CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
      CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL UNIQUE,
        total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
        tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
        discount_amount REAL NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
        payment_method TEXT NOT NULL DEFAULT 'cash'
          CHECK (payment_method IN ('cash','card','credit','other')),
        status TEXT NOT NULL DEFAULT 'completed'
          CHECK (status IN ('completed','voided','refunded')),
        sold_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_sales_date ON sales(sold_at);
      CREATE INDEX idx_sales_status ON sales(status);

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit_price REAL NOT NULL CHECK (unit_price >= 0),
        line_total REAL NOT NULL CHECK (line_total >= 0),
        tax_rate REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX idx_sale_items_product ON sale_items(product_id);

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        category TEXT,
        amount REAL NOT NULL CHECK (amount >= 0),
        incurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_expenses_date ON expenses(incurred_at);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const seed = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`
    );
    seed.run('shop.name', 'Mughal Tuck Shop');
    seed.run('shop.currency', 'PKR');
    seed.run('shop.locale', 'en-PK');
    seed.run('theme.mode', 'system');
  },
};
