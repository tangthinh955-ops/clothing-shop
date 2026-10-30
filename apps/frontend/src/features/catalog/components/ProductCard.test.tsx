import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CatalogProduct, CatalogVariant } from '../api/catalog.api';
import { ProductCard } from './ProductCard';

function variant(id: string, size: string, color: string, price: number, active = true): CatalogVariant {
  return { id, sku: `SKU-${id}`, size, color, price, active, available: 3 };
}

const base: CatalogProduct = {
  id: 'p1', name: 'Áo hoodie zip', slug: 'ao-hoodie-zip', description: '', categoryId: 'c1',
  category: { id: 'c1', name: 'Áo hoodie', slug: 'ao-hoodie' }, priceFrom: 450000,
  images: [{ id: 'i1', url: '/api/v1/media/i1' }, { id: 'i2', url: '/api/v1/media/i2' }],
  variants: [variant('1', 'XL', 'đen', 450000), variant('2', 'S', 'đen', 450000), variant('3', 'M', 'trắng', 450000)],
};

function renderCard(item: CatalogProduct) {
  render(<MemoryRouter><ul><ProductCard item={item} /></ul></MemoryRouter>);
  return screen.getByRole('listitem', { name: item.name });
}

describe('product card', () => {
  it('links the product name to its page and shows the cover photo', () => {
    const card = renderCard(base);
    expect(within(card).getByRole('link', { name: 'Áo hoodie zip' })).toHaveAttribute('href', '/products/ao-hoodie-zip');
    expect(within(card).getByAltText('Ảnh của Áo hoodie zip')).toHaveAttribute('src', '/api/v1/media/i1');
  });

  it('shows one price when every size costs the same, with the size range and colour count', () => {
    const card = renderCard(base);
    expect(within(card).getByText(/^450\.000\s*₫$/)).toBeVisible();
    expect(within(card).queryByText(/Từ/)).not.toBeInTheDocument();
    expect(within(card).getByText('S – XL · 2 màu')).toBeVisible();
  });

  it('marks the lowest price as a starting price when sizes cost differently and skips turned-off variants', () => {
    const card = renderCard({ ...base, priceFrom: 400000, variants: [
      variant('1', 'M', 'đen', 400000), variant('2', 'L', 'đen', 420000), variant('3', 'XXL', 'xám', 999000, false),
    ] });
    expect(within(card).getByText(/^Từ 400\.000\s*₫$/)).toBeVisible();
    expect(within(card).getByText('M – L')).toBeVisible();
  });

  it('keeps the second photo ready for hover without announcing it twice', () => {
    const card = renderCard(base);
    expect(within(card).getAllByRole('img')).toHaveLength(1);
    expect(card.querySelector('img[src="/api/v1/media/i2"]')).toHaveAttribute('alt', '');
  });

  it('has no hover photo when the product has a single image', () => {
    const card = renderCard({ ...base, images: [base.images[0]!] });
    expect(card.querySelectorAll('img')).toHaveLength(1);
  });

  it('says so when the product has no photo yet', () => {
    const card = renderCard({ ...base, images: [] });
    expect(within(card).getByText('Chưa có ảnh')).toBeVisible();
  });
});
