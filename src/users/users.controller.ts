import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards';
import { CurrentUser } from 'src/auth/decorators';
import { ParseDatePipe } from 'src/days/pipes';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user streak and overall statistics' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getStats(@CurrentUser('id') userId: string) {
    return this.usersService.getStats(userId);
  }

  @Get('me/stats/day/:date')
  @ApiOperation({ summary: 'Get completion statistics for a specific day' })
  @ApiParam({
    name: 'date',
    description: 'Date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @ApiResponse({ status: 200, description: 'Day statistics' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDayStats(@CurrentUser('id') userId: string, @Param('date', ParseDatePipe) date: string) {
    return this.usersService.getDayStats(userId, date);
  }

  @Get('me/stats/week/:date')
  @ApiOperation({
    summary: 'Get completion statistics for the week containing the date',
  })
  @ApiParam({
    name: 'date',
    description: 'Any date within the week (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @ApiResponse({ status: 200, description: 'Week statistics' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getWeekStats(@CurrentUser('id') userId: string, @Param('date', ParseDatePipe) date: string) {
    return this.usersService.getWeekStats(userId, date);
  }
}
