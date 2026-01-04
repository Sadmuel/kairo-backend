import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TimeBlocksService } from './time-blocks.service';
import { PrismaService } from '../prisma/prisma.service';
import { DaysService } from '../days/days.service';

describe('TimeBlocksService', () => {
  let service: TimeBlocksService;
  let prisma: jest.Mocked<PrismaService>;
  let daysService: jest.Mocked<DaysService>;

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
    day: mockDay,
  };

  const mockPrismaService = {
    timeBlock: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDaysService = {
    findOne: jest.fn(),
    updateCompletionStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeBlocksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DaysService,
          useValue: mockDaysService,
        },
      ],
    }).compile();

    service = module.get<TimeBlocksService>(TimeBlocksService);
    prisma = module.get(PrismaService);
    daysService = module.get(DaysService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByDay', () => {
    it('should return time blocks for a day in order', async () => {
      const timeBlocks = [mockTimeBlock, { ...mockTimeBlock, id: 'tb-456', order: 1 }];
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findMany.mockResolvedValue(timeBlocks);

      const result = await service.findByDay('day-123', 'user-123');

      expect(result).toEqual(timeBlocks);
      expect(daysService.findOne).toHaveBeenCalledWith('day-123', 'user-123');
      expect(prisma.timeBlock.findMany).toHaveBeenCalledWith({
        where: { dayId: 'day-123' },
        include: {
          notes: { orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      });
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(new NotFoundException('Day not found'));

      await expect(service.findByDay('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return time block when found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);

      const result = await service.findOne('tb-123', 'user-123');

      expect(result).toEqual(mockTimeBlock);
      expect(prisma.timeBlock.findFirst).toHaveBeenCalledWith({
        where: { id: 'tb-123' },
        include: {
          day: true,
          notes: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(
        'Time block not found',
      );
    });

    it('should throw NotFoundException when time block belongs to different user', async () => {
      const blockWithDifferentUser = {
        ...mockTimeBlock,
        day: { ...mockDay, userId: 'different-user' },
      };
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(blockWithDifferentUser);

      await expect(service.findOne('tb-123', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Morning Routine',
      startTime: '06:00',
      endTime: '08:00',
      dayId: 'day-123',
      color: '#A5D8FF',
    };

    it('should create a time block with auto-assigned order', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findFirst.mockResolvedValue({ order: 2 });
      mockPrismaService.timeBlock.create.mockResolvedValue(mockTimeBlock);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockTimeBlock);
      expect(prisma.timeBlock.create).toHaveBeenCalledWith({
        data: {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '08:00',
          color: '#A5D8FF',
          order: 3,
          dayId: 'day-123',
        },
        include: {
          notes: true,
        },
      });
    });

    it('should create first time block with order 0', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);
      mockPrismaService.timeBlock.create.mockResolvedValue(mockTimeBlock);

      await service.create('user-123', createDto);

      expect(prisma.timeBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });

    it('should use provided order when specified', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.create.mockResolvedValue(mockTimeBlock);

      await service.create('user-123', { ...createDto, order: 5 });

      expect(prisma.timeBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 5 }),
        }),
      );
    });

    it('should throw BadRequestException when end time is before start time', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);

      await expect(
        service.create('user-123', { ...createDto, startTime: '10:00', endTime: '08:00' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', { ...createDto, startTime: '10:00', endTime: '08:00' }),
      ).rejects.toThrow('End time must be after start time');
    });

    it('should throw BadRequestException when start and end time are equal', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);

      await expect(
        service.create('user-123', { ...createDto, startTime: '08:00', endTime: '08:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(new NotFoundException('Day not found'));

      await expect(service.create('user-123', createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update time block fields', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);
      mockPrismaService.timeBlock.update.mockResolvedValue({
        ...mockTimeBlock,
        name: 'Updated Name',
      });

      const result = await service.update('tb-123', 'user-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.timeBlock.update).toHaveBeenCalledWith({
        where: { id: 'tb-123' },
        data: { name: 'Updated Name' },
        include: {
          notes: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should validate time range when updating times', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);

      await expect(
        service.update('tb-123', 'user-123', { startTime: '10:00', endTime: '08:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate time range with existing values', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue({
        ...mockTimeBlock,
        startTime: '06:00',
        endTime: '08:00',
      });

      await expect(service.update('tb-123', 'user-123', { startTime: '09:00' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update day completion status when isCompleted changes', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);
      mockPrismaService.timeBlock.update.mockResolvedValue({
        ...mockTimeBlock,
        isCompleted: true,
      });
      mockDaysService.updateCompletionStatus.mockResolvedValue(undefined);

      await service.update('tb-123', 'user-123', { isCompleted: true });

      expect(daysService.updateCompletionStatus).toHaveBeenCalledWith('day-123');
    });

    it('should not update day completion when isCompleted is not changed', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);
      mockPrismaService.timeBlock.update.mockResolvedValue({
        ...mockTimeBlock,
        name: 'Updated Name',
      });

      await service.update('tb-123', 'user-123', { name: 'Updated Name' });

      expect(daysService.updateCompletionStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'user-123', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete time block and reorder remaining', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);
      mockPrismaService.timeBlock.delete.mockResolvedValue(mockTimeBlock);
      mockPrismaService.timeBlock.updateMany.mockResolvedValue({ count: 2 });
      mockDaysService.updateCompletionStatus.mockResolvedValue(undefined);

      await service.remove('tb-123', 'user-123');

      expect(prisma.timeBlock.delete).toHaveBeenCalledWith({
        where: { id: 'tb-123' },
      });
      expect(prisma.timeBlock.updateMany).toHaveBeenCalledWith({
        where: {
          dayId: 'day-123',
          order: { gt: 0 },
        },
        data: {
          order: { decrement: 1 },
        },
      });
      expect(daysService.updateCompletionStatus).toHaveBeenCalledWith('day-123');
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should reorder time blocks', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([
        { ...mockTimeBlock, order: 0 },
        { ...mockTimeBlock, id: 'tb-456', order: 1 },
      ]);

      const result = await service.reorder('user-123', 'day-123', {
        orderedIds: ['tb-456', 'tb-123'],
      });

      expect(daysService.findOne).toHaveBeenCalledWith('day-123', 'user-123');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(new NotFoundException('Day not found'));

      await expect(
        service.reorder('user-123', 'nonexistent', { orderedIds: ['tb-123'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
