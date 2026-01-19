import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'securePassword123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
