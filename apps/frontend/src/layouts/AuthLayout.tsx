import { Box, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { SHOP_NAME, pageTitle } from '../shared/shop';

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.9fr 1fr' }, minHeight: 580, my: { xs: 3, md: 7 } }}>
    <Box sx={{ bgcolor: '#e8e4dc', p: { xs: 4, md: 7 }, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between' }}>
      <Typography variant="overline" sx={{ letterSpacing: '.25em' }}>{SHOP_NAME.toUpperCase()}</Typography>
      <Box><Typography variant="h2" sx={{ lineHeight: 1.12, mb: 3 }}>Mặc thoải mái.<br />Sống theo cách bạn.</Typography>
        <Typography sx={{ maxWidth: 300, color: 'text.secondary' }}>Một nơi lưu lại những lựa chọn dành riêng cho mỗi ngày của bạn.</Typography></Box>
      <Box sx={{ width: 64, borderBottom: '2px solid #181818' }} />
    </Box>
    <Paper square elevation={0} sx={{ p: { xs: 3, sm: 5, md: 7 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <title>{pageTitle(title)}</title>
      <Stack spacing={3.5} sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
        <Box><Typography variant="h4" component="h1" sx={{ mb: 1.5 }}>{title}</Typography>
          <Typography color="text.secondary">{description}</Typography></Box>
        {children}
      </Stack>
    </Paper>
  </Box>;
}
