import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CreateTemplateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsInt()
  @Min(0)
  order: number;
}
