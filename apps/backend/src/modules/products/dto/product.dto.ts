import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { PageQuery, VersionDto } from '../../../common/dto/request.dto.js';
import { lower, trim } from '../../../common/dto/transforms.js';

export class ProductQuery extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  q?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['newest', 'price-asc', 'price-desc'])
  sort: 'newest' | 'price-asc' | 'price-desc' = 'newest';
}

export class AdminProductQuery extends ProductQuery {
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'HIDDEN'])
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
}

export class VariantDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/)
  sku!: string;

  @IsIn(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'FREESIZE'])
  size!: string;

  @Transform(lower)
  @IsString()
  @Length(1, 40)
  color!: string;

  @IsInt()
  @Min(1)
  @Max(100000000)
  price!: number;

  @IsBoolean()
  active!: boolean;
}

export class ProductDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(lower)
  @IsString()
  @Length(1, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Transform(trim)
  @IsString()
  @Length(0, 5000)
  description!: string;

  @IsUUID()
  categoryId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];
}

export class ProductUpdateDto extends ProductDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class ImagesDto extends VersionDto {
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  assetIds!: string[];
}
