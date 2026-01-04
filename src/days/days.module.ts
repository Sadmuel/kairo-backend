import { Module } from '@nestjs/common';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DaysController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
