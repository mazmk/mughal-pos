import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { DashboardMetrics } from '../../shared/ipc-types';
import { dashboardService } from '../services/dashboard.service';
import { handle } from './ipc-wrapper';

export function registerDashboardIpc(): void {
  handle<[], DashboardMetrics>(IPC_CHANNELS.dashboard.metrics, () => dashboardService.metrics());
}
