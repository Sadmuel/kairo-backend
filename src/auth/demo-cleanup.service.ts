import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DemoCleanupService {
  private readonly logger = new Logger(DemoCleanupService.name);

  constructor(private prisma: PrismaService) {}

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
        this.logger.log(`Cleaned up ${result.count} expired demo user(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup demo users', error);
    }
  }
}
