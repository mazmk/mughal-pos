#!/usr/bin/env node
/**
 * Smoke test for the SQLite layer. Runs the migrations against a temp DB,
 * exercises products, sales, expenses and reports, and prints a summary.
 *
 * Does NOT require Electron. Run with:
 *   node scripts/smoke-test-db.js
 */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Point everything that references `app.getPath('userData')` at a temp dir
// — but we don't boot Electron here, we exercise the pure DB layer.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mughal-smoke-'));
const dbFile = path.join(tmpRoot, 'tuckshop.db');
console.log('[smoke] temp db:', dbFile);

const { initializeDatabase, getSchemaVersion, getDatabase, closeDatabase } = require(
  '../dist-electron/electron/database/connection',
);
const { productsRepository } = require(
  '../dist-electron/electron/services/products.repository',
);
const { settingsRepository } = require(
  '../dist-electron/electron/services/settings.repository',
);
const { salesService } = require('../dist-electron/electron/services/sales.service');
const { expensesService } = require('../dist-electron/electron/services/expenses.service');
const { dashboardService } = require('../dist-electron/electron/services/dashboard.service');

try {
  initializeDatabase(dbFile);
  console.log('[smoke] schema version:', getSchemaVersion());

  const product = productsRepository.create({
    sku: 'TEST-001',
    barcode: null,
    name: 'Smoke Test Soda',
    categoryId: null,
    unitPrice: 1.5,
    costPrice: 0.75,
    taxRate: 0,
    imagePath: null,
    isActive: 1,
  });
  console.log('[smoke] created product id=', product.id);

  settingsRepository.set('smoke.key', 'ok');
  const s = settingsRepository.get('smoke.key');
  console.log('[smoke] setting round-trip =', s?.value);
  if (s?.value !== 'ok') throw new Error('setting mismatch');

  // Soft delete: gone from the shop, row kept for history, SKU free to reuse
  productsRepository.remove(product.id);
  if (productsRepository.get(product.id)) throw new Error('deleted product still readable');
  if (productsRepository.list().length !== 0) throw new Error('deleted product still listed');
  const kept = getDatabase().prepare('SELECT is_deleted FROM products WHERE id = ?').get(product.id);
  if (kept?.is_deleted !== 1) throw new Error('product row was not kept');
  const reused = productsRepository.create({
    sku: 'TEST-001',
    barcode: null,
    name: 'Smoke Test Soda 2',
    categoryId: null,
    unitPrice: 2,
    costPrice: 1,
    taxRate: 0,
    imagePath: null,
    isActive: 1,
  });
  console.log('[smoke] deleted SKU reused by product id=', reused.id);

  let duplicateBlocked = false;
  try {
    productsRepository.create({ ...reused, name: 'Duplicate' });
  } catch (e) {
    duplicateBlocked = true;
    console.log('[smoke] duplicate SKU guard works:', e.message);
  }
  if (!duplicateBlocked) throw new Error('duplicate SKU was accepted');

  // Profit: tax and discount are left out, and a later cost change or void can't rewrite it.
  // No stock is recorded, so selling any quantity works.
  const sale = (quantity, taxRate, discountAmount) =>
    salesService.create({
      items: [{ productId: reused.id, quantity, unitPrice: 5, taxRate }],
      discountAmount,
      paymentMethod: 'cash',
      notes: null,
    });
  const taxed = sale(3, 0.1, 1);
  if (taxed.profit !== 11) throw new Error(`profit mismatch: ${taxed.profit}`);

  productsRepository.update(reused.id, { costPrice: 2 });
  if (salesService.get(taxed.id)?.profit !== 11) throw new Error('old sale profit changed');

  const later = sale(1, 0, 0);
  if (later.profit !== 3) throw new Error(`profit at new cost mismatch: ${later.profit}`);
  if (dashboardService.metrics().todayProfit !== 14) throw new Error('today profit mismatch');
  salesService.void(later.id);
  const afterVoid = dashboardService.metrics().todayProfit;
  if (afterVoid !== 11) throw new Error(`voided sale counted as profit: ${afterVoid}`);
  console.log('[smoke] today profit =', afterVoid);

  // Expenses: stock bought is not taken off net profit (cost price already is), others are
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
  const bill = expensesService.create({
    type: 'utility',
    amount: 4,
    description: 'Electricity',
    incurredAt: now,
    addAttachments: [{ fileName: '../../bill.exe', mimeType: 'image/jpeg', dataBase64: jpeg }],
  });
  if (bill.attachments[0]?.fileName !== 'bill.jpg') throw new Error('attachment name not cleaned');
  if (expensesService.attachment(bill.attachments[0].id).dataBase64 !== jpeg) {
    throw new Error('attachment bytes changed');
  }
  let badFile = false;
  try {
    expensesService.create({
      type: 'other', amount: 1, description: null, incurredAt: now,
      addAttachments: [{ fileName: 'x.pdf', mimeType: 'application/pdf', dataBase64: jpeg }],
    });
  } catch (e) {
    badFile = true;
  }
  if (!badFile) throw new Error('mismatched attachment accepted');
  expensesService.create({ type: 'stock', amount: 50, description: null, incurredAt: now, addAttachments: [] });

  const metrics = dashboardService.metrics();
  if (metrics.monthExpenses !== 4) throw new Error(`month expenses: ${metrics.monthExpenses}`);
  if (metrics.monthNetProfit !== 7) throw new Error(`month net profit: ${metrics.monthNetProfit}`);
  const day = new Date();
  const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const [row] = dashboardService.salesReport({ from: today, to: today, granularity: 'month' });
  if (row?.netProfit !== 7 || row.stockExpenses !== 50 || row.otherExpenses !== 4) {
    throw new Error('report mismatch: ' + JSON.stringify(row));
  }
  if (expensesService.list({ from: today, to: today }).length !== 2) throw new Error('expense list');

  const edited = expensesService.update(bill.id, {
    type: 'staff', amount: 5, description: 'Ali', incurredAt: now,
    addAttachments: [], removeAttachmentIds: [bill.attachments[0].id],
  });
  if (edited.type !== 'staff' || edited.attachments.length !== 0) throw new Error('expense update');
  expensesService.remove(bill.id);
  const leftover = getDatabase().prepare('SELECT COUNT(*) AS c FROM expense_attachments').get();
  if (leftover.c !== 0) throw new Error('attachments not deleted with expense');
  console.log('[smoke] month net profit =', metrics.monthNetProfit);

  closeDatabase();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('[smoke] PASS');
} catch (err) {
  console.error('[smoke] FAIL', err);
  process.exit(1);
}
