import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { PageQuery, VersionDto } from '../../../common/dto/request.dto.js';
import { trim } from '../../../common/dto/transforms.js';

export class InventoryQuery extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  q?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;
}

export class AdjustmentDto extends VersionDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  delta!: number;

  @Transform(trim)
  @IsString()
  @Length(3, 300)
  reason!: string;
}
