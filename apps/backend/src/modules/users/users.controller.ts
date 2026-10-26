import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service.js';
import { identitySelect, safeUser, type UserIdentity } from '../auth/identity.js';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';

class ProfileDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 80, { message: 'Tên cần từ 2 đến 80 ký tự.' })
  name!: string;
}

@ApiTags('account')
@UseGuards(SessionGuard)
@Controller('me')
export class UsersController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  @Get() me(@CurrentUser() user: UserIdentity) { return safeUser(user); }
  @Patch() async update(@CurrentUser() user: UserIdentity, @Body() dto: ProfileDto) {
    return safeUser(await this.db.user.update({ where: { id: user.id }, data: { name: dto.name }, select: identitySelect }));
  }
}

@ApiTags('admin')
@UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN')
@Controller('admin/access')
export class AdminAccessController {
  @Get() access() { return { allowed: true }; }
}
