import { IsString, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  content: string;

  @IsUUID()
  timeBlockId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
