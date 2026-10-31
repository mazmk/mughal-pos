import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Point of Sale" subtitle="Scan, add items to a cart, and complete a sale." icon="point_of_sale" />`,
})
export class PosPage {}
