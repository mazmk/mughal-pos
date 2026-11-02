import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  ExpenseTypeRow,
  ReportRange,
  SalesReportRow,
  TopProductRow,
} from '../../shared/ipc-types';
import { dashboardService } from '../services/dashboard.service';
import { parseDateRange } from './expenses.ipc';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

const VALID_GRAN: readonly ReportRange['granularity'][] = ['day', 'week', 'month'];

function parseRange(raw: unknown): ReportRange {
  const o = assertObject(raw, 'range');
  const g = assertString(o['granularity'], 'granularity');
  if (!(VALID_GRAN as readonly string[]).includes(g)) {
    throw new Error(`Invalid granularity: ${g}`);
  }
  return {
    from: assertString(o['from'], 'from'),
    to: assertString(o['to'], 'to'),
    granularity: g as ReportRange['granularity'],
  };
}

export function registerReportsIpc(): void {
  handle<[unknown], SalesReportRow[]>(IPC_CHANNELS.reports.sales, (_e, range) =>
    dashboardService.salesReport(parseRange(range))
  );

  handle<[unknown, number | undefined], TopProductRow[]>(
    IPC_CHANNELS.reports.topProducts,
    (_e, range, limit) =>
      dashboardService.topProducts(
        parseRange(range),
        limit === undefined ? 10 : assertNumber(limit, 'limit')
      )
  );

  handle<[unknown], ExpenseTypeRow[]>(IPC_CHANNELS.reports.expensesByType, (_e, range) =>
    dashboardService.expensesByType(parseDateRange(range))
  );
}
