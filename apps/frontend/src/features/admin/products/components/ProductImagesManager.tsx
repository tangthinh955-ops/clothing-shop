import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { uploadsApi } from '../api/uploads.api';
import { ProductImageTile } from './ProductImageTile';

const maxImages = 8;
const maxBytes = 5 * 1024 * 1024;
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
// Hidden visually but still focusable, so keyboard users reach the native file picker.
const visuallyHidden = { position: 'absolute', width: 1, height: 1, p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const;

interface ImageRef {
  id: string;
  url: string;
}

interface Props {
  productName: string;
  images: ImageRef[];
  disabled: boolean;
  onSave: (assetIds: string[]) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

function uploadError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 413) return 'Ảnh vượt quá 5 MB.';
  return cause instanceof ApiError ? cause.message : 'Chưa tải được ảnh. Vui lòng thử lại.';
}

export function ProductImagesManager({ productName, images, disabled, onSave, onDirtyChange }: Props) {
  // `saved` is the list the server holds; `rows` is the order being edited, including uploads not attached yet
  // (the server cleans unattached uploads after 24 hours).
  const [saved, setSaved] = useState<ImageRef[]>(images);
  const [rows, setRows] = useState<ImageRef[]>(images);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(null);
  const busy = useRef(false);
  const hintId = useId();
  const savedIds = new Set(saved.map((image) => image.id));
  const changed = rows.map((image) => image.id).join() !== saved.map((image) => image.id).join();
  const removesSaved = saved.some((image) => !rows.some((row) => row.id === image.id));
  const full = rows.length >= maxImages;
  const locked = disabled || uploading || saving;

  useEffect(() => {
    onDirtyChange?.(changed);
  }, [changed, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy.current) return;
    if (!acceptedTypes.includes(file.type)) {
      setMessage({ severity: 'error', text: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.' });
      return;
    }
    if (file.size > maxBytes) {
      setMessage({ severity: 'error', text: 'Ảnh vượt quá 5 MB.' });
      return;
    }
    busy.current = true;
    setUploading(true);
    setMessage(null);
    try {
      const uploaded = await uploadsApi.image(file);
      setRows((current) => [...current, { id: uploaded.id, url: uploaded.url }]);
    } catch (cause: unknown) {
      setMessage({ severity: 'error', text: uploadError(cause) });
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }

  function move(index: number, offset: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const [image] = next.splice(index, 1);
      if (image) next.splice(index + offset, 0, image);
      return next;
    });
  }

  async function save() {
    if (busy.current || disabled || !changed) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(rows.map((image) => image.id));
      // The server replaces the whole list with exactly what was sent, so it becomes the new saved baseline.
      setSaved(rows);
      setMessage({ severity: 'success', text: 'Đã lưu ảnh sản phẩm.' });
    } catch (cause: unknown) {
      setMessage({ severity: 'error', text: cause instanceof ApiError ? cause.message : 'Chưa lưu được ảnh. Vui lòng thử lại.' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <Stack spacing={2.5} aria-busy={locked}>
    <Typography component="h2" variant="h5">Ảnh sản phẩm</Typography>
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
    {rows.length === 0 && <Typography color="text.secondary">Sản phẩm chưa có ảnh. Cần ít nhất một ảnh trước khi xuất bản.</Typography>}
    {rows.length > 0 && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {rows.map((image, index) => <ProductImageTile key={image.id} productName={productName} url={image.url} position={index + 1}
        total={rows.length} saved={savedIds.has(image.id)} disabled={locked} onMove={(offset) => move(index, offset)}
        onRemove={() => setRows((current) => current.filter((row) => row.id !== image.id))} />)}
    </Box>}
    <Box>
      <Box component="label" sx={{ position: 'relative', display: 'inline-flex',
        '& input:focus-visible + span': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
        <Box component="input" type="file" accept={acceptedTypes.join(',')} aria-label="Tải ảnh sản phẩm" aria-describedby={hintId}
          disabled={locked || full} onChange={(event: ChangeEvent<HTMLInputElement>) => { void upload(event); }} sx={visuallyHidden} />
        <Box component="span" sx={{ border: 1, borderColor: locked || full ? 'action.disabled' : 'text.primary', color: locked || full ? 'text.disabled' : 'text.primary',
          px: 2.5, py: 1, cursor: locked || full ? 'default' : 'pointer', fontWeight: 500 }}>Chọn ảnh để tải lên</Box>
      </Box>
      <Typography id={hintId} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {full ? 'Đã đủ 8 ảnh cho một sản phẩm.' : 'JPEG, PNG hoặc WebP, tối đa 5 MB, mỗi chiều 64–8000 px. Tối đa 8 ảnh.'}
      </Typography>
      {uploading && <Typography role="status" sx={{ mt: 1 }}>Đang tải ảnh lên…</Typography>}
    </Box>
    {removesSaved && <Alert severity="warning" role="status">Ảnh đã gỡ sẽ không khôi phục được sau khi lưu.</Alert>}
    <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap' }}>
      <Button variant="contained" disabled={locked || !changed} onClick={() => { void save(); }}>
        {saving ? 'Đang lưu ảnh…' : 'Lưu thứ tự ảnh'}
      </Button>
      <Button variant="outlined" disabled={locked || !changed} onClick={() => setRows(saved)}>Hủy thay đổi ảnh</Button>
    </Stack>
  </Stack>;
}
