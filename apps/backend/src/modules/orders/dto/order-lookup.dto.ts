import { Transform } from 'class-transformer';
import { IsString, Length, Matches, Validate, ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { INVALID_CODE_SHAPE } from '../order-access.service.js';
import { normalizeVietnamesePhone } from '../order-command.js';

/** The one code shape rule, shared with the access path: bounded length, no control characters.
 * Rejected at validation time (400) so impossible codes never reach PostgreSQL. */
@ValidatorConstraint({ name: 'orderCodeShape' })
class OrderCodeShape implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && !INVALID_CODE_SHAPE(value);
  }
  defaultMessage(): string {
    return 'Mã đơn chưa hợp lệ.';
  }
}

export class OrderLookupDto {
  // Trimmed and uppercased: stored codes come from the uppercase generateOrderCode alphabet, so a
  // lowercase keystroke still finds the order without loosening the database match.
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Length(1, 24)
  @Validate(OrderCodeShape)
  code!: string;

  // Normalized once here so the service compares the same stored 0-prefixed form as creation,
  // snapshot and quota (m4-contract §8) — no second phone rule.
  @Transform(({ value }: { value: unknown }) => normalizeVietnamesePhone(value) ?? value)
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại Việt Nam chưa hợp lệ.' })
  phone!: string;
}
