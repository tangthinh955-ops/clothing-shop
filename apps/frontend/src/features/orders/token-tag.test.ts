import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './token-tag';

// The cache tag on the guest order page must be genuinely SHA-256: pinned official vectors pin the
// exact algorithm, and a differential sweep against the system SHA-256 across token-size and block
// boundary lengths pins every padding/len path (55→64, 56→128, 63/64/65). Fixtures are deterministic.

const officialVectors: ReadonlyArray<readonly [string, string]> = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
];

const systemDigest = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');

describe('sha256Hex', () => {
  it('matches the official NIST FIPS 180-4 test vectors', () => {
    for (const [input, digest] of officialVectors) expect(sha256Hex(input)).toBe(digest);
  });

  it('agrees with the system SHA-256 across token sizes, block boundaries and UTF-8', () => {
    const inputs = ['A'.repeat(32), ''.padEnd(32, 'f'), 'tiếng Việt trong nhãn thử — Áo xem chi tiết',
      'a'.repeat(54), 'b'.repeat(55), 'c'.repeat(56), 'd'.repeat(63), 'e'.repeat(64), 'f'.repeat(65)];
    for (let index = 0; index < 8; index += 1) {
      const token = randomUUID().replace(/-/g, '').slice(0, 32);
      const suffix = index % 2 === 0 ? '' : 'Ü';
      inputs.push(`${token}${suffix}`);
    }
    for (const input of inputs) expect(sha256Hex(input)).toBe(systemDigest(input));
  });
});
