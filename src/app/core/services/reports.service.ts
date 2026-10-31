import { Injectable, inject } from '@angular/core';
import type { ReportRange, SalesReportRow, TopProductRow } from '../../../../shared/ipc-types';
import { ElectronBridgeService } from './electron-bridge.service';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly bridge = inject(ElectronBridgeService);

  sales(range: ReportRange): Promise<SalesReportRow[]> {
    return this.bridge.unwrap(this.bridge.api.reports.sales(range));
  }

  topProducts(range: ReportRange, limit = 10): Promise<TopProductRow[]> {
    return this.bridge.unwrap(this.bridge.api.reports.topProducts(range, limit));
  }
}
