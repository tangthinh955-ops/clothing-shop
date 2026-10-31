import { SvgIcon, type SvgIconProps } from '@mui/material';

// The store needs only a few line icons, so they are drawn here instead of pulling in @mui/icons-material.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' } as const;

export function MenuIcon(props: SvgIconProps) {
  return <SvgIcon {...props}><path {...stroke} d="M4 7h16M4 12h16M4 17h16" /></SvgIcon>;
}

export function SearchIcon(props: SvgIconProps) {
  return <SvgIcon {...props}><circle {...stroke} cx="11" cy="11" r="6.5" /><path {...stroke} d="m16 16 4.5 4.5" /></SvgIcon>;
}

export function ExpandIcon(props: SvgIconProps) {
  return <SvgIcon {...props}><path {...stroke} d="m6 9 6 6 6-6" /></SvgIcon>;
}

export function CloseIcon(props: SvgIconProps) {
  return <SvgIcon {...props}><path {...stroke} d="M6 6l12 12M18 6 6 18" /></SvgIcon>;
}

export function CartIcon(props: SvgIconProps) {
  return <SvgIcon {...props}>
    <path {...stroke} d="M3.5 4.5h1.8a.8.8 0 0 1 .8.7l.5 2.3m0 0 1.4 7.2a1.4 1.4 0 0 0 1.4 1.1h5.9a1.4 1.4 0 0 0 1.4-1.1l1.2-6.1a.7.7 0 0 0-.7-.9H6.6m3.4 11.2a1.2 1.2 0 1 1-2.4 0m2.4 0a1.2 1.2 0 1 0-2.4 0m7.4 0a1.2 1.2 0 1 1-2.4 0m2.4 0a1.2 1.2 0 1 0-2.4 0" />
  </SvgIcon>;
}
