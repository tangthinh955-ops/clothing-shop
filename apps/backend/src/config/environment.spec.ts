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
    expect(readEnvironment({ ...valid, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
  });
  it('rejects origin paths and invalid port values', () => {
    expect(() => readEnvironment({ ...valid, APP_ORIGIN: 'http://localhost:5173/other' })).toThrow('APP_ORIGIN');
    expect(() => readEnvironment({ ...valid, PORT: '3.5' })).toThrow('PORT');
  });
});
