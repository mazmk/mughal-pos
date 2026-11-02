import type {
  AttachmentFile,
  BackupCheck,
  BackupCurrentState,
  BackupInfo,
  Category,
  CategoryPatch,
  DashboardMetrics,
  DateRange,
  Expense,
  ExpensePatch,
  ExpenseTypeRow,
  HealthStatus,
  IpcResponse,
  NewCategory,
  NewExpense,
  NewProduct,
  NewSale,
  Product,
  ProductImportResult,
  ProductImportRow,
  ProductPatch,
  ReportRange,
  ClearShopResult,
  RestoreResult,
  Sale,
  SalesReportRow,
  Setting,
  TopProductRow,
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
  categories: {
    list(): Promise<IpcResponse<Category[]>>;
    get(id: number): Promise<IpcResponse<Category | null>>;
    create(input: NewCategory): Promise<IpcResponse<Category>>;
    update(id: number, patch: CategoryPatch): Promise<IpcResponse<Category>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
  };
  products: {
    list(): Promise<IpcResponse<Product[]>>;
    get(id: number): Promise<IpcResponse<Product | null>>;
    create(input: NewProduct): Promise<IpcResponse<Product>>;
    update(id: number, patch: ProductPatch): Promise<IpcResponse<Product>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
    /** Adds many products at once, creating missing categories; existing products are skipped. */
    import(rows: ProductImportRow[]): Promise<IpcResponse<ProductImportResult>>;
  };
  sales: {
    list(): Promise<IpcResponse<Sale[]>>;
    get(id: number): Promise<IpcResponse<Sale | null>>;
    create(input: NewSale): Promise<IpcResponse<Sale>>;
    void(id: number): Promise<IpcResponse<Sale>>;
  };
  expenses: {
    list(range: DateRange): Promise<IpcResponse<Expense[]>>;
    create(input: NewExpense): Promise<IpcResponse<Expense>>;
    update(id: number, patch: ExpensePatch): Promise<IpcResponse<Expense>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
    /** Opens a file picker and returns the chosen files, ready to save. Empty when cancelled. */
    pickAttachments(): Promise<IpcResponse<AttachmentFile[]>>;
    attachment(id: number): Promise<IpcResponse<AttachmentFile>>;
    /** Opens a saved attachment in the computer's default viewer. */
    openAttachment(id: number): Promise<IpcResponse<void>>;
  };
  dashboard: {
    metrics(): Promise<IpcResponse<DashboardMetrics>>;
  };
  reports: {
    sales(range: ReportRange): Promise<IpcResponse<SalesReportRow[]>>;
    topProducts(range: ReportRange, limit?: number): Promise<IpcResponse<TopProductRow[]>>;
    expensesByType(range: DateRange): Promise<IpcResponse<ExpenseTypeRow[]>>;
  };
  backup: {
    create(note?: string | null): Promise<IpcResponse<BackupInfo>>;
    list(): Promise<IpcResponse<BackupInfo[]>>;
    current(): Promise<IpcResponse<BackupCurrentState>>;
    verify(filename: string): Promise<IpcResponse<BackupCheck>>;
    restore(filename: string): Promise<IpcResponse<RestoreResult>>;
    /** Opens a file picker; null when the user cancels. */
    import(): Promise<IpcResponse<BackupInfo | null>>;
    /** Opens a save dialog; returns the saved path, or null when cancelled. */
    export(filename: string): Promise<IpcResponse<string | null>>;
    remove(filename: string): Promise<IpcResponse<{ filename: string }>>;
    openFolder(): Promise<IpcResponse<void>>;
    /** Deletes every record, after taking a safety backup. Backups are kept. */
    clearShop(): Promise<IpcResponse<ClearShopResult>>;
  };
  branding: {
    /** Opens a file picker, normalises the image and stores it as `shop.logo`. Null when cancelled. */
    pickLogo(): Promise<IpcResponse<Setting | null>>;
    clearLogo(): Promise<IpcResponse<void>>;
  };
}
