/**
 * Allow-list of IPC channels. Both main and renderer import from here.
 * Keep this file free of runtime dependencies — it is shared type-only material.
 *
 * Preload inlines its own copy (electron/preload/preload.ts) because sandbox
 * mode restricts require() — keep both in sync when adding channels.
 */
export const IPC_CHANNELS = {
  health: {
    status: 'health:status',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    list: 'settings:list',
  },
  categories: {
    list: 'categories:list',
    get: 'categories:get',
    create: 'categories:create',
    update: 'categories:update',
    remove: 'categories:remove',
  },
  products: {
    list: 'products:list',
    get: 'products:get',
    create: 'products:create',
    update: 'products:update',
    remove: 'products:remove',
    import: 'products:import',
  },
  sales: {
    list: 'sales:list',
    get: 'sales:get',
    create: 'sales:create',
    void: 'sales:void',
  },
  expenses: {
    list: 'expenses:list',
    create: 'expenses:create',
    update: 'expenses:update',
    remove: 'expenses:remove',
    pickAttachments: 'expenses:pick-attachments',
    attachment: 'expenses:attachment',
    openAttachment: 'expenses:open-attachment',
  },
  dashboard: {
    metrics: 'dashboard:metrics',
  },
  reports: {
    sales: 'reports:sales',
    topProducts: 'reports:top-products',
    expensesByType: 'reports:expenses-by-type',
  },
  backup: {
    create: 'backup:create',
    list: 'backup:list',
    current: 'backup:current',
    verify: 'backup:verify',
    restore: 'backup:restore',
    import: 'backup:import',
    export: 'backup:export',
    remove: 'backup:remove',
    openFolder: 'backup:open-folder',
    clearShop: 'backup:clear-shop',
  },
  branding: {
    pickLogo: 'branding:pick-logo',
    clearLogo: 'branding:clear-logo',
  },
} as const;
