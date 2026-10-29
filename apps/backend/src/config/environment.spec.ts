import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readEnvironment } from './environment.js';

const valid = {
  NODE_ENV: 'development', PORT: '3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5433/clothing_local',
  APP_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 'a'.repeat(48),
  MAIL_MODE: 'preview', MAIL_PREVIEW_DIR: '../../.local/mailbox',
};

describe('startup environment', () => {
  it('rejects missing database before the app starts', () => {
    expect(() => readEnvironment({ ...valid, DATABASE_URL: '' })).toThrow('DATABASE_URL');
  });
  it('rejects sample or short session secrets', () => {
    expect(() => readEnvironment({ ...valid, SESSION_SECRET: 'REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES' })).toThrow('SESSION_SECRET');
    expect(() => readEnvironment({ ...valid, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET');
  });
  it('rejects preview email and HTTP origin in production', () => {
    expect(() => readEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow();
    expect(() => readEnvironment({ ...valid, NODE_ENV: 'production', APP_ORIGIN: 'https://shop.example', MAIL_MODE: 'preview' })).toThrow('MAIL_MODE');
  });
  it('requires a complete sender configuration for real mail', () => {
    expect(() => readEnvironment({ ...valid, MAIL_MODE: 'resend' })).toThrow('RESEND_API_KEY');
  });
  it('does not treat the string false as an enabled proxy', () => {
    expect(readEnvironment({ ...valid, TRUST_PROXY: 'false' }).trustProxyHops).toBe(0);
  });
  it('reads the proxy hop count so client IPs and secure cookies work behind the VPS reverse proxy', () => {
    expect(readEnvironment(valid).trustProxyHops).toBe(0);
    expect(readEnvironment({ ...valid, TRUST_PROXY: 'true' }).trustProxyHops).toBe(1);
    expect(readEnvironment({ ...valid, TRUST_PROXY: '2' }).trustProxyHops).toBe(2);
    expect(() => readEnvironment({ ...valid, TRUST_PROXY: 'yes' })).toThrow('TRUST_PROXY');
    expect(() => readEnvironment({ ...valid, TRUST_PROXY: '9' })).toThrow('TRUST_PROXY');
  });
  it('listens on loopback by default and accepts a configured host', () => {
    expect(readEnvironment(valid).host).toBe('127.0.0.1');
    expect(readEnvironment({ ...valid, HOST: '0.0.0.0' }).host).toBe('0.0.0.0');
    expect(() => readEnvironment({ ...valid, HOST: 'bad host' })).toThrow('HOST');
  });
  it('keeps local uploads under the repo .local folder regardless of the working directory', () => {
    const repoUploads = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.local');
    expect(readEnvironment(valid).uploadsDir).toBe(path.join(repoUploads, 'uploads'));
    expect(readEnvironment({ ...valid, NODE_ENV: 'test' }).uploadsDir).toBe(path.join(repoUploads, 'test-uploads'));
    expect(() => readEnvironment({ ...valid, UPLOADS_DIR: 'relative/uploads' })).toThrow('UPLOADS_DIR');
  });
  it('requires a trusted proxy and an absolute uploads folder in production', () => {
    const production = { ...valid, NODE_ENV: 'production', APP_ORIGIN: 'https://shop.example', MAIL_MODE: 'resend',
      RESEND_API_KEY: 're_test_key', MAIL_FROM: 'shop@shop.example', TRUST_PROXY: '1', UPLOADS_DIR: path.resolve('/srv/shop/uploads') };
    expect(readEnvironment(production)).toMatchObject({ trustProxyHops: 1, uploadsDir: path.resolve('/srv/shop/uploads') });
    expect(() => readEnvironment({ ...production, TRUST_PROXY: 'false' })).toThrow('TRUST_PROXY');
    expect(() => readEnvironment({ ...production, UPLOADS_DIR: '' })).toThrow('UPLOADS_DIR');
  });
  it('rejects origin paths and invalid port values', () => {
    expect(() => readEnvironment({ ...valid, APP_ORIGIN: 'http://localhost:5173/other' })).toThrow('APP_ORIGIN');
    expect(() => readEnvironment({ ...valid, PORT: '3.5' })).toThrow('PORT');
  });
});
