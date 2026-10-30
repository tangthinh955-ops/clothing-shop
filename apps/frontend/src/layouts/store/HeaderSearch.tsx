import { Container, IconButton, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router';
import { CloseIcon } from '../../shared/ui/icons';

// The collection page rejects longer terms, so the field stops at the same length.
const MAX_TERM_LENGTH = 80;

export function HeaderSearch({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  return <Container id={id} maxWidth="lg" sx={{ pt: 1, pb: 2 }}>
    <Stack component="form" role="search" aria-label="Tìm kiếm cửa hàng" direction="row" spacing={1} sx={{ alignItems: 'center' }}
      onSubmit={(event) => {
        event.preventDefault();
        const term = String(new FormData(event.currentTarget).get('q') ?? '').trim();
        navigate(term ? `/shop?${new URLSearchParams({ q: term }).toString()}` : '/shop');
        onClose();
      }}>
      <TextField name="q" type="search" label="Tìm trong cửa hàng" placeholder="Tên sản phẩm hoặc SKU" size="small" autoFocus
        slotProps={{ htmlInput: { maxLength: MAX_TERM_LENGTH, enterKeyHint: 'search' } }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }} />
      <IconButton aria-label="Đóng tìm kiếm" color="inherit" onClick={onClose}><CloseIcon /></IconButton>
    </Stack>
  </Container>;
}
