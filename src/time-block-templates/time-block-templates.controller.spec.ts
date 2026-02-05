import { Test, TestingModule } from '@nestjs/testing';
import { TimeBlockTemplatesController } from './time-block-templates.controller';
import { TimeBlockTemplatesService } from './time-block-templates.service';

describe('TimeBlockTemplatesController', () => {
  let controller: TimeBlockTemplatesController;
  let service: jest.Mocked<TimeBlockTemplatesService>;

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

  const mockTemplatesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deactivate: jest.fn(),
    materializeForDateRange: jest.fn(),
    materializeForDate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeBlockTemplatesController],
      providers: [
        {
          provide: TimeBlockTemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    }).compile();

    controller = module.get<TimeBlockTemplatesController>(TimeBlockTemplatesController);
    service = module.get(TimeBlockTemplatesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all templates for the user', async () => {
      const templates = [mockTemplate];
      mockTemplatesService.findAll.mockResolvedValue(templates);

      const result = await controller.findAll('user-123');

      expect(result).toEqual(templates);
      expect(service.findAll).toHaveBeenCalledWith('user-123');
    });
  });

  describe('findOne', () => {
    it('should return a single template', async () => {
      mockTemplatesService.findOne.mockResolvedValue(mockTemplate);

      const result = await controller.findOne('tpl-123', 'user-123');

      expect(result).toEqual(mockTemplate);
      expect(service.findOne).toHaveBeenCalledWith('tpl-123', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new template', async () => {
      mockTemplatesService.create.mockResolvedValue(mockTemplate);
      const dto = {
        name: 'Gym',
        startTime: '07:00',
        endTime: '08:00',
        daysOfWeek: [1, 3, 5],
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(mockTemplate);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      const updatedTemplate = { ...mockTemplate, name: 'Yoga' };
      mockTemplatesService.update.mockResolvedValue(updatedTemplate);

      const result = await controller.update('tpl-123', 'user-123', { name: 'Yoga' });

      expect(result).toEqual(updatedTemplate);
      expect(service.update).toHaveBeenCalledWith('tpl-123', 'user-123', { name: 'Yoga' });
    });
  });

  describe('deactivate', () => {
    it('should deactivate a template', async () => {
      const deactivated = { ...mockTemplate, isActive: false };
      mockTemplatesService.deactivate.mockResolvedValue(deactivated);
      const dto = { deleteFutureOccurrences: true };

      const result = await controller.deactivate('tpl-123', 'user-123', dto);

      expect(result).toEqual(deactivated);
      expect(service.deactivate).toHaveBeenCalledWith('tpl-123', 'user-123', dto);
    });
  });

  describe('remove', () => {
    it('should delete a template', async () => {
      mockTemplatesService.remove.mockResolvedValue(undefined);

      await controller.remove('tpl-123', 'user-123');

      expect(service.remove).toHaveBeenCalledWith('tpl-123', 'user-123');
    });
  });
});
