import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto, ReorderNotesDto } from './dto';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Notes')
@ApiBearerAuth()
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notes for a time block' })
  @ApiQuery({ name: 'timeBlockId', description: 'Time block UUID' })
  @ApiResponse({ status: 200, description: 'Returns notes in order' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  findAll(
    @Query('timeBlockId', ParseUUIDPipe) timeBlockId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.findByTimeBlock(timeBlockId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single note by ID' })
  @ApiParam({ name: 'id', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Returns note with time block info' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.notesService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateNoteDto) {
    return this.notesService.create(userId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder notes within a time block' })
  @ApiQuery({ name: 'timeBlockId', description: 'Time block UUID' })
  @ApiResponse({ status: 200, description: 'Returns reordered notes' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  reorder(
    @Query('timeBlockId', ParseUUIDPipe) timeBlockId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderNotesDto,
  ) {
    return this.notesService.reorder(userId, timeBlockId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note' })
  @ApiParam({ name: 'id', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'id', description: 'Note UUID' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.notesService.remove(id, userId);
  }
}
