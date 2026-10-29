import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { categoriesApi } from '../../categories/api/categories.api';
import { productsApi, productsKey, type Product, type ProductImagesInput, type ProductUpdateInput } from '../api/products.api';
import { ProductEditForm } from '../components/ProductEditForm';
import { ProductImagesManager } from '../components/ProductImagesManager';
import { ProductStatusPanel, type StatusAction } from '../components/ProductStatusPanel';
import { pageTitle } from '../../../../shared/shop';

type Operation = 'save' | 'reload' | 'images' | 'status';

const headings = { DRAFT: 'Sửa sản phẩm nháp', PUBLISHED: 'Sửa sản phẩm đang bán', HIDDEN: 'Sửa sản phẩm đã ẩn' } as const;

export function ProductEditPage() {
  const productId = useParams()['productId'] ?? '';
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: categoriesApi.list, retry: false });
  const detail = useQuery({ queryKey: [...productsKey, 'detail', productId], queryFn: () => productsApi.detail(productId), enabled: productId !== '', retry: false });
  const update = useMutation({ mutationFn: (input: ProductUpdateInput) => productsApi.update(productId, input), retry: false });
  const attach = useMutation({ mutationFn: (input: ProductImagesInput) => productsApi.images(productId, input), retry: false });
  const transition = useMutation({ mutationFn: ({ action, version }: { action: StatusAction; version: number }) => productsApi[action](productId, version), retry: false });
  // Snapshot freezes the product/version this edit session started from; background refetches never rebase it.
  const [snapshot, setSnapshot] = useState<Product | null>(null);
  const [revision, setRevision] = useState(0);
  const operationRef = useRef<Operation | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  // Reported by the form and the image manager; publishing checks saved data, so it waits until nothing is unsaved.
  const [formDirty, setFormDirty] = useState(false);
  const [imagesDirty, setImagesDirty] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (detail.data && snapshot === null) setSnapshot(detail.data);

  function beginOperation(next: Operation) {
    // The page owns this lock so a form remount cannot clear an in-flight operation.
    if (operationRef.current !== null) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }

  function endOperation() {
    operationRef.current = null;
    setOperation(null);
  }

  async function save(input: ProductUpdateInput) {
    if (!beginOperation('save')) return;
    try {
      const saved = await update.mutateAsync(input);
      await queryClient.invalidateQueries({ queryKey: productsKey });
      void navigate('/admin/products', { replace: true, state: { updatedName: saved.name } });
    } finally { endOperation(); }
  }

  async function saveImages(assetIds: string[]) {
    // Reject rather than return: a silent return would let the manager report success and drop its unsaved images.
    if (!snapshot || !beginOperation('images')) throw new Error('Another product operation is running');
    try {
      const saved = await attach.mutateAsync({ assetIds, expectedVersion: snapshot.version });
      // The PUT only succeeds on the captured version, so the returned version covers just this image change: adopting it keeps the info draft valid.
      setSnapshot((current) => current && { ...current, version: saved.version, images: saved.images });
      void queryClient.invalidateQueries({ queryKey: productsKey });
    } finally { endOperation(); }
  }

  async function changeStatus(action: StatusAction) {
    if (!snapshot || !beginOperation('status')) throw new Error('Another product operation is running');
    try {
      // The version check passed, so the response is this product with only the status change applied.
      setSnapshot(await transition.mutateAsync({ action, version: snapshot.version }));
      void queryClient.invalidateQueries({ queryKey: productsKey });
    } finally { endOperation(); }
  }

  async function reloadLatest() {
    if (!beginOperation('reload')) return;
    try {
      // A failed refetch keeps the previous data in fresh.data, so only isSuccess may rebase the snapshot.
      const fresh = await detail.refetch();
      if (fresh.isSuccess && fresh.data) {
        setSnapshot(fresh.data);
        setRevision((value) => value + 1);
      }
    } finally { endOperation(); }
  }

  const categoryActive = snapshot ? categories.data?.find((category) => category.id === snapshot.categoryId)?.active : undefined;

  return <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>{pageTitle('Sửa sản phẩm | Quản trị')}</title>
    <Button component={Link} to="/admin/products" sx={{ mb: 2 }}>Về danh sách sản phẩm</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>{snapshot ? headings[snapshot.status] : 'Sửa sản phẩm'}</Typography>
    {detail.isPending && <Typography role="status">Đang tải sản phẩm…</Typography>}
    {detail.isError && <Stack spacing={2} sx={{ mb: 3 }}>
      <Alert severity="error">{detail.error instanceof ApiError ? detail.error.message : 'Chưa tải được sản phẩm. Vui lòng thử lại.'}</Alert>
      <Button variant="outlined" disabled={detail.isFetching} onClick={() => { void detail.refetch(); }}>Tải lại sản phẩm</Button>
    </Stack>}
    {snapshot && <Stack spacing={2.5}>
      {snapshot.status === 'PUBLISHED' && <Alert severity="warning">
        Khách đang xem sản phẩm này: thay đổi hiển thị ngay khi lưu. Đổi đường dẫn sẽ làm link cũ đã chia sẻ (ví dụ trên Instagram) không mở được nữa.
      </Alert>}
      {snapshot.status === 'HIDDEN' && <Alert severity="info">Sản phẩm đang ẩn: khách chưa thấy thay đổi cho tới khi xuất bản lại.</Alert>}
      {categories.isError && <Stack spacing={2}>
        <Alert severity="error">{categories.error instanceof ApiError ? categories.error.message : 'Chưa tải được danh mục. Vui lòng thử lại.'}</Alert>
        <Button variant="outlined" disabled={categories.isFetching} onClick={() => { void categories.refetch(); }}>Tải lại danh mục</Button>
      </Stack>}
      {categories.isPending && <Typography role="status">Đang tải danh mục…</Typography>}
      <Stack spacing={1}>
        <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} disabled={operation !== null || detail.isFetching}
          onClick={() => { void reloadLatest(); }}>Tải dữ liệu mới</Button>
        <Typography variant="body2" color="text.secondary">Tải dữ liệu mới sẽ thay toàn bộ nội dung đang nhập bằng bản mới nhất trên máy chủ.</Typography>
        {operation === 'reload' && <Typography role="status">Đang tải dữ liệu mới…</Typography>}
      </Stack>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <ProductStatusPanel key={revision} product={snapshot} categoryActive={categoryActive} unsaved={formDirty || imagesDirty}
          disabled={operation !== null} onChange={changeStatus} />
      </Paper>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <ProductImagesManager key={revision} productName={snapshot.name} images={snapshot.images} disabled={operation !== null}
          onSave={saveImages} onDirtyChange={setImagesDirty} />
      </Paper>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <ProductEditForm key={revision} product={snapshot} categories={categories.data ?? []} disabled={operation !== null}
          onSubmit={save} onDirtyChange={setFormDirty} />
      </Paper>
    </Stack>}
  </Box>;
}
