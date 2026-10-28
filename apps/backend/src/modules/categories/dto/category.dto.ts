import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Length, Matches, Min } from 'class-validator';
import { lower, trim } from '../../../common/dto/transforms.js';

export class CategoryDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name!: string;

  @Transform(lower)
  @IsString()
  @Length(1, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsBoolean()
  active!: boolean;
}

export class CategoryUpdateDto extends CategoryDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
