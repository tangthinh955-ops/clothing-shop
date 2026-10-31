import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

/** One guest cart row: a variant UUID and an integer quantity 1..99. */
export class CartItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CartResolveDto {
  // The raw payload bound (100 rows before merging) keeps oversized junk from reaching queries;
  // the normalized limits (50 lines, 99 per variant after merging) are enforced by the service.
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
