import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DaysModule } from './days/days.module';
import { TimeBlocksModule } from './time-blocks/time-blocks.module';
import { NotesModule } from './notes/notes.module';
import { TodosModule } from './todos/todos.module';
import { EventsModule } from './events/events.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TimeBlockTemplatesModule } from './time-block-templates/time-block-templates.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get('NODE_ENV') === 'test';
        if (isTest) {
          // Very permissive rate limiting in test environment
          return [{ ttl: 60000, limit: 10000 }];
        }
        return [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 3, // 3 requests per second
          },
          {
            name: 'medium',
            ttl: 10000, // 10 seconds
            limit: 20, // 20 requests per 10 seconds
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
        ];
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    DaysModule,
    TimeBlocksModule,
    NotesModule,
    TodosModule,
    EventsModule,
    DashboardModule,
    TimeBlockTemplatesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
