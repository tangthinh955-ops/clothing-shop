import { Alert, Button, Dialog, DialogContent, DialogContentText, DialogTitle, Stack } from '@mui/material';
import { useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/client';
import type { Category, CategoryUpdateInput } from '../api/categories.api';
import { CategoryForm } from './CategoryForm';

interface Props {
  category: Category;
  onSave: (input: CategoryUpdateInput) => Promise<void>;
  onReload: () => Promise<Category>;
  onClose: () => void;
}

export function CategoryEditDialog({ category, onSave, onReload, onClose }: Props) {
  // Preserve the version captured on opening; background refetch must not rebase a draft.
  const [snapshot, setSnapshot] = useState(category);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const busy = useRef(false);

  function setBusy(value: boolean) {
    busy.current = value;
    setPending(value);
  }

  function close() {
    if (!busy.current) onClose();
  }

  async function reload() {
    if (busy.current) return;
    setBusy(true);
    setReloadError('');
    try {
      const latest = await onReload();
      setSnapshot(latest);
      setRevision((value) => value + 1);
    } catch (cause: unknown) {
      setReloadError(cause instanceof ApiError ? cause.message : 'Chưa tải được dữ liệu mới. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open onClose={close} fullWidth maxWidth="sm" aria-labelledby="edit-category-title" aria-describedby="edit-category-description">
    <DialogTitle id="edit-category-title">Sửa danh mục</DialogTitle>
    <DialogContent>
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <DialogContentText id="edit-category-description">
          Sửa tên, đường dẫn hoặc trạng thái rồi lưu. Tải dữ liệu mới sẽ thay phần đang nhập bằng dữ liệu mới nhất.
        </DialogContentText>
        {reloadError && <Alert severity="error">{reloadError}</Alert>}
        <CategoryForm key={revision} mode="edit" initialValues={snapshot} disabled={pending}
          onSubmit={(input) => onSave({ ...input, expectedVersion: snapshot.version })}
          onCancel={close} onPendingChange={setBusy} />
        <Button type="button" variant="text" disabled={pending} onClick={() => { void reload(); }}>Tải dữ liệu mới</Button>
      </Stack>
    </DialogContent>
  </Dialog>;
}
