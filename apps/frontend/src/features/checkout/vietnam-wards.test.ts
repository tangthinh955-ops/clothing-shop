import { describe, expect, it } from 'vitest';
import { PROVINCES } from './vietnam-provinces';
import {
  isWardOfProvince,
  WARD_ROWS_BY_PROVINCE,
  wardNamesForProvince,
  wardsForProvince,
  type WardType,
} from './vietnam-wards';

const WARD_TYPES: readonly WardType[] = ['phường', 'xã', 'đặc khu'];
const allRows = Object.values(WARD_ROWS_BY_PROVINCE).flat();

describe('vietnam-wards', () => {
  it('covers every current province with the full official ward list', () => {
    expect(Object.keys(WARD_ROWS_BY_PROVINCE).sort()).toEqual(PROVINCES.map((province) => province.code).sort());
    expect(allRows).toHaveLength(3321);
    expect(new Set(allRows.map(([code]) => code)).size).toBe(3321);
    for (const province of PROVINCES) {
      expect(wardsForProvince(province.name).length).toBeGreaterThan(0);
    }
    expect(wardsForProvince('TP. Hồ Chí Minh')).toHaveLength(168);
    expect(wardsForProvince('Cần Thơ')).toHaveLength(103);
  });

  it('keeps the official split of phường, xã and đặc khu', () => {
    const counts = Object.fromEntries(WARD_TYPES.map((type) => [type, allRows.filter(([, , rowType]) => rowType === type).length]));
    expect(counts).toEqual({ 'phường': 687, 'xã': 2621, 'đặc khu': 13 });
    for (const [, name, type] of allRows) {
      expect(name.trim().length).toBeGreaterThanOrEqual(2);
      expect(name.trim().length).toBeLessThanOrEqual(100);
      expect(WARD_TYPES).toContain(type);
    }
  });

  it('maps a committed province to only its own wards, including the current names', () => {
    const hcmWards = wardNamesForProvince('TP. Hồ Chí Minh');
    expect(hcmWards).toContain('Phường Bến Thành');
    expect(hcmWards).not.toContain('Phường Bến Nghé'); // merged in the 2025 rearrangement
    expect(isWardOfProvince('TP. Hồ Chí Minh', 'Phường Bến Thành')).toBe(true);
    expect(isWardOfProvince('Cần Thơ', 'Phường Ninh Kiều')).toBe(true);
    expect(isWardOfProvince('Hà Nội', 'Phường Ninh Kiều')).toBe(false);
    expect(isWardOfProvince('Không tồn tại', 'Phường Bến Thành')).toBe(false);
    expect(wardNamesForProvince('Không tồn tại')).toEqual([]);
  });
});
