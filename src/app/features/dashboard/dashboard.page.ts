import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardService } from '../../core/services/dashboard.service';
import { HealthService } from '../../core/services/health.service';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly tone: 'primary' | 'tertiary' | 'warn' | 'neutral';
  readonly link?: string;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatChipsModule,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly health = inject(HealthService);
  readonly dashboard = inject(DashboardService);

  readonly status = this.health.status;
  readonly healthLoading = this.health.loading;
  readonly healthError = this.health.error;

  readonly loading = this.dashboard.loading;
  readonly metrics = this.dashboard.metrics;

  readonly stats = computed<readonly StatCard[]>(() => {
    const m = this.metrics();
    const money = (n: number) => (new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(n));
    return [
      {
        label: "Today's Sales",
        value: m ? `${money(m.todaySalesAmount)} · ${m.todaySalesCount} sale${m.todaySalesCount === 1 ? '' : 's'}` : '—',
        icon: 'payments',
        tone: 'primary' as const,
        link: '/sales',
      },
      {
        label: 'Active Products',
        value: m ? String(m.totalProducts) : '—',
        icon: 'inventory_2',
        tone: 'tertiary' as const,
        link: '/products',
      },
      {
        label: 'Low Stock',
        value: m ? String(m.lowStockProducts) : '—',
        icon: 'warning',
        tone: 'warn' as const,
        link: '/inventory',
      },
      {
        label: 'Inventory Value',
        value: m ? money(m.inventoryValue) : '—',
        icon: 'account_balance',
        tone: 'neutral' as const,
        link: '/inventory',
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.health.refresh(), this.dashboard.refresh()]);
  }

  refresh(): void {
    void this.health.refresh();
    void this.dashboard.refresh();
  }
}
