import type {
  BackupInfo,
  Category,
  CategoryPatch,
  DashboardMetrics,
  HealthStatus,
  IpcResponse,
  NewCategory,
  NewProduct,
  NewPurchase,
  NewSale,
  NewStockMovement,
  NewSupplier,
  Product,
  ProductPatch,
  Purchase,
  ReportRange,
  Sale,
  SalesReportRow,
  Setting,
  StockMovement,
  Supplier,
  SupplierPatch,
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
  suppliers: {
    list(): Promise<IpcResponse<Supplier[]>>;
    get(id: number): Promise<IpcResponse<Supplier | null>>;
    create(input: NewSupplier): Promise<IpcResponse<Supplier>>;
    update(id: number, patch: SupplierPatch): Promise<IpcResponse<Supplier>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
  };
  products: {
    list(): Promise<IpcResponse<Product[]>>;
    get(id: number): Promise<IpcResponse<Product | null>>;
    create(input: NewProduct): Promise<IpcResponse<Product>>;
    update(id: number, patch: ProductPatch): Promise<IpcResponse<Product>>;
    remove(id: number): Promise<IpcResponse<{ id: number }>>;
    lowStock(): Promise<IpcResponse<Product[]>>;
  };
  stock: {
    list(productId?: number): Promise<IpcResponse<StockMovement[]>>;
    adjust(input: NewStockMovement): Promise<IpcResponse<StockMovement>>;
  };
  purchases: {
    list(): Promise<IpcResponse<Purchase[]>>;
    get(id: number): Promise<IpcResponse<Purchase | null>>;
    create(input: NewPurchase): Promise<IpcResponse<Purchase>>;
    receive(id: number): Promise<IpcResponse<Purchase>>;
    cancel(id: number): Promise<IpcResponse<Purchase>>;
  };
  sales: {
    list(): Promise<IpcResponse<Sale[]>>;
    get(id: number): Promise<IpcResponse<Sale | null>>;
    create(input: NewSale): Promise<IpcResponse<Sale>>;
    void(id: number): Promise<IpcResponse<Sale>>;
  };
  dashboard: {
    metrics(): Promise<IpcResponse<DashboardMetrics>>;
  };
  reports: {
    sales(range: ReportRange): Promise<IpcResponse<SalesReportRow[]>>;
    topProducts(range: ReportRange, limit?: number): Promise<IpcResponse<TopProductRow[]>>;
  };
  backup: {
    create(): Promise<IpcResponse<BackupInfo>>;
    list(): Promise<IpcResponse<BackupInfo[]>>;
  };
}
