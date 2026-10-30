import type { CatalogVariant } from './api/catalog.api';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
// Clothing sizes read smallest to largest; anything unknown (e.g. "Freesize") keeps its order after them.
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

export function formatMoney(amount: number) {
  return money.format(amount);
}

// "Từ …" only when the sizes a shopper can pick really cost differently.
export function priceLabel(priceFrom: number, variants: CatalogVariant[]) {
  const differentPrices = new Set(variants.map((variant) => variant.price)).size > 1;
  return differentPrices ? `Từ ${formatMoney(priceFrom)}` : formatMoney(priceFrom);
}

function sizeRank(size: string) {
  const rank = SIZE_ORDER.indexOf(size.toUpperCase());
  return rank === -1 ? SIZE_ORDER.length : rank;
}

export function sortSizes(sizes: Iterable<string>) {
  return [...new Set(sizes)].sort((a, b) => sizeRank(a) - sizeRank(b));
}
