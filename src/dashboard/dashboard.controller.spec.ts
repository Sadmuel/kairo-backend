import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { RecurrenceType } from '@prisma/client';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  const mockDashboardResponse = {
    streaks: {
      currentStreak: 5,
      longestStreak: 10,
      lastCompletedDate: new Date('2024-01-14'),
      totalCompletedDays: 15,
      totalDays: 20,
      overallDayCompletionRate: 75,
    },
    today: {
      date: '2024-01-15',
      dayExists: true,
      isCompleted: false,
      completedTodos: 3,
      totalTodos: 5,
      todoCompletionRate: 60,
      completedTimeBlocks: 1,
      totalTimeBlocks: 3,
      timeBlockCompletionRate: 33,
    },
    todayDetail: {
      id: 'day-123',
      date: new Date('2024-01-15'),
      isCompleted: false,
      timeBlocks: [
        {
          id: 'tb-1',
          name: 'Morning',
          startTime: '09:00',
          endTime: '12:00',
          isCompleted: true,
          order: 0,
          color: '#A5D8FF',
          notes: [],
          todos: [],
        },
      ],
      todos: [],
    },
    upcomingEvents: [
      {
        id: 'event-1',
        title: 'Meeting',
        date: new Date('2024-01-16'),
        color: '#B2F2BB',
        isRecurring: false,
        recurrenceType: RecurrenceType.NONE,
        isOccurrence: false,
        occurrenceDate: new Date('2024-01-16'),
      },
    ],
  };

  const mockDashboardService = {
    getDashboard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get(DashboardService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      mockDashboardService.getDashboard.mockResolvedValue(mockDashboardResponse);

      const result = await controller.getDashboard('user-123');

      expect(result).toEqual(mockDashboardResponse);
      expect(service.getDashboard).toHaveBeenCalledWith('user-123', undefined);
      expect(service.getDashboard).toHaveBeenCalledTimes(1);
    });

    it('should pass correct userId and date to service', async () => {
      mockDashboardService.getDashboard.mockResolvedValue(mockDashboardResponse);

      await controller.getDashboard('different-user-456', '2026-01-20');

      expect(service.getDashboard).toHaveBeenCalledWith('different-user-456', '2026-01-20');
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Service error');
      mockDashboardService.getDashboard.mockRejectedValue(error);

      await expect(controller.getDashboard('user-123')).rejects.toThrow(error);
    });
  });
});
