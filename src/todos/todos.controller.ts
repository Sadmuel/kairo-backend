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
import { TodosService } from './todos.service';
import {
  CreateTodoDto,
  UpdateTodoDto,
  ReorderTodosDto,
  MoveTodoDto,
  TodoFilterQueryDto,
} from './dto';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Todos')
@ApiBearerAuth()
@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private todosService: TodosService) {}

  @Get()
  @ApiOperation({ summary: 'Get all todos with optional filters' })
  @ApiQuery({
    name: 'dayId',
    required: false,
    description: 'Filter by day UUID',
  })
  @ApiQuery({
    name: 'timeBlockId',
    required: false,
    description: 'Filter by time block UUID',
  })
  @ApiQuery({
    name: 'isCompleted',
    required: false,
    description: 'Filter by completion status',
  })
  @ApiQuery({
    name: 'inbox',
    required: false,
    description: 'Get only unassigned (inbox) todos',
  })
  @ApiResponse({ status: 200, description: 'Returns filtered todos in order' })
  findAll(@CurrentUser('id') userId: string, @Query() filters: TodoFilterQueryDto) {
    return this.todosService.findAll(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single todo by ID' })
  @ApiParam({ name: 'id', description: 'Todo UUID' })
  @ApiResponse({ status: 200, description: 'Returns todo with context info' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.todosService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new todo' })
  @ApiResponse({ status: 201, description: 'Todo created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or both dayId and timeBlockId provided',
  })
  @ApiResponse({ status: 404, description: 'Day or time block not found' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTodoDto) {
    return this.todosService.create(userId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder todos within a context' })
  @ApiQuery({
    name: 'dayId',
    required: false,
    description: 'Day context UUID',
  })
  @ApiQuery({
    name: 'timeBlockId',
    required: false,
    description: 'Time block context UUID',
  })
  @ApiQuery({
    name: 'inbox',
    required: false,
    description: 'Reorder inbox todos (set to true)',
  })
  @ApiResponse({ status: 200, description: 'Returns reordered todos' })
  @ApiResponse({ status: 400, description: 'Invalid context parameters' })
  @ApiResponse({ status: 404, description: 'Context not found' })
  reorder(
    @CurrentUser('id') userId: string,
    @Query('dayId') dayId: string,
    @Query('timeBlockId') timeBlockId: string,
    @Query('inbox') inbox: string,
    @Body() dto: ReorderTodosDto,
  ) {
    return this.todosService.reorder(
      userId,
      {
        dayId: dayId || undefined,
        timeBlockId: timeBlockId || undefined,
        inbox: inbox === 'true',
      },
      dto,
    );
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move todo to a different context' })
  @ApiParam({ name: 'id', description: 'Todo UUID' })
  @ApiResponse({ status: 200, description: 'Todo moved successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid target (both dayId and timeBlockId provided)',
  })
  @ApiResponse({ status: 404, description: 'Todo or target not found' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: MoveTodoDto,
  ) {
    return this.todosService.move(id, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  @ApiParam({ name: 'id', description: 'Todo UUID' })
  @ApiResponse({ status: 200, description: 'Todo updated successfully' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a todo' })
  @ApiParam({ name: 'id', description: 'Todo UUID' })
  @ApiResponse({ status: 204, description: 'Todo deleted successfully' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.todosService.remove(id, userId);
  }
}
