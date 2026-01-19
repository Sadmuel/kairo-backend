import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUsersService = {
    getStats: jest.fn(),
    getDayStats: jest.fn(),
    getWeekStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    const mockStats = {
      currentStreak: 5,
      longestStreak: 10,
      lastCompletedDate: new Date('2024-01-15'),
      totalCompletedDays: 15,
      totalDays: 20,
      overallDayCompletionRate: 75,
    };

    it('should return user stats', async () => {
      mockUsersService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('user-123');

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledWith('user-123');
      expect(service.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDayStats', () => {
    const mockDayStats = {
      date: '2024-01-15',
      dayExists: true,
      isCompleted: true,
      completedTodos: 8,
      totalTodos: 10,
      todoCompletionRate: 80,
      completedTimeBlocks: 4,
      totalTimeBlocks: 4,
      timeBlockCompletionRate: 100,
    };

    it('should return day stats', async () => {
      mockUsersService.getDayStats.mockResolvedValue(mockDayStats);

      const result = await controller.getDayStats('user-123', '2024-01-15');

      expect(result).toEqual(mockDayStats);
      expect(service.getDayStats).toHaveBeenCalledWith('user-123', '2024-01-15');
      expect(service.getDayStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWeekStats', () => {
    const mockWeekStats = {
      weekStart: '2024-01-15',
      weekEnd: '2024-01-21',
      completedDays: 3,
      totalDays: 5,
      completedTodos: 25,
      totalTodos: 40,
      todoCompletionRate: 63,
      completedTimeBlocks: 15,
      totalTimeBlocks: 20,
      timeBlockCompletionRate: 75,
      dailyStats: [],
    };

    it('should return week stats', async () => {
      mockUsersService.getWeekStats.mockResolvedValue(mockWeekStats);

      const result = await controller.getWeekStats('user-123', '2024-01-17');

      expect(result).toEqual(mockWeekStats);
      expect(service.getWeekStats).toHaveBeenCalledWith('user-123', '2024-01-17');
      expect(service.getWeekStats).toHaveBeenCalledTimes(1);
    });
  });
});
