import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: { primary: { main: '#171717' }, background: { default: '#f5f4f0', paper: '#ffffff' }, text: { primary: '#171717', secondary: '#57534e' } },
  shape: { borderRadius: 2 },
  typography: { fontFamily: 'Arial, sans-serif', h1: { fontWeight: 400 }, h3: { fontFamily: 'Georgia, serif', fontWeight: 400 },
    h4: { fontFamily: 'Georgia, serif', fontWeight: 400 }, body1: { lineHeight: 1.65 }, button: { textTransform: 'none', fontWeight: 500 } },
  components: { MuiButton: { styleOverrides: { root: { minHeight: 44, boxShadow: 'none', paddingInline: 24 } } },
    MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined' } }, MuiLink: { defaultProps: { color: 'inherit', underline: 'hover' } } },
});
