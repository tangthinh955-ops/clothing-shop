import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async sendAuth(to: string, kind: 'verify-email' | 'reset-password', token: string): Promise<void> {
    const title = kind === 'verify-email' ? 'Xác minh email' : 'Đặt lại mật khẩu';
    // Fragment keeps the bearer token out of frontend HTTP access logs/referrers.
    const text = `${title} cho Clothing Shop:\n${this.config.appOrigin}/${kind}#token=${encodeURIComponent(token)}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này.`;
    try {
      await this.deliver(to, title, text);
    } catch {
      // Registration/token commit remains valid; UI offers resend. Do not log mail/token/recipient/provider body.
      this.logger.warn('AUTH_MAIL_DELIVERY_FAILED; resend is available');
    }
  }

  /** Answers whether the provider took the mail; the caller records it, so nothing about the recipient is logged here. */
  async sendOrderNotice(to: string, subject: string, text: string): Promise<boolean> {
    try {
      await this.deliver(to, subject, text);
      return true;
    } catch {
      return false;
    }
  }

  private async deliver(to: string, subject: string, text: string): Promise<void> {
    if (this.config.mailMode === 'preview') {
      const directory = path.resolve(this.config.mailPreviewDir);
      await mkdir(directory, { recursive: true });
      for (const filename of await readdir(directory)) {
        if (!/^mail-[0-9a-f-]+\.json$/.test(filename)) continue;
        const file = path.join(directory, filename);
        try {
          const content: unknown = JSON.parse(await readFile(file, 'utf8'));
          if (content && typeof content === 'object' && 'expiresAt' in content && typeof content.expiresAt === 'number'
            && content.expiresAt < Date.now()) await unlink(file);
        } catch { /* Never remove unrelated or unreadable files. */ }
      }
      await writeFile(path.join(directory, `mail-${randomUUID()}.json`),
        JSON.stringify({ to, subject, text, expiresAt: Date.now() + 3600000 }, null, 2), { flag: 'wx', mode: 0o600 });
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${this.config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.mailFrom, to: [to], subject, text }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('MAIL_PROVIDER_REJECTED');
  }
}
