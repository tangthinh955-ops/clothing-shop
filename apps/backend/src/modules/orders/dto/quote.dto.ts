import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class QuoteItemDto {
  // Ids are normalized to lowercase so merging and the snapshot stay stable across clients.
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CheckoutQuoteDto {
  // The raw bound (100 rows before merging) matches the cart resolver so oversized junk never
  // reaches queries; the normalized limits (1..50 lines, ≤99 per variant after merging) live in the service.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];

  // M4.2.2 quotes COD only; a BANK request is refused explicitly instead of being coerced.
  @IsIn(['COD'], { message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).' })
  method!: 'COD';
}
