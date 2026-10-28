import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../shared/api/client';
import { uploadsApi, type UploadedImage } from '../api/uploads.api';
import { ProductImagesManager } from './ProductImagesManager';

const saved = { id: 'asset-saved', url: '/api/v1/admin/uploads/images/asset-saved' };
const uploaded: UploadedImage = { id: 'asset-new', width: 300, height: 400, url: '/api/v1/admin/uploads/images/asset-new' };

const three = ['a', 'b', 'c'].map((id) => ({ id, url: `/${id}` }));

afterEach(() => vi.restoreAllMocks());

function sources() {
  return screen.getAllByRole('img').map((image) => image.getAttribute('src'));
}

function png(name = 'ao.png') {
  return new File(['png-bytes'], name, { type: 'image/png' });
}

function renderManager(options: { images?: { id: string; url: string }[]; disabled?: boolean } = {}) {
  const onSave = vi.fn<(assetIds: string[]) => Promise<void>>().mockResolvedValue(undefined);
  render(<ProductImagesManager productName="Áo cotton" images={options.images ?? [saved]} disabled={options.disabled ?? false} onSave={onSave} />);
  return onSave;
}

describe('upload and attach product images', () => {
  it('uploads a valid image as unsaved, then saves saved + new asset ids in order', async () => {
    const upload = vi.spyOn(uploadsApi, 'image').mockResolvedValue(uploaded);
    const onSave = renderManager();
    expect(screen.getByRole('img', { name: 'Ảnh 1 của Áo cotton' })).toHaveAttribute('src', saved.url);
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png());
    expect(upload).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('img', { name: 'Ảnh 2 của Áo cotton (chưa lưu)' })).toHaveAttribute('src', uploaded.url);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' }));
    expect(onSave).toHaveBeenCalledWith(['asset-saved', 'asset-new']);
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã lưu ảnh sản phẩm.');
    expect(screen.queryByText(/chưa lưu/)).not.toBeInTheDocument();
  });

  it('rejects a wrong type or a file over 5 MB before sending', async () => {
    const upload = vi.spyOn(uploadsApi, 'image');
    renderManager();
    const input = screen.getByLabelText('Tải ảnh sản phẩm');
    fireEvent.change(input, { target: { files: [new File(['gif'], 'ao.gif', { type: 'image/gif' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
    const big = png('big.png');
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Ảnh vượt quá 5 MB.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('shows the server reason for rejected bytes and a readable message for 413', async () => {
    const upload = vi.spyOn(uploadsApi, 'image')
      .mockRejectedValueOnce(new ApiError('UNSUPPORTED_IMAGE', 'Chỉ nhận JPEG, PNG, WebP tĩnh, mỗi chiều 64–8000 và tối đa 16 triệu pixel.', 415))
      .mockRejectedValueOnce(new ApiError('PAYLOAD_TOO_LARGE', 'File too large', 413));
    renderManager();
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png('fake.png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ nhận JPEG, PNG, WebP tĩnh');
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png('huge.png'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ảnh vượt quá 5 MB.'));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/chưa lưu/)).not.toBeInTheDocument();
  });

  it('removes an unsaved image so it is not attached', async () => {
    vi.spyOn(uploadsApi, 'image').mockResolvedValue(uploaded);
    renderManager();
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png());
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ ảnh chưa lưu 2' }));
    expect(screen.queryByRole('img', { name: /chưa lưu/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
  });

  it('keeps unsaved images and shows the server message when attaching fails', async () => {
    vi.spyOn(uploadsApi, 'image').mockResolvedValue(uploaded);
    const onSave = renderManager();
    onSave.mockRejectedValueOnce(new ApiError('CONFLICT', 'Dữ liệu đã thay đổi hoặc bị trùng. Hãy tải lại rồi thử lại.', 409));
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png());
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu thứ tự ảnh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu đã thay đổi hoặc bị trùng.');
    expect(screen.getByRole('img', { name: 'Ảnh 2 của Áo cotton (chưa lưu)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeEnabled();
  });

  it('sends only one upload while one is in flight', async () => {
    let finish: (value: UploadedImage) => void = () => { throw new Error('Upload not started'); };
    const upload = vi.spyOn(uploadsApi, 'image').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderManager();
    const input = screen.getByLabelText('Tải ảnh sản phẩm');
    fireEvent.change(input, { target: { files: [png('one.png')] } });
    fireEvent.change(input, { target: { files: [png('two.png')] } });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải ảnh lên…');
    await act(async () => { finish(uploaded); });
    expect(await screen.findByRole('img', { name: 'Ảnh 2 của Áo cotton (chưa lưu)' })).toBeVisible();
  });

  it('stops new uploads at 8 images and while the page is busy', () => {
    const eight = Array.from({ length: 8 }, (_value, index) => ({ id: `asset-${index}`, url: `/api/v1/admin/uploads/images/asset-${index}` }));
    renderManager({ images: eight });
    expect(screen.getByLabelText('Tải ảnh sản phẩm')).toBeDisabled();
    expect(screen.getByText('Đã đủ 8 ảnh cho một sản phẩm.')).toBeVisible();
  });

  it('reorders images, marks the first as main, and saves the new order', async () => {
    const onSave = renderManager({ images: three });
    expect(sources()).toEqual(['/a', '/b', '/c']);
    expect(screen.getByText('Ảnh chính')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đưa ảnh 1 lên trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa ảnh 3 ra sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa ảnh 3 lên trước' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đưa ảnh 1 ra sau' }));
    expect(sources()).toEqual(['/c', '/a', '/b']);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' }));
    expect(onSave).toHaveBeenCalledWith(['c', 'a', 'b']);
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã lưu ảnh sản phẩm.');
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
  });

  it('removes a saved image with a warning, and Hủy thay đổi ảnh restores the saved list', async () => {
    const onSave = renderManager({ images: three });
    await userEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh 2' }));
    expect(sources()).toEqual(['/a', '/c']);
    expect(screen.getByText('Ảnh đã gỡ sẽ không khôi phục được sau khi lưu.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi ảnh' }));
    expect(sources()).toEqual(['/a', '/b', '/c']);
    expect(screen.queryByText('Ảnh đã gỡ sẽ không khôi phục được sau khi lưu.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' }));
    expect(onSave).toHaveBeenCalledWith(['a', 'c']);
  });

  it('lets a new upload become the main image before saving', async () => {
    vi.spyOn(uploadsApi, 'image').mockResolvedValue(uploaded);
    const onSave = renderManager();
    await userEvent.upload(screen.getByLabelText('Tải ảnh sản phẩm'), png());
    await userEvent.click(await screen.findByRole('button', { name: 'Đưa ảnh 2 lên trước' }));
    expect(screen.getByRole('img', { name: 'Ảnh 1 của Áo cotton (chưa lưu)' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' }));
    expect(onSave).toHaveBeenCalledWith(['asset-new', 'asset-saved']);
  });

  it('locks upload and save while the page holds another operation', () => {
    renderManager({ disabled: true });
    expect(screen.getByLabelText('Tải ảnh sản phẩm')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu thứ tự ảnh' })).toBeDisabled();
  });
});
