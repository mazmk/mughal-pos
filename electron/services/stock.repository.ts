import { getDatabase } from '../database/connection';
import type { StockMovement } from '../../shared/ipc-types';

interface Row {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  reason: StockMovement['reason'];
  quantity: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: number | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
}

const toMovement = (r: Row): StockMovement => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  productSku: r.product_sku,
  reason: r.reason,
  quantity: r.quantity,
  unitCost: r.unit_cost,
  referenceType: r.reference_type,
  referenceId: r.reference_id,
  note: r.note,
  occurredAt: r.occurred_at,
  createdAt: r.created_at,
});

const BASE = `
  SELECT sm.*, p.name AS product_name, p.sku AS product_sku
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
`;

export const stockRepository = {
  list(productId?: number): StockMovement[] {
    const db = getDatabase();
    const rows =
      productId == null
        ? (db.prepare(`${BASE} ORDER BY sm.occurred_at DESC, sm.id DESC`).all() as Row[])
        : (db
            .prepare(`${BASE} WHERE sm.product_id = ? ORDER BY sm.occurred_at DESC, sm.id DESC`)
            .all(productId) as Row[]);
    return rows.map(toMovement);
  },

  getById(id: number): StockMovement | null {
    const r = getDatabase().prepare(`${BASE} WHERE sm.id = ?`).get(id) as Row | undefined;
    return r ? toMovement(r) : null;
  },
};
