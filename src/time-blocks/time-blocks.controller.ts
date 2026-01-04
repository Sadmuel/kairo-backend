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
import { TimeBlocksService } from './time-blocks.service';
import { CreateTimeBlockDto, UpdateTimeBlockDto, ReorderTimeBlocksDto } from './dto';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Time Blocks')
@ApiBearerAuth()
@Controller('time-blocks')
@UseGuards(JwtAuthGuard)
export class TimeBlocksController {
  constructor(private timeBlocksService: TimeBlocksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all time blocks for a day' })
  @ApiQuery({ name: 'dayId', description: 'Day UUID' })
  @ApiResponse({ status: 200, description: 'Returns time blocks with notes' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  findAll(@Query('dayId', ParseUUIDPipe) dayId: string, @CurrentUser('id') userId: string) {
    return this.timeBlocksService.findByDay(dayId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single time block by ID' })
  @ApiParam({ name: 'id', description: 'Time block UUID' })
  @ApiResponse({ status: 200, description: 'Returns time block with notes' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.timeBlocksService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new time block' })
  @ApiResponse({ status: 201, description: 'Time block created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time format or end time before start time' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTimeBlockDto) {
    return this.timeBlocksService.create(userId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder time blocks within a day' })
  @ApiQuery({ name: 'dayId', description: 'Day UUID' })
  @ApiResponse({ status: 200, description: 'Returns reordered time blocks' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  reorder(
    @Query('dayId', ParseUUIDPipe) dayId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderTimeBlocksDto,
  ) {
    return this.timeBlocksService.reorder(userId, dayId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a time block' })
  @ApiParam({ name: 'id', description: 'Time block UUID' })
  @ApiResponse({ status: 200, description: 'Time block updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time range' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTimeBlockDto,
  ) {
    return this.timeBlocksService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time block (cascades to notes)' })
  @ApiParam({ name: 'id', description: 'Time block UUID' })
  @ApiResponse({ status: 204, description: 'Time block deleted successfully' })
  @ApiResponse({ status: 404, description: 'Time block not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.timeBlocksService.remove(id, userId);
  }
}
