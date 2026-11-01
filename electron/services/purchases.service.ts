import { getDatabase } from '../database/connection';
import { productsRepository } from './products.repository';
import type { NewPurchase, Purchase, PurchaseItem } from '../../shared/ipc-types';
import { recordMovement } from './stock.service';

interface PurchaseRow {
  id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  reference: string | null;
  total_amount: number;
  status: Purchase['status'];
  purchased_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

const toItem = (r: ItemRow): PurchaseItem => ({
  id: r.id,
  purchaseId: r.purchase_id,
  productId: r.product_id,
  productName: r.product_name,
  productSku: r.product_sku,
  quantity: r.quantity,
  unitCost: r.unit_cost,
  lineTotal: r.line_total,
});

function loadWithItems(id: number): Purchase | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT pu.*, s.name AS supplier_name
       FROM purchases pu
       LEFT JOIN suppliers s ON s.id = pu.supplier_id
       WHERE pu.id = ?`
    )
    .get(id) as PurchaseRow | undefined;
  if (!row) return null;
  const items = db
    .prepare(
      `SELECT pi.*, p.name AS product_name, p.sku AS product_sku
       FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`
    )
    .all(id) as ItemRow[];
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    reference: row.reference,
    totalAmount: row.total_amount,
    status: row.status,
    purchasedAt: row.purchased_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(toItem),
  };
}

export const purchasesService = {
  list(): Purchase[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT pu.*, s.name AS supplier_name
         FROM purchases pu
         LEFT JOIN suppliers s ON s.id = pu.supplier_id
         ORDER BY pu.purchased_at DESC, pu.id DESC`
      )
      .all() as PurchaseRow[];
    return rows.map((row) => {
      const items = db
        .prepare(
          `SELECT pi.*, p.name AS product_name, p.sku AS product_sku
           FROM purchase_items pi
           JOIN products p ON p.id = pi.product_id
           WHERE pi.purchase_id = ?
           ORDER BY pi.id`
        )
        .all(row.id) as ItemRow[];
      return {
        id: row.id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        reference: row.reference,
        totalAmount: row.total_amount,
        status: row.status,
        purchasedAt: row.purchased_at,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: items.map(toItem),
      };
    });
  },

  get: loadWithItems,

  create(input: NewPurchase): Purchase {
    if (input.items.length === 0) throw new Error('Purchase must have at least one item');
    const db = getDatabase();

    const id = db.transaction(() => {
      const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
      const result = db
        .prepare(
          `INSERT INTO purchases
             (supplier_id, reference, total_amount, status, purchased_at, notes)
           VALUES (@supplierId, @reference, @total, 'draft', @purchasedAt, @notes)`
        )
        .run({
          supplierId: input.supplierId,
          reference: input.reference,
          total,
          purchasedAt: input.purchasedAt,
          notes: input.notes,
        });

      const purchaseId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const item of input.items) {
        if (item.quantity <= 0) throw new Error('Purchase item quantity must be > 0');
        if (item.unitCost < 0) throw new Error('Purchase item unit cost must be >= 0');
        productsRepository.assertNotDeleted(item.productId);
        insertItem.run(purchaseId, item.productId, item.quantity, item.unitCost, item.quantity * item.unitCost);
      }
      return purchaseId;
    })();

    const purchase = loadWithItems(id);
    if (!purchase) throw new Error(`Purchase ${id} not found after insert`);
    return purchase;
  },

  /** Receives a draft purchase — creates stock movements and marks as 'received'. */
  receive(id: number): Purchase {
    const db = getDatabase();
    const tx = db.transaction(() => {
      const current = loadWithItems(id);
      if (!current) throw new Error(`Purchase ${id} not found`);
      if (current.status !== 'draft') {
        throw new Error(`Purchase ${id} is ${current.status}, cannot receive`);
      }
      for (const item of current.items) {
        recordMovement({
          productId: item.productId,
          reason: 'restock',
          quantity: item.quantity,
          unitCost: item.unitCost,
          referenceType: 'purchase',
          referenceId: id,
          note: `Received via purchase #${id}`,
        });
        // Sales take their cost from the product, so keep it at the latest price paid.
        // A 0 line is free stock and says nothing about what the product costs.
        if (item.unitCost > 0) {
          db.prepare(
            `UPDATE products SET cost_price = ?, updated_at = datetime('now') WHERE id = ?`
          ).run(item.unitCost, item.productId);
        }
      }
      db.prepare(
        `UPDATE purchases SET status = 'received', updated_at = datetime('now') WHERE id = ?`
      ).run(id);
    });
    tx();
    const result = loadWithItems(id);
    if (!result) throw new Error(`Purchase ${id} missing after receive`);
    return result;
  },

  cancel(id: number): Purchase {
    const db = getDatabase();
    const current = loadWithItems(id);
    if (!current) throw new Error(`Purchase ${id} not found`);
    if (current.status === 'received') {
      throw new Error('Received purchases cannot be cancelled; create a return movement instead');
    }
    db.prepare(
      `UPDATE purchases SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`
    ).run(id);
    const result = loadWithItems(id);
    if (!result) throw new Error(`Purchase ${id} missing after cancel`);
    return result;
  },
};
