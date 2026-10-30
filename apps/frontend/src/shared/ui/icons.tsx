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
