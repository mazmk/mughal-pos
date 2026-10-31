import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Products" subtitle="Manage SKUs, prices, barcodes, and images." icon="inventory_2" />`,
})
export class ProductsPage {}
