import { Box, Link, Stack, Typography } from '@mui/material';
import { pageTitle, seller } from '../../../shared/shop';
import type { PolicyContent } from '../content/policies';

export function PolicyPage({ policy }: { policy: PolicyContent }) {
  return <Box sx={{ maxWidth: 720, py: 7 }}>
    <title>{pageTitle(policy.title)}</title>
    <Typography variant="h3" component="h1" sx={{ mb: 3 }}>{policy.title}</Typography>
    <Stack spacing={3}>
      {policy.sections.map((section) => <Box component="section" key={section.heading}>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>{section.heading}</Typography>
        {section.paragraphs.map((paragraph) => <Typography key={paragraph} sx={{ mb: 0.75 }}>{paragraph}</Typography>)}
      </Box>)}
      {policy.path === 'contact' && <Link href={seller.instagram.url} target="_blank" rel="noopener noreferrer">
        Instagram @{seller.instagram.handle}
      </Link>}
    </Stack>
  </Box>;
}
