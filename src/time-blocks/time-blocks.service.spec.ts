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
    day: {
      update: jest.fn(),
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

    it('should create a time block with auto-assigned order using atomic counter', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);

      // Mock the transaction to execute the callback with a mock tx client
      const mockTxClient = {
        day: {
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 3 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue(mockTimeBlock),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTxClient);
      });

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockTimeBlock);
      expect(mockTxClient.day.update).toHaveBeenCalledWith({
        where: { id: 'day-123' },
        data: { nextTimeBlockOrder: { increment: 1 } },
        select: { nextTimeBlockOrder: true },
      });
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '08:00',
          color: '#A5D8FF',
          order: 2,
          dayId: 'day-123',
        },
        include: {
          notes: true,
        },
      });
    });

    it('should create first time block with order 0 using atomic counter', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);

      const mockTxClient = {
        day: {
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue(mockTimeBlock),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTxClient);
      });

      await service.create('user-123', createDto);

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });

    it('should use provided order when specified and no conflict exists', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);
      mockPrismaService.timeBlock.create.mockResolvedValue(mockTimeBlock);

      await service.create('user-123', { ...createDto, order: 5 });

      expect(prisma.timeBlock.findFirst).toHaveBeenCalledWith({
        where: { dayId: 'day-123', order: 5 },
      });
      expect(prisma.timeBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 5 }),
        }),
      );
    });

    it('should throw BadRequestException when provided order conflicts with existing', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findFirst.mockResolvedValue({ id: 'existing-tb', order: 5 });

      await expect(service.create('user-123', { ...createDto, order: 5 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-123', { ...createDto, order: 5 })).rejects.toThrow(
        'A time block with order 5 already exists for this day',
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
      mockDaysService.updateCompletionStatus.mockResolvedValue(undefined);

      const updatedTimeBlock = { ...mockTimeBlock, isCompleted: true };
      const mockTxClient = {
        timeBlock: {
          update: jest.fn().mockResolvedValue(updatedTimeBlock),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTxClient);
      });

      await service.update('tb-123', 'user-123', { isCompleted: true });

      expect(daysService.updateCompletionStatus).toHaveBeenCalledWith('day-123', mockTxClient);
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
    const mockTxClient = {
      timeBlock: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    beforeEach(() => {
      mockTxClient.timeBlock.findUnique.mockReset();
      mockTxClient.timeBlock.delete.mockReset();
      mockTxClient.timeBlock.updateMany.mockReset();
      mockPrismaService.$transaction.mockImplementation((callback) => callback(mockTxClient));
    });

    it('should delete time block and reorder remaining in a transaction', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockTimeBlock);
      mockTxClient.timeBlock.findUnique.mockResolvedValue(mockTimeBlock);
      mockTxClient.timeBlock.delete.mockResolvedValue(mockTimeBlock);
      mockTxClient.timeBlock.updateMany.mockResolvedValue({ count: 2 });
      mockDaysService.updateCompletionStatus.mockResolvedValue(undefined);

      await service.remove('tb-123', 'user-123');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockTxClient.timeBlock.delete).toHaveBeenCalledWith({
        where: { id: 'tb-123' },
      });
      expect(mockTxClient.timeBlock.updateMany).toHaveBeenCalledWith({
        where: {
          dayId: 'day-123',
          order: { gt: 0 },
        },
        data: {
          order: { decrement: 1 },
        },
      });
      // updateCompletionStatus should be called with the transaction client for atomicity
      expect(daysService.updateCompletionStatus).toHaveBeenCalledWith('day-123', mockTxClient);
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
      mockPrismaService.timeBlock.findMany.mockResolvedValue([{ id: 'tb-123' }, { id: 'tb-456' }]);

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

    it('should throw BadRequestException when time block does not belong to day', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([{ id: 'tb-123' }]);

      await expect(
        service.reorder('user-123', 'day-123', { orderedIds: ['tb-123', 'invalid-tb'] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.reorder('user-123', 'day-123', { orderedIds: ['tb-123', 'invalid-tb'] }),
      ).rejects.toThrow('Time block invalid-tb does not belong to this day');
    });
  });

  describe('duplicate', () => {
    const mockSourceWithRelations = {
      ...mockTimeBlock,
      notes: [
        { id: 'note-1', content: 'Note 1', order: 0, timeBlockId: 'tb-123' },
        { id: 'note-2', content: 'Note 2', order: 1, timeBlockId: 'tb-123' },
      ],
      todos: [
        {
          id: 'todo-1',
          title: 'Todo 1',
          isCompleted: true,
          deadline: new Date('2024-12-31'),
          order: 0,
          userId: 'user-123',
          timeBlockId: 'tb-123',
        },
      ],
    };

    const mockTargetDay = {
      id: 'day-456',
      date: new Date('2024-01-16'),
      isCompleted: false,
      userId: 'user-123',
    };

    const baseDuplicateDto = {
      targetDayId: 'day-456',
    };

    it('should duplicate a time block to a target day with notes by default', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      // Mock day.findFirst for target day validation
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = {
        id: 'tb-new',
        name: 'Morning Routine',
        startTime: '06:00',
        endTime: '08:00',
        color: '#A5D8FF',
        isCompleted: false,
        order: 2,
        dayId: 'day-456',
      };

      const mockTxClient = {
        day: {
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 3 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({
            ...createdBlock,
            notes: [
              { id: 'note-new-1', content: 'Note 1', order: 0 },
              { id: 'note-new-2', content: 'Note 2', order: 1 },
            ],
            todos: [],
          }),
        },
        note: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        todo: {
          createMany: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTxClient);
      });

      const result = await service.duplicate('tb-123', 'user-123', baseDuplicateDto);

      // Should create the time block with source data
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '08:00',
          color: '#A5D8FF',
          isCompleted: false,
          dayId: 'day-456',
        }),
      });

      // Should duplicate notes by default
      expect(mockTxClient.note.createMany).toHaveBeenCalledWith({
        data: [
          { content: 'Note 1', order: 0, timeBlockId: 'tb-new' },
          { content: 'Note 2', order: 1, timeBlockId: 'tb-new' },
        ],
      });

      // Should NOT duplicate todos by default
      expect(mockTxClient.todo.createMany).not.toHaveBeenCalled();

      expect(result).toBeDefined();
    });

    it('should exclude notes when includeNotes is false', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      const mockTxClient = {
        day: {
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', {
        ...baseDuplicateDto,
        includeNotes: false,
      });

      expect(mockTxClient.note.createMany).not.toHaveBeenCalled();
    });

    it('should include todos when includeTodos is true', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      const mockTxClient = {
        day: {
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', {
        ...baseDuplicateDto,
        includeTodos: true,
      });

      expect(mockTxClient.todo.createMany).toHaveBeenCalledWith({
        data: [
          {
            title: 'Todo 1',
            isCompleted: false,
            deadline: null,
            order: 0,
            userId: 'user-123',
            timeBlockId: 'tb-new',
          },
        ],
      });
    });

    it('should use time overrides when provided', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      const mockTxClient = {
        day: { update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }) },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', {
        ...baseDuplicateDto,
        startTime: '10:00',
        endTime: '12:00',
      });

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startTime: '10:00',
          endTime: '12:00',
        }),
      });
    });

    it('should throw BadRequestException when override times are invalid', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      await expect(
        service.duplicate('tb-123', 'user-123', {
          ...baseDuplicateDto,
          startTime: '14:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.duplicate('tb-123', 'user-123', {
          ...baseDuplicateDto,
          startTime: '14:00',
          endTime: '12:00',
        }),
      ).rejects.toThrow('End time must be after start time');
    });

    it('should duplicate to same day', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue({ ...mockDay });
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new' };
      const mockTxClient = {
        day: { update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 2 }) },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', { targetDayId: 'day-123' });

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dayId: 'day-123',
          order: 1,
        }),
      });
    });

    it('should always set isCompleted to false on duplicated block', async () => {
      const completedSource = { ...mockSourceWithRelations, isCompleted: true };
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(completedSource);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      const mockTxClient = {
        day: { update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }) },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', baseDuplicateDto);

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isCompleted: false,
        }),
      });
    });

    it('should throw NotFoundException when source time block not found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(null);

      await expect(
        service.duplicate('nonexistent', 'user-123', baseDuplicateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when source belongs to different user', async () => {
      const otherUserBlock = {
        ...mockSourceWithRelations,
        day: { ...mockDay, userId: 'other-user' },
      };
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(otherUserBlock);

      await expect(
        service.duplicate('tb-123', 'user-123', baseDuplicateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target day not found', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      const mockDayFindFirst = jest.fn().mockResolvedValue(null);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      await expect(
        service.duplicate('tb-123', 'user-123', baseDuplicateDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.duplicate('tb-123', 'user-123', baseDuplicateDto),
      ).rejects.toThrow('Target day not found');
    });

    it('should throw NotFoundException when target day belongs to different user', async () => {
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(mockSourceWithRelations);
      // findFirst with userId filter returns null for other user's day
      const mockDayFindFirst = jest.fn().mockResolvedValue(null);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      await expect(
        service.duplicate('tb-123', 'user-123', { targetDayId: 'other-day' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip note duplication when source has no notes', async () => {
      const sourceWithoutNotes = { ...mockSourceWithRelations, notes: [] };
      mockPrismaService.timeBlock.findFirst.mockResolvedValue(sourceWithoutNotes);
      const mockDayFindFirst = jest.fn().mockResolvedValue(mockTargetDay);
      (prisma as any).day = { ...mockPrismaService.day, findFirst: mockDayFindFirst };

      const createdBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      const mockTxClient = {
        day: { update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }) },
        timeBlock: {
          create: jest.fn().mockResolvedValue(createdBlock),
          findUnique: jest.fn().mockResolvedValue({ ...createdBlock, notes: [], todos: [] }),
        },
        note: { createMany: jest.fn() },
        todo: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.duplicate('tb-123', 'user-123', baseDuplicateDto);

      expect(mockTxClient.note.createMany).not.toHaveBeenCalled();
    });
  });
});
