import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { VersionDto } from '../../../common/dto/request.dto.js';

// M4.5.8: the only decision the web offers is refusing a waiting request; agreeing is the existing
// "cancel" step. Keeping REJECTED explicit in the body lets the audit read as a decision, and rules
// out silently growing other decisions without their own contract.
export class AdminCancellationDecisionDto extends VersionDto {
  @IsUUID()
  requestId!: string;

  @IsIn(['REJECTED'])
  decision!: 'REJECTED';

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason!: string;
}
