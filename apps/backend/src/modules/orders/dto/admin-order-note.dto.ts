import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AdminOrderNoteDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  body!: string;
}
