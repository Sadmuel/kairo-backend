import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254) // RFC 5321 email limit
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128) // Prevent bcrypt DoS with very long passwords
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
