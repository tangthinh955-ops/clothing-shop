import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * The one Vietnamese mobile normalization for DTOs, snapshots, hashing and quota
 * (m4-contract §8): leading 0 and +84/84 forms collapse to the 0-prefixed 10-digit form.
 * Anything else is not a Vietnamese mobile number.
 */
export function normalizeVietnamesePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s.\-()]/g, '');
  const local = digits.startsWith('+84') ? `0${digits.slice(3)}`
    : digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(local) ? local : null;
}

/** Unambiguous order-code alphabet: no 0/O, 1/I/L confusion; fixed length 12. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ORDER_CODE_LENGTH = 12;

export function generateOrderCode(): string {
  let code = '';
  for (let index = 0; index < ORDER_CODE_LENGTH; index += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function generateLookupToken(): string {
  return randomBytes(24).toString('base64url'); // 192 bits per m4-contract §8.
}

export const lookupTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export interface OrderCommand {
  quoteId: string;
  items: Array<{ variantId: string; quantity: number }>;
  contact: { name: string; phone: string; email: string | null };
  address: { province: string; district: string; ward: string; addressLine: string };
  note: string | null;
  method: 'COD';
}

/**
 * Canonical command shape for hashing (m4-contract §7): ids lowercased, merged and sorted by
 * variantId, phone normalized, text trimmed — two identical intents must hash identically.
 */
export function canonicalizeOrderCommand(dto: {
  quoteId: string; method: string;
  items: Array<{ variantId: string; quantity: number }>;
  contact: { name: string; phone: string; email?: string | null };
  address: { province: string; district?: string; ward: string; addressLine: string };
  note?: string | null;
}): OrderCommand {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of dto.items) {
    const id = variantId.toLowerCase();
    merged.set(id, (merged.get(id) ?? 0) + quantity);
  }
  return {
    quoteId: dto.quoteId.toLowerCase(),
    items: [...merged.entries()].sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([variantId, quantity]) => ({ variantId, quantity })),
    contact: { name: dto.contact.name.trim(), phone: normalizeVietnamesePhone(dto.contact.phone) ?? '',
      email: dto.contact.email ? dto.contact.email.trim().toLowerCase() : null },
    address: { province: dto.address.province.trim(), district: (dto.address.district ?? '').trim(),
      ward: dto.address.ward.trim(), addressLine: dto.address.addressLine.trim() },
    note: dto.note && dto.note.trim().length > 0 ? dto.note.trim() : null,
    method: 'COD',
  };
}

export const hashOrderCommand = (command: OrderCommand) =>
  createHash('sha256').update(JSON.stringify(['orders.create', command])).digest('hex');
