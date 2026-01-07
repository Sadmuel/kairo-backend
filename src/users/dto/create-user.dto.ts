import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254) // RFC 5321 email limit
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128) // Prevent bcrypt DoS with very long passwords
  password: string;

  @IsString()
  @Transform(({ value }) => value?.trim())
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
