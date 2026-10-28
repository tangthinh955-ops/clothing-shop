import { Inject, Injectable } from '@nestjs/common';
import { conflict, databaseError } from '../../common/database-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CategoryDto, CategoryUpdateDto } from './dto/category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  listPublic() {
    return this.db.category.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
  }

  listAdmin() {
    return this.db.category.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  async create(dto: CategoryDto) {
    try {
      return await this.db.category.create({ data: dto });
    } catch (error) {
      databaseError(error);
    }
  }

  async update(id: string, dto: CategoryUpdateDto) {
    try {
      const { expectedVersion, ...fields } = dto;
      return await this.db.$transaction(async (tx) => {
        const result = await tx.category.updateMany({
          where: { id, version: expectedVersion },
          data: { ...fields, version: { increment: 1 } },
        });
        if (!result.count) conflict();
        return tx.category.findUniqueOrThrow({ where: { id } });
      });
    } catch (error) {
      databaseError(error);
    }
  }
}
