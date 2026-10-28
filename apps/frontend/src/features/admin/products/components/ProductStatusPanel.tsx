import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/client';
import type { Product } from '../api/products.api';

export type StatusAction = 'publish' | 'hide';

const statusLabels = { DRAFT: 'Nháp', PUBLISHED: 'Đã xuất bản', HIDDEN: 'Đã ẩn' } as const;
const successMessages = { publish: 'Đã xuất bản sản phẩm.', hide: 'Đã ẩn sản phẩm.' } as const;

interface Props {
  product: Product;
  // undefined while the category list is unknown (loading or failed); publishing waits until it is known.
  categoryActive: boolean | undefined;
  unsaved: boolean;
  disabled: boolean;
  onChange: (action: StatusAction) => Promise<void>;
}

export function ProductStatusPanel({ product, categoryActive, unsaved, disabled, onChange }: Props) {
  const [pending, setPending] = useState<StatusAction | null>(null);
  const [message, setMessage] = useState<{ severity: 'error' | 'success'; text: string } | null>(null);
  const busy = useRef(false);
  const published = product.status === 'PUBLISHED';
  // Mirrors the backend publish rule on saved data; the server stays the authority and rechecks it.
  const conditions = [
    { label: 'Danh mục đang bật', met: categoryActive === true, note: categoryActive === undefined ? 'Chưa kiểm tra được danh mục' : '' },
    { label: 'Có ít nhất 1 ảnh đã lưu', met: product.images.length > 0, note: '' },
    { label: 'Có ít nhất 1 biến thể đang bật', met: product.variants.some((variant) => variant.active), note: '' },
  ];
  const ready = conditions.every((condition) => condition.met);
  const locked = disabled || pending !== null;

  async function run(action: StatusAction) {
    if (busy.current || disabled) return;
    busy.current = true;
    setPending(action);
    setMessage(null);
    try {
      await onChange(action);
      setMessage({ severity: 'success', text: successMessages[action] });
    } catch (cause: unknown) {
      setMessage({ severity: 'error', text: cause instanceof ApiError ? cause.message : 'Chưa đổi được trạng thái. Vui lòng thử lại.' });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return <Stack spacing={2} aria-busy={locked}>
    <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Typography component="h2" variant="h5">Trạng thái</Typography>
      <Chip label={statusLabels[product.status]} variant="outlined" />
    </Stack>
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
    {published ? <>
      <Typography variant="body2" color="text.secondary">Khách đang xem được sản phẩm này. Ẩn sản phẩm để gỡ khỏi cửa hàng mà không xóa dữ liệu.</Typography>
      <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} disabled={locked} onClick={() => { void run('hide'); }}>
        {pending === 'hide' ? 'Đang ẩn…' : 'Ẩn sản phẩm'}
      </Button>
    </> : <>
      <Typography variant="body2" color="text.secondary">Điều kiện xuất bản (theo dữ liệu đã lưu):</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {conditions.map((condition) => <Box component="li" key={condition.label} sx={{ mb: 0.5 }}>
          <Typography component="span" sx={{ fontWeight: 600, color: condition.met ? 'success.dark' : 'error.dark' }}>
            {condition.met ? 'Đạt' : 'Chưa đạt'}
          </Typography>
          <Typography component="span">{' — '}</Typography>
          <Typography component="span">{condition.label}</Typography>
          {condition.note && <Typography variant="body2" color="text.secondary">{condition.note}</Typography>}
        </Box>)}
      </Box>
      {unsaved && <Alert severity="warning" role="status">Lưu hoặc hủy các thay đổi đang nhập trước khi xuất bản.</Alert>}
      <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={locked || !ready || unsaved} onClick={() => { void run('publish'); }}>
        {pending === 'publish' ? 'Đang xuất bản…' : 'Xuất bản'}
      </Button>
    </>}
  </Stack>;
}
