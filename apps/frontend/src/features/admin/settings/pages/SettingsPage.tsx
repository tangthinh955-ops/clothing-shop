import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { settingsApi, settingsKey, type AdminSettings, type SettingsUpdateInput } from '../api/settings.api';
import { SettingsForm } from '../components/SettingsForm';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: settingsKey, queryFn: settingsApi.adminView, retry: false });
  const data = settings.data;
  // The form owns its frozen snapshot and draft; bumping this key is the only way a reload replaces
  // the content, and it happens only after the confirmed refetch has delivered the newer row.
  const [formEpoch, setFormEpoch] = useState(0);
  const operationRef = useRef<'save' | 'reload' | null>(null);
  const [operation, setOperation] = useState<'save' | 'reload' | null>(null);

  function begin(next: 'save' | 'reload') {
    if (operationRef.current) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }

  function finish() {
    operationRef.current = null;
    setOperation(null);
  }

  async function save(input: SettingsUpdateInput, idempotencyKey: string): Promise<AdminSettings> {
    if (!begin('save')) throw new ApiError('OPERATION_PENDING', 'Vui lòng chờ thao tác hiện tại hoàn tất.', 409);
    try {
      await queryClient.cancelQueries({ queryKey: settingsKey, exact: true });
      const saved = await settingsApi.update(input, idempotencyKey);
      queryClient.setQueryData(settingsKey, saved);
      return saved;
    } finally { finish(); }
  }

  async function reloadConfiguration() {
    if (!begin('reload')) return;
    try {
      const result = await settings.refetch();
      // refetch resolves even on error; preserve the draft, lock and old command until a fresh read succeeds.
      if (result.isSuccess) setFormEpoch((value) => value + 1);
    } finally { finish(); }
  }

  return <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>Cài đặt | Quản trị Clothing Shop</title>
    <Button component={Link} to="/admin" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>Cài đặt cửa hàng</Typography>
    {settings.isPending && <Typography role="status">Đang tải cài đặt…</Typography>}
    {settings.isError && <Stack spacing={2} sx={{ mb: 3 }}>
      <Alert severity="error">{settings.error instanceof ApiError ? settings.error.message : 'Chưa tải được cài đặt. Vui lòng thử lại.'}</Alert>
      {!data && <Box><Button variant="outlined" disabled={operation !== null || settings.isFetching}
        onClick={() => { void reloadConfiguration(); }}>Tải lại cài đặt</Button></Box>}
    </Stack>}
    {settings.isFetching && data && <Typography role="status">Đang tải cấu hình mới…</Typography>}
    {data && <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
      <SettingsForm key={formEpoch} snapshot={data} disabled={operation !== null} onSave={save}
        onDiscardReload={() => { void reloadConfiguration(); }} />
    </Paper>}
  </Box>;
}
