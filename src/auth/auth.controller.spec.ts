import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { RegisterDto, LoginDto, RefreshTokenDto, AuthResponseDto } from './dto';
import { UserResponseDto } from 'src/users/dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserResponse: UserResponseDto = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    isDemoUser: false,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAuthResponse: AuthResponseDto = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUserResponse,
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 0, limit: 0 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should register a new user and return user data', async () => {
      const expectedResponse: UserResponseDto = {
        ...mockUserResponse,
        email: registerDto.email,
        name: registerDto.name,
      };
      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from authService.register', async () => {
      const error = new Error('Email already exists');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user and return tokens with user data', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user).toEqual(mockUserResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refresh', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh tokens and return new tokens with user data', async () => {
      const newAuthResponse: AuthResponseDto = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockUserResponse,
      };
      mockAuthService.refresh.mockResolvedValue(newAuthResponse);

      const result = await controller.refresh(refreshTokenDto);

      expect(result).toEqual(newAuthResponse);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(authService.refresh).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(authService.refresh).toHaveBeenCalledTimes(1);
    });

    it('should propagate UnauthorizedException for invalid refresh token', async () => {
      const error = new Error('Invalid refresh token');
      mockAuthService.refresh.mockRejectedValue(error);

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(error);
      expect(authService.refresh).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });

    it('should propagate UnauthorizedException for expired refresh token', async () => {
      const error = new Error('Refresh token expired');
      mockAuthService.refresh.mockRejectedValue(error);

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(error);
      expect(authService.refresh).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });
  });

  describe('logout', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should logout user by invalidating refresh token', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(refreshTokenDto);

      expect(result).toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('should handle logout gracefully even with invalid token', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const invalidTokenDto: RefreshTokenDto = {
        refreshToken: 'invalid-token',
      };

      const result = await controller.logout(invalidTokenDto);

      expect(result).toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith(invalidTokenDto.refreshToken);
    });

    it('should propagate errors from authService.logout', async () => {
      const error = new Error('Database error');
      mockAuthService.logout.mockRejectedValue(error);

      await expect(controller.logout(refreshTokenDto)).rejects.toThrow(error);
      expect(authService.logout).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });
  });

  describe('me', () => {
    const mockAuthUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    it('should return current user data', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(mockUserResponse);

      const result = await controller.me(mockAuthUser);

      expect(result).toEqual(mockUserResponse);
      expect(authService.getCurrentUser).toHaveBeenCalledWith(mockAuthUser.id);
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      await expect(controller.me(mockAuthUser)).rejects.toThrow(NotFoundException);
      await expect(controller.me(mockAuthUser)).rejects.toThrow('User not found');
    });

    it('should propagate errors from authService.getCurrentUser', async () => {
      const error = new Error('Database error');
      mockAuthService.getCurrentUser.mockRejectedValue(error);

      await expect(controller.me(mockAuthUser)).rejects.toThrow(error);
      expect(authService.getCurrentUser).toHaveBeenCalledWith(mockAuthUser.id);
    });

    it('should handle different user IDs correctly', async () => {
      const anotherUser = {
        id: 'user-456',
        email: 'another@example.com',
      };
      const anotherUserResponse: UserResponseDto = {
        ...mockUserResponse,
        id: 'user-456',
        email: 'another@example.com',
        name: 'Another User',
      };
      mockAuthService.getCurrentUser.mockResolvedValue(anotherUserResponse);

      const result = await controller.me(anotherUser);

      expect(result).toEqual(anotherUserResponse);
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-456');
    });
  });
});
