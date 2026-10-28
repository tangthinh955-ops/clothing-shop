import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ImageFile { buffer: Buffer; mimetype: string }
const invalid = () => new UnsupportedMediaTypeException({ code: 'UNSUPPORTED_IMAGE', message: 'Chỉ nhận JPEG, PNG, WebP tĩnh, mỗi chiều 64–8000 và tối đa 16 triệu pixel.' });
@Injectable()
export class UploadsService {
  private readonly root: string;
  private readonly logger = new Logger(UploadsService.name);
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.root = path.resolve(config.nodeEnv === 'test' ? '../../.local/test-uploads' : '../../.local/uploads');
  }
  private file(key: string) {
    if (!/^[0-9a-f-]{36}\.webp$/.test(key)) throw new NotFoundException();
    return path.join(this.root, key);
  }
  async cleanup() {
    const before = new Date(Date.now() - 86400000);
    const rows = await this.db.uploadAsset.findMany({ where: { createdAt: { lt: before }, image: { is: null } }, take: 20, orderBy: { createdAt: 'asc' } });
    for (const row of rows) {
      try {
        const deleted = await this.db.uploadAsset.deleteMany({ where: { id: row.id, createdAt: { lt: before }, image: { is: null } } });
        if (deleted.count) await unlink(this.file(row.storageKey)).catch(() => undefined);
      } catch { this.logger.warn('LOCAL_UPLOAD_CLEANUP_DEFERRED'); }
    }
  }
  async upload(ownerId: string, file: ImageFile | undefined) {
    if (this.config.nodeEnv === 'production') throw new ServiceUnavailableException({ code: 'UPLOAD_NOT_CONFIGURED', message: 'Chưa cấu hình lưu ảnh cho môi trường deploy.' });
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw invalid();
    // Decode and rewrite, rather than trusting the extension or client MIME. No SVG and no metadata passthrough.
    let data: Buffer; let width: number; let height: number;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 16000000, failOn: 'warning' });
      const meta = await image.metadata();
      if (!meta.width || !meta.height || meta.width < 64 || meta.height < 64 || meta.width > 8000 || meta.height > 8000
        || (meta.pages ?? 1) !== 1 || !['jpeg', 'png', 'webp'].includes(meta.format ?? '')
        || file.mimetype !== `image/${meta.format}`) throw invalid();
      const result = await image.rotate().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
      data = result.data; width = result.info.width; height = result.info.height;
    } catch { throw invalid(); }
    const id = randomUUID(); const storageKey = `${id}.webp`;
    await mkdir(this.root, { recursive: true });
    await writeFile(this.file(storageKey), data, { flag: 'wx', mode: 0o600 });
    try { await this.db.uploadAsset.create({ data: { id, ownerId, storageKey, width, height } }); }
    catch (error) { await unlink(this.file(storageKey)).catch(() => undefined); throw error; }
    await this.cleanup();
    return { id, width, height, url: `/api/v1/admin/uploads/images/${id}` };
  }
  async read(id: string, actorId?: string) {
    const row = await this.db.uploadAsset.findUnique({ where: { id }, include: { image: { include: { product: { include: { category: true } } } } } });
    const publicImage = row?.image?.product.status === 'PUBLISHED' && row.image.product.category.active;
    if (!row || (actorId ? row.ownerId !== actorId && !row.image : !publicImage)) throw new NotFoundException();
    try { return await readFile(this.file(row.storageKey)); } catch { throw new NotFoundException(); }
  }
}
