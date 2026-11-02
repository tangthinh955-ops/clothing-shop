/**
 * The 34 provincial-level units in force since 01/07/2025 (Decision 19/2025/QĐ-TTg), kept in the
 * frontend so checkout never calls an external address service while the shopper types. The order
 * API still stores free text, so old orders and the backend contract are untouched.
 *
 * Source: https://baochinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-3321-don-vi-hanh-chinh-cap-xa-moi-102250704153652947.htm
 */
export interface Province {
  /** Official two-digit code from the decision (01 … 96). */
  code: string;
  name: string;
}

export const PROVINCES: readonly Province[] = [
  { code: '01', name: 'Hà Nội' },
  { code: '04', name: 'Cao Bằng' },
  { code: '08', name: 'Tuyên Quang' },
  { code: '11', name: 'Điện Biên' },
  { code: '12', name: 'Lai Châu' },
  { code: '14', name: 'Sơn La' },
  { code: '15', name: 'Lào Cai' },
  { code: '19', name: 'Thái Nguyên' },
  { code: '20', name: 'Lạng Sơn' },
  { code: '22', name: 'Quảng Ninh' },
  { code: '24', name: 'Bắc Ninh' },
  { code: '25', name: 'Phú Thọ' },
  { code: '31', name: 'Hải Phòng' },
  { code: '33', name: 'Hưng Yên' },
  { code: '37', name: 'Ninh Bình' },
  { code: '38', name: 'Thanh Hóa' },
  { code: '40', name: 'Nghệ An' },
  { code: '42', name: 'Hà Tĩnh' },
  { code: '44', name: 'Quảng Trị' },
  { code: '46', name: 'Huế' },
  { code: '48', name: 'Đà Nẵng' },
  { code: '51', name: 'Quảng Ngãi' },
  { code: '52', name: 'Gia Lai' },
  { code: '56', name: 'Khánh Hòa' },
  { code: '66', name: 'Đắk Lắk' },
  { code: '68', name: 'Lâm Đồng' },
  { code: '75', name: 'Đồng Nai' },
  { code: '79', name: 'TP. Hồ Chí Minh' },
  { code: '80', name: 'Tây Ninh' },
  { code: '82', name: 'Đồng Tháp' },
  { code: '86', name: 'Vĩnh Long' },
  { code: '91', name: 'An Giang' },
  { code: '92', name: 'Cần Thơ' },
  { code: '96', name: 'Cà Mau' },
];

export const PROVINCE_NAMES: readonly string[] = PROVINCES.map((province) => province.name);
const PROVINCE_NAME_SET = new Set(PROVINCE_NAMES);

/** A province is valid only as one of the exact names above; typed search text is not a value. */
export function isProvinceName(value: string): boolean {
  return PROVINCE_NAME_SET.has(value);
}

/** Case- and diacritic-insensitive text used by the province picker: "ho chi minh" finds TP. HCM. */
export function searchableText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
