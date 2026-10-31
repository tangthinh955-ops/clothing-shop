import { useCallback, useMemo } from 'react';
import type { CartLine } from '../../cart/cart-store';
import type { CheckoutQuote } from '../api/checkout.api';
import type { CreateOrderBody } from '../api/orders.api';
import { useOrderSubmission } from '../OrderSubmissionProvider';

export interface ContactDraft {
  name: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  note: string;
}

/** Server-owned items only: the order body quotes the accepted quote's lines, never client prices. */
export function buildOrderBody(quote: CheckoutQuote): CreateOrderBody {
  return {
    quoteId: quote.quoteId,
    items: quote.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    contact: { name: '', phone: '', email: '' },
    address: { province: '', district: '', ward: '', addressLine: '' },
    note: '',
    method: 'COD',
  };
}

/** True when the live cart still matches the lines of the quote or the placed order. */
export function cartMatchesQuote(items: readonly CartLine[],
  lines: ReadonlyArray<{ variantId: string; quantity: number }>): boolean {
  const expected = [...lines]
    .map((item) => ({ variantId: item.variantId, quantity: item.quantity }))
    .sort((left, right) => (left.variantId < right.variantId ? -1 : 1));
  const cartLines = [...items]
    .map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
    .sort((left, right) => (left.variantId < right.variantId ? -1 : 1));
  return JSON.stringify(expected) === JSON.stringify(cartLines);
}

/**
 * Thin view over the submission provider for one accepted quote: the body is derived from the
 * quote (server-owned lines) and stays immutable per intent; the provider owns key/replay rules.
 */
export function useCreateOrder(quote: CheckoutQuote | null) {
  const submission = useOrderSubmission();
  const body = useMemo(() => (quote ? buildOrderBody(quote) : null), [quote]);

  const submit = useCallback(async (contact: ContactDraft) => {
    if (!quote || !body) return;
    const email = contact.email.trim();
    await submission.submit({
      ...body,
      contact: { name: contact.name.trim(), phone: contact.phone.trim(), ...(email ? { email } : {}) },
      address: { province: contact.province.trim(), district: contact.district.trim(),
        ward: contact.ward.trim(), addressLine: contact.addressLine.trim() },
      note: contact.note.trim() ? contact.note.trim() : ''
    });
  }, [body, quote, submission]);

  return { ...submission, body, submit };
}
