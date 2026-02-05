import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TimeBlockTemplatesService } from './time-block-templates.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TimeBlockTemplatesService', () => {
  let service: TimeBlockTemplatesService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTemplate = {
    id: 'tpl-123',
    name: 'Gym',
    startTime: '07:00',
    endTime: '08:00',
    color: '#A5D8FF',
    daysOfWeek: [1, 3, 5],
    isActive: true,
    activeUntil: null,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: [],
  };

  const mockPrismaService = {
    timeBlockTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    timeBlock: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    materializationExclusion: {
      findMany: jest.fn(),
    },
    day: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    note: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeBlockTemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TimeBlockTemplatesService>(TimeBlockTemplatesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all templates for a user', async () => {
      const templates = [mockTemplate];
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue(templates);

      const result = await service.findAll('user-123');

      expect(result).toEqual(templates);
      expect(prisma.timeBlockTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { notes: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no templates', async () => {
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-123');

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return template when found', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);

      const result = await service.findOne('tpl-123', 'user-123');

      expect(result).toEqual(mockTemplate);
      expect(prisma.timeBlockTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-123', userId: 'user-123' },
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(
        'Time block template not found',
      );
    });

    it('should throw NotFoundException when template belongs to different user', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('tpl-123', 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Gym',
      startTime: '07:00',
      endTime: '08:00',
      color: '#A5D8FF',
      daysOfWeek: [1, 3, 5],
    };

    it('should create a template without notes', async () => {
      mockPrismaService.timeBlockTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockTemplate);
      expect(prisma.timeBlockTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Gym',
          startTime: '07:00',
          endTime: '08:00',
          color: '#A5D8FF',
          daysOfWeek: [1, 3, 5],
          userId: 'user-123',
          notes: undefined,
        },
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });

    it('should create a template with nested notes', async () => {
      const dtoWithNotes = {
        ...createDto,
        notes: [
          { content: 'Warm up', order: 0 },
          { content: 'Cool down', order: 1 },
        ],
      };
      mockPrismaService.timeBlockTemplate.create.mockResolvedValue({
        ...mockTemplate,
        notes: dtoWithNotes.notes,
      });

      await service.create('user-123', dtoWithNotes);

      expect(prisma.timeBlockTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: {
            create: [
              { content: 'Warm up', order: 0 },
              { content: 'Cool down', order: 1 },
            ],
          },
        }),
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });

    it('should throw BadRequestException when end time is before start time', async () => {
      await expect(
        service.create('user-123', { ...createDto, startTime: '10:00', endTime: '08:00' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', { ...createDto, startTime: '10:00', endTime: '08:00' }),
      ).rejects.toThrow('End time must be after start time');
    });

    it('should throw BadRequestException when start and end time are equal', async () => {
      await expect(
        service.create('user-123', { ...createDto, startTime: '08:00', endTime: '08:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when daysOfWeek has duplicates', async () => {
      await expect(
        service.create('user-123', { ...createDto, daysOfWeek: [1, 3, 1] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', { ...createDto, daysOfWeek: [1, 3, 1] }),
      ).rejects.toThrow('daysOfWeek must contain unique values');
    });

    it('should not create notes when notes array is empty', async () => {
      mockPrismaService.timeBlockTemplate.create.mockResolvedValue(mockTemplate);

      await service.create('user-123', { ...createDto, notes: [] });

      expect(prisma.timeBlockTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ notes: undefined }),
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update template fields', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockPrismaService.timeBlockTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: 'Yoga',
      });

      const result = await service.update('tpl-123', 'user-123', { name: 'Yoga' });

      expect(result.name).toBe('Yoga');
      expect(prisma.timeBlockTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-123' },
        data: {
          name: 'Yoga',
          startTime: undefined,
          endTime: undefined,
          color: undefined,
          daysOfWeek: undefined,
        },
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });

    it('should validate time range when updating start time only', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);

      // Template has endTime 08:00, updating startTime to 09:00 should fail
      await expect(
        service.update('tpl-123', 'user-123', { startTime: '09:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate time range when updating end time only', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);

      // Template has startTime 07:00, updating endTime to 06:00 should fail
      await expect(
        service.update('tpl-123', 'user-123', { endTime: '06:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate daysOfWeek uniqueness on update', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);

      await expect(
        service.update('tpl-123', 'user-123', { daysOfWeek: [2, 4, 2] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('tpl-123', 'user-123', { daysOfWeek: [2, 4, 2] }),
      ).rejects.toThrow('daysOfWeek must contain unique values');
    });

    it('should skip daysOfWeek validation when not provided', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockPrismaService.timeBlockTemplate.update.mockResolvedValue(mockTemplate);

      await service.update('tpl-123', 'user-123', { name: 'Updated' });

      // Should not throw
      expect(prisma.timeBlockTemplate.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-123', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete template after ownership check', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockPrismaService.timeBlockTemplate.delete.mockResolvedValue(mockTemplate);

      await service.remove('tpl-123', 'user-123');

      expect(prisma.timeBlockTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'tpl-123' },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────

  describe('deactivate', () => {
    const mockTxClient = {
      timeBlockTemplate: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      timeBlock: {
        deleteMany: jest.fn(),
      },
    };

    beforeEach(() => {
      mockTxClient.timeBlockTemplate.update.mockReset();
      mockTxClient.timeBlockTemplate.findUnique.mockReset();
      mockTxClient.timeBlock.deleteMany.mockReset();
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));
    });

    it('should deactivate template with provided activeUntil date', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      const deactivatedTemplate = { ...mockTemplate, isActive: false, activeUntil: new Date('2024-02-01') };
      mockTxClient.timeBlockTemplate.findUnique.mockResolvedValue(deactivatedTemplate);

      const result = await service.deactivate('tpl-123', 'user-123', {
        activeUntil: '2024-02-01',
      });

      expect(mockTxClient.timeBlockTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-123' },
        data: { isActive: false, activeUntil: new Date('2024-02-01') },
      });
      expect(result).toEqual(deactivatedTemplate);
    });

    it('should default activeUntil to now when not provided', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockTxClient.timeBlockTemplate.findUnique.mockResolvedValue(mockTemplate);

      await service.deactivate('tpl-123', 'user-123', {});

      expect(mockTxClient.timeBlockTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-123' },
        data: { isActive: false, activeUntil: expect.any(Date) },
      });
    });

    it('should delete future uncompleted blocks when deleteFutureOccurrences is true', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockTxClient.timeBlock.deleteMany.mockResolvedValue({ count: 3 });
      mockTxClient.timeBlockTemplate.findUnique.mockResolvedValue(mockTemplate);

      await service.deactivate('tpl-123', 'user-123', {
        deleteFutureOccurrences: true,
      });

      expect(mockTxClient.timeBlock.deleteMany).toHaveBeenCalledWith({
        where: {
          templateId: 'tpl-123',
          isCompleted: false,
          day: { date: { gte: expect.any(Date) } },
        },
      });
    });

    it('should not delete future blocks when deleteFutureOccurrences is not set', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockTxClient.timeBlockTemplate.findUnique.mockResolvedValue(mockTemplate);

      await service.deactivate('tpl-123', 'user-123', {});

      expect(mockTxClient.timeBlock.deleteMany).not.toHaveBeenCalled();
    });

    it('should return the updated template from within the transaction', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(mockTemplate);
      const deactivated = { ...mockTemplate, isActive: false };
      mockTxClient.timeBlockTemplate.findUnique.mockResolvedValue(deactivated);

      const result = await service.deactivate('tpl-123', 'user-123', {});

      expect(mockTxClient.timeBlockTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'tpl-123' },
        include: { notes: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(deactivated);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrismaService.timeBlockTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivate('nonexistent', 'user-123', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── materializeForDateRange ──────────────────────────────────────────

  describe('materializeForDateRange', () => {
    // Helper: make a UTC date
    const utcDate = (dateStr: string) => new Date(`${dateStr}T00:00:00.000Z`);

    it('should do nothing when user has no active templates', async () => {
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([]);

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      expect(prisma.timeBlock.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should materialize blocks for matching weekdays', async () => {
      // Mon=1, Wed=3, Fri=5 template
      const template = { ...mockTemplate, daysOfWeek: [1, 3, 5], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      // 2024-01-15 (Mon) to 2024-01-21 (Sun) — should match Mon(15), Wed(17), Fri(19)
      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: {
          createMany: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      // Should create exactly 3 time blocks (Mon, Wed, Fri)
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(3);
      expect(mockTxClient.day.upsert).toHaveBeenCalledTimes(3);
    });

    it('should skip dates that already have materialized blocks', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1, 3, 5], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);

      // Wednesday 2024-01-17 already has a block
      mockPrismaService.timeBlock.findMany.mockResolvedValue([
        { templateId: 'tpl-123', day: { date: utcDate('2024-01-17') } },
      ]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      // Only Mon(15) and Fri(19) — Wed(17) skipped
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);
    });

    it('should skip dates with exclusions', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1, 3, 5], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);

      // Friday 2024-01-19 has an exclusion (user deleted it previously)
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([
        { templateId: 'tpl-123', date: utcDate('2024-01-19') },
      ]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      // Only Mon(15) and Wed(17) — Fri(19) excluded
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);
    });

    it('should skip dates after template activeUntil', async () => {
      const template = {
        ...mockTemplate,
        daysOfWeek: [1, 3, 5],
        activeUntil: utcDate('2024-01-17'), // Active until Wednesday
        notes: [],
      };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      // Mon(15) and Wed(17) only — Fri(19) is after activeUntil
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);
    });

    it('should not match non-matching weekdays', async () => {
      // Template only for Tuesday (2) and Thursday (4)
      const template = { ...mockTemplate, daysOfWeek: [2, 4], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      // 2024-01-15 (Mon) to 2024-01-21 (Sun) — Tue=16, Thu=18
      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-21'));

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);

      // Verify the dates are correct (Tue and Thu)
      const createCalls = mockTxClient.timeBlock.create.mock.calls;
      expect(createCalls[0][0].data).toEqual(
        expect.objectContaining({ name: 'Gym', templateId: 'tpl-123' }),
      );
    });

    it('should handle Sunday (ISO day 7) correctly', async () => {
      // Template only for Sunday (7)
      const template = { ...mockTemplate, daysOfWeek: [7], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      // 2024-01-14 (Sun) to 2024-01-21 (Sun) — two Sundays
      await service.materializeForDateRange('user-123', utcDate('2024-01-14'), utcDate('2024-01-21'));

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);
    });

    it('should copy template notes to materialized blocks', async () => {
      const templateWithNotes = {
        ...mockTemplate,
        daysOfWeek: [1], // Monday only
        notes: [
          { id: 'tn-1', content: 'Warm up', order: 0, templateId: 'tpl-123' },
          { id: 'tn-2', content: 'Cool down', order: 1, templateId: 'tpl-123' },
        ],
      };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([templateWithNotes]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      // 2024-01-15 is a Monday
      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(mockTxClient.note.createMany).toHaveBeenCalledWith({
        data: [
          { content: 'Warm up', order: 0, timeBlockId: 'tb-new' },
          { content: 'Cool down', order: 1, timeBlockId: 'tb-new' },
        ],
      });
    });

    it('should not create notes when template has no notes', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(mockTxClient.note.createMany).not.toHaveBeenCalled();
    });

    it('should use atomic order counter for each materialized block', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 3 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(mockTxClient.day.update).toHaveBeenCalledWith({
        where: { id: 'day-new' },
        data: { nextTimeBlockOrder: { increment: 1 } },
        select: { nextTimeBlockOrder: true },
      });
      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 2 }), // nextTimeBlockOrder(3) - 1
      });
    });

    it('should do nothing when all dates are already materialized', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);

      // Monday already has a block
      mockPrismaService.timeBlock.findMany.mockResolvedValue([
        { templateId: 'tpl-123', day: { date: utcDate('2024-01-15') } },
      ]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should swallow P2002 unique constraint errors for concurrent safety', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const p2002Error = { code: 'P2002', message: 'Unique constraint failed' };
      mockPrismaService.$transaction.mockRejectedValue(p2002Error);

      // Should not throw
      await expect(
        service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15')),
      ).resolves.toBeUndefined();
    });

    it('should re-throw non-P2002 errors', async () => {
      const template = { ...mockTemplate, daysOfWeek: [1], notes: [] };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const otherError = new Error('Database connection failed');
      mockPrismaService.$transaction.mockRejectedValue(otherError);

      await expect(
        service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15')),
      ).rejects.toThrow('Database connection failed');
    });

    it('should create materialized blocks with correct data from template', async () => {
      const template = {
        ...mockTemplate,
        name: 'Meditation',
        startTime: '06:00',
        endTime: '06:30',
        color: '#FFD700',
        daysOfWeek: [1],
        notes: [],
      };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-123' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledWith({
        data: {
          name: 'Meditation',
          startTime: '06:00',
          endTime: '06:30',
          color: '#FFD700',
          isCompleted: false,
          order: 0,
          dayId: 'day-123',
          templateId: 'tpl-123',
        },
      });
    });

    it('should handle multiple templates for the same day', async () => {
      const template1 = { ...mockTemplate, id: 'tpl-1', daysOfWeek: [1], notes: [] };
      const template2 = {
        ...mockTemplate,
        id: 'tpl-2',
        name: 'Study',
        daysOfWeek: [1],
        notes: [],
      };
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([template1, template2]);
      mockPrismaService.timeBlock.findMany.mockResolvedValue([]);
      mockPrismaService.materializationExclusion.findMany.mockResolvedValue([]);

      const mockTxClient = {
        day: {
          upsert: jest.fn().mockResolvedValue({ id: 'day-new' }),
          update: jest.fn().mockResolvedValue({ nextTimeBlockOrder: 1 }),
        },
        timeBlock: {
          create: jest.fn().mockResolvedValue({ id: 'tb-new' }),
        },
        note: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(mockTxClient));

      await service.materializeForDateRange('user-123', utcDate('2024-01-15'), utcDate('2024-01-15'));

      expect(mockTxClient.timeBlock.create).toHaveBeenCalledTimes(2);
    });
  });

  // ─── materializeForDate ───────────────────────────────────────────────

  describe('materializeForDate', () => {
    it('should delegate to materializeForDateRange with same start and end date', async () => {
      mockPrismaService.timeBlockTemplate.findMany.mockResolvedValue([]);

      const date = new Date('2024-01-15T00:00:00.000Z');
      await service.materializeForDate('user-123', date);

      expect(prisma.timeBlockTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            OR: [{ activeUntil: null }, { activeUntil: { gte: date } }],
          }),
        }),
      );
    });
  });
});
