import { createTheme } from '@mui/material/styles';

const ink = '#111111';
const line = '#e5e5e5';

export const theme = createTheme({
  palette: {
    primary: { main: ink },
    // Accent kept for small highlights (e.g. a "Mới" label); everything else stays black and white.
    secondary: { main: '#b42318' },
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: ink, secondary: '#5c5c5c' },
    divider: line,
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: '"Be Vietnam Pro", Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 700, fontSize: 'clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem)', letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, fontSize: 'clamp(1.5rem, 1.3rem + 0.8vw, 2rem)', letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    body1: { lineHeight: 1.65 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44, paddingInline: 24 } },
    },
    MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined' } },
    MuiLink: { defaultProps: { color: 'inherit', underline: 'hover' } },
    // Flat panels used to stand out against the old beige page; on white they need a hairline instead.
    MuiPaper: { variants: [{ props: { elevation: 0, variant: 'elevation' }, style: { border: `1px solid ${line}` } }] },
  },
});
