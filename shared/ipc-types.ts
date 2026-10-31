/**
 * Shared data contracts between Electron main and Angular renderer.
 * These types travel across the IPC boundary — keep them JSON-serializable.
 */

export interface IpcResult<T> {
  ok: true;
  data: T;
}

export interface IpcError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type IpcResponse<T> = IpcResult<T> | IpcError;

export type Platform =
  | 'aix'
  | 'darwin'
  | 'freebsd'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'android'
  | 'cygwin'
  | 'haiku'
  | 'netbsd';

export interface HealthStatus {
  databaseInitialized: boolean;
  schemaVersion: number;
  databasePath: string;
  appVersion: string;
  platform: Platform;
  userDataPath: string;
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: number | null;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  imagePath: string | null;
  isActive: 0 | 1;
  stockOnHand: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
}

export type NewProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stockOnHand'>;
export type ProductPatch = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'stockOnHand'>>;

export type StockMovementReason =
  | 'opening'
  | 'sale'
  | 'restock'
  | 'damage'
  | 'adjustment'
  | 'return';
