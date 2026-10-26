import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const email = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;

export class EmailDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(email) @IsEmail({}, { message: 'Email chưa hợp lệ.' }) @MaxLength(254)
  email!: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ format: 'password', writeOnly: true, maxLength: 128 })
  @IsString() @Length(1, 128, { message: 'Vui lòng nhập mật khẩu hợp lệ.' })
  password!: string;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(trim) @IsString() @Length(2, 80, { message: 'Tên cần từ 2 đến 80 ký tự.' })
  name!: string;

  @ApiProperty({ format: 'password', writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString() @MinLength(12, { message: 'Mật khẩu cần ít nhất 12 ký tự.' }) @MaxLength(128)
  password!: string;
}

export class TokenDto {
  @ApiProperty({ minLength: 32, maxLength: 128, writeOnly: true })
  @IsString() @Length(32, 128, { message: 'Liên kết không hợp lệ hoặc đã hết hạn.' })
  token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ format: 'password', writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString() @MinLength(12, { message: 'Mật khẩu cần ít nhất 12 ký tự.' }) @MaxLength(128)
  password!: string;
}
