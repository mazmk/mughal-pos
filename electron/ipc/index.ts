import { registerBackupIpc } from './backup.ipc';
import { registerBrandingIpc } from './branding.ipc';
import { registerCategoriesIpc } from './categories.ipc';
import { registerDashboardIpc } from './dashboard.ipc';
import { registerHealthIpc } from './health.ipc';
import { registerProductsIpc } from './products.ipc';
import { registerPurchasesIpc } from './purchases.ipc';
import { registerReportsIpc } from './reports.ipc';
import { registerSalesIpc } from './sales.ipc';
import { registerSettingsIpc } from './settings.ipc';
import { registerStockIpc } from './stock.ipc';
import { registerSuppliersIpc } from './suppliers.ipc';

export function registerAllIpcHandlers(): void {
  registerHealthIpc();
  registerSettingsIpc();
  registerCategoriesIpc();
  registerSuppliersIpc();
  registerProductsIpc();
  registerStockIpc();
  registerPurchasesIpc();
  registerSalesIpc();
  registerDashboardIpc();
  registerReportsIpc();
  registerBackupIpc();
  registerBrandingIpc();
}
