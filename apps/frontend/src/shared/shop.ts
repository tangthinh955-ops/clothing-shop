// Seller details shown to shoppers. Moves to the shop settings (M4.1) once admins can edit it;
// until then a missing phone/email is left out rather than shown as a placeholder.
export interface SellerInfo {
  name: string;
  owner: string;
  city: string;
  instagram: { handle: string; url: string };
  phone: string | null;
  email: string | null;
}

export const SHOP_NAME = 'RMG Labels';

export const seller: SellerInfo = {
  name: SHOP_NAME,
  owner: 'Cá nhân kinh doanh',
  city: 'TP. Hồ Chí Minh',
  instagram: { handle: 'rmglabels', url: 'https://www.instagram.com/rmglabels/' },
  phone: null,
  email: null,
};

export function pageTitle(page: string) {
  return `${page} | ${SHOP_NAME}`;
}
