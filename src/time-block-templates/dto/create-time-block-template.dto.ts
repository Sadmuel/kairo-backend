import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTemplateNoteDto } from './create-template-note.dto';

export class CreateTimeBlockTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g., #A5D8FF)',
  })
  color?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateNoteDto)
  notes?: CreateTemplateNoteDto[];
}
