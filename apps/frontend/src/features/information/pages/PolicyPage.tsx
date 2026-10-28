import { Box, Typography } from '@mui/material';
import type { PolicyContent } from '../content/policies';

export function PolicyPage({ policy }: { policy: PolicyContent }) {
  return <Box sx={{ maxWidth: 720, py: 7 }}>
    <title>{policy.title} | Clothing Shop</title>
    <Typography variant="h3" component="h1" sx={{ mb: 3 }}>{policy.title}</Typography>
    <Typography>{policy.text}</Typography>
  </Box>;
}
