import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { adminOrdersApi, type AdminOrderNote } from '../api/admin-orders.api';
import { formatOrderTime } from '../orderLabels';

const MAX_NOTE_LENGTH = 1000;
const CONNECTION_MESSAGE = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';

interface OrderNotesProps {
  orderId: string;
  notes: AdminOrderNote[];
  onSaved: () => unknown;
}

// A lost response may still have been saved server-side, so the text locks and only the exact same
// key and content can be resent; a clear refusal (4xx) leaves the draft editable under a new key.
export function OrderNotes({ orderId, notes, onSaved }: OrderNotesProps) {
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const key = useRef(crypto.randomUUID());
  const sentBody = useRef('');

  function send(body: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    sentBody.current = body;
    adminOrdersApi.addNote(orderId, body, key.current)
      .then(() => {
        key.current = crypto.randomUUID();
        setDraft('');
        setUnconfirmed(false);
        void onSaved();
      })
      .catch((cause: unknown) => {
        const refused = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
        if (refused) key.current = crypto.randomUUID();
        setUnconfirmed(!refused);
        setError(cause instanceof ApiError ? cause.message : CONNECTION_MESSAGE);
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || unconfirmed) return;
    const body = draft.trim();
    if (body === '') {
      setFieldError('Nhập nội dung ghi chú.');
      return;
    }
    setFieldError('');
    send(body);
  }

  return <Stack spacing={2}>
    {notes.length === 0 ? <Typography color="text.secondary">Chưa có ghi chú.</Typography>
      : <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {notes.map((note) => <Box component="li" key={note.id} sx={{ overflowWrap: 'anywhere' }}>
          <Typography sx={{ whiteSpace: 'pre-line' }}>{note.body}</Typography>
          <Typography variant="body2" color="text.secondary">{note.authorName} · {formatOrderTime(note.createdAt)}</Typography>
        </Box>)}
      </Stack>}
    <Stack component="form" noValidate spacing={1.5} onSubmit={submit}>
      <TextField label="Thêm ghi chú" multiline minRows={2} value={draft} disabled={unconfirmed}
        onChange={(event) => setDraft(event.target.value)} error={fieldError !== ''}
        helperText={fieldError || 'Khách không thấy ghi chú này. Ghi chú đã lưu không sửa hoặc xóa được.'}
        slotProps={{ htmlInput: { maxLength: MAX_NOTE_LENGTH } }} />
      {error && <Alert severity="error">
        {error}{unconfirmed && ' Ghi chú có thể đã được lưu; bấm Gửi lại sẽ không tạo trùng.'}
      </Alert>}
      {unconfirmed
        ? <Button variant="contained" disabled={pending} onClick={() => send(sentBody.current)} sx={{ alignSelf: 'flex-start' }}>Gửi lại</Button>
        : <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>Lưu ghi chú</Button>}
    </Stack>
  </Stack>;
}
