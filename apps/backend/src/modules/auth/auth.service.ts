import { BadRequestException, Inject, Injectable, UnauthorizedException, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import type { TokenKind } from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import type { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto.js';
import { identitySelect, type UserIdentity } from './identity.js';

export const hashPassword = (password: string): Promise<string> => argon2.hash(password,
  { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(MailService) private readonly mail: MailService) {}
  async onModuleInit(): Promise<void> { this.dummyHash = await hashPassword(randomBytes(32).toString('hex')); }

  async register(dto: RegisterDto): Promise<void> {
    const passwordHash = await hashPassword(dto.password);
    const raw = randomBytes(32).toString('base64url');
    try {
      await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email: dto.email, name: dto.name, passwordHash }, select: { id: true } });
        await this.addToken(tx, user.id, 'VERIFY_EMAIL', raw);
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    this.deliver(dto.email, 'verify-email', raw);
  }

  async login(dto: LoginDto): Promise<UserIdentity> {
    const user = await this.db.user.findUnique({ where: { email: dto.email }, select: { ...identitySelect, passwordHash: true } });
    const correct = await argon2.verify(user?.passwordHash ?? this.dummyHash, dto.password);
    if (!user || !correct || user.disabledAt) throw this.badLogin();
    const fresh = await this.db.user.findUnique({ where: { id: user.id }, select: { ...identitySelect, passwordHash: true } });
    if (!fresh || fresh.disabledAt || fresh.passwordHash !== user.passwordHash) throw this.badLogin();
    return fresh;
  }

  async requestToken(email: string, kind: TokenKind): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email }, select: identitySelect });
    if (!user || user.disabledAt || kind === 'VERIFY_EMAIL' && user.emailVerifiedAt) return;
    const raw = randomBytes(32).toString('base64url');
    await this.db.$transaction(async (tx) => {
      await tx.authToken.updateMany({ where: { userId: user.id, kind, usedAt: null }, data: { usedAt: new Date() } });
      await this.addToken(tx, user.id, kind, raw);
    });
    this.deliver(email, kind === 'VERIFY_EMAIL' ? 'verify-email' : 'reset-password', raw);
  }

  // Not awaited: response time must not reveal whether the email belongs to an account.
  // MailService logs its own failures; the user can request the link again.
  private deliver(email: string, kind: 'verify-email' | 'reset-password', raw: string): void {
    this.mail.sendAuth(email, kind, raw).catch(() => undefined);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const row = await this.consume(tx, token, 'VERIFY_EMAIL');
      await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const candidate = await this.db.authToken.findUnique({ where: { tokenHash: tokenHash(dto.token) }, select: { id: true } });
    if (!candidate) throw this.badToken();
    const passwordHash = await hashPassword(dto.password);
    await this.db.$transaction(async (tx) => {
      const row = await this.consume(tx, dto.token, 'RESET_PASSWORD');
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      await tx.authToken.updateMany({ where: { userId: row.userId, kind: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } });
      await tx.session.deleteMany({ where: { sess: { path: ['userId'], equals: row.userId } } });
    });
  }

  private async addToken(tx: Prisma.TransactionClient, userId: string, kind: TokenKind, raw: string): Promise<void> {
    await tx.authToken.create({ data: { userId, kind, tokenHash: tokenHash(raw),
      expiresAt: new Date(Date.now() + (kind === 'VERIFY_EMAIL' ? 86400000 : 30 * 60000)) } });
  }
  private async consume(tx: Prisma.TransactionClient, raw: string, kind: TokenKind) {
    const row = await tx.authToken.findUnique({ where: { tokenHash: tokenHash(raw) }, include: { user: { select: { disabledAt: true } } } });
    if (!row || row.kind !== kind || row.usedAt || row.expiresAt <= new Date() || row.user.disabledAt) throw this.badToken();
    const changed = await tx.authToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (changed.count !== 1) throw this.badToken();
    return row;
  }
  private badLogin(): UnauthorizedException {
    return new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu chưa đúng.' });
  }
  private badToken(): BadRequestException {
    return new BadRequestException({ code: 'INVALID_TOKEN', message: 'Liên kết không hợp lệ hoặc đã hết hạn.' });
  }
}
