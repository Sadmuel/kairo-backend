import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'Password (8-128 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
