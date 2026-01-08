import { IsString, IsOptional, IsBoolean, IsDateString, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTodoDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Completion status' })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Updated deadline (ISO date string, or null to remove)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @ValidateIf((o) => o.deadline !== null && o.deadline !== undefined)
  @IsDateString()
  deadline?: string | null;
}
