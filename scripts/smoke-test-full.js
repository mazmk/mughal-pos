#!/usr/bin/env node
/**
 * Full-stack smoke test exercising every new IPC channel end-to-end
 * through a real Electron window + preload bridge.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const electronBin = require('electron');
const projectRoot = path.resolve(__dirname, '..');

const probe = `
const { app, BrowserWindow } = require('electron');
// A throwaway data folder: this test clears the shop, so it must never see real data.
app.setPath('userData', require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'mughal-smoke-full-')));
require('./dist-electron/electron/main/main.js');

const script = \`(async () => {
  const api = window.api;
  if (!api) return JSON.stringify({ ok: false, step: 'bridge' });

  const unwrap = async (p, label) => {
    const r = await p;
    if (!r.ok) throw new Error(label + ': ' + r.error.message);
    return r.data;
  };

  // 1. Create category
  const cat = await unwrap(api.categories.create({ name: 'Snacks', description: null }), 'cat.create');

  // 2. Create product
  const prod = await unwrap(api.products.create({
    sku: 'SMK-001', barcode: null, name: 'Chips',
    categoryId: cat.id, unitPrice: 50, costPrice: 30,
    taxRate: 0.17, imagePath: null, isActive: 1,
  }), 'prod.create');

  // 3-4. Stock is not tracked: selling any quantity of a new product works
  const sale = await unwrap(api.sales.create({
    paymentMethod: 'cash', discountAmount: 0, notes: null,
    items: [{ productId: prod.id, quantity: 3, unitPrice: 50, taxRate: 0.17 }],
  }), 'sale.create');

  // 5. Expenses, one with an attached file
  const jpeg = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2));
  const expense = await unwrap(api.expenses.create({
    type: 'utility', amount: 20, description: 'Gas bill', incurredAt: new Date().toISOString(),
    addAttachments: [{ fileName: 'bill.png', mimeType: 'image/jpeg', dataBase64: jpeg }],
  }), 'exp.create');
  await unwrap(api.expenses.create({
    type: 'stock', amount: 300, description: null, incurredAt: new Date().toISOString(),
    addAttachments: [],
  }), 'exp.create2');
  const badType = await api.expenses.create({
    type: 'rent', amount: 1, description: null, incurredAt: new Date().toISOString(), addAttachments: [],
  });
  const attachment = await unwrap(api.expenses.attachment(expense.attachments[0].id), 'exp.attachment');

  // 6. Dashboard metrics should reflect everything
  const metrics = await unwrap(api.dashboard.metrics(), 'dash');

  // 7. Reports over last 30 days
  const to = new Date().toISOString().slice(0,10);
  const from = new Date(Date.now() - 30*86400_000).toISOString().slice(0,10);
  const salesReport = await unwrap(api.reports.sales({ from, to, granularity: 'day' }), 'rpt.sales');
  const topProducts = await unwrap(api.reports.topProducts({ from, to, granularity: 'day' }, 5), 'rpt.top');
  const expensesByType = await unwrap(api.reports.expensesByType({ from, to }), 'rpt.expenses');
  const expenseList = await unwrap(api.expenses.list({ from, to }), 'exp.list');

  // 8. Backup
  const backup = await unwrap(api.backup.create(), 'backup.create');

  // 10. Soft delete keeps history, hides the product and frees its SKU
  await unwrap(api.products.remove(prod.id), 'prod.remove');
  const listAfterDelete = await unwrap(api.products.list(), 'prod.list');
  const saleAfterDelete = await unwrap(api.sales.get(sale.id), 'sale.get');
  const blockedSale = await api.sales.create({
    paymentMethod: 'cash', discountAmount: 0, notes: null,
    items: [{ productId: prod.id, quantity: 1, unitPrice: 50, taxRate: 0 }],
  });
  const voided = await unwrap(api.sales.void(sale.id), 'sale.void');
  const reused = await unwrap(api.products.create({
    sku: 'SMK-001', barcode: null, name: 'Chips v2',
    categoryId: null, unitPrice: 60, costPrice: 40,
    taxRate: 0, imagePath: null, isActive: 1,
  }), 'prod.recreate');

  // 11. Clear shop empties every record, keeps backups, and can be undone
  await unwrap(api.settings.set('shop.name', 'Smoke Shop'), 'settings.set');
  const cleared = await unwrap(api.backup.clearShop(), 'clearShop');
  const emptyCurrent = await unwrap(api.backup.current(), 'backup.current');
  const backups = await unwrap(api.backup.list(), 'backup.list');
  const shopName = await unwrap(api.settings.get('shop.name'), 'settings.get');
  const firstProduct = await unwrap(api.products.create({
    sku: 'NEW-001', barcode: null, name: 'First', categoryId: null, unitPrice: 1,
    costPrice: 1, taxRate: 0, imagePath: null, isActive: 1,
  }), 'prod.afterClear');
  await unwrap(api.backup.restore(cleared.safetyBackup.filename), 'restore');
  const undone = await unwrap(api.backup.current(), 'backup.current2');

  return JSON.stringify({
    softDelete: {
      hidden: !listAfterDelete.some((p) => p.id === prod.id),
      historyName: saleAfterDelete.items[0].productName,
      saleBlocked: !blockedSale.ok,
      voidStatus: voided.status,
      reusedSku: reused.sku,
    },
    clear: {
      counts: emptyCurrent.counts,
      kind: cleared.safetyBackup.kind,
      backupsKept: backups.length,
      shopName: shopName.value,
      firstProductId: firstProduct.id,
      undone: undone.counts,
    },
    expenses: {
      listed: expenseList.length,
      byType: expensesByType,
      badTypeRejected: !badType.ok,
      attachmentName: attachment.fileName,
      attachmentIntact: attachment.dataBase64 === jpeg,
    },
    saleRef: sale.reference,
    saleTotal: sale.totalAmount,
    metrics,
    salesReport,
    topProducts,
    backup: { filename: backup.filename, size: backup.sizeBytes > 0 },
  });
})()\`;

app.whenReady().then(async () => {
  const wait = () => new Promise(r => {
    const check = () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w && !w.webContents.isLoading()) r(w);
      else setTimeout(check, 200);
    };
    check();
  });
  const win = await wait();
  try {
    const result = await win.webContents.executeJavaScript(script);
    console.log('[probe] result:', result);
    const d = JSON.parse(result);
    const e = d.expenses;
    if (e.listed !== 2 || e.byType.length !== 2) throw new Error('expenses: ' + JSON.stringify(e));
    if (!e.badTypeRejected) throw new Error('unknown expense type accepted');
    if (e.attachmentName !== 'bill.jpg' || !e.attachmentIntact) throw new Error('attachment: ' + JSON.stringify(e));
    // profit 3 × (50 − 30) = 60, less the 20 bill; the 300 of stock bought is not subtracted
    if (d.metrics.monthNetProfit !== 40) throw new Error('net profit: ' + d.metrics.monthNetProfit);
    if (d.metrics.todaySalesCount !== 1) throw new Error('metrics salesCount: ' + d.metrics.todaySalesCount);
    if (d.metrics.totalProducts < 1) throw new Error('no products in metrics');
    if (!d.saleRef.startsWith('S-')) throw new Error('bad sale ref: ' + d.saleRef);
    if (!Array.isArray(d.salesReport) || d.salesReport.length === 0) throw new Error('empty sales report');
    if (!Array.isArray(d.topProducts) || d.topProducts.length === 0) throw new Error('empty top products');
    if (!d.backup.size) throw new Error('backup not created');
    const sd = d.softDelete;
    if (!sd.hidden) throw new Error('deleted product still listed');
    if (sd.historyName !== 'Chips') throw new Error('sale lost its product: ' + sd.historyName);
    if (!sd.saleBlocked) throw new Error('deleted product was usable');
    if (sd.voidStatus !== 'voided') throw new Error('could not void sale of deleted product');
    if (sd.reusedSku !== 'SMK-001') throw new Error('SKU not reusable');
    const c = d.clear;
    if (Object.values(c.counts).some((n) => n !== 0)) throw new Error('not empty: ' + JSON.stringify(c.counts));
    if (c.kind !== 'pre-clear') throw new Error('bad safety kind: ' + c.kind);
    if (c.backupsKept < 2) throw new Error('backups were not kept: ' + c.backupsKept);
    if (c.shopName !== 'Mughal Tuck Shop') throw new Error('settings not reset: ' + c.shopName);
    if (c.firstProductId !== 1) throw new Error('ids not reset: ' + c.firstProductId);
    if (c.undone.sales !== 1 || c.undone.products !== 1) throw new Error('undo failed: ' + JSON.stringify(c.undone));
    console.log('[probe] PASS');
    app.exit(0);
  } catch (err) {
    console.error('[probe] FAIL', err);
    app.exit(1);
  }
});
`;

const probeFile = path.join(projectRoot, '.probe-full.js');
fs.writeFileSync(probeFile, probe);

const cleanEnv = { ...process.env, NODE_ENV: 'production' };
delete cleanEnv.ELECTRON_RUN_AS_NODE;
delete cleanEnv.ELECTRON_NO_ATTACH_CONSOLE;

const child = spawn(electronBin, [probeFile], {
  cwd: projectRoot,
  env: cleanEnv,
  stdio: 'inherit',
});

const kill = setTimeout(() => {
  console.error('[probe] timeout');
  child.kill('SIGKILL');
  process.exit(2);
}, 45000);

child.on('exit', (code) => {
  clearTimeout(kill);
  try { fs.unlinkSync(probeFile); } catch {}
  process.exit(code ?? 0);
});
