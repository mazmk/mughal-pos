import { getDatabase } from '../database/connection';
import type { NewSale, Sale, SaleItem } from '../../shared/ipc-types';
import { recordMovement } from './stock.service';

interface SaleRow {
  id: number;
  reference: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
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
  lineTotal: r.line_total,
  taxRate: r.tax_rate,
});

function loadWithItems(id: number): Sale | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id) as SaleRow | undefined;
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
      .prepare(`SELECT * FROM sales ORDER BY sold_at DESC, id DESC`)
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
           (sale_id, product_id, quantity, unit_price, line_total, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      for (const item of input.items) {
        const line = item.quantity * item.unitPrice;
        insertItem.run(saleId, item.productId, item.quantity, item.unitPrice, line, item.taxRate ?? 0);
        // Decrement stock via the enforced ledger path. recordMovement will
        // throw if the sale would drive stock negative.
        recordMovement({
          productId: item.productId,
          reason: 'sale',
          quantity: -item.quantity,
          referenceType: 'sale',
          referenceId: saleId,
          note: `Sold via ${reference}`,
        });
      }

      return saleId;
    })();

    const sale = loadWithItems(id);
    if (!sale) throw new Error(`Sale ${id} not found after insert`);
    return sale;
  },

  /** Void a completed sale — restore stock as 'return' movements. */
  void(id: number): Sale {
    const db = getDatabase();
    const tx = db.transaction(() => {
      const current = loadWithItems(id);
      if (!current) throw new Error(`Sale ${id} not found`);
      if (current.status === 'voided') return;
      for (const item of current.items) {
        recordMovement({
          productId: item.productId,
          reason: 'return',
          quantity: item.quantity,
          referenceType: 'sale-void',
          referenceId: id,
          note: `Void of ${current.reference}`,
        });
      }
      db.prepare(
        `UPDATE sales SET status = 'voided', updated_at = datetime('now') WHERE id = ?`
      ).run(id);
    });
    tx();
    const result = loadWithItems(id);
    if (!result) throw new Error(`Sale ${id} missing after void`);
    return result;
  },
};
