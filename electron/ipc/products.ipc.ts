import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { NewProduct, Product, ProductPatch } from '../../shared/ipc-types';
import { productsRepository } from '../services/products.repository';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

function parseNewProduct(raw: unknown): NewProduct {
  const o = assertObject(raw, 'product');
  return {
    sku: assertString(o['sku'], 'sku'),
    barcode: o['barcode'] === null ? null : o['barcode'] ? assertString(o['barcode'], 'barcode') : null,
    name: assertString(o['name'], 'name'),
    categoryId: o['categoryId'] === null || o['categoryId'] === undefined
      ? null
      : assertNumber(o['categoryId'], 'categoryId'),
    unitPrice: assertNumber(o['unitPrice'], 'unitPrice'),
    costPrice: assertNumber(o['costPrice'], 'costPrice'),
    taxRate: assertNumber(o['taxRate'], 'taxRate'),
    imagePath: o['imagePath'] === null || o['imagePath'] === undefined
      ? null
      : assertString(o['imagePath'], 'imagePath'),
    isActive: (o['isActive'] === 1 || o['isActive'] === 0 ? o['isActive'] : 1) as 0 | 1,
    reorderLevel: assertNumber(o['reorderLevel'] ?? 0, 'reorderLevel'),
  };
}

function parsePatch(raw: unknown): ProductPatch {
  const o = assertObject(raw, 'patch');
  const patch: ProductPatch = {};
  if ('sku' in o) patch.sku = assertString(o['sku'], 'sku');
  if ('barcode' in o) patch.barcode = o['barcode'] === null ? null : assertString(o['barcode'], 'barcode');
  if ('name' in o) patch.name = assertString(o['name'], 'name');
  if ('categoryId' in o)
    patch.categoryId = o['categoryId'] === null ? null : assertNumber(o['categoryId'], 'categoryId');
  if ('unitPrice' in o) patch.unitPrice = assertNumber(o['unitPrice'], 'unitPrice');
  if ('costPrice' in o) patch.costPrice = assertNumber(o['costPrice'], 'costPrice');
  if ('taxRate' in o) patch.taxRate = assertNumber(o['taxRate'], 'taxRate');
  if ('imagePath' in o)
    patch.imagePath = o['imagePath'] === null ? null : assertString(o['imagePath'], 'imagePath');
  if ('isActive' in o) patch.isActive = (o['isActive'] ? 1 : 0) as 0 | 1;
  if ('reorderLevel' in o) patch.reorderLevel = assertNumber(o['reorderLevel'], 'reorderLevel');
  return patch;
}

export function registerProductsIpc(): void {
  handle<[], Product[]>(IPC_CHANNELS.products.list, () => productsRepository.list());

  handle<[number], Product | null>(IPC_CHANNELS.products.get, (_e, id) =>
    productsRepository.get(assertNumber(id, 'id'))
  );

  handle<[unknown], Product>(IPC_CHANNELS.products.create, (_e, input) =>
    productsRepository.create(parseNewProduct(input))
  );

  handle<[number, unknown], Product>(IPC_CHANNELS.products.update, (_e, id, patch) =>
    productsRepository.update(assertNumber(id, 'id'), parsePatch(patch))
  );

  handle<[number], { id: number }>(IPC_CHANNELS.products.remove, (_e, id) =>
    productsRepository.remove(assertNumber(id, 'id'))
  );
}
