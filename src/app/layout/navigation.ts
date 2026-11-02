export interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  { label: 'POS', icon: 'point_of_sale', route: '/pos' },
  { label: 'Products', icon: 'inventory_2', route: '/products' },
  { label: 'Categories', icon: 'category', route: '/categories' },
  { label: 'Sales', icon: 'receipt_long', route: '/sales' },
  { label: 'Expenses', icon: 'request_quote', route: '/expenses' },
  { label: 'Reports', icon: 'analytics', route: '/reports' },
  { label: 'Settings', icon: 'settings', route: '/settings' },
];
