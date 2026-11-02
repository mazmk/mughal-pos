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
  // products
  productsList: 'products:list',
  productsGet: 'products:get',
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsRemove: 'products:remove',
  // sales
  salesList: 'sales:list',
  salesGet: 'sales:get',
  salesCreate: 'sales:create',
  salesVoid: 'sales:void',
  // expenses
  expensesList: 'expenses:list',
  expensesCreate: 'expenses:create',
  expensesUpdate: 'expenses:update',
  expensesRemove: 'expenses:remove',
  expensesPickAttachments: 'expenses:pick-attachments',
  expensesAttachment: 'expenses:attachment',
  expensesOpenAttachment: 'expenses:open-attachment',
  // dashboard
  dashboardMetrics: 'dashboard:metrics',
  // reports
  reportsSales: 'reports:sales',
  reportsTopProducts: 'reports:top-products',
  reportsExpensesByType: 'reports:expenses-by-type',
  // backup
  backupCreate: 'backup:create',
  backupList: 'backup:list',
  backupCurrent: 'backup:current',
  backupVerify: 'backup:verify',
  backupRestore: 'backup:restore',
  backupImport: 'backup:import',
  backupExport: 'backup:export',
  backupRemove: 'backup:remove',
  backupOpenFolder: 'backup:open-folder',
  backupClearShop: 'backup:clear-shop',
  // branding
  brandingPickLogo: 'branding:pick-logo',
  brandingClearLogo: 'branding:clear-logo',
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
  products: {
    list: () => invoke(CH.productsList),
    get: (id: number) => invoke(CH.productsGet, id),
    create: (input: unknown) => invoke(CH.productsCreate, input),
    update: (id: number, patch: unknown) => invoke(CH.productsUpdate, id, patch),
    remove: (id: number) => invoke(CH.productsRemove, id),
  },
  sales: {
    list: () => invoke(CH.salesList),
    get: (id: number) => invoke(CH.salesGet, id),
    create: (input: unknown) => invoke(CH.salesCreate, input),
    void: (id: number) => invoke(CH.salesVoid, id),
  },
  expenses: {
    list: (range: unknown) => invoke(CH.expensesList, range),
    create: (input: unknown) => invoke(CH.expensesCreate, input),
    update: (id: number, patch: unknown) => invoke(CH.expensesUpdate, id, patch),
    remove: (id: number) => invoke(CH.expensesRemove, id),
    pickAttachments: () => invoke(CH.expensesPickAttachments),
    attachment: (id: number) => invoke(CH.expensesAttachment, id),
    openAttachment: (id: number) => invoke(CH.expensesOpenAttachment, id),
  },
  dashboard: {
    metrics: () => invoke(CH.dashboardMetrics),
  },
  reports: {
    sales: (range: unknown) => invoke(CH.reportsSales, range),
    topProducts: (range: unknown, limit?: number) => invoke(CH.reportsTopProducts, range, limit),
    expensesByType: (range: unknown) => invoke(CH.reportsExpensesByType, range),
  },
  backup: {
    create: (note?: string | null) => invoke(CH.backupCreate, note ?? null),
    list: () => invoke(CH.backupList),
    current: () => invoke(CH.backupCurrent),
    verify: (filename: string) => invoke(CH.backupVerify, filename),
    restore: (filename: string) => invoke(CH.backupRestore, filename),
    import: () => invoke(CH.backupImport),
    export: (filename: string) => invoke(CH.backupExport, filename),
    remove: (filename: string) => invoke(CH.backupRemove, filename),
    openFolder: () => invoke(CH.backupOpenFolder),
    clearShop: () => invoke(CH.backupClearShop),
  },
  branding: {
    pickLogo: () => invoke(CH.brandingPickLogo),
    clearLogo: () => invoke(CH.brandingClearLogo),
  },
});
