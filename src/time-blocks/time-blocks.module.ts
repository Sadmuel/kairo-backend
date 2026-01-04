import { Module } from '@nestjs/common';
import { TimeBlocksController } from './time-blocks.controller';
import { TimeBlocksService } from './time-blocks.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DaysModule } from 'src/days/days.module';

@Module({
  imports: [PrismaModule, DaysModule],
  controllers: [TimeBlocksController],
  providers: [TimeBlocksService],
  exports: [TimeBlocksService],
})
export class TimeBlocksModule {}
