import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { VersionDto } from '../../../common/dto/request.dto.js';

export class AdminOrderShipDto extends VersionDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,100}$/)
  trackingNumber!: string;
}
