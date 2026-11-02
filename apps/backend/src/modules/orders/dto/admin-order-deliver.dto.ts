import { IsISO8601, IsString, Matches } from 'class-validator';
import { VersionDto } from '../../../common/dto/request.dto.js';

export class AdminOrderDeliverDto extends VersionDto {
  @IsString()
  @IsISO8601({ strict: true })
  // Without an offset the same text would mean a different instant depending on the server's timezone.
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  deliveredAt!: string;
}
