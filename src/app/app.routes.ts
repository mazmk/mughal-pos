import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos.page').then((m) => m.PosPage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
      },
      {
        path: 'stock',
        loadComponent: () => import('./features/stock/stock.page').then((m) => m.StockPage),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/suppliers.page').then((m) => m.SuppliersPage),
      },
      {
        path: 'purchases',
        loadComponent: () =>
          import('./features/purchases/purchases.page').then((m) => m.PurchasesPage),
      },
      {
        path: 'sales',
        loadComponent: () => import('./features/sales/sales.page').then((m) => m.SalesPage),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
