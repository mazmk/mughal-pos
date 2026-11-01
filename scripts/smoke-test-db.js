#!/usr/bin/env node
/**
 * Smoke test for the SQLite layer. Runs the migrations against a temp DB,
 * exercises a product create + stock movement, and prints a summary.
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
const { recordMovement, rebuildStockCache } = require(
  '../dist-electron/electron/services/stock.service',
);
const { productsRepository } = require(
  '../dist-electron/electron/services/products.repository',
);
const { settingsRepository } = require(
  '../dist-electron/electron/services/settings.repository',
);
const { salesService } = require('../dist-electron/electron/services/sales.service');
const { purchasesService } = require('../dist-electron/electron/services/purchases.service');
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
    reorderLevel: 5,
  });
  console.log('[smoke] created product id=', product.id);

  recordMovement({
    productId: product.id,
    reason: 'opening',
    quantity: 20,
    unitCost: 0.75,
    note: 'Opening stock',
  });

  recordMovement({
    productId: product.id,
    reason: 'sale',
    quantity: -3,
    note: 'Three sold',
  });

  const refreshed = productsRepository.get(product.id);
  console.log('[smoke] stock_on_hand after +20 then -3 =', refreshed?.stockOnHand);
  if (refreshed?.stockOnHand !== 17) throw new Error('stock mismatch');

  rebuildStockCache();
  const rebuilt = productsRepository.get(product.id);
  console.log('[smoke] after rebuildStockCache =', rebuilt?.stockOnHand);
  if (rebuilt?.stockOnHand !== 17) throw new Error('rebuilt stock mismatch');

  settingsRepository.set('smoke.key', 'ok');
  const s = settingsRepository.get('smoke.key');
  console.log('[smoke] setting round-trip =', s?.value);
  if (s?.value !== 'ok') throw new Error('setting mismatch');

  // Try to drive stock negative — should throw
  let caught = false;
  try {
    recordMovement({ productId: product.id, reason: 'adjustment', quantity: -100 });
  } catch (e) {
    caught = true;
    console.log('[smoke] negative-stock guard works:', e.message);
  }
  if (!caught) throw new Error('negative-stock guard failed to trip');

  const rows = getDatabase().prepare('SELECT COUNT(*) AS c FROM stock_movements').get();
  console.log('[smoke] stock_movements rows =', rows.c);

  // Soft delete: gone from the shop, still in the ledger, SKU free to reuse
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
    reorderLevel: 0,
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

  // Profit: tax and discount are left out, and a later cost change or void can't rewrite it
  recordMovement({ productId: reused.id, reason: 'opening', quantity: 10 });
  const sale = (quantity, taxRate, discountAmount) =>
    salesService.create({
      items: [{ productId: reused.id, quantity, unitPrice: 5, taxRate }],
      discountAmount,
      paymentMethod: 'cash',
      notes: null,
    });
  const taxed = sale(3, 0.1, 1);
  if (taxed.profit !== 11) throw new Error(`profit mismatch: ${taxed.profit}`);

  const purchase = purchasesService.create({
    supplierId: null,
    reference: null,
    purchasedAt: new Date().toISOString(),
    notes: null,
    items: [{ productId: reused.id, quantity: 1, unitCost: 2 }],
  });
  purchasesService.receive(purchase.id);
  if (productsRepository.get(reused.id)?.costPrice !== 2) throw new Error('cost not updated');
  if (salesService.get(taxed.id)?.profit !== 11) throw new Error('old sale profit changed');

  const later = sale(1, 0, 0);
  if (later.profit !== 3) throw new Error(`profit at new cost mismatch: ${later.profit}`);
  if (dashboardService.metrics().todayProfit !== 14) throw new Error('today profit mismatch');
  salesService.void(later.id);
  const afterVoid = dashboardService.metrics().todayProfit;
  if (afterVoid !== 11) throw new Error(`voided sale counted as profit: ${afterVoid}`);
  console.log('[smoke] today profit =', afterVoid);

  closeDatabase();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('[smoke] PASS');
} catch (err) {
  console.error('[smoke] FAIL', err);
  process.exit(1);
}
