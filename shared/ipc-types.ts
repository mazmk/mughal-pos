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

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                 */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
export type NewCategory = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
export type CategoryPatch = Partial<NewCategory>;

/* -------------------------------------------------------------------------- */
/*  Suppliers                                                                  */
/* -------------------------------------------------------------------------- */

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: 0 | 1;
  createdAt: string;
  updatedAt: string;
}
export type NewSupplier = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;
export type SupplierPatch = Partial<NewSupplier>;

/* -------------------------------------------------------------------------- */
/*  Products                                                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Stock                                                                      */
/* -------------------------------------------------------------------------- */

export type StockMovementReason =
  | 'opening'
  | 'sale'
  | 'restock'
  | 'damage'
  | 'adjustment'
  | 'return';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  reason: StockMovementReason;
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: number | null;
  note: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface NewStockMovement {
  productId: number;
  reason: StockMovementReason;
  quantity: number;
  unitCost?: number | null;
  note?: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Purchases                                                                  */
/* -------------------------------------------------------------------------- */

export type PurchaseStatus = 'draft' | 'received' | 'cancelled';

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  reference: string | null;
  totalAmount: number;
  status: PurchaseStatus;
  purchasedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItem[];
}

export interface NewPurchaseItem {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface NewPurchase {
  supplierId: number | null;
  reference: string | null;
  purchasedAt: string;
  notes: string | null;
  items: NewPurchaseItem[];
}

/* -------------------------------------------------------------------------- */
/*  Sales                                                                      */
/* -------------------------------------------------------------------------- */

export type PaymentMethod = 'cash' | 'card' | 'credit' | 'other';
export type SaleStatus = 'completed' | 'voided' | 'refunded';

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
}

export interface Sale {
  id: number;
  reference: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  soldAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
}

export interface NewSaleItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface NewSale {
  paymentMethod: PaymentMethod;
  discountAmount: number;
  notes: string | null;
  items: NewSaleItem[];
}

/* -------------------------------------------------------------------------- */
/*  Dashboard + Reports                                                        */
/* -------------------------------------------------------------------------- */

export interface DashboardMetrics {
  todaySalesAmount: number;
  todaySalesCount: number;
  totalProducts: number;
  lowStockProducts: number;
  inventoryValue: number;
  activeCategories: number;
  activeSuppliers: number;
}

export interface SalesReportRow {
  bucket: string;
  salesCount: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
}

export interface TopProductRow {
  productId: number;
  productName: string;
  productSku: string;
  quantitySold: number;
  revenue: number;
}

export interface ReportRange {
  from: string;
  to: string;
  granularity: 'day' | 'week' | 'month';
}

/* -------------------------------------------------------------------------- */
/*  Backup                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Why a backup exists. `manual` and `imported` are never pruned automatically;
 * `auto` follows the retention setting; safety snapshots keep the newest 10.
 */
export type BackupKind = 'manual' | 'auto' | 'pre-restore' | 'pre-migration' | 'imported';

/** `verified` = checksum + SQLite integrity passed at creation or last verify. */
export type BackupStatus = 'verified' | 'unverified' | 'damaged';

/** Row counts captured in a backup, shown so the user knows what they restore. */
export interface BackupCounts {
  products: number;
  categories: number;
  suppliers: number;
  sales: number;
  purchases: number;
  stockMovements: number;
}

export interface BackupInfo {
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  kind: BackupKind;
  status: BackupStatus;
  /** Schema version inside the backup; null for legacy backups never verified. */
  schemaVersion: number | null;
  appVersion: string | null;
  sha256: string | null;
  counts: BackupCounts | null;
  note: string | null;
  /** Date of the latest sale in the backup — "data up to". */
  lastSaleAt: string | null;
}

export interface BackupCheck {
  ok: boolean;
  /** Human-readable reasons when ok is false. */
  problems: string[];
  info: BackupInfo;
}

export interface RestoreResult {
  restored: BackupInfo;
  /** Snapshot of the data that was replaced — restore this to undo. */
  safetyBackup: BackupInfo;
}

/** Live database summary, for comparing against a backup before restoring. */
export interface BackupCurrentState {
  counts: BackupCounts;
  lastSaleAt: string | null;
  schemaVersion: number;
  backupsFolder: string;
}
