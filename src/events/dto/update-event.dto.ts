import { IsString, IsOptional, IsBoolean, IsEnum, Matches, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceType } from '@prisma/client';

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'Updated color (null to remove)',
    example: '#A5D8FF',
  })
  @IsOptional()
  @ValidateIf((o) => o.color !== null)
  @IsString()
  color?: string | null;

  @ApiPropertyOptional({ description: 'Whether the event recurs' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Type of recurrence',
    enum: RecurrenceType,
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;
}
