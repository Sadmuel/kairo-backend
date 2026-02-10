import { Injectable, OnModuleInit, OnModuleDestroy, Inject, LoggerService } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Type for Prisma transaction client - exported for use in services
export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log({ message: 'Database connected' }, 'PrismaService');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log({ message: 'Database disconnected' }, 'PrismaService');
  }
}
