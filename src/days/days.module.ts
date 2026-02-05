import { Module } from '@nestjs/common';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TimeBlockTemplatesModule } from 'src/time-block-templates/time-block-templates.module';

@Module({
  imports: [PrismaModule, TimeBlockTemplatesModule],
  controllers: [DaysController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
