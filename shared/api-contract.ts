import type {
  HealthStatus,
  IpcResponse,
  NewProduct,
  Product,
  ProductPatch,
  Setting,
} from './ipc-types';

/**
 * The exact shape exposed on `window.api` via contextBridge.
 * Any method added here must have a matching IPC handler in electron/ipc.
 */
export interface MughalApi {
  health: {
    status(): Promise<IpcResponse<HealthStatus>>;
  };
  settings: {
    get(key: string): Promise<IpcResponse<Setting | null>>;
    set(key: string, value: string): Promise<IpcResponse<Setting>>;
    list(): Promise<IpcResponse<Setting[]>>;
  };
  products: {
    list(): Promise<IpcResponse<Product[]>>;
    get(id: number): Promise<IpcResponse<Product | null>>;
    create(input: NewProduct): Promise<IpcResponse<Product>>;
    update(id: number, patch: ProductPatch): Promise<IpcResponse<Product>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
  };
}
