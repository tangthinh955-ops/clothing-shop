import { Accordion, AccordionDetails, AccordionSummary, Box, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { policyPages } from '../../information/content/policies';
import { ExpandIcon } from '../../../shared/ui/icons';

// Read from the published policies so the product page never drifts from them.
const FOLDED_POLICIES = ['shipping', 'returns-policy'];

export function ProductPolicies() {
  const policies = policyPages.filter((policy) => FOLDED_POLICIES.includes(policy.path));
  return <Box>
    {policies.map((policy) => <Accordion key={policy.path} disableGutters square elevation={0}
      sx={{ border: 0, borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandIcon />} sx={{ px: 0, fontWeight: 600 }}>{policy.title}</AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        {policy.sections.map((section) => <Box key={section.heading} sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{section.heading}</Typography>
          {section.paragraphs.map((paragraph) => <Typography key={paragraph} variant="body2" color="text.secondary">
            {paragraph}
          </Typography>)}
        </Box>)}
        <Link component={RouterLink} to={`/${policy.path}`} variant="body2" underline="always">
          Xem chính sách {policy.title}
        </Link>
      </AccordionDetails>
    </Accordion>)}
  </Box>;
}
