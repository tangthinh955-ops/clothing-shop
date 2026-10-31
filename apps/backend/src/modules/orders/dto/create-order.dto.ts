import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { normalizeVietnamesePhone } from '../order-command.js';

export class OrderItemDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class ContactDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 120)
  name!: string;

  // Normalized once here so the service, the hash and the quota all see the same stored form.
  @Transform(({ value }: { value: unknown }) => normalizeVietnamesePhone(value) ?? value)
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại Việt Nam chưa hợp lệ.' })
  phone!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(0, 254)
  email?: string;
}

export class AddressDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 100)
  province!: string;

  // Optional district: absent/blank becomes '' (the column is NOT NULL by schema).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : '')
  @IsString()
  @Length(0, 100)
  district?: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 100)
  ward!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(5, 255)
  addressLine!: string;
}

export class CreateOrderDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsUUID()
  quoteId!: string;

  // The raw bound (100 rows) matches the quote and cart resolver; merging happens in the service.
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  // IsDefined makes a missing/null contact or address a 400 field error before the service runs —
  // ValidateNested alone lets undefined through and the command canonicalizer would crash with a 500.
  @IsDefined()
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : '')
  @IsString()
  @Length(0, 500)
  note?: string;

  // COD only in M4.3; BANK must be refused explicitly, never coerced.
  @IsIn(['COD'], { message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).' })
  method!: 'COD';
}
