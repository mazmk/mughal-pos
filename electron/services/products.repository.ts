import { getDatabase } from '../database/connection';
import type { NewProduct, Product, ProductPatch } from '../../shared/ipc-types';

interface ProductRow {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: number | null;
  unit_price: number;
  cost_price: number;
  tax_rate: number;
  image_path: string | null;
  is_active: 0 | 1;
  stock_on_hand: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    categoryId: row.category_id,
    unitPrice: row.unit_price,
    costPrice: row.cost_price,
    taxRate: row.tax_rate,
    imagePath: row.image_path,
    isActive: row.is_active,
    stockOnHand: row.stock_on_hand,
    reorderLevel: row.reorder_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const productsRepository = {
  list(): Product[] {
    const rows = getDatabase()
      .prepare(`SELECT * FROM products ORDER BY name COLLATE NOCASE`)
      .all() as ProductRow[];
    return rows.map(toProduct);
  },

  get(id: number): Product | null {
    const row = getDatabase().prepare(`SELECT * FROM products WHERE id = ?`).get(id) as
      | ProductRow
      | undefined;
    return row ? toProduct(row) : null;
  },

  create(input: NewProduct): Product {
    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO products
           (sku, barcode, name, category_id, unit_price, cost_price, tax_rate,
            image_path, is_active, reorder_level)
         VALUES (@sku, @barcode, @name, @categoryId, @unitPrice, @costPrice,
                 @taxRate, @imagePath, @isActive, @reorderLevel)`
      )
      .run({
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        categoryId: input.categoryId,
        unitPrice: input.unitPrice,
        costPrice: input.costPrice,
        taxRate: input.taxRate,
        imagePath: input.imagePath,
        isActive: input.isActive,
        reorderLevel: input.reorderLevel,
      });

    const created = this.get(Number(result.lastInsertRowid));
    if (!created) throw new Error('Product insert succeeded but row not found');
    return created;
  },

  update(id: number, patch: ProductPatch): Product {
    const fields: string[] = [];
    const values: Record<string, unknown> = { id };
    const map: Record<keyof ProductPatch, string> = {
      sku: 'sku',
      barcode: 'barcode',
      name: 'name',
      categoryId: 'category_id',
      unitPrice: 'unit_price',
      costPrice: 'cost_price',
      taxRate: 'tax_rate',
      imagePath: 'image_path',
      isActive: 'is_active',
      reorderLevel: 'reorder_level',
    };

    for (const [key, column] of Object.entries(map) as [keyof ProductPatch, string][]) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = @${key}`);
        values[key] = patch[key];
      }
    }

    if (fields.length === 0) {
      const existing = this.get(id);
      if (!existing) throw new Error(`Product ${id} not found`);
      return existing;
    }

    fields.push(`updated_at = datetime('now')`);
    getDatabase()
      .prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = @id`)
      .run(values);

    const next = this.get(id);
    if (!next) throw new Error(`Product ${id} not found after update`);
    return next;
  },

  remove(id: number): { id: number } {
    getDatabase().prepare(`DELETE FROM products WHERE id = ?`).run(id);
    return { id };
  },

  lowStock(): Product[] {
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM products
         WHERE is_active = 1 AND reorder_level > 0 AND stock_on_hand <= reorder_level
         ORDER BY (stock_on_hand - reorder_level), name COLLATE NOCASE`
      )
      .all() as ProductRow[];
    return rows.map(toProduct);
  },
};
