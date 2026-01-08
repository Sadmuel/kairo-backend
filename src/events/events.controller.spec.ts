import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService, EventOccurrence } from './events.service';
import { RecurrenceType } from '@prisma/client';

describe('EventsController', () => {
  let controller: EventsController;
  let service: jest.Mocked<EventsService>;

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

  const mockOccurrence: EventOccurrence = {
    ...mockEvent,
    isOccurrence: false,
    occurrenceDate: new Date('2024-01-15T00:00:00.000Z'),
  };

  const mockEventsService = {
    findAll: jest.fn(),
    findByDateRange: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get(EventsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all user events', async () => {
      const events = [mockEvent];
      mockEventsService.findAll.mockResolvedValue(events);

      const result = await controller.findAll('user-123');

      expect(result).toEqual(events);
      expect(service.findAll).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array when no events', async () => {
      mockEventsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByDateRange', () => {
    it('should return events in date range', async () => {
      const occurrences = [mockOccurrence];
      mockEventsService.findByDateRange.mockResolvedValue(occurrences);

      const result = await controller.findByDateRange('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result).toEqual(occurrences);
      expect(service.findByDateRange).toHaveBeenCalledWith('user-123', '2024-01-01', '2024-01-31');
    });

    it('should pass query params to service correctly', async () => {
      mockEventsService.findByDateRange.mockResolvedValue([]);

      await controller.findByDateRange('user-123', {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });

      expect(service.findByDateRange).toHaveBeenCalledWith('user-123', '2024-06-01', '2024-06-30');
    });
  });

  describe('findOne', () => {
    it('should return a single event', async () => {
      mockEventsService.findOne.mockResolvedValue(mockEvent);

      const result = await controller.findOne('event-123', 'user-123');

      expect(result).toEqual(mockEvent);
      expect(service.findOne).toHaveBeenCalledWith('event-123', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a non-recurring event', async () => {
      mockEventsService.create.mockResolvedValue(mockEvent);
      const dto = {
        title: 'Team Meeting',
        date: '2024-01-15',
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(mockEvent);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });

    it('should create a recurring event', async () => {
      const recurringEvent = {
        ...mockEvent,
        isRecurring: true,
        recurrenceType: RecurrenceType.WEEKLY,
      };
      mockEventsService.create.mockResolvedValue(recurringEvent);
      const dto = {
        title: 'Weekly Standup',
        date: '2024-01-15',
        isRecurring: true,
        recurrenceType: RecurrenceType.WEEKLY,
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(recurringEvent);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });

    it('should create an event with color', async () => {
      const coloredEvent = { ...mockEvent, color: '#B2F2BB' };
      mockEventsService.create.mockResolvedValue(coloredEvent);
      const dto = {
        title: 'Team Meeting',
        date: '2024-01-15',
        color: '#B2F2BB',
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(coloredEvent);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('update', () => {
    it('should update an event title', async () => {
      const updatedEvent = { ...mockEvent, title: 'Updated Meeting' };
      mockEventsService.update.mockResolvedValue(updatedEvent);

      const result = await controller.update('event-123', 'user-123', {
        title: 'Updated Meeting',
      });

      expect(result).toEqual(updatedEvent);
      expect(service.update).toHaveBeenCalledWith('event-123', 'user-123', {
        title: 'Updated Meeting',
      });
    });

    it('should update an event date', async () => {
      const updatedEvent = {
        ...mockEvent,
        date: new Date('2024-02-20T00:00:00.000Z'),
      };
      mockEventsService.update.mockResolvedValue(updatedEvent);

      const result = await controller.update('event-123', 'user-123', {
        date: '2024-02-20',
      });

      expect(result).toEqual(updatedEvent);
      expect(service.update).toHaveBeenCalledWith('event-123', 'user-123', {
        date: '2024-02-20',
      });
    });

    it('should update recurrence settings', async () => {
      const updatedEvent = {
        ...mockEvent,
        isRecurring: true,
        recurrenceType: RecurrenceType.MONTHLY,
      };
      mockEventsService.update.mockResolvedValue(updatedEvent);

      const result = await controller.update('event-123', 'user-123', {
        isRecurring: true,
        recurrenceType: RecurrenceType.MONTHLY,
      });

      expect(result).toEqual(updatedEvent);
      expect(service.update).toHaveBeenCalledWith('event-123', 'user-123', {
        isRecurring: true,
        recurrenceType: RecurrenceType.MONTHLY,
      });
    });
  });

  describe('remove', () => {
    it('should delete an event', async () => {
      mockEventsService.remove.mockResolvedValue(undefined);

      await controller.remove('event-123', 'user-123');

      expect(service.remove).toHaveBeenCalledWith('event-123', 'user-123');
    });
  });
});
