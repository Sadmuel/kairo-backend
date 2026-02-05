import { Test, TestingModule } from '@nestjs/testing';
import { TimeBlocksController } from './time-blocks.controller';
import { TimeBlocksService } from './time-blocks.service';

describe('TimeBlocksController', () => {
  let controller: TimeBlocksController;
  let service: jest.Mocked<TimeBlocksService>;

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

  const mockTimeBlocksService = {
    findByDay: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
    duplicate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeBlocksController],
      providers: [
        {
          provide: TimeBlocksService,
          useValue: mockTimeBlocksService,
        },
      ],
    }).compile();

    controller = module.get<TimeBlocksController>(TimeBlocksController);
    service = module.get(TimeBlocksService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return time blocks for a day', async () => {
      const timeBlocks = [mockTimeBlock];
      mockTimeBlocksService.findByDay.mockResolvedValue(timeBlocks);

      const result = await controller.findAll('day-123', 'user-123');

      expect(result).toEqual(timeBlocks);
      expect(service.findByDay).toHaveBeenCalledWith('day-123', 'user-123');
    });
  });

  describe('findOne', () => {
    it('should return a single time block', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);

      const result = await controller.findOne('tb-123', 'user-123');

      expect(result).toEqual(mockTimeBlock);
      expect(service.findOne).toHaveBeenCalledWith('tb-123', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new time block', async () => {
      mockTimeBlocksService.create.mockResolvedValue(mockTimeBlock);
      const dto = {
        name: 'Morning Routine',
        startTime: '06:00',
        endTime: '08:00',
        dayId: 'day-123',
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(mockTimeBlock);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('update', () => {
    it('should update a time block', async () => {
      const updatedBlock = { ...mockTimeBlock, name: 'Updated Name' };
      mockTimeBlocksService.update.mockResolvedValue(updatedBlock);

      const result = await controller.update('tb-123', 'user-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedBlock);
      expect(service.update).toHaveBeenCalledWith('tb-123', 'user-123', { name: 'Updated Name' });
    });
  });

  describe('remove', () => {
    it('should delete a time block', async () => {
      mockTimeBlocksService.remove.mockResolvedValue(undefined);

      await controller.remove('tb-123', 'user-123');

      expect(service.remove).toHaveBeenCalledWith('tb-123', 'user-123');
    });
  });

  describe('reorder', () => {
    it('should reorder time blocks', async () => {
      const reorderedBlocks = [
        { ...mockTimeBlock, order: 0 },
        { ...mockTimeBlock, id: 'tb-456', order: 1 },
      ];
      mockTimeBlocksService.reorder.mockResolvedValue(reorderedBlocks);

      const result = await controller.reorder('day-123', 'user-123', {
        orderedIds: ['tb-123', 'tb-456'],
      });

      expect(result).toEqual(reorderedBlocks);
      expect(service.reorder).toHaveBeenCalledWith('user-123', 'day-123', {
        orderedIds: ['tb-123', 'tb-456'],
      });
    });
  });

  describe('duplicate', () => {
    it('should duplicate a time block to a target day', async () => {
      const duplicatedBlock = { ...mockTimeBlock, id: 'tb-new', dayId: 'day-456' };
      mockTimeBlocksService.duplicate.mockResolvedValue(duplicatedBlock);
      const dto = { targetDayId: 'day-456' };

      const result = await controller.duplicate('tb-123', 'user-123', dto);

      expect(result).toEqual(duplicatedBlock);
      expect(service.duplicate).toHaveBeenCalledWith('tb-123', 'user-123', dto);
    });

    it('should pass all options through to service', async () => {
      mockTimeBlocksService.duplicate.mockResolvedValue(mockTimeBlock);
      const dto = {
        targetDayId: 'day-456',
        includeNotes: false,
        includeTodos: true,
        startTime: '10:00',
        endTime: '12:00',
      };

      await controller.duplicate('tb-123', 'user-123', dto);

      expect(service.duplicate).toHaveBeenCalledWith('tb-123', 'user-123', dto);
    });
  });
});
