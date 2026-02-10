import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoSeedService } from './demo-seed.service';
import { UserResponseDto } from '../users/dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: jest.Mocked<Partial<UsersService>>;
  let mockJwtService: jest.Mocked<Partial<JwtService>>;
  let mockPrismaService: any;

  let mockDemoSeedService: jest.Mocked<Partial<DemoSeedService>>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    isDemoUser: false,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockUsersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
    };

    mockPrismaService = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockDemoSeedService = {
      seedDemoData: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DemoSeedService,
          useValue: mockDemoSeedService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return UserResponseDto', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockUsersService.create!.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(mockUsersService.create).toHaveBeenCalledWith(registerDto);
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.email).toBe(mockUser.email);
      expect(result.name).toBe(mockUser.name);
      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    beforeEach(() => {
      // Setup transaction mock to execute the callback
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const txMock = {
            refreshToken: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        },
      );
      mockJwtService.signAsync!.mockResolvedValue('access-token');
    });

    it('should login successfully with valid credentials', async () => {
      mockUsersService.findByEmail!.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUsersService.findByEmail!.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockUsersService.findByEmail!.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should still compare password when user does not exist (timing attack prevention)', async () => {
      mockUsersService.findByEmail!.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      // bcrypt.compare should still be called with dummy hash
      expect(bcrypt.compare).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const refreshToken = 'valid-refresh-token';

    it('should refresh tokens with valid refresh token', async () => {
      const storedToken = {
        id: 'token-123',
        token: 'hashed-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        createdAt: new Date(),
        user: mockUser,
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const txMock = {
            refreshToken: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        },
      );
      mockJwtService.signAsync!.mockResolvedValue('new-access-token');

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: storedToken.id },
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = {
        id: 'token-123',
        token: 'hashed-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        createdAt: new Date(),
        user: mockUser,
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(expiredToken);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token expired'),
      );
    });

    it('should throw UnauthorizedException when token already used (race condition)', async () => {
      const storedToken = {
        id: 'token-123',
        token: 'hashed-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: mockUser,
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(storedToken);
      // Simulate race condition - deleteMany returns 0 (already deleted)
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token on logout', async () => {
      const refreshToken = 'valid-refresh-token';
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(refreshToken);

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalled();
    });

    it('should not throw error when token does not exist', async () => {
      const refreshToken = 'non-existent-token';
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.logout(refreshToken)).resolves.not.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should return UserResponseDto for existing user', async () => {
      mockUsersService.findById!.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(mockUser.id);

      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result?.email).toBe(mockUser.email);
    });

    it('should return null for non-existent user', async () => {
      mockUsersService.findById!.mockResolvedValue(null);

      const result = await service.getCurrentUser('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('generateTokens (private method via login)', () => {
    beforeEach(() => {
      mockUsersService.findByEmail!.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync!.mockResolvedValue('access-token');
    });

    it('should clean up expired tokens during generation', async () => {
      const txMock = {
        refreshToken: {
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          return callback(txMock);
        },
      );

      await service.login({ email: mockUser.email, password: 'password123' });

      // First deleteMany call is for expired tokens
      expect(txMock.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            expiresAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should delete oldest tokens when at max limit', async () => {
      const existingTokens = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `token-${i}`,
          createdAt: new Date(Date.now() - i * 1000),
        }));

      const txMock = {
        refreshToken: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue(existingTokens),
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          return callback(txMock);
        },
      );

      await service.login({ email: mockUser.email, password: 'password123' });

      // Should call deleteMany to remove oldest tokens
      expect(txMock.refreshToken.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('should create new refresh token', async () => {
      const txMock = {
        refreshToken: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          return callback(txMock);
        },
      );

      await service.login({ email: mockUser.email, password: 'password123' });

      expect(txMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: expect.any(String),
            userId: mockUser.id,
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
