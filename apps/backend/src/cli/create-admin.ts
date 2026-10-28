import 'reflect-metadata';
import { readEnvironment } from '../config/environment.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { hashPassword } from '../modules/auth/auth.service.js';

const email = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
const password = process.env['ADMIN_PASSWORD'];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 128) {
  console.error('Provide ADMIN_EMAIL and a private ADMIN_PASSWORD (12–128 chars) via environment; no default administrator exists.');
  process.exitCode = 1;
} else {
  const db = new PrismaService(readEnvironment(process.env));
  try {
    await db.user.create({ data: { email, passwordHash: await hashPassword(password), name: 'Quản trị viên', role: 'ADMIN', emailVerifiedAt: new Date() } });
    console.log('Administrator created. Remove ADMIN_PASSWORD from the environment.');
  } catch { console.error('Administrator was not created. Existing accounts are never promoted or overwritten by this command.'); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}
