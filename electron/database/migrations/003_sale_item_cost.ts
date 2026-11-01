import type Database from 'better-sqlite3';

/**
 * Records what each sold item cost, so a later cost change can't rewrite the
 * profit on past sales.
 *
 * Old sales never stored this. The nearest thing to the real figure is the last
 * received purchase before the sale, then the product's current cost.
 */
export const migration_003_sale_item_cost = {
  version: 3,
  name: 'sale_item_cost',
  up(db: Database.Database): void {
    db.exec(`
      ALTER TABLE sale_items
        ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0);

      UPDATE sale_items SET unit_cost = COALESCE(
        (SELECT sm.unit_cost
         FROM stock_movements sm
         JOIN sales s ON s.id = sale_items.sale_id
         WHERE sm.product_id = sale_items.product_id
           AND sm.reason = 'restock'
           AND sm.unit_cost > 0
           AND sm.occurred_at <= s.sold_at
         ORDER BY sm.occurred_at DESC, sm.id DESC
         LIMIT 1),
        (SELECT p.cost_price FROM products p WHERE p.id = sale_items.product_id)
      );
    `);
  },
};
