import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DaysModule } from 'src/days/days.module';
import { TimeBlocksModule } from 'src/time-blocks/time-blocks.module';

@Module({
  imports: [PrismaModule, DaysModule, TimeBlocksModule],
  controllers: [TodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}
