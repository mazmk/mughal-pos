import { Component, OnInit, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { HealthService } from '../../core/services/health.service';

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly tone: 'primary' | 'tertiary' | 'warn' | 'neutral';
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
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

  readonly status = this.health.status;
  readonly loading = this.health.loading;
  readonly error = this.health.error;

  readonly stats = computed<readonly StatCard[]>(() => [
    { label: "Today's Sales", value: '—', icon: 'payments', tone: 'primary' },
    { label: 'Total Products', value: '—', icon: 'inventory_2', tone: 'tertiary' },
    { label: 'Low Stock Products', value: '—', icon: 'warning', tone: 'warn' },
    { label: 'Inventory Value', value: '—', icon: 'account_balance', tone: 'neutral' },
  ]);

  ngOnInit(): void {
    void this.health.refresh();
  }

  refresh(): void {
    void this.health.refresh();
  }
}
