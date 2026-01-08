import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrenceType } from '@prisma/client';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockEvent = {
    id: 'event-123',
    title: 'Team Meeting',
    date: new Date('2024-01-15T00:00:00.000Z'),
    color: '#A5D8FF',
    isRecurring: false,
    recurrenceType: RecurrenceType.NONE,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRecurringEvent = {
    id: 'event-456',
    title: 'Weekly Standup',
    date: new Date('2024-01-01T00:00:00.000Z'),
    color: '#B2F2BB',
    isRecurring: true,
    recurrenceType: RecurrenceType.WEEKLY,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all user events', async () => {
      const events = [mockEvent];
      mockPrismaService.event.findMany.mockResolvedValue(events);

      const result = await service.findAll('user-123');

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { date: 'asc' },
      });
    });

    it('should return empty array when no events', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByDateRange', () => {
    it('should return non-recurring events within range', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([mockEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-31');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Team Meeting');
      expect(result[0].isOccurrence).toBe(false);
    });

    it('should exclude non-recurring events outside range', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);

      const result = await service.findByDateRange('user-123', '2024-02-01', '2024-02-28');

      expect(result).toHaveLength(0);
    });

    it('should generate weekly occurrences within range', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([mockRecurringEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-31');

      // Jan 1, 8, 15, 22, 29 = 5 occurrences
      expect(result).toHaveLength(5);
      expect(result[0].isOccurrence).toBe(false); // First occurrence is original
      expect(result[1].isOccurrence).toBe(true);
      expect(result[2].isOccurrence).toBe(true);
    });

    it('should generate daily occurrences within range', async () => {
      const dailyEvent = {
        ...mockRecurringEvent,
        recurrenceType: RecurrenceType.DAILY,
      };
      mockPrismaService.event.findMany.mockResolvedValue([dailyEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-07');

      // Jan 1-7 = 7 occurrences
      expect(result).toHaveLength(7);
    });

    it('should generate monthly occurrences within range', async () => {
      const monthlyEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-15T00:00:00.000Z'),
        recurrenceType: RecurrenceType.MONTHLY,
      };
      mockPrismaService.event.findMany.mockResolvedValue([monthlyEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-04-30');

      // Jan 15, Feb 15, Mar 15, Apr 15 = 4 occurrences
      expect(result).toHaveLength(4);
    });

    it('should generate yearly occurrences within range', async () => {
      const yearlyEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-15T00:00:00.000Z'),
        recurrenceType: RecurrenceType.YEARLY,
      };
      mockPrismaService.event.findMany.mockResolvedValue([yearlyEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2026-12-31');

      // Jan 15 2024, 2025, 2026 = 3 occurrences
      expect(result).toHaveLength(3);
    });

    it('should throw BadRequestException when startDate > endDate', async () => {
      await expect(service.findByDateRange('user-123', '2024-01-31', '2024-01-01')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByDateRange('user-123', '2024-01-31', '2024-01-01')).rejects.toThrow(
        'startDate must be less than or equal to endDate',
      );
    });

    it('should return empty array for empty range', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-01');

      expect(result).toEqual([]);
    });

    it('should handle recurring events starting before range', async () => {
      // Event started in December 2023, querying January 2024
      const oldEvent = {
        ...mockRecurringEvent,
        date: new Date('2023-12-01T00:00:00.000Z'),
      };
      mockPrismaService.event.findMany.mockResolvedValue([oldEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-31');

      // Weekly occurrences in Jan: 5, 12, 19, 26 = 4 occurrences
      expect(result).toHaveLength(4);
      expect(result[0].isOccurrence).toBe(true); // All are generated occurrences
    });

    it('should handle monthly event on 31st in February (last day of month)', async () => {
      const monthlyEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-31T00:00:00.000Z'),
        recurrenceType: RecurrenceType.MONTHLY,
      };
      mockPrismaService.event.findMany.mockResolvedValue([monthlyEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-03-31');

      // Jan 31, Feb 29 (2024 is leap year), Mar 31 = 3 occurrences
      expect(result).toHaveLength(3);
      // Check February occurrence is Feb 29
      const febOccurrence = result[1];
      expect(febOccurrence.occurrenceDate.getUTCMonth()).toBe(1); // February
      expect(febOccurrence.occurrenceDate.getUTCDate()).toBe(29);
    });

    it('should generate WEEKDAYS occurrences (Mon-Fri only)', async () => {
      const weekdaysEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-01T00:00:00.000Z'), // Monday
        recurrenceType: RecurrenceType.WEEKDAYS,
      };
      mockPrismaService.event.findMany.mockResolvedValue([weekdaysEvent]);

      // Jan 1-7, 2024: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(7)
      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-07');

      // Should only include Mon-Fri = 5 occurrences
      expect(result).toHaveLength(5);
      // Check that all occurrences are weekdays
      for (const occurrence of result) {
        const dayOfWeek = occurrence.occurrenceDate.getUTCDay();
        expect(dayOfWeek).toBeGreaterThanOrEqual(1); // Monday or later
        expect(dayOfWeek).toBeLessThanOrEqual(5); // Friday or earlier
      }
    });

    it('should generate WEEKENDS occurrences (Sat-Sun only)', async () => {
      const weekendsEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-06T00:00:00.000Z'), // Saturday
        recurrenceType: RecurrenceType.WEEKENDS,
      };
      mockPrismaService.event.findMany.mockResolvedValue([weekendsEvent]);

      // Jan 1-14, 2024 should have 2 full weekends
      const result = await service.findByDateRange('user-123', '2024-01-01', '2024-01-14');

      // Should include Sat(6), Sun(7), Sat(13), Sun(14) = 4 occurrences
      expect(result).toHaveLength(4);
      // Check that all occurrences are weekend days
      for (const occurrence of result) {
        const dayOfWeek = occurrence.occurrenceDate.getUTCDay();
        expect(dayOfWeek === 0 || dayOfWeek === 6).toBe(true);
      }
    });

    it('should handle WEEKDAYS event starting on weekend', async () => {
      const weekdaysEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-01-06T00:00:00.000Z'), // Saturday
        recurrenceType: RecurrenceType.WEEKDAYS,
      };
      mockPrismaService.event.findMany.mockResolvedValue([weekdaysEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-06', '2024-01-12');

      // Jan 6 (Sat), 7 (Sun) skipped, 8 (Mon), 9 (Tue), 10 (Wed), 11 (Thu), 12 (Fri) = 5 weekdays
      expect(result).toHaveLength(5);
      // First occurrence should be Monday Jan 8
      expect(result[0].occurrenceDate.getUTCDate()).toBe(8);
    });

    it('should handle yearly event on Feb 29 in non-leap year', async () => {
      const leapYearEvent = {
        ...mockRecurringEvent,
        date: new Date('2024-02-29T00:00:00.000Z'),
        recurrenceType: RecurrenceType.YEARLY,
      };
      mockPrismaService.event.findMany.mockResolvedValue([leapYearEvent]);

      const result = await service.findByDateRange('user-123', '2024-01-01', '2025-12-31');

      // 2024: Feb 29, 2025: Feb 28 (last day of Feb) = 2 occurrences
      expect(result).toHaveLength(2);
      // Check 2025 occurrence is Feb 28
      const feb2025Occurrence = result[1];
      expect(feb2025Occurrence.occurrenceDate.getUTCFullYear()).toBe(2025);
      expect(feb2025Occurrence.occurrenceDate.getUTCMonth()).toBe(1); // February
      expect(feb2025Occurrence.occurrenceDate.getUTCDate()).toBe(28);
    });
  });

  describe('findOne', () => {
    it('should return event when found', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);

      const result = await service.findOne('event-123', 'user-123');

      expect(result).toEqual(mockEvent);
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { id: 'event-123', userId: 'user-123' },
      });
    });

    it('should throw NotFoundException when event not found', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow('Event not found');
    });

    it('should throw NotFoundException for different user', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      await expect(service.findOne('event-123', 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create non-recurring event', async () => {
      mockPrismaService.event.create.mockResolvedValue(mockEvent);

      const result = await service.create('user-123', {
        title: 'Team Meeting',
        date: '2024-01-15',
      });

      expect(result).toEqual(mockEvent);
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          title: 'Team Meeting',
          date: new Date('2024-01-15T00:00:00.000Z'),
          color: null,
          isRecurring: false,
          recurrenceType: RecurrenceType.NONE,
          userId: 'user-123',
        },
      });
    });

    it('should create recurring event with weekly recurrence', async () => {
      mockPrismaService.event.create.mockResolvedValue(mockRecurringEvent);

      const result = await service.create('user-123', {
        title: 'Weekly Standup',
        date: '2024-01-01',
        isRecurring: true,
        recurrenceType: RecurrenceType.WEEKLY,
      });

      expect(result).toEqual(mockRecurringEvent);
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRecurring: true,
          recurrenceType: RecurrenceType.WEEKLY,
        }),
      });
    });

    it('should create event with color', async () => {
      const eventWithColor = { ...mockEvent, color: '#A5D8FF' };
      mockPrismaService.event.create.mockResolvedValue(eventWithColor);

      await service.create('user-123', {
        title: 'Team Meeting',
        date: '2024-01-15',
        color: '#A5D8FF',
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          color: '#A5D8FF',
        }),
      });
    });

    it('should throw BadRequestException when isRecurring=true but recurrenceType=NONE', async () => {
      await expect(
        service.create('user-123', {
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: true,
          recurrenceType: RecurrenceType.NONE,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', {
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: true,
          recurrenceType: RecurrenceType.NONE,
        }),
      ).rejects.toThrow('Recurring events must have a recurrence type other than NONE');
    });

    it('should throw BadRequestException when isRecurring=false but recurrenceType!=NONE', async () => {
      await expect(
        service.create('user-123', {
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: false,
          recurrenceType: RecurrenceType.WEEKLY,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', {
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: false,
          recurrenceType: RecurrenceType.WEEKLY,
        }),
      ).rejects.toThrow('Non-recurring events must have recurrence type NONE');
    });

    it('should default isRecurring to false', async () => {
      mockPrismaService.event.create.mockResolvedValue(mockEvent);

      await service.create('user-123', {
        title: 'Team Meeting',
        date: '2024-01-15',
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRecurring: false,
        }),
      });
    });

    it('should default recurrenceType to NONE', async () => {
      mockPrismaService.event.create.mockResolvedValue(mockEvent);

      await service.create('user-123', {
        title: 'Team Meeting',
        date: '2024-01-15',
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recurrenceType: RecurrenceType.NONE,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update event title', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        title: 'Updated Title',
      });

      const result = await service.update('event-123', 'user-123', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { title: 'Updated Title' },
      });
    });

    it('should update event date', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        date: new Date('2024-02-20T00:00:00.000Z'),
      });

      await service.update('event-123', 'user-123', {
        date: '2024-02-20',
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { date: new Date('2024-02-20T00:00:00.000Z') },
      });
    });

    it('should update event color', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        color: '#FFEC99',
      });

      await service.update('event-123', 'user-123', {
        color: '#FFEC99',
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { color: '#FFEC99' },
      });
    });

    it('should remove color when set to null', async () => {
      const eventWithColor = { ...mockEvent, color: '#A5D8FF' };
      mockPrismaService.event.findFirst.mockResolvedValue(eventWithColor);
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        color: null,
      });

      await service.update('event-123', 'user-123', {
        color: null,
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { color: null },
      });
    });

    it('should update recurrence settings', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.event.update.mockResolvedValue({
        ...mockEvent,
        isRecurring: true,
        recurrenceType: RecurrenceType.DAILY,
      });

      await service.update('event-123', 'user-123', {
        isRecurring: true,
        recurrenceType: RecurrenceType.DAILY,
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          isRecurring: true,
          recurrenceType: RecurrenceType.DAILY,
        },
      });
    });

    it('should throw BadRequestException for invalid recurrence combination on update', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);

      // Try to set recurrenceType without setting isRecurring
      await expect(
        service.update('event-123', 'user-123', {
          recurrenceType: RecurrenceType.WEEKLY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when event not found', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'user-123', { title: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete event', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(mockEvent);
      mockPrismaService.event.delete.mockResolvedValue(mockEvent);

      await service.remove('event-123', 'user-123');

      expect(prisma.event.delete).toHaveBeenCalledWith({
        where: { id: 'event-123' },
      });
    });

    it('should throw NotFoundException when event not found', async () => {
      mockPrismaService.event.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });
});
