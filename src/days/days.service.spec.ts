import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DaysService } from './days.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DaysService', () => {
  let service: DaysService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hash',
    name: 'Test User',
    currentStreak: 5,
    longestStreak: 10,
    lastCompletedDate: new Date('2024-01-14'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDay = {
    id: 'day-123',
    date: new Date('2024-01-15'),
    isCompleted: false,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    timeBlocks: [],
  };

  const mockTimeBlock = {
    id: 'tb-123',
    name: 'Morning Routine',
    startTime: '06:00',
    endTime: '08:00',
    isCompleted: false,
    order: 0,
    color: '#A5D8FF',
    dayId: 'day-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: [],
  };

  const mockPrismaService = {
    day: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DaysService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DaysService>(DaysService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByDateRange', () => {
    it('should return days within date range', async () => {
      const days = [mockDay, { ...mockDay, id: 'day-456', date: new Date('2024-01-16') }];
      mockPrismaService.day.findMany.mockResolvedValue(days);

      const result = await service.findByDateRange('user-123', '2024-01-15', '2024-01-20');

      expect(result).toEqual(days);
      expect(prisma.day.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          date: {
            gte: new Date('2024-01-15'),
            lte: new Date('2024-01-20'),
          },
        },
        include: {
          timeBlocks: {
            orderBy: { order: 'asc' },
            include: {
              notes: { orderBy: { order: 'asc' } },
              todos: { orderBy: { order: 'asc' } },
            },
          },
          todos: {
            where: { timeBlockId: null },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { date: 'asc' },
      });
    });

    it('should return empty array when no days in range', async () => {
      mockPrismaService.day.findMany.mockResolvedValue([]);

      const result = await service.findByDateRange('user-123', '2024-01-15', '2024-01-20');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return day when found', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(mockDay);

      const result = await service.findOne('day-123', 'user-123');

      expect(result).toEqual(mockDay);
      expect(prisma.day.findFirst).toHaveBeenCalledWith({
        where: { id: 'day-123', userId: 'user-123' },
        include: {
          timeBlocks: {
            orderBy: { order: 'asc' },
            include: {
              notes: { orderBy: { order: 'asc' } },
              todos: { orderBy: { order: 'asc' } },
            },
          },
          todos: {
            where: { timeBlockId: null },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should throw NotFoundException when day not found', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow('Day not found');
    });

    it('should throw NotFoundException when day belongs to different user', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(null);

      await expect(service.findOne('day-123', 'different-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDate', () => {
    it('should return day when found by date', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(mockDay);

      const result = await service.findByDate('user-123', '2024-01-15');

      expect(result).toEqual(mockDay);
      expect(prisma.day.findUnique).toHaveBeenCalledWith({
        where: {
          userId_date: { userId: 'user-123', date: new Date('2024-01-15') },
        },
        include: {
          timeBlocks: {
            orderBy: { order: 'asc' },
            include: {
              notes: { orderBy: { order: 'asc' } },
              todos: { orderBy: { order: 'asc' } },
            },
          },
          todos: {
            where: { timeBlockId: null },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should return null when no day exists for date', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.findByDate('user-123', '2024-01-15');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new day', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(null);
      mockPrismaService.day.create.mockResolvedValue(mockDay);

      const result = await service.create('user-123', { date: '2024-01-15' });

      expect(result).toEqual(mockDay);
      expect(prisma.day.create).toHaveBeenCalledWith({
        data: {
          date: new Date('2024-01-15'),
          userId: 'user-123',
        },
        include: {
          timeBlocks: true,
        },
      });
    });

    it('should throw ConflictException when day already exists', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(mockDay);

      await expect(service.create('user-123', { date: '2024-01-15' })).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create('user-123', { date: '2024-01-15' })).rejects.toThrow(
        'Day already exists for this date',
      );
    });
  });

  describe('update', () => {
    it('should update day fields', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(mockDay);
      mockPrismaService.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });

      const result = await service.update('day-123', 'user-123', { isCompleted: true });

      expect(result.isCompleted).toBe(true);
      expect(prisma.day.update).toHaveBeenCalledWith({
        where: { id: 'day-123' },
        data: { isCompleted: true },
        include: {
          timeBlocks: {
            orderBy: { order: 'asc' },
            include: {
              notes: { orderBy: { order: 'asc' } },
              todos: { orderBy: { order: 'asc' } },
            },
          },
          todos: {
            where: { timeBlockId: null },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should throw NotFoundException when day not found', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-123', { isCompleted: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete day', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(mockDay);
      mockPrismaService.day.delete.mockResolvedValue(mockDay);

      await service.remove('day-123', 'user-123');

      expect(prisma.day.delete).toHaveBeenCalledWith({
        where: { id: 'day-123' },
      });
    });

    it('should throw NotFoundException when day not found', async () => {
      mockPrismaService.day.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCompletionStatus', () => {
    // Create a transaction client mock that mirrors the main prisma mock
    const mockTxClient = {
      day: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    beforeEach(() => {
      // Reset tx client mocks
      mockTxClient.day.findUnique.mockReset();
      mockTxClient.day.findMany.mockReset();
      mockTxClient.day.update.mockReset();
      mockTxClient.user.findUnique.mockReset();
      mockTxClient.user.update.mockReset();
      // Make $transaction execute the callback with our tx client
      mockPrismaService.$transaction.mockImplementation((callback) => callback(mockTxClient));
    });

    it('should mark day as completed when all time blocks are completed', async () => {
      const dayWithBlocks = {
        ...mockDay,
        timeBlocks: [
          { ...mockTimeBlock, isCompleted: true },
          { ...mockTimeBlock, id: 'tb-456', isCompleted: true },
        ],
      };
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([{ date: new Date('2024-01-15') }]);
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });
      mockTxClient.user.findUnique.mockResolvedValue(mockUser);
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.day.update).toHaveBeenCalledWith({
        where: { id: 'day-123' },
        data: { isCompleted: true },
      });
    });

    it('should mark day as incomplete when not all time blocks are completed', async () => {
      const dayWithBlocks = {
        ...mockDay,
        isCompleted: true,
        timeBlocks: [
          { ...mockTimeBlock, isCompleted: true },
          { ...mockTimeBlock, id: 'tb-456', isCompleted: false },
        ],
      };
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([]); // No completed days after this one becomes incomplete
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: false });
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.day.update).toHaveBeenCalledWith({
        where: { id: 'day-123' },
        data: { isCompleted: false },
      });
    });

    it('should not update when day has no time blocks', async () => {
      mockTxClient.day.findUnique.mockResolvedValue({ ...mockDay, timeBlocks: [] });

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.day.update).not.toHaveBeenCalled();
    });

    it('should not update when completion status is unchanged', async () => {
      const dayWithBlocks = {
        ...mockDay,
        isCompleted: false,
        timeBlocks: [{ ...mockTimeBlock, isCompleted: false }],
      };
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.day.update).not.toHaveBeenCalled();
    });

    it('should update user streak when day becomes completed with consecutive days', async () => {
      const dayWithBlocks = {
        ...mockDay,
        date: new Date('2024-01-15'),
        timeBlocks: [{ ...mockTimeBlock, isCompleted: true }],
      };
      // Simulate 6 consecutive completed days (Jan 10-15)
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([
        { date: new Date('2024-01-15') },
        { date: new Date('2024-01-14') },
        { date: new Date('2024-01-13') },
        { date: new Date('2024-01-12') },
        { date: new Date('2024-01-11') },
        { date: new Date('2024-01-10') },
      ]);
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });
      mockTxClient.user.findUnique.mockResolvedValue({ ...mockUser, longestStreak: 10 });
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          currentStreak: 6,
          longestStreak: 10, // Preserved from user's existing longest
          lastCompletedDate: new Date('2024-01-15'),
        },
      });
    });

    it('should reset streak to 1 when day is not consecutive', async () => {
      const dayWithBlocks = {
        ...mockDay,
        date: new Date('2024-01-20'),
        timeBlocks: [{ ...mockTimeBlock, isCompleted: true }],
      };
      // Only one completed day (the new one), previous were not consecutive
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([
        { date: new Date('2024-01-20') },
        { date: new Date('2024-01-10') }, // Gap - not consecutive
      ]);
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });
      mockTxClient.user.findUnique.mockResolvedValue({ ...mockUser, longestStreak: 10 });
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          currentStreak: 1,
          longestStreak: 10,
          lastCompletedDate: new Date('2024-01-20'),
        },
      });
    });

    it('should use transaction for all database operations', async () => {
      const dayWithBlocks = {
        ...mockDay,
        timeBlocks: [{ ...mockTimeBlock, isCompleted: true }],
      };
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([{ date: new Date('2024-01-15') }]);
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });
      mockTxClient.user.findUnique.mockResolvedValue(mockUser);
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should calculate longest streak correctly from all completed days', async () => {
      const dayWithBlocks = {
        ...mockDay,
        date: new Date('2024-01-25'),
        timeBlocks: [{ ...mockTimeBlock, isCompleted: true }],
      };
      // Simulating: current streak of 2 (Jan 24-25), but longest was 4 (Jan 10-13)
      mockTxClient.day.findUnique.mockResolvedValue(dayWithBlocks);
      mockTxClient.day.findMany.mockResolvedValue([
        { date: new Date('2024-01-25') },
        { date: new Date('2024-01-24') },
        // Gap
        { date: new Date('2024-01-13') },
        { date: new Date('2024-01-12') },
        { date: new Date('2024-01-11') },
        { date: new Date('2024-01-10') },
      ]);
      mockTxClient.day.update.mockResolvedValue({ ...mockDay, isCompleted: true });
      mockTxClient.user.findUnique.mockResolvedValue({ ...mockUser, longestStreak: 3 }); // Previous longest was 3
      mockTxClient.user.update.mockResolvedValue(mockUser);

      await service.updateCompletionStatus('day-123');

      expect(mockTxClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          currentStreak: 2,
          longestStreak: 4, // New longest from the Jan 10-13 sequence
          lastCompletedDate: new Date('2024-01-25'),
        },
      });
    });
  });
});
