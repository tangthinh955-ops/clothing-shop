import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { VersionDto } from '../../../common/dto/request.dto.js';

export class AdminOrderCancelDto extends VersionDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason!: string;
}
