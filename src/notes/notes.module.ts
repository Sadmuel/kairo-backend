import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TimeBlocksModule } from 'src/time-blocks/time-blocks.module';

@Module({
  imports: [PrismaModule, TimeBlocksModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
