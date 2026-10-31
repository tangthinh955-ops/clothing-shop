import { Box, Paper, Stack, Typography } from '@mui/material';
import { formatMoney } from '../../catalog/catalogFormat';
import type { CheckoutQuote, QuoteItem } from '../api/checkout.api';

/** Visual tone of a quote block: active (valid), old (seen before) or new (awaiting confirmation). */
export type QuoteTone = 'active' | 'old' | 'new';

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
    <Typography sx={strong ? { fontWeight: 700 } : undefined}>{label}</Typography>
    <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</Typography>
  </Stack>;
}

/** Server-owned numbers only: every value comes from the stored quote, nothing is recomputed here. */
export function QuoteSummary({ quote, tone = 'active' }: { quote: CheckoutQuote; tone?: QuoteTone }) {
  return <Paper square elevation={0} sx={tone === 'old'
    ? { p: { xs: 2.5, sm: 4 }, opacity: 0.72 }
    : tone === 'new'
      ? { p: { xs: 2.5, sm: 4 }, border: 2, borderColor: 'primary.main' }
      : { p: { xs: 2.5, sm: 4 } }}>
    <Stack spacing={2}>
      {quote.items.map((item: QuoteItem) => <Stack key={item.variantId} direction="row" useFlexGap
        sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
          <Typography variant="body2" color="text.secondary">{item.color} · size {item.size} · {item.sku}</Typography>
          <Typography variant="body2">{formatMoney(item.unitPriceVnd)} × {item.quantity}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{formatMoney(item.lineTotalVnd)}</Typography>
      </Stack>)}
    </Stack>
    <Stack spacing={1} sx={{ borderTop: 1, borderColor: 'divider', mt: 2, pt: 2 }}>
      <Row label="Tiền hàng" value={formatMoney(quote.subtotal)} />
      <Row label="Phí giao hàng" value={formatMoney(quote.shippingFee)} />
      <Row label="Tổng tiền" value={formatMoney(quote.total)} strong />
    </Stack>
  </Paper>;
}

/** Human-readable list of what changed between the quote the shopper saw and the fresh one. */
export function describeQuoteChanges(oldQuote: CheckoutQuote, freshQuote: CheckoutQuote): string[] {
  const changes: string[] = [];
  if (oldQuote.shippingFee !== freshQuote.shippingFee) {
    changes.push(`Phí giao hàng đổi từ ${formatMoney(oldQuote.shippingFee)} thành ${formatMoney(freshQuote.shippingFee)}.`);
  }
  const oldById = new Map(oldQuote.items.map((item) => [item.variantId, item]));
  for (const item of freshQuote.items) {
    const previous = oldById.get(item.variantId);
    if (previous && previous.unitPriceVnd !== item.unitPriceVnd) {
      changes.push(`Đơn giá "${item.productName}" đổi từ ${formatMoney(previous.unitPriceVnd)} thành ${formatMoney(item.unitPriceVnd)}.`);
    }
  }
  return changes;
}
