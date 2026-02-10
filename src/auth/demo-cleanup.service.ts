import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DemoCleanupService {
  constructor(
    private prisma: PrismaService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupDemoUsers(): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    try {
      const result = await this.prisma.user.deleteMany({
        where: {
          isDemoUser: true,
          createdAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          { message: `Cleaned up ${result.count} expired demo user(s)`, count: result.count },
          'DemoCleanupService',
        );
      }
    } catch (error) {
      this.logger.error(
        {
          message: 'Failed to cleanup demo users',
          error: error instanceof Error ? error.stack : error,
        },
        'DemoCleanupService',
      );
    }
  }
}
