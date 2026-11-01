import { getDatabase } from '../database/connection';
import { SALE_PROFIT_SQL } from './sales.service';
import type {
  DashboardMetrics,
  ReportRange,
  SalesReportRow,
  TopProductRow,
} from '../../shared/ipc-types';

// sold_at is UTC, and a shop's day runs on its own clock, hence 'localtime' throughout.
function bucketExpression(granularity: ReportRange['granularity']): string {
  switch (granularity) {
    case 'day':
      return `strftime('%Y-%m-%d', sold_at, 'localtime')`;
    case 'week':
      return `strftime('%Y-W%W', sold_at, 'localtime')`;
    case 'month':
      return `strftime('%Y-%m', sold_at, 'localtime')`;
    default:
      return `strftime('%Y-%m-%d', sold_at, 'localtime')`;
  }
}

export const dashboardService = {
  metrics(): DashboardMetrics {
    const db = getDatabase();

    const today = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total,
                COUNT(*) AS count,
                COALESCE(SUM(${SALE_PROFIT_SQL}), 0) AS profit
         FROM sales
         WHERE status = 'completed' AND date(sold_at, 'localtime') = date('now', 'localtime')`
      )
      .get() as { total: number; count: number; profit: number };

    const totalProducts = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND is_deleted = 0`)
        .get() as { c: number }
    ).c;

    const lowStock = (
      db
        .prepare(
          `SELECT COUNT(*) AS c
           FROM products
           WHERE is_active = 1 AND is_deleted = 0
             AND reorder_level > 0 AND stock_on_hand <= reorder_level`
        )
        .get() as { c: number }
    ).c;

    const inventoryValue = (
      db
        .prepare(
          `SELECT COALESCE(SUM(stock_on_hand * cost_price), 0) AS value
           FROM products
           WHERE is_active = 1 AND is_deleted = 0`
        )
        .get() as { value: number }
    ).value;

    const categories = (
      db.prepare(`SELECT COUNT(*) AS c FROM categories`).get() as { c: number }
    ).c;

    const suppliers = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM suppliers WHERE is_active = 1`)
        .get() as { c: number }
    ).c;

    return {
      todaySalesAmount: today.total,
      todaySalesCount: today.count,
      todayProfit: today.profit,
      totalProducts,
      lowStockProducts: lowStock,
      inventoryValue,
      activeCategories: categories,
      activeSuppliers: suppliers,
    };
  },

  salesReport(range: ReportRange): SalesReportRow[] {
    const bucket = bucketExpression(range.granularity);
    const rows = getDatabase()
      .prepare(
        `SELECT ${bucket} AS bucket,
                COUNT(*) AS sales_count,
                COALESCE(SUM(total_amount), 0) AS total_amount,
                COALESCE(SUM(tax_amount), 0) AS tax_amount,
                COALESCE(SUM(discount_amount), 0) AS discount_amount
         FROM sales
         WHERE status = 'completed'
           AND date(sold_at, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY bucket
         ORDER BY bucket`
      )
      .all(range.from, range.to) as Array<{
      bucket: string;
      sales_count: number;
      total_amount: number;
      tax_amount: number;
      discount_amount: number;
    }>;

    return rows.map((r) => ({
      bucket: r.bucket,
      salesCount: r.sales_count,
      totalAmount: r.total_amount,
      taxAmount: r.tax_amount,
      discountAmount: r.discount_amount,
    }));
  },

  topProducts(range: ReportRange, limit = 10): TopProductRow[] {
    const rows = getDatabase()
      .prepare(
        `SELECT si.product_id, p.name AS product_name, p.sku AS product_sku,
                SUM(si.quantity) AS quantity_sold,
                SUM(si.line_total) AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.status = 'completed'
           AND date(s.sold_at, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY si.product_id, p.name, p.sku
         ORDER BY quantity_sold DESC
         LIMIT ?`
      )
      .all(range.from, range.to, limit) as Array<{
      product_id: number;
      product_name: string;
      product_sku: string;
      quantity_sold: number;
      revenue: number;
    }>;

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      productSku: r.product_sku,
      quantitySold: r.quantity_sold,
      revenue: r.revenue,
    }));
  },
};
