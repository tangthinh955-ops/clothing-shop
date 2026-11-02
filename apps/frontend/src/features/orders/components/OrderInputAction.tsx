import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useId, useState } from 'react';
import { useOrderCommand } from '../hooks/useOrderCommand';

interface OrderInputActionProps {
  label: string;
  title: string;
  description: string;
  fieldLabel: string;
  maxLength?: number;
  multiline?: boolean;
  danger?: boolean;
  inputType?: 'text' | 'datetime-local';
  /** The value the field starts from each time the dialog opens. */
  initialValue?: () => string;
  /** Answers what is wrong with the trimmed value, or an empty string when it can be sent. */
  validate: (value: string) => string;
  perform: (value: string, idempotencyKey: string) => Promise<unknown>;
  onChanged: () => unknown;
}

// A step that needs one value. The value is part of the command: after an unclear result the field locks so a resend carries the same text.
export function OrderInputAction({ label, title, description, fieldLabel, maxLength, multiline = false, danger = false,
  inputType = 'text', initialValue, validate, perform, onChanged }: OrderInputActionProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState('');
  const command = useOrderCommand(() => {
    setOpen(false);
    void onChanged();
  });
  const { outcome, pending } = command;
  const leave = () => command.leave(() => setOpen(false));
  const color = danger ? 'error' : 'primary';

  function show() {
    if (initialValue) setDraft(initialValue());
    setOpen(true);
  }

  function submit() {
    const value = draft.trim();
    const problem = validate(value);
    setFieldError(problem);
    if (problem === '') command.send((key) => perform(value, key));
  }

  return <>
    <Button variant={danger ? 'outlined' : 'contained'} color={color} onClick={show}>{label}</Button>
    <Dialog open={open} onClose={leave} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId} sx={{ overflowWrap: 'anywhere' }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>
        <TextField label={fieldLabel} type={inputType} required fullWidth multiline={multiline} {...(multiline ? { minRows: 2 } : {})} value={draft}
          disabled={pending || outcome.kind !== 'idle'} onChange={(event) => setDraft(event.target.value)} error={fieldError !== ''}
          helperText={fieldError} slotProps={{ htmlInput: maxLength === undefined ? {} : { maxLength }, inputLabel: inputType === 'text' ? {} : { shrink: true } }} />
        {outcome.kind !== 'idle' && <Alert severity="error" sx={{ mt: 2 }}>{outcome.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={leave} disabled={pending}>Để sau</Button>
        {outcome.kind === 'idle' && <Button variant="contained" color={color} disabled={pending} onClick={submit}>{label}</Button>}
        {outcome.kind === 'unconfirmed' && <Button variant="contained" disabled={pending} onClick={command.resend}>Gửi lại</Button>}
        {outcome.kind === 'refused' && <Button variant="contained" onClick={command.finish}>Tải lại đơn</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
