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
  healthStatus: 'health:status',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsList: 'settings:list',
  productsList: 'products:list',
  productsGet: 'products:get',
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsRemove: 'products:remove',
} as const;

contextBridge.exposeInMainWorld('api', {
  health: {
    status: () => ipcRenderer.invoke(CH.healthStatus),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(CH.settingsGet, key),
    set: (key: string, value: string) => ipcRenderer.invoke(CH.settingsSet, key, value),
    list: () => ipcRenderer.invoke(CH.settingsList),
  },
  products: {
    list: () => ipcRenderer.invoke(CH.productsList),
    get: (id: number) => ipcRenderer.invoke(CH.productsGet, id),
    create: (input: unknown) => ipcRenderer.invoke(CH.productsCreate, input),
    update: (id: number, patch: unknown) => ipcRenderer.invoke(CH.productsUpdate, id, patch),
    remove: (id: number) => ipcRenderer.invoke(CH.productsRemove, id),
  },
});
