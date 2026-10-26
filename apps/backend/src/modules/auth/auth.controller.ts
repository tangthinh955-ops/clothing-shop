import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';
import { AuthService } from './auth.service.js';
import { EmailDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './dto/auth.dto.js';
import { safeUser } from './identity.js';
import { destroySession, regenerateSession, saveSession } from './session.types.js';

const accepted = { message: 'Nếu thông tin phù hợp, hướng dẫn sẽ được gửi tới email. Bạn có thể yêu cầu gửi lại nếu chưa nhận được.' };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('csrf')
  async csrf(@Req() req: Request) {
    req.session.csrfToken ??= randomBytes(32).toString('base64url');
    await saveSession(req);
    return { csrfToken: req.session.csrfToken };
  }

  @Post('register') @HttpCode(202) @Throttle({ identity: { limit: 3, ttl: 15 * 60000 } })
  async register(@Body() dto: RegisterDto) { await this.auth.register(dto); return accepted; }

  @Post('login') @HttpCode(200) @Throttle({ identity: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.auth.login(dto);
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.sessionVersion = user.sessionVersion;
    req.session.authenticatedAt = req.session.lastSeenAt = Date.now();
    req.session.csrfToken = randomBytes(32).toString('base64url');
    req.session.cookie.maxAge = user.role === 'ADMIN' ? 30 * 60000 : 86400000;
    await saveSession(req);
    return safeUser(user);
  }

  @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await destroySession(req);
    res.clearCookie(this.config.nodeEnv === 'production' ? '__Host-shop.sid' : 'shop.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: this.config.nodeEnv === 'production' });
  }

  @Post('verify-email') @HttpCode(200)
  async verify(@Body() dto: TokenDto) { await this.auth.verifyEmail(dto.token); return { message: 'Email đã được xác minh.' }; }

  @Post('resend-verification') @HttpCode(202) @Throttle({ identity: { limit: 3, ttl: 15 * 60000 } })
  async resend(@Body() dto: EmailDto) { await this.auth.requestToken(dto.email, 'VERIFY_EMAIL'); return accepted; }

  @Post('forgot-password') @HttpCode(202) @Throttle({ identity: { limit: 3, ttl: 15 * 60000 } })
  async forgot(@Body() dto: EmailDto) { await this.auth.requestToken(dto.email, 'RESET_PASSWORD'); return accepted; }

  @Post('reset-password') @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) { await this.auth.resetPassword(dto); return { message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.' }; }
}
