import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard with daily summary, stats, and upcoming events' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Client local date in YYYY-MM-DD format. Defaults to server date if not provided.',
    example: '2026-01-20',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data with streaks, today stats, and upcoming events',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getDashboard(@CurrentUser('id') userId: string, @Query('date') date?: string) {
    return this.dashboardService.getDashboard(userId, date);
  }
}
