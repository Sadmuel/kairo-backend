import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { UserResponseDto } from 'src/users/dto';
import { RegisterDto, LoginDto, AuthResponseDto } from 'src/auth/dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_REFRESH_TOKENS_PER_USER = 5;

/**
 * Hash a refresh token using SHA-256.
 * We use SHA-256 instead of bcrypt because:
 * 1. Refresh tokens are already cryptographically random (high entropy)
 * 2. SHA-256 is fast, which is important for token validation on every request
 * 3. The goal is to prevent token use if DB is compromised, not resist brute force
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Pre-computed bcrypt hash for timing attack prevention
// This ensures bcrypt.compare always runs, even when the user doesn't exist
const DUMMY_PASSWORD_HASH = '$2b$10$bDXCh/qqXVqqXNoP33l0heeQpmJkZjUeMxFxeSIr96UPW6bHomIcW';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(registerDto);
    return UserResponseDto.fromUser(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    // Always compare password to prevent timing attacks
    // If user doesn't exist, compare against dummy hash to maintain consistent timing
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(loginDto.password, passwordHash);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      ...tokens,
      user: UserResponseDto.fromUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const tokenHash = hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.deleteMany({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Delete old refresh token (rotation) - use deleteMany to handle race conditions
    const deleted = await this.prisma.refreshToken.deleteMany({ where: { id: storedToken.id } });

    // If token was already deleted by another request, reject this one
    if (deleted.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(storedToken.user.id, storedToken.user.email);

    return {
      ...tokens,
      user: UserResponseDto.fromUser(storedToken.user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: { token: tokenHash },
    });
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto | null> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }
    return UserResponseDto.fromUser(user);
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Use transaction to clean up and create token atomically
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete expired tokens for this user
      await tx.refreshToken.deleteMany({
        where: {
          userId,
          expiresAt: { lt: new Date() },
        },
      });

      // 2. Count active tokens and remove oldest if at limit
      const activeTokens = await tx.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (activeTokens.length >= MAX_REFRESH_TOKENS_PER_USER) {
        // Delete oldest tokens to make room (keep MAX - 1 to allow new one)
        const tokensToDelete = activeTokens.slice(
          0,
          activeTokens.length - MAX_REFRESH_TOKENS_PER_USER + 1,
        );
        await tx.refreshToken.deleteMany({
          where: {
            id: { in: tokensToDelete.map((t) => t.id) },
          },
        });
      }

      // 3. Create new refresh token (store hash, not raw token)
      await tx.refreshToken.create({
        data: {
          token: tokenHash,
          userId,
          expiresAt,
        },
      });
    });

    // Return raw token to client (they need it for future requests)
    return { accessToken, refreshToken };
  }
}
