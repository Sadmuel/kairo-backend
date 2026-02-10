import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

export const mockLoggerProvider = {
  provide: WINSTON_MODULE_NEST_PROVIDER,
  useValue: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
};
