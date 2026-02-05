import { Module } from '@nestjs/common';
import { TimeBlockTemplatesController } from './time-block-templates.controller';
import { TimeBlockTemplatesService } from './time-block-templates.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TimeBlockTemplatesController],
  providers: [TimeBlockTemplatesService],
  exports: [TimeBlockTemplatesService],
})
export class TimeBlockTemplatesModule {}
