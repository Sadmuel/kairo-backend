import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
    day: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    todo: {
      findMany: jest.fn(),
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

  describe('getStats', () => {
    it('should return user stats with streak data', async () => {
      const userWithStreak = {
        ...mockUser,
        currentStreak: 5,
        longestStreak: 10,
        lastCompletedDate: new Date('2024-01-15'),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithStreak);
      mockPrismaService.day.count
        .mockResolvedValueOnce(20) // totalDays
        .mockResolvedValueOnce(15); // completedDays

      const result = await service.getStats('user-123');

      expect(result).toEqual({
        currentStreak: 5,
        longestStreak: 10,
        lastCompletedDate: new Date('2024-01-15'),
        totalCompletedDays: 15,
        totalDays: 20,
        overallDayCompletionRate: 75,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getStats('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return 0 completion rate when no days exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.day.count
        .mockResolvedValueOnce(0) // totalDays
        .mockResolvedValueOnce(0); // completedDays

      const result = await service.getStats('user-123');

      expect(result.overallDayCompletionRate).toBe(0);
      expect(result.totalDays).toBe(0);
    });
  });

  describe('getDayStats', () => {
    const mockDay = {
      id: 'day-123',
      date: new Date('2024-01-15'),
      isCompleted: true,
      userId: 'user-123',
      timeBlocks: [
        { id: 'tb-1', isCompleted: true },
        { id: 'tb-2', isCompleted: false },
      ],
    };

    it('should return stats for existing day', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(mockDay);
      mockPrismaService.todo.findMany.mockResolvedValue([
        { id: 'todo-1', isCompleted: true },
        { id: 'todo-2', isCompleted: true },
        { id: 'todo-3', isCompleted: false },
      ]);

      const result = await service.getDayStats('user-123', '2024-01-15');

      expect(result).toEqual({
        date: '2024-01-15',
        dayExists: true,
        isCompleted: true,
        completedTodos: 2,
        totalTodos: 3,
        todoCompletionRate: 67,
        completedTimeBlocks: 1,
        totalTimeBlocks: 2,
        timeBlockCompletionRate: 50,
      });
    });

    it('should return empty stats when day does not exist', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getDayStats('user-123', '2024-01-15');

      expect(result).toEqual({
        date: '2024-01-15',
        dayExists: false,
        isCompleted: false,
        completedTodos: 0,
        totalTodos: 0,
        todoCompletionRate: 0,
        completedTimeBlocks: 0,
        totalTimeBlocks: 0,
        timeBlockCompletionRate: 0,
      });
    });

    it('should return 0 rates when no todos or time blocks', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue({
        ...mockDay,
        timeBlocks: [],
      });
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      const result = await service.getDayStats('user-123', '2024-01-15');

      expect(result.todoCompletionRate).toBe(0);
      expect(result.timeBlockCompletionRate).toBe(0);
    });
  });

  describe('getWeekStats', () => {
    it('should calculate correct ISO week boundaries (Monday-Sunday)', async () => {
      // 2024-01-17 is a Wednesday
      mockPrismaService.day.findMany.mockResolvedValue([]);
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getWeekStats('user-123', '2024-01-17');

      expect(result.weekStart).toBe('2024-01-15'); // Monday
      expect(result.weekEnd).toBe('2024-01-21'); // Sunday
    });

    it('should aggregate stats from all days in the week', async () => {
      const mockDays = [
        {
          id: 'day-1',
          date: new Date('2024-01-15'),
          isCompleted: true,
          timeBlocks: [{ id: 'tb-1', isCompleted: true }],
        },
        {
          id: 'day-2',
          date: new Date('2024-01-16'),
          isCompleted: false,
          timeBlocks: [
            { id: 'tb-2', isCompleted: true },
            { id: 'tb-3', isCompleted: false },
          ],
        },
      ];
      mockPrismaService.day.findMany.mockResolvedValue(mockDays);
      mockPrismaService.todo.findMany.mockResolvedValue([
        { id: 'todo-1', isCompleted: true },
        { id: 'todo-2', isCompleted: false },
      ]);
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getWeekStats('user-123', '2024-01-17');

      expect(result.completedDays).toBe(1);
      expect(result.totalDays).toBe(2);
      expect(result.completedTodos).toBe(1);
      expect(result.totalTodos).toBe(2);
      expect(result.completedTimeBlocks).toBe(2);
      expect(result.totalTimeBlocks).toBe(3);
    });

    it('should include dailyStats for all 7 days', async () => {
      mockPrismaService.day.findMany.mockResolvedValue([]);
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getWeekStats('user-123', '2024-01-17');

      expect(result.dailyStats).toHaveLength(7);
    });

    it('should return empty aggregates when no days in week', async () => {
      mockPrismaService.day.findMany.mockResolvedValue([]);
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getWeekStats('user-123', '2024-01-17');

      expect(result.completedDays).toBe(0);
      expect(result.totalDays).toBe(0);
      expect(result.todoCompletionRate).toBe(0);
      expect(result.timeBlockCompletionRate).toBe(0);
    });

    it('should handle Sunday correctly (start of week is previous Monday)', async () => {
      // 2024-01-21 is a Sunday
      mockPrismaService.day.findMany.mockResolvedValue([]);
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getWeekStats('user-123', '2024-01-21');

      expect(result.weekStart).toBe('2024-01-15'); // Previous Monday
      expect(result.weekEnd).toBe('2024-01-21'); // Sunday
    });
  });
});
