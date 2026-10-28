import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { uploadsApi } from '../api/uploads.api';

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
}

function uploadError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 413) return 'Ảnh vượt quá 5 MB.';
  return cause instanceof ApiError ? cause.message : 'Chưa tải được ảnh. Vui lòng thử lại.';
}

export function ProductImagesManager({ productName, images, disabled, onSave }: Props) {
  // Uploaded but not yet attached; the server cleans unattached assets after 24 hours.
  const [pending, setPending] = useState<ImageRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(null);
  const busy = useRef(false);
  const hintId = useId();
  const total = images.length + pending.length;
  const full = total >= maxImages;
  const locked = disabled || uploading || saving;

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
      setPending((rows) => [...rows, { id: uploaded.id, url: uploaded.url }]);
    } catch (cause: unknown) {
      setMessage({ severity: 'error', text: uploadError(cause) });
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }

  async function save() {
    if (busy.current || disabled || !pending.length) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await onSave([...images, ...pending].map((image) => image.id));
      setPending([]);
      setMessage({ severity: 'success', text: 'Đã lưu ảnh sản phẩm.' });
    } catch (cause: unknown) {
      setMessage({ severity: 'error', text: cause instanceof ApiError ? cause.message : 'Chưa lưu được ảnh. Vui lòng thử lại.' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const rows = [...images.map((image) => ({ ...image, saved: true })), ...pending.map((image) => ({ ...image, saved: false }))];

  return <Stack spacing={2.5} aria-busy={locked}>
    <Typography component="h2" variant="h5">Ảnh sản phẩm</Typography>
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
    {rows.length === 0 && <Typography color="text.secondary">Sản phẩm chưa có ảnh. Cần ít nhất một ảnh trước khi xuất bản.</Typography>}
    {rows.length > 0 && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {rows.map((image, index) => {
        const position = index + 1;
        return <Box component="li" key={image.id} sx={{ minWidth: 0 }}>
          <Box component="img" src={image.url} alt={`Ảnh ${position} của ${productName}${image.saved ? '' : ' (chưa lưu)'}`}
            sx={{ display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', bgcolor: 'action.hover' }} />
          <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Typography variant="body2">Ảnh {position}{image.saved ? '' : ' · chưa lưu'}</Typography>
            {!image.saved && <Button size="small" color="inherit" disabled={locked} aria-label={`Bỏ ảnh chưa lưu ${position}`}
              onClick={() => setPending((current) => current.filter((row) => row.id !== image.id))}>Bỏ</Button>}
          </Stack>
        </Box>;
      })}
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
    <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={locked || !pending.length} onClick={() => { void save(); }}>
      {saving ? 'Đang lưu ảnh…' : 'Lưu thứ tự ảnh'}
    </Button>
  </Stack>;
}
