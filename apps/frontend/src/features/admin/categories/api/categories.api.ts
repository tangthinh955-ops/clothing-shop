import { request } from '../../../../shared/api/client';

export interface CategoryInput {
  name: string;
  slug: string;
  active: boolean;
}

export interface Category extends CategoryInput {
  id: string;
  version: number;
}

export interface CategoryUpdateInput extends CategoryInput {
  expectedVersion: number;
}

export const categoriesApi = {
  list: () => request<Category[]>('/admin/categories'),
  create: (input: CategoryInput) => request<Category>('/admin/categories', { method: 'POST', body: input }),
  update: (id: string, input: CategoryUpdateInput) => request<Category>(`/admin/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
};
