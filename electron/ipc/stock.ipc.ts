import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { NewStockMovement, StockMovement, StockMovementReason } from '../../shared/ipc-types';
import { productsRepository } from '../services/products.repository';
import { stockRepository } from '../services/stock.repository';
import { recordMovement } from '../services/stock.service';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

const VALID_REASONS: readonly StockMovementReason[] = [
  'opening',
  'sale',
  'restock',
  'damage',
  'adjustment',
  'return',
];

function parseReason(v: unknown): StockMovementReason {
  const s = assertString(v, 'reason');
  if (!(VALID_REASONS as readonly string[]).includes(s)) {
    throw new Error(`Invalid reason: ${s}`);
  }
  return s as StockMovementReason;
}

function parseNewMovement(raw: unknown): NewStockMovement {
  const o = assertObject(raw, 'movement');
  return {
    productId: assertNumber(o['productId'], 'productId'),
    reason: parseReason(o['reason']),
    quantity: assertNumber(o['quantity'], 'quantity'),
    unitCost:
      o['unitCost'] === null || o['unitCost'] === undefined
        ? null
        : assertNumber(o['unitCost'], 'unitCost'),
    note:
      o['note'] === null || o['note'] === undefined ? null : assertString(o['note'], 'note'),
  };
}

export function registerStockIpc(): void {
  handle<[number | undefined], StockMovement[]>(IPC_CHANNELS.stock.list, (_e, productId) => {
    if (productId == null) return stockRepository.list();
    return stockRepository.list(assertNumber(productId, 'productId'));
  });

  handle<[unknown], StockMovement>(IPC_CHANNELS.stock.adjust, (_e, input) => {
    const parsed = parseNewMovement(input);
    productsRepository.assertNotDeleted(parsed.productId);
    const id = recordMovement({
      productId: parsed.productId,
      reason: parsed.reason,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      note: parsed.note,
      referenceType: 'manual',
    });
    const row = stockRepository.getById(id);
    if (!row) throw new Error('Stock movement not found after insert');
    return row;
  });
}
