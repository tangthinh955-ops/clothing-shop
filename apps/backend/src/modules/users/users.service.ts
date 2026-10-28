import { Inject, Injectable } from '@nestjs/common';
import { identitySelect, safeUser } from '../auth/identity.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProfileDto } from './dto/profile.dto.js';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async updateProfile(userId: string, dto: ProfileDto) {
    const user = await this.db.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: identitySelect,
    });
    return safeUser(user);
  }
}
