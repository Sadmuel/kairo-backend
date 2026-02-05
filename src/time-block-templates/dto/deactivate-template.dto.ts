import { IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class DeactivateTemplateDto {
  @IsOptional()
  @IsDateString()
  activeUntil?: string;

  @IsOptional()
  @IsBoolean()
  deleteFutureOccurrences?: boolean;
}
