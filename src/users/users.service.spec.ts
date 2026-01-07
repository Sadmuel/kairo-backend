import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    name: 'Test User',
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should create a new user with hashed password', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@example.com',
          name: 'New User',
          passwordHash: expect.any(String),
        }),
      });
    });

    it('should normalize email to lowercase and trim whitespace', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      const dtoWithSpaces: CreateUserDto = {
        email: '  TestUser@Example.COM  ',
        password: 'password123',
        name: '  Test User  ',
      };

      await service.create(dtoWithSpaces);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'testuser@example.com',
          name: 'Test User',
        }),
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrismaService.user.create.mockRejectedValue(prismaError);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createUserDto)).rejects.toThrow('Email already exists');
    });

    it('should propagate other errors', async () => {
      const genericError = new Error('Database connection failed');
      mockPrismaService.user.create.mockRejectedValue(genericError);

      await expect(service.create(createUserDto)).rejects.toThrow(genericError);
    });

    it('should hash password before storing', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.create(createUserDto);

      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe(createUserDto.password);
      expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$\d+\$.{53}$/);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });

    it('should normalize email to lowercase and trim whitespace', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.findByEmail('  TestUser@Example.COM  ');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'testuser@example.com' },
      });
    });

    it('should propagate errors from prisma', async () => {
      const error = new Error('Database error');
      mockPrismaService.user.findUnique.mockRejectedValue(error);

      await expect(service.findByEmail('test@example.com')).rejects.toThrow(error);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
      });
    });

    it('should propagate errors from prisma', async () => {
      const error = new Error('Database error');
      mockPrismaService.user.findUnique.mockRejectedValue(error);

      await expect(service.findById('user-123')).rejects.toThrow(error);
    });

    it('should handle different user IDs correctly', async () => {
      const anotherUser = { ...mockUser, id: 'user-456', email: 'another@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(anotherUser);

      const result = await service.findById('user-456');

      expect(result).toEqual(anotherUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' },
      });
    });
  });
});
