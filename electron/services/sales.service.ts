import { getDatabase } from '../database/connection';
import { productsRepository } from './products.repository';
import type { NewSale, Sale, SaleItem } from '../../shared/ipc-types';

/**
 * What a row of `sales` earned: takings after discount, less tax and what the
 * goods cost. Tax is collected for the government, so it is never profit.
 */
export const SALE_PROFIT_SQL = `(
  sales.total_amount - sales.tax_amount - COALESCE(
    (SELECT SUM(si.quantity * si.unit_cost) FROM sale_items si WHERE si.sale_id = sales.id),
    0
  )
)`;

interface SaleRow {
  id: number;
  reference: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  profit: number;
  payment_method: Sale['paymentMethod'];
  status: Sale['status'];
  sold_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  tax_rate: number;
}

const toItem = (r: ItemRow): SaleItem => ({
  id: r.id,
  saleId: r.sale_id,
  productId: r.product_id,
  productName: r.product_name,
  productSku: r.product_sku,
  quantity: r.quantity,
  unitPrice: r.unit_price,
  unitCost: r.unit_cost,
  lineTotal: r.line_total,
  taxRate: r.tax_rate,
});

function loadWithItems(id: number): Sale | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT *, ${SALE_PROFIT_SQL} AS profit FROM sales WHERE id = ?`)
    .get(id) as SaleRow | undefined;
  if (!row) return null;
  const items = db
    .prepare(
      `SELECT si.*, p.name AS product_name, p.sku AS product_sku
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id`
    )
    .all(id) as ItemRow[];
  return {
    id: row.id,
    reference: row.reference,
    totalAmount: row.total_amount,
    taxAmount: row.tax_amount,
    discountAmount: row.discount_amount,
    profit: row.profit,
    paymentMethod: row.payment_method,
    status: row.status,
    soldAt: row.sold_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(toItem),
  };
}

function generateReference(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `S-${ymd}-${rand}`;
}

export const salesService = {
  list(): Sale[] {
    const db = getDatabase();
    const rows = db
      .prepare(`SELECT *, ${SALE_PROFIT_SQL} AS profit FROM sales ORDER BY sold_at DESC, id DESC`)
      .all() as SaleRow[];
    return rows.map((row) => {
      const items = db
        .prepare(
          `SELECT si.*, p.name AS product_name, p.sku AS product_sku
           FROM sale_items si
           JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = ?
           ORDER BY si.id`
        )
        .all(row.id) as ItemRow[];
      return {
        id: row.id,
        reference: row.reference,
        totalAmount: row.total_amount,
        taxAmount: row.tax_amount,
        discountAmount: row.discount_amount,
        profit: row.profit,
        paymentMethod: row.payment_method,
        status: row.status,
        soldAt: row.sold_at,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: items.map(toItem),
      };
    });
  },

  get: loadWithItems,

  create(input: NewSale): Sale {
    if (input.items.length === 0) throw new Error('Sale must have at least one item');
    if (input.discountAmount < 0) throw new Error('Discount must be >= 0');
    const db = getDatabase();

    const id = db.transaction(() => {
      let subtotal = 0;
      let taxAmount = 0;
      for (const item of input.items) {
        if (item.quantity <= 0) throw new Error('Sale item quantity must be > 0');
        if (item.unitPrice < 0) throw new Error('Sale item unit price must be >= 0');
        productsRepository.assertNotDeleted(item.productId);
        const line = item.quantity * item.unitPrice;
        subtotal += line;
        taxAmount += line * (item.taxRate ?? 0);
      }
      const total = Math.max(0, subtotal + taxAmount - input.discountAmount);
      const reference = generateReference();

      const result = db
        .prepare(
          `INSERT INTO sales
             (reference, total_amount, tax_amount, discount_amount, payment_method,
              status, sold_at, notes)
           VALUES (@reference, @total, @tax, @discount, @paymentMethod,
                   'completed', datetime('now'), @notes)`
        )
        .run({
          reference,
          total,
          tax: taxAmount,
          discount: input.discountAmount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
        });

      const saleId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(
        `INSERT INTO sale_items
           (sale_id, product_id, quantity, unit_price, unit_cost, line_total, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of input.items) {
        const line = item.quantity * item.unitPrice;
        const unitCost = productsRepository.get(item.productId)?.costPrice ?? 0;
        insertItem.run(
          saleId,
          item.productId,
          item.quantity,
          item.unitPrice,
          unitCost,
          line,
          item.taxRate ?? 0
        );
      }

      return saleId;
    })();

    const sale = loadWithItems(id);
    if (!sale) throw new Error(`Sale ${id} not found after insert`);
    return sale;
  },

  /** Void a completed sale: it stays on record but no longer counts towards revenue or profit. */
  void(id: number): Sale {
    getDatabase()
      .prepare(
        `UPDATE sales SET status = 'voided', updated_at = datetime('now')
         WHERE id = ? AND status != 'voided'`
      )
      .run(id);
    const voided = loadWithItems(id);
    if (!voided) throw new Error(`Sale ${id} not found`);
    return voided;
  },
};
