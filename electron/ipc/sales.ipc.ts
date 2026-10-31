import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { NewSale, NewSaleItem, PaymentMethod, Sale } from '../../shared/ipc-types';
import { salesService } from '../services/sales.service';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

const VALID_METHODS: readonly PaymentMethod[] = ['cash', 'card', 'credit', 'other'];

function parsePaymentMethod(v: unknown): PaymentMethod {
  const s = assertString(v, 'paymentMethod');
  if (!(VALID_METHODS as readonly string[]).includes(s)) {
    throw new Error(`Invalid payment method: ${s}`);
  }
  return s as PaymentMethod;
}

function parseItems(raw: unknown): NewSaleItem[] {
  if (!Array.isArray(raw)) throw new Error('items must be an array');
  return raw.map((row, i) => {
    const o = assertObject(row, `items[${i}]`);
    return {
      productId: assertNumber(o['productId'], `items[${i}].productId`),
      quantity: assertNumber(o['quantity'], `items[${i}].quantity`),
      unitPrice: assertNumber(o['unitPrice'], `items[${i}].unitPrice`),
      taxRate:
        o['taxRate'] === undefined ? 0 : assertNumber(o['taxRate'], `items[${i}].taxRate`),
    };
  });
}

function parseNewSale(raw: unknown): NewSale {
  const o = assertObject(raw, 'sale');
  return {
    paymentMethod: parsePaymentMethod(o['paymentMethod']),
    discountAmount:
      o['discountAmount'] === undefined ? 0 : assertNumber(o['discountAmount'], 'discountAmount'),
    notes:
      o['notes'] === null || o['notes'] === undefined || o['notes'] === ''
        ? null
        : assertString(o['notes'], 'notes'),
    items: parseItems(o['items']),
  };
}

export function registerSalesIpc(): void {
  handle<[], Sale[]>(IPC_CHANNELS.sales.list, () => salesService.list());
  handle<[number], Sale | null>(IPC_CHANNELS.sales.get, (_e, id) =>
    salesService.get(assertNumber(id, 'id'))
  );
  handle<[unknown], Sale>(IPC_CHANNELS.sales.create, (_e, input) =>
    salesService.create(parseNewSale(input))
  );
  handle<[number], Sale>(IPC_CHANNELS.sales.void, (_e, id) =>
    salesService.void(assertNumber(id, 'id'))
  );
}
