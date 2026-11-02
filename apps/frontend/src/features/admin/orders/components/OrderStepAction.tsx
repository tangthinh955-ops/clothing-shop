import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useId, useState } from 'react';
import { useOrderCommand } from '../../../orders/hooks/useOrderCommand';

interface OrderStepActionProps {
  label: string;
  title: string;
  description: string;
  submitLabel: string;
  perform: (idempotencyKey: string) => Promise<unknown>;
  onChanged: () => unknown;
}

// A step with nothing to fill in. The status never goes back, so it asks once more instead of firing on a mistaken tap.
export function OrderStepAction({ label, title, description, submitLabel, perform, onChanged }: OrderStepActionProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const command = useOrderCommand(() => {
    setOpen(false);
    void onChanged();
  });
  const { outcome, pending } = command;
  const leave = () => command.leave(() => setOpen(false));

  return <>
    <Button variant="contained" onClick={() => setOpen(true)}>{label}</Button>
    <Dialog open={open} onClose={leave} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId} sx={{ overflowWrap: 'anywhere' }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
        {outcome.kind !== 'idle' && <Alert severity="error" sx={{ mt: 2 }}>{outcome.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={leave} disabled={pending}>Để sau</Button>
        {outcome.kind === 'idle' && <Button variant="contained" disabled={pending} onClick={() => command.send(perform)}>{submitLabel}</Button>}
        {outcome.kind === 'unconfirmed' && <Button variant="contained" disabled={pending} onClick={command.resend}>Gửi lại</Button>}
        {outcome.kind === 'refused' && <Button variant="contained" onClick={command.finish}>Tải lại đơn</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
