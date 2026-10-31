import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Suppliers" subtitle="Vendors you buy stock from." icon="local_shipping" />`,
})
export class SuppliersPage {}
