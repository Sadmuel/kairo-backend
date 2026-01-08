import { IsString, IsOptional, IsBoolean, IsEnum, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceType } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ description: 'Event title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Event date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @ApiPropertyOptional({
    description: 'Event color for display',
    example: '#A5D8FF',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Whether the event recurs',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Type of recurrence',
    enum: RecurrenceType,
    default: RecurrenceType.NONE,
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;
}
