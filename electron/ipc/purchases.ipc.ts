import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { NewPurchase, NewPurchaseItem, Purchase } from '../../shared/ipc-types';
import { purchasesService } from '../services/purchases.service';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

function parseItems(raw: unknown): NewPurchaseItem[] {
  if (!Array.isArray(raw)) throw new Error('items must be an array');
  return raw.map((row, i) => {
    const o = assertObject(row, `items[${i}]`);
    return {
      productId: assertNumber(o['productId'], `items[${i}].productId`),
      quantity: assertNumber(o['quantity'], `items[${i}].quantity`),
      unitCost: assertNumber(o['unitCost'], `items[${i}].unitCost`),
    };
  });
}

function parseNewPurchase(raw: unknown): NewPurchase {
  const o = assertObject(raw, 'purchase');
  return {
    supplierId:
      o['supplierId'] === null || o['supplierId'] === undefined
        ? null
        : assertNumber(o['supplierId'], 'supplierId'),
    reference:
      o['reference'] === null || o['reference'] === undefined || o['reference'] === ''
        ? null
        : assertString(o['reference'], 'reference'),
    purchasedAt: assertString(o['purchasedAt'], 'purchasedAt'),
    notes:
      o['notes'] === null || o['notes'] === undefined || o['notes'] === ''
        ? null
        : assertString(o['notes'], 'notes'),
    items: parseItems(o['items']),
  };
}

export function registerPurchasesIpc(): void {
  handle<[], Purchase[]>(IPC_CHANNELS.purchases.list, () => purchasesService.list());
  handle<[number], Purchase | null>(IPC_CHANNELS.purchases.get, (_e, id) =>
    purchasesService.get(assertNumber(id, 'id'))
  );
  handle<[unknown], Purchase>(IPC_CHANNELS.purchases.create, (_e, input) =>
    purchasesService.create(parseNewPurchase(input))
  );
  handle<[number], Purchase>(IPC_CHANNELS.purchases.receive, (_e, id) =>
    purchasesService.receive(assertNumber(id, 'id'))
  );
  handle<[number], Purchase>(IPC_CHANNELS.purchases.cancel, (_e, id) =>
    purchasesService.cancel(assertNumber(id, 'id'))
  );
}
