import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { NewSupplier, Supplier, SupplierPatch } from '../../shared/ipc-types';
import { suppliersRepository } from '../services/suppliers.repository';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

function optionalString(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  return assertString(v, field);
}

function parseNewSupplier(raw: unknown): NewSupplier {
  const o = assertObject(raw, 'supplier');
  return {
    name: assertString(o['name'], 'name'),
    contactName: optionalString(o['contactName'], 'contactName'),
    phone: optionalString(o['phone'], 'phone'),
    email: optionalString(o['email'], 'email'),
    address: optionalString(o['address'], 'address'),
    notes: optionalString(o['notes'], 'notes'),
    isActive: (o['isActive'] === 0 ? 0 : 1) as 0 | 1,
  };
}

function parsePatch(raw: unknown): SupplierPatch {
  const o = assertObject(raw, 'patch');
  const patch: SupplierPatch = {};
  if ('name' in o) patch.name = assertString(o['name'], 'name');
  if ('contactName' in o) patch.contactName = optionalString(o['contactName'], 'contactName');
  if ('phone' in o) patch.phone = optionalString(o['phone'], 'phone');
  if ('email' in o) patch.email = optionalString(o['email'], 'email');
  if ('address' in o) patch.address = optionalString(o['address'], 'address');
  if ('notes' in o) patch.notes = optionalString(o['notes'], 'notes');
  if ('isActive' in o) patch.isActive = (o['isActive'] ? 1 : 0) as 0 | 1;
  return patch;
}

export function registerSuppliersIpc(): void {
  handle<[], Supplier[]>(IPC_CHANNELS.suppliers.list, () => suppliersRepository.list());
  handle<[number], Supplier | null>(IPC_CHANNELS.suppliers.get, (_e, id) =>
    suppliersRepository.get(assertNumber(id, 'id'))
  );
  handle<[unknown], Supplier>(IPC_CHANNELS.suppliers.create, (_e, input) =>
    suppliersRepository.create(parseNewSupplier(input))
  );
  handle<[number, unknown], Supplier>(IPC_CHANNELS.suppliers.update, (_e, id, patch) =>
    suppliersRepository.update(assertNumber(id, 'id'), parsePatch(patch))
  );
  handle<[number], { id: number }>(IPC_CHANNELS.suppliers.remove, (_e, id) =>
    suppliersRepository.remove(assertNumber(id, 'id'))
  );
}
