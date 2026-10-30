import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { VersionDto } from '../../../common/dto/request.dto.js';
import { trim } from '../../../common/dto/transforms.js';

/**
 * PATCH /admin/settings body (M4.1.2). There is no numeric coercion on purpose: unlike query
 * strings, a JSON body "45000" as a string must fail instead of being silently accepted, and the
 * global ValidationPipe already rejects unknown keys (whitelist + forbidNonWhitelisted).
 */
export class UpdateSettingsDto extends VersionDto {
  @IsInt()
  @Min(0)
  @Max(100000000)
  shippingFeeVnd!: number;

  @IsInt()
  @Min(15)
  @Max(2880)
  bankDeadlineMinutes!: number;

  // Optional blank strings are normalized to null by the service. The "either all four bank fields
  // or none" rule is business logic, so it stays in SettingsService.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  bankName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(?:\d{6})?$/)
  bankBin?: string;

  // A string field on purpose: leading zeros of an account number must survive.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(?:\d{1,32})?$/)
  bankAccountNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  bankAccountName?: string;
}
