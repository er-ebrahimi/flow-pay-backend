import { IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', format: 'email' })
  @IsEmail({}, { message: 'email must be an email' })
  email!: string;

  // Bcrypt silently truncates beyond 72 bytes, so reject it at the boundary
  // instead of hashing a truncated credential.
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72)
  @ApiProperty({ minLength: 8, maxLength: 72, writeOnly: true, example: 'hunter2hunter2' })
  password!: string;
}
