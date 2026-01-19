import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService, EventOccurrence } from '../events/events.service';
import { RecurrenceType } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let eventsService: jest.Mocked<EventsService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    currentStreak: 5,
    longestStreak: 10,
    lastCompletedDate: new Date('2024-01-14'),
  };

  const mockTodo = {
    id: 'todo-1',
    title: 'Test todo',
    isCompleted: false,
    deadline: null,
    order: 0,
  };

  const mockNote = {
    id: 'note-1',
    content: 'Test note',
    order: 0,
  };

  const mockTimeBlock = {
    id: 'tb-1',
    name: 'Morning',
    startTime: '09:00',
    endTime: '12:00',
    isCompleted: false,
    order: 0,
    color: '#A5D8FF',
    todos: [mockTodo],
    notes: [mockNote],
  };

  const mockDay = {
    id: 'day-123',
    date: new Date(),
    isCompleted: false,
    userId: 'user-123',
    timeBlocks: [mockTimeBlock],
    todos: [{ ...mockTodo, id: 'todo-2', isCompleted: true }],
  };

  const mockEvent: EventOccurrence = {
    id: 'event-1',
    title: 'Test Event',
    date: new Date(),
    color: '#B2F2BB',
    isRecurring: false,
    recurrenceType: RecurrenceType.NONE,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    isOccurrence: false,
    occurrenceDate: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    day: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockEventsService = {
    findByDateRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    eventsService = module.get(EventsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    beforeEach(() => {
      // Default mock setup for successful case
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.day.findUnique.mockResolvedValue(mockDay);
      mockPrismaService.day.count
        .mockResolvedValueOnce(20) // totalDays
        .mockResolvedValueOnce(15); // completedDays
      mockEventsService.findByDateRange.mockResolvedValue([mockEvent]);
    });

    it('should return complete dashboard data', async () => {
      const result = await service.getDashboard('user-123');

      expect(result).toHaveProperty('streaks');
      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('todayDetail');
      expect(result).toHaveProperty('upcomingEvents');
    });

    it('should return correct streaks data', async () => {
      const result = await service.getDashboard('user-123');

      expect(result.streaks).toEqual({
        currentStreak: 5,
        longestStreak: 10,
        lastCompletedDate: mockUser.lastCompletedDate,
        totalCompletedDays: 15,
        totalDays: 20,
        overallDayCompletionRate: 75,
      });
    });

    it('should return correct today stats when day exists', async () => {
      const result = await service.getDashboard('user-123');

      expect(result.today.dayExists).toBe(true);
      expect(result.today.totalTodos).toBe(2); // 1 in timeBlock + 1 day-level
      expect(result.today.completedTodos).toBe(1); // only day-level todo is completed
      expect(result.today.totalTimeBlocks).toBe(1);
      expect(result.today.completedTimeBlocks).toBe(0);
    });

    it('should return null todayDetail when no day exists', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue(null);

      const result = await service.getDashboard('user-123');

      expect(result.todayDetail).toBeNull();
      expect(result.today.dayExists).toBe(false);
    });

    it('should return upcoming events', async () => {
      const result = await service.getDashboard('user-123');

      expect(result.upcomingEvents).toHaveLength(1);
      expect(result.upcomingEvents[0].title).toBe('Test Event');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getDashboard('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return 0 completion rate when no days exist', async () => {
      mockPrismaService.day.count
        .mockReset()
        .mockResolvedValueOnce(0) // totalDays
        .mockResolvedValueOnce(0); // completedDays

      const result = await service.getDashboard('user-123');

      expect(result.streaks.overallDayCompletionRate).toBe(0);
      expect(result.streaks.totalDays).toBe(0);
    });

    it('should correctly map todayDetail with nested data', async () => {
      const result = await service.getDashboard('user-123');

      expect(result.todayDetail).not.toBeNull();
      expect(result.todayDetail!.timeBlocks).toHaveLength(1);
      expect(result.todayDetail!.timeBlocks[0].todos).toHaveLength(1);
      expect(result.todayDetail!.timeBlocks[0].notes).toHaveLength(1);
      expect(result.todayDetail!.todos).toHaveLength(1);
    });

    it('should call eventsService with correct date range', async () => {
      await service.getDashboard('user-123');

      expect(eventsService.findByDateRange).toHaveBeenCalledTimes(1);
      expect(eventsService.findByDateRange).toHaveBeenCalledWith(
        'user-123',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // today
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // next week
      );
    });

    it('should execute queries in parallel', async () => {
      // This test ensures Promise.all is being used (performance)
      const startTime = Date.now();

      // Make the mock calls take some time
      mockPrismaService.user.findUnique.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockUser), 50)),
      );
      mockPrismaService.day.findUnique.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockDay), 50)),
      );
      mockEventsService.findByDateRange.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([mockEvent]), 50)),
      );
      mockPrismaService.day.count.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(10), 50)),
      );

      await service.getDashboard('user-123');

      const elapsed = Date.now() - startTime;
      // If running sequentially, would take ~250ms (5 calls * 50ms)
      // With parallel execution, should be ~50-100ms
      expect(elapsed).toBeLessThan(200);
    });

    it('should handle empty timeBlocks and todos', async () => {
      mockPrismaService.day.findUnique.mockResolvedValue({
        ...mockDay,
        timeBlocks: [],
        todos: [],
      });

      const result = await service.getDashboard('user-123');

      expect(result.today.totalTodos).toBe(0);
      expect(result.today.totalTimeBlocks).toBe(0);
      expect(result.today.todoCompletionRate).toBe(0);
      expect(result.today.timeBlockCompletionRate).toBe(0);
    });
  });
});
