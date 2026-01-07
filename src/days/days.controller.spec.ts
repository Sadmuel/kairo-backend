import { Test, TestingModule } from '@nestjs/testing';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';

describe('DaysController', () => {
  let controller: DaysController;
  let service: jest.Mocked<DaysService>;

  const mockDay = {
    id: 'day-123',
    date: new Date('2024-01-15'),
    isCompleted: false,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    timeBlocks: [],
  };

  const mockDaysService = {
    findByDateRange: jest.fn(),
    findOne: jest.fn(),
    findByDate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DaysController],
      providers: [
        {
          provide: DaysService,
          useValue: mockDaysService,
        },
      ],
    }).compile();

    controller = module.get<DaysController>(DaysController);
    service = module.get(DaysService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return days in date range', async () => {
      const days = [mockDay];
      mockDaysService.findByDateRange.mockResolvedValue(days);

      const result = await controller.findAll('user-123', {
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      });

      expect(result).toEqual(days);
      expect(service.findByDateRange).toHaveBeenCalledWith('user-123', '2024-01-15', '2024-01-20');
    });
  });

  describe('findOne', () => {
    it('should return a single day', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);

      const result = await controller.findOne('day-123', 'user-123');

      expect(result).toEqual(mockDay);
      expect(service.findOne).toHaveBeenCalledWith('day-123', 'user-123');
    });
  });

  describe('findByDate', () => {
    it('should return day by date', async () => {
      mockDaysService.findByDate.mockResolvedValue(mockDay);

      const result = await controller.findByDate('2024-01-15', 'user-123');

      expect(result).toEqual(mockDay);
      expect(service.findByDate).toHaveBeenCalledWith('user-123', '2024-01-15');
    });
  });

  describe('create', () => {
    it('should create a new day', async () => {
      mockDaysService.create.mockResolvedValue(mockDay);

      const result = await controller.create('user-123', { date: '2024-01-15' });

      expect(result).toEqual(mockDay);
      expect(service.create).toHaveBeenCalledWith('user-123', { date: '2024-01-15' });
    });
  });

  describe('update', () => {
    it('should update a day', async () => {
      const updatedDay = { ...mockDay, isCompleted: true };
      mockDaysService.update.mockResolvedValue(updatedDay);

      const result = await controller.update('day-123', 'user-123', { isCompleted: true });

      expect(result).toEqual(updatedDay);
      expect(service.update).toHaveBeenCalledWith('day-123', 'user-123', { isCompleted: true });
    });
  });

  describe('remove', () => {
    it('should delete a day', async () => {
      mockDaysService.remove.mockResolvedValue(mockDay);

      const result = await controller.remove('day-123', 'user-123');

      expect(result).toEqual(mockDay);
      expect(service.remove).toHaveBeenCalledWith('day-123', 'user-123');
    });
  });
});
