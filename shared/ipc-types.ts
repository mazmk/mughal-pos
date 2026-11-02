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
  createdAt: string;
  updatedAt: string;
}

export type NewProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductPatch = Partial<NewProduct>;

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
  unitCost: number;
  lineTotal: number;
  taxRate: number;
}

export interface Sale {
  id: number;
  reference: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  profit: number;
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
/*  Expenses                                                                   */
/* -------------------------------------------------------------------------- */

/** utility = bills, stock = buying goods to sell, staff = money a team member took. */
export type ExpenseType = 'utility' | 'stock' | 'staff' | 'other';

/** Files the shop may attach to an expense. Images are re-encoded as JPEG on the way in. */
export type AttachmentMimeType = 'image/jpeg' | 'application/pdf';

export interface ExpenseAttachment {
  id: number;
  expenseId: number;
  fileName: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
  createdAt: string;
}

/** An attachment's bytes, base64-encoded so it can cross IPC. */
export interface AttachmentFile {
  fileName: string;
  mimeType: AttachmentMimeType;
  dataBase64: string;
}

export interface Expense {
  id: number;
  type: ExpenseType;
  amount: number;
  description: string | null;
  incurredAt: string;
  createdAt: string;
  updatedAt: string;
  attachments: ExpenseAttachment[];
}

export interface NewExpense {
  type: ExpenseType;
  amount: number;
  description: string | null;
  /** ISO-8601 instant; stored as UTC. */
  incurredAt: string;
  addAttachments: AttachmentFile[];
}

export interface ExpensePatch extends NewExpense {
  removeAttachmentIds: number[];
}

/** Inclusive calendar dates, yyyy-mm-dd, on the computer's clock. */
export interface DateRange {
  from: string;
  to: string;
}

/* -------------------------------------------------------------------------- */
/*  Dashboard + Reports                                                        */
/* -------------------------------------------------------------------------- */

export interface DashboardMetrics {
  todaySalesAmount: number;
  todaySalesCount: number;
  todayProfit: number;
  monthSalesAmount: number;
  monthProfit: number;
  /** This month's expenses other than stock bought: what net profit subtracts. */
  monthExpenses: number;
  monthNetProfit: number;
  totalProducts: number;
  activeCategories: number;
}

export interface SalesReportRow {
  bucket: string;
  salesCount: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  profit: number;
  /** Money spent buying stock. Already counted in profit via each item's cost. */
  stockExpenses: number;
  /** Every other expense type. */
  otherExpenses: number;
  /** profit − otherExpenses. */
  netProfit: number;
}

export interface ExpenseTypeRow {
  type: ExpenseType;
  count: number;
  amount: number;
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
export type BackupKind =
  | 'manual'
  | 'auto'
  | 'pre-restore'
  | 'pre-migration'
  | 'pre-clear'
  | 'imported';

/** `verified` = checksum + SQLite integrity passed at creation or last verify. */
export type BackupStatus = 'verified' | 'unverified' | 'damaged';

/** Row counts captured in a backup, shown so the user knows what they restore. */
export interface BackupCounts {
  products: number;
  categories: number;
  sales: number;
  /** Missing from manifests written before expenses were tracked. */
  expenses?: number;
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

export interface ClearShopResult {
  /** Snapshot of the data that was deleted — restore this to undo. */
  safetyBackup: BackupInfo;
}

/** Live database summary, for comparing against a backup before restoring. */
export interface BackupCurrentState {
  counts: BackupCounts;
  lastSaleAt: string | null;
  schemaVersion: number;
  backupsFolder: string;
}
