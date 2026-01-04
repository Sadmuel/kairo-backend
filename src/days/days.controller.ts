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
import { DaysService } from './days.service';
import { CreateDayDto, UpdateDayDto, CalendarQueryDto } from './dto';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Days')
@ApiBearerAuth()
@Controller('days')
@UseGuards(JwtAuthGuard)
export class DaysController {
  constructor(private daysService: DaysService) {}

  @Get()
  @ApiOperation({ summary: 'Get days in date range (calendar view)' })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)', example: '2024-01-31' })
  @ApiResponse({ status: 200, description: 'Returns days with time blocks and notes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser('id') userId: string, @Query() query: CalendarQueryDto) {
    return this.daysService.findByDateRange(userId, query.startDate, query.endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single day by ID' })
  @ApiParam({ name: 'id', description: 'Day UUID' })
  @ApiResponse({ status: 200, description: 'Returns day with time blocks and notes' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.daysService.findOne(id, userId);
  }

  @Get('date/:date')
  @ApiOperation({ summary: 'Get day by date' })
  @ApiParam({ name: 'date', description: 'Date (YYYY-MM-DD)', example: '2024-01-15' })
  @ApiResponse({ status: 200, description: 'Returns day or null if not found' })
  findByDate(@Param('date') date: string, @CurrentUser('id') userId: string) {
    return this.daysService.findByDate(userId, date);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new day' })
  @ApiResponse({ status: 201, description: 'Day created successfully' })
  @ApiResponse({ status: 409, description: 'Day already exists for this date' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDayDto) {
    return this.daysService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update day (mark completed)' })
  @ApiParam({ name: 'id', description: 'Day UUID' })
  @ApiResponse({ status: 200, description: 'Day updated successfully' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDayDto,
  ) {
    return this.daysService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a day (cascades to time blocks and notes)' })
  @ApiParam({ name: 'id', description: 'Day UUID' })
  @ApiResponse({ status: 204, description: 'Day deleted successfully' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.daysService.remove(id, userId);
  }
}
