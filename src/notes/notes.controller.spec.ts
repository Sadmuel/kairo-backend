import { Test, TestingModule } from '@nestjs/testing';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

describe('NotesController', () => {
  let controller: NotesController;
  let service: jest.Mocked<NotesService>;

  const mockNote = {
    id: 'note-123',
    content: 'Wake up and stretch',
    order: 0,
    timeBlockId: 'tb-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotesService = {
    findByTimeBlock: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [
        {
          provide: NotesService,
          useValue: mockNotesService,
        },
      ],
    }).compile();

    controller = module.get<NotesController>(NotesController);
    service = module.get(NotesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return notes for a time block', async () => {
      const notes = [mockNote];
      mockNotesService.findByTimeBlock.mockResolvedValue(notes);

      const result = await controller.findAll('tb-123', 'user-123');

      expect(result).toEqual(notes);
      expect(service.findByTimeBlock).toHaveBeenCalledWith('tb-123', 'user-123');
    });
  });

  describe('findOne', () => {
    it('should return a single note', async () => {
      mockNotesService.findOne.mockResolvedValue(mockNote);

      const result = await controller.findOne('note-123', 'user-123');

      expect(result).toEqual(mockNote);
      expect(service.findOne).toHaveBeenCalledWith('note-123', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new note', async () => {
      mockNotesService.create.mockResolvedValue(mockNote);
      const dto = {
        content: 'Wake up and stretch',
        timeBlockId: 'tb-123',
      };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(mockNote);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('update', () => {
    it('should update a note', async () => {
      const updatedNote = { ...mockNote, content: 'Updated content' };
      mockNotesService.update.mockResolvedValue(updatedNote);

      const result = await controller.update('note-123', 'user-123', {
        content: 'Updated content',
      });

      expect(result).toEqual(updatedNote);
      expect(service.update).toHaveBeenCalledWith('note-123', 'user-123', {
        content: 'Updated content',
      });
    });
  });

  describe('remove', () => {
    it('should delete a note', async () => {
      mockNotesService.remove.mockResolvedValue(undefined);

      await controller.remove('note-123', 'user-123');

      expect(service.remove).toHaveBeenCalledWith('note-123', 'user-123');
    });
  });

  describe('reorder', () => {
    it('should reorder notes', async () => {
      const reorderedNotes = [
        { ...mockNote, order: 0 },
        { ...mockNote, id: 'note-456', order: 1 },
      ];
      mockNotesService.reorder.mockResolvedValue(reorderedNotes);

      const result = await controller.reorder('tb-123', 'user-123', {
        orderedIds: ['note-123', 'note-456'],
      });

      expect(result).toEqual(reorderedNotes);
      expect(service.reorder).toHaveBeenCalledWith('user-123', 'tb-123', {
        orderedIds: ['note-123', 'note-456'],
      });
    });
  });
});
