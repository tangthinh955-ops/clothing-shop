import { request } from '../../../../shared/api/client';

export interface UploadedImage {
  id: string;
  width: number;
  height: number;
  url: string;
}

export const uploadsApi = {
  // The server decodes and re-encodes to WebP; the result is a private temporary asset until a product attaches it.
  image: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UploadedImage>('/admin/uploads/images', { method: 'POST', body });
  },
};
