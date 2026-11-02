import { getDatabase } from '../database/connection';
import type { ProductImportResult, ProductImportRow } from '../../shared/ipc-types';

export const MAX_IMPORT_ROWS = 5000;

/** Category and name, ignoring case: the same product imported twice is skipped. */
const productKey = (categoryId: number | null, name: string) =>
  `${categoryId ?? ''}|${name.toLowerCase()}`;

/** SKU prefix from the category's first three letters or digits: Cigarettes → CIG. */
function skuPrefix(category: string | null): string {
  return (category ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'GEN';
}

export const productImportService = {
  /**
   * All or nothing: one transaction, so a failure part-way leaves no half
   * import behind. Prices come from the rows; tax is 0 and barcodes are left
   * empty, to be filled in per product later.
   */
  import(rows: ProductImportRow[]): ProductImportResult {
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`Import at most ${MAX_IMPORT_ROWS} products at a time`);
    }
    const db = getDatabase();

    return db.transaction(() => {
      const categoryIds = new Map<string, number>();
      for (const c of db.prepare(`SELECT id, name FROM categories`).all() as {
        id: number;
        name: string;
      }[]) {
        categoryIds.set(c.name.toLowerCase(), c.id);
      }

      const current = db
        .prepare(`SELECT sku, name, category_id FROM products WHERE is_deleted = 0`)
        .all() as { sku: string; name: string; category_id: number | null }[];
      const existing = new Set(current.map((p) => productKey(p.category_id, p.name)));
      const skus = new Set(current.map((p) => p.sku.toUpperCase()));
      const nextNumber = new Map<string, number>();

      const nextSku = (category: string | null): string => {
        const prefix = skuPrefix(category);
        let n = nextNumber.get(prefix) ?? 1;
        let sku = `${prefix}-${String(n).padStart(3, '0')}`;
        while (skus.has(sku)) sku = `${prefix}-${String(++n).padStart(3, '0')}`;
        skus.add(sku);
        nextNumber.set(prefix, n + 1);
        return sku;
      };

      const insertCategory = db.prepare(`INSERT INTO categories (name) VALUES (?)`);
      const insertProduct = db.prepare(
        `INSERT INTO products (sku, name, category_id, unit_price, cost_price, tax_rate, is_active)
         VALUES (?, ?, ?, ?, ?, 0, 1)`
      );

      const result: ProductImportResult = { created: 0, skipped: 0, categoriesCreated: 0 };
      for (const row of rows) {
        let categoryId: number | null = null;
        if (row.category) {
          categoryId = categoryIds.get(row.category.toLowerCase()) ?? null;
          if (categoryId === null) {
            categoryId = Number(insertCategory.run(row.category).lastInsertRowid);
            categoryIds.set(row.category.toLowerCase(), categoryId);
            result.categoriesCreated++;
          }
        }

        const key = productKey(categoryId, row.name);
        if (existing.has(key)) {
          result.skipped++;
          continue;
        }
        existing.add(key);
        insertProduct.run(nextSku(row.category), row.name, categoryId, row.unitPrice, row.costPrice);
        result.created++;
      }
      return result;
    })();
  },
};
