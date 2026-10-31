import { getDatabase } from '../database/connection';
import type { StockMovementReason } from '../../shared/ipc-types';

/**
 * Single enforced path for stock changes.
 *
 * Why: application rule — no code may update products.stock_on_hand directly.
 * All inventory deltas go through recordMovement(), which inserts a
 * stock_movements row AND updates the cached stock_on_hand atomically.
 */

export interface StockMovementInput {
  productId: number;
  reason: StockMovementReason;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: number;
  note?: string;
}

export function recordMovement(input: StockMovementInput): void {
  const db = getDatabase();

  const tx = db.transaction((m: StockMovementInput) => {
    const product = db
      .prepare(`SELECT stock_on_hand FROM products WHERE id = ?`)
      .get(m.productId) as { stock_on_hand: number } | undefined;

    if (!product) {
      throw new Error(`Product ${m.productId} not found`);
    }

    const next = product.stock_on_hand + m.quantity;
    if (next < 0) {
      throw new Error(
        `Movement would drive stock negative for product ${m.productId} (current=${product.stock_on_hand}, delta=${m.quantity})`
      );
    }

    db.prepare(
      `INSERT INTO stock_movements
         (product_id, reason, quantity, unit_cost, reference_type, reference_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.productId,
      m.reason,
      m.quantity,
      m.unitCost ?? null,
      m.referenceType ?? null,
      m.referenceId ?? null,
      m.note ?? null
    );

    db.prepare(
      `UPDATE products
         SET stock_on_hand = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(next, m.productId);
  });

  tx(input);
}

/**
 * Rebuilds products.stock_on_hand from the stock_movements ledger.
 * Use after restore or data import; cheap enough to run on demand.
 */
export function rebuildStockCache(): void {
  const db = getDatabase();
  const tx = db.transaction(() => {
    db.exec(`
      UPDATE products SET stock_on_hand = COALESCE((
        SELECT SUM(quantity) FROM stock_movements WHERE product_id = products.id
      ), 0);
    `);
  });
  tx();
}
