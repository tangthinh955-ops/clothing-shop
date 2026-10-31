import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { CatalogVariant } from '../../catalog/api/catalog.api';
import { useCart } from '../CartProvider';

/** Cart-facing copy for a failed cart operation, keyed by the pure store's error code. */
function rejectionMessage(error: 'invalid-quantity' | 'max-per-variant' | 'max-lines' | 'not-in-cart'): string {
  switch (error) {
    case 'invalid-quantity': return 'Số lượng cần là số nguyên từ 1 đến 99.';
    case 'max-per-variant': return 'Đã đạt tối đa 99 chiếc của sản phẩm này trong giỏ.';
    case 'max-lines': return 'Giỏ đã chứa tối đa 50 dòng, hãy thêm bớt trước khi chọn thêm dòng khác.';
    case 'not-in-cart': return 'Dòng này không còn trong giỏ.';
  }
}

/**
 * Quantity field + add button of a chosen variant. Stock checks here only guide the shopper:
 * the cart store and the later resolve step decide what the cart really holds.
 */
export function AddToCartForm({ variant }: { variant: CatalogVariant | undefined }) {
  const cart = useCart();
  const [quantityText, setQuantityText] = useState('');

  const inCart = cart.items.find((line) => line.variantId === variant?.id)?.quantity ?? 0;
  // Inventory shown alongside stock readouts; the "remaining" check keeps over-adding out of the UI.
  const remaining = variant ? Math.max(0, variant.available - inCart) : 0;
  const parsed = quantityText.trim() === '' ? 1 : /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
  const validNumber = Number.isInteger(parsed) && parsed >= 1 && parsed <= 99;
  const quantityValid = validNumber && parsed <= remaining;
  const quantityError = !validNumber ? 'Số lượng từ 1 đến 99.'
    : `Chỉ còn ${remaining} sản phẩm có thể thêm vào giỏ.`;
  // A failed add keeps the cart as-is and reports itself below the button instead of faking success.
  const rejection = cart.rejection?.variantId === variant?.id ? cart.rejection : undefined;

  if (variant && remaining === 0) {
    return <Typography role="status" sx={{ fontWeight: 600, color: variant.available > 0 ? 'text.disabled' : 'error.dark' }}>
      {variant.available > 0 ? 'Số lượng này đã nằm đủ trong giỏ hàng.' : 'Hết hàng — hãy nhắn shop qua Instagram.'}
    </Typography>;
  }

  return <Stack spacing={2} sx={{ maxWidth: 320 }}>
    <TextField
      label="Số lượng" type="number" size="small" value={quantityText}
      error={quantityText.trim() !== '' && !quantityValid}
      helperText={quantityText.trim() !== '' && !quantityValid ? quantityError : undefined}
      slotProps={{ htmlInput: { inputMode: 'numeric', min: 1, max: 99, step: 1, enterKeyHint: 'enter' } }}
      onChange={(event) => setQuantityText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && variant && quantityValid) {
          event.preventDefault();
          cart.addItem(variant.id, parsed);
          setQuantityText('');
        }
      }}
    />
    <Button variant="contained" size="large" sx={{ minHeight: 52 }}
      disabled={!variant || !quantityValid}
      onClick={() => {
        if (variant && quantityValid) {
          cart.addItem(variant.id, parsed);
          setQuantityText('');
        }
      }}>
      Thêm vào giỏ
    </Button>
    {rejection && <Typography role="alert" sx={{ fontWeight: 600, color: 'error.dark' }}>
      {rejectionMessage(rejection.error)}
    </Typography>}
  </Stack>;
}
