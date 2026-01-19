import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { EventsModule } from 'src/events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
