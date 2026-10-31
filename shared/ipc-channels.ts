/**
 * Allow-list of IPC channels. Both main and renderer import from here.
 * Keep this file free of runtime dependencies — it is shared type-only material.
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
  products: {
    list: 'products:list',
    get: 'products:get',
    create: 'products:create',
    update: 'products:update',
    remove: 'products:remove',
  },
} as const;

export type IpcChannel =
  | (typeof IPC_CHANNELS.health)[keyof typeof IPC_CHANNELS.health]
  | (typeof IPC_CHANNELS.settings)[keyof typeof IPC_CHANNELS.settings]
  | (typeof IPC_CHANNELS.products)[keyof typeof IPC_CHANNELS.products];
