import { registerBackupIpc } from './backup.ipc';
import { registerBrandingIpc } from './branding.ipc';
import { registerCategoriesIpc } from './categories.ipc';
import { registerDashboardIpc } from './dashboard.ipc';
import { registerExpensesIpc } from './expenses.ipc';
import { registerHealthIpc } from './health.ipc';
import { registerProductsIpc } from './products.ipc';
import { registerReportsIpc } from './reports.ipc';
import { registerSalesIpc } from './sales.ipc';
import { registerSettingsIpc } from './settings.ipc';

export function registerAllIpcHandlers(): void {
  registerHealthIpc();
  registerSettingsIpc();
  registerCategoriesIpc();
  registerProductsIpc();
  registerSalesIpc();
  registerExpensesIpc();
  registerDashboardIpc();
  registerReportsIpc();
  registerBackupIpc();
  registerBrandingIpc();
}
