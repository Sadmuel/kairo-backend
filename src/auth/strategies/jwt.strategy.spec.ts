import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload, AuthUser } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw an error if JWT_SECRET is not configured', () => {
      const configWithoutSecret = {
        get: jest.fn().mockReturnValue(undefined),
      };

      expect(() => {
        new JwtStrategy(configWithoutSecret as any);
      }).toThrow('JWT_SECRET environment variable is not configured');
    });

    it('should throw an error if JWT_SECRET is empty string', () => {
      const configWithEmptySecret = {
        get: jest.fn().mockReturnValue(''),
      };

      expect(() => {
        new JwtStrategy(configWithEmptySecret as any);
      }).toThrow('JWT_SECRET environment variable is not configured');
    });

    it('should configure strategy with JWT_SECRET from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return AuthUser from JWT payload', () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 1234567890 + 3600,
      };

      const result: AuthUser = strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should return AuthUser without optional fields', () => {
      const payload: JwtPayload = {
        sub: 'user-456',
        email: 'another@example.com',
      };

      const result: AuthUser = strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-456',
        email: 'another@example.com',
      });
    });

    it('should extract id from sub field', () => {
      const payload: JwtPayload = {
        sub: 'uuid-user-id',
        email: 'user@test.com',
      };

      const result = strategy.validate(payload);

      expect(result.id).toBe('uuid-user-id');
    });

    it('should preserve email from payload', () => {
      const payload: JwtPayload = {
        sub: 'user-id',
        email: 'specific@email.com',
      };

      const result = strategy.validate(payload);

      expect(result.email).toBe('specific@email.com');
    });
  });
});
