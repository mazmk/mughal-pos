import { getDatabase } from '../database/connection';
import { SALE_PROFIT_SQL } from './sales.service';
import type {
  DashboardMetrics,
  DateRange,
  ExpenseTypeRow,
  ReportRange,
  SalesReportRow,
  TopProductRow,
} from '../../shared/ipc-types';

// Timestamps are UTC, and a shop's day runs on its own clock, hence 'localtime' throughout.
function bucketExpression(granularity: ReportRange['granularity'], column: string): string {
  switch (granularity) {
    case 'week':
      return `strftime('%Y-W%W', ${column}, 'localtime')`;
    case 'month':
      return `strftime('%Y-%m', ${column}, 'localtime')`;
    default:
      return `strftime('%Y-%m-%d', ${column}, 'localtime')`;
  }
}

/**
 * Stock purchases are left out of net profit: profit already takes off each
 * sold item's cost price, so subtracting the money spent buying that stock
 * as well would count the same cost twice.
 */
const OTHER_EXPENSE_SQL = `SUM(CASE WHEN type = 'stock' THEN 0 ELSE amount END)`;
const STOCK_EXPENSE_SQL = `SUM(CASE WHEN type = 'stock' THEN amount ELSE 0 END)`;

export const dashboardService = {
  metrics(): DashboardMetrics {
    const db = getDatabase();

    const sales = (day: string) =>
      db
        .prepare(
          `SELECT COALESCE(SUM(total_amount), 0) AS total,
                  COUNT(*) AS count,
                  COALESCE(SUM(${SALE_PROFIT_SQL}), 0) AS profit
           FROM sales
           WHERE status = 'completed' AND strftime(?, sold_at, 'localtime') = strftime(?, 'now', 'localtime')`
        )
        .get(day, day) as { total: number; count: number; profit: number };
    const today = sales('%Y-%m-%d');
    const month = sales('%Y-%m');

    const monthExpenses = (
      db
        .prepare(
          `SELECT COALESCE(${OTHER_EXPENSE_SQL}, 0) AS other
           FROM expenses
           WHERE strftime('%Y-%m', incurred_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
        )
        .get() as { other: number }
    ).other;

    const totalProducts = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND is_deleted = 0`)
        .get() as { c: number }
    ).c;

    const categories = (
      db.prepare(`SELECT COUNT(*) AS c FROM categories`).get() as { c: number }
    ).c;

    return {
      todaySalesAmount: today.total,
      todaySalesCount: today.count,
      todayProfit: today.profit,
      monthSalesAmount: month.total,
      monthProfit: month.profit,
      monthExpenses,
      monthNetProfit: month.profit - monthExpenses,
      totalProducts,
      activeCategories: categories,
    };
  },

  /** One row per period that has a sale or an expense. */
  salesReport(range: ReportRange): SalesReportRow[] {
    const rows = getDatabase()
      .prepare(
        `WITH s AS (
           SELECT ${bucketExpression(range.granularity, 'sold_at')} AS bucket,
                  COUNT(*) AS sales_count,
                  SUM(total_amount) AS total_amount,
                  SUM(tax_amount) AS tax_amount,
                  SUM(discount_amount) AS discount_amount,
                  SUM(${SALE_PROFIT_SQL}) AS profit
           FROM sales
           WHERE status = 'completed'
             AND date(sold_at, 'localtime') BETWEEN date(@from) AND date(@to)
           GROUP BY bucket
         ),
         e AS (
           SELECT ${bucketExpression(range.granularity, 'incurred_at')} AS bucket,
                  ${STOCK_EXPENSE_SQL} AS stock_expenses,
                  ${OTHER_EXPENSE_SQL} AS other_expenses
           FROM expenses
           WHERE date(incurred_at, 'localtime') BETWEEN date(@from) AND date(@to)
           GROUP BY bucket
         ),
         buckets AS (SELECT bucket FROM s UNION SELECT bucket FROM e)
         SELECT b.bucket,
                COALESCE(s.sales_count, 0) AS sales_count,
                COALESCE(s.total_amount, 0) AS total_amount,
                COALESCE(s.tax_amount, 0) AS tax_amount,
                COALESCE(s.discount_amount, 0) AS discount_amount,
                COALESCE(s.profit, 0) AS profit,
                COALESCE(e.stock_expenses, 0) AS stock_expenses,
                COALESCE(e.other_expenses, 0) AS other_expenses
         FROM buckets b
         LEFT JOIN s ON s.bucket = b.bucket
         LEFT JOIN e ON e.bucket = b.bucket
         ORDER BY b.bucket`
      )
      .all({ from: range.from, to: range.to }) as Array<{
      bucket: string;
      sales_count: number;
      total_amount: number;
      tax_amount: number;
      discount_amount: number;
      profit: number;
      stock_expenses: number;
      other_expenses: number;
    }>;

    return rows.map((r) => ({
      bucket: r.bucket,
      salesCount: r.sales_count,
      totalAmount: r.total_amount,
      taxAmount: r.tax_amount,
      discountAmount: r.discount_amount,
      profit: r.profit,
      stockExpenses: r.stock_expenses,
      otherExpenses: r.other_expenses,
      netProfit: r.profit - r.other_expenses,
    }));
  },

  expensesByType(range: DateRange): ExpenseTypeRow[] {
    return getDatabase()
      .prepare(
        `SELECT type, COUNT(*) AS count, SUM(amount) AS amount
         FROM expenses
         WHERE date(incurred_at, 'localtime') BETWEEN date(?) AND date(?)
         GROUP BY type
         ORDER BY amount DESC`
      )
      .all(range.from, range.to) as ExpenseTypeRow[];
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
