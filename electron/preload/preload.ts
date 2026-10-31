import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload runs in an isolated, sandboxed world. Node integration is OFF for
 * the renderer, so this is the only surface Angular can see.
 *
 * Because sandbox mode restricts `require()` to the `electron` module and a
 * few built-ins, channel names are inlined here (not imported from
 * ../../shared/ipc-channels) to avoid a sandbox resolution failure.
 *
 * The names MUST stay in sync with shared/ipc-channels.ts.
 * The exposed object MUST match shared/api-contract.ts > MughalApi.
 */
const CH = {
  // health
  healthStatus: 'health:status',
  // settings
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsList: 'settings:list',
  // categories
  categoriesList: 'categories:list',
  categoriesGet: 'categories:get',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesRemove: 'categories:remove',
  // suppliers
  suppliersList: 'suppliers:list',
  suppliersGet: 'suppliers:get',
  suppliersCreate: 'suppliers:create',
  suppliersUpdate: 'suppliers:update',
  suppliersRemove: 'suppliers:remove',
  // products
  productsList: 'products:list',
  productsGet: 'products:get',
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsRemove: 'products:remove',
  productsLowStock: 'products:low-stock',
  // stock
  stockList: 'stock:list',
  stockAdjust: 'stock:adjust',
  // purchases
  purchasesList: 'purchases:list',
  purchasesGet: 'purchases:get',
  purchasesCreate: 'purchases:create',
  purchasesReceive: 'purchases:receive',
  purchasesCancel: 'purchases:cancel',
  // sales
  salesList: 'sales:list',
  salesGet: 'sales:get',
  salesCreate: 'sales:create',
  salesVoid: 'sales:void',
  // dashboard
  dashboardMetrics: 'dashboard:metrics',
  // reports
  reportsSales: 'reports:sales',
  reportsTopProducts: 'reports:top-products',
  // backup
  backupCreate: 'backup:create',
  backupList: 'backup:list',
} as const;

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  health: {
    status: () => invoke(CH.healthStatus),
  },
  settings: {
    get: (key: string) => invoke(CH.settingsGet, key),
    set: (key: string, value: string) => invoke(CH.settingsSet, key, value),
    list: () => invoke(CH.settingsList),
  },
  categories: {
    list: () => invoke(CH.categoriesList),
    get: (id: number) => invoke(CH.categoriesGet, id),
    create: (input: unknown) => invoke(CH.categoriesCreate, input),
    update: (id: number, patch: unknown) => invoke(CH.categoriesUpdate, id, patch),
    remove: (id: number) => invoke(CH.categoriesRemove, id),
  },
  suppliers: {
    list: () => invoke(CH.suppliersList),
    get: (id: number) => invoke(CH.suppliersGet, id),
    create: (input: unknown) => invoke(CH.suppliersCreate, input),
    update: (id: number, patch: unknown) => invoke(CH.suppliersUpdate, id, patch),
    remove: (id: number) => invoke(CH.suppliersRemove, id),
  },
  products: {
    list: () => invoke(CH.productsList),
    get: (id: number) => invoke(CH.productsGet, id),
    create: (input: unknown) => invoke(CH.productsCreate, input),
    update: (id: number, patch: unknown) => invoke(CH.productsUpdate, id, patch),
    remove: (id: number) => invoke(CH.productsRemove, id),
    lowStock: () => invoke(CH.productsLowStock),
  },
  stock: {
    list: (productId?: number) => invoke(CH.stockList, productId),
    adjust: (input: unknown) => invoke(CH.stockAdjust, input),
  },
  purchases: {
    list: () => invoke(CH.purchasesList),
    get: (id: number) => invoke(CH.purchasesGet, id),
    create: (input: unknown) => invoke(CH.purchasesCreate, input),
    receive: (id: number) => invoke(CH.purchasesReceive, id),
    cancel: (id: number) => invoke(CH.purchasesCancel, id),
  },
  sales: {
    list: () => invoke(CH.salesList),
    get: (id: number) => invoke(CH.salesGet, id),
    create: (input: unknown) => invoke(CH.salesCreate, input),
    void: (id: number) => invoke(CH.salesVoid, id),
  },
  dashboard: {
    metrics: () => invoke(CH.dashboardMetrics),
  },
  reports: {
    sales: (range: unknown) => invoke(CH.reportsSales, range),
    topProducts: (range: unknown, limit?: number) => invoke(CH.reportsTopProducts, range, limit),
  },
  backup: {
    create: () => invoke(CH.backupCreate),
    list: () => invoke(CH.backupList),
  },
});
