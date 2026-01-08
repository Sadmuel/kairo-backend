import { IsString, IsUUID, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTodoDto {
  @ApiProperty({ description: 'Title of the todo' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Deadline for the todo (ISO date string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Day UUID for general day todos (mutually exclusive with timeBlockId)',
  })
  @IsOptional()
  @IsUUID()
  dayId?: string;

  @ApiPropertyOptional({
    description: 'Time block UUID for block-specific todos (mutually exclusive with dayId)',
  })
  @IsOptional()
  @IsUUID()
  timeBlockId?: string;

  @ApiPropertyOptional({
    description: 'Order within context (auto-assigned if not provided)',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
