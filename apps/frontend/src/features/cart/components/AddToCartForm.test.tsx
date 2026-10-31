import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { CartProvider } from '../CartProvider';
import { CART_STORAGE_KEY } from '../cart-store';
import { AddToCartForm } from './AddToCartForm';

beforeEach(() => window.localStorage.clear());

it('does not add a fractional or over-limit quantity even when stock is high', () => {
  render(<CartProvider><AddToCartForm variant={{ id: '17bfecab-9df4-4de4-bd91-3c11116fca5b',
    sku: 'TEST', size: 'M', color: 'Đen', price: 200000, active: true, available: 200 }} /></CartProvider>);
  const quantity = screen.getByRole('spinbutton', { name: 'Số lượng' });
  const add = screen.getByRole('button', { name: 'Thêm vào giỏ' });
  fireEvent.change(quantity, { target: { value: '1.5' } });
  expect(add).toBeDisabled();
  fireEvent.change(quantity, { target: { value: '100' } });
  expect(add).toBeDisabled();
  expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
});

it('explains when a valid quantity exceeds the available stock', () => {
  render(<CartProvider><AddToCartForm variant={{ id: '17bfecab-9df4-4de4-bd91-3c11116fca5b',
    sku: 'TEST', size: 'M', color: 'Đen', price: 200000, active: true, available: 4 }} /></CartProvider>);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Số lượng' }), { target: { value: '5' } });
  expect(screen.getByText('Chỉ còn 4 sản phẩm có thể thêm vào giỏ.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Thêm vào giỏ' })).toBeDisabled();
});
