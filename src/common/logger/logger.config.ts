import * as winston from 'winston';

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL =
  process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Colombian timezone
const TIMEZONE = 'America/Bogota';

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  fgGreen: '\x1b[32m',
  fgBlue: '\x1b[34m',
  fgYellow: '\x1b[33m',
  fgRed: '\x1b[31m',
  black: '\x1b[30m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const LEVEL_STYLES: Record<
  string,
  { fg: string; bg: string; bgText: string; label: string }
> = {
  error: { fg: COLORS.fgRed, bg: COLORS.bgRed, bgText: COLORS.white, label: 'ERROR' },
  warn: { fg: COLORS.fgYellow, bg: COLORS.bgYellow, bgText: COLORS.black, label: 'WARN' },
  info: { fg: COLORS.fgGreen, bg: COLORS.bgGreen, bgText: COLORS.black, label: 'INFO' },
  debug: { fg: COLORS.fgBlue, bg: COLORS.bgBlue, bgText: COLORS.white, label: 'DEBUG' },
  verbose: { fg: COLORS.fgBlue, bg: COLORS.bgBlue, bgText: COLORS.white, label: 'TRACE' },
};

function formatTimestamp(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    hour12: true,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  };
  return date.toLocaleString('en-US', options);
}

function formatParams(params: Record<string, any>): string {
  const excludeKeys = ['level', 'message', 'context', 'timestamp', 'ms'];
  const entries = Object.entries(params).filter(
    ([key]) => !excludeKeys.includes(key),
  );

  if (entries.length === 0) return '';

  // Find the longest key for colon alignment
  const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

  const lines = entries.map(([key, value]) => {
    const formatted =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    const paddedKey = key.padEnd(maxKeyLength);
    return `  ${COLORS.white}${paddedKey}${COLORS.reset} : ${COLORS.white}${formatted}${COLORS.reset}`;
  });

  return '\n' + lines.join('\n');
}

function extractMessage(info: winston.Logform.TransformableInfo): {
  message: string;
  extra: Record<string, any>;
} {
  const { message } = info;

  if (typeof message === 'string') {
    return { message, extra: {} };
  }

  if (typeof message === 'object' && message !== null) {
    const { message: msg, ...rest } = message as Record<string, any>;
    return { message: msg || '', extra: rest };
  }

  return { message: '', extra: {} };
}

const coloredConsoleFormat = winston.format.printf((info) => {
  const { level, context, timestamp, ...rest } = info;
  const { message, extra } = extractMessage(info);
  const params = { ...rest, ...extra };

  const ts = formatTimestamp(new Date(timestamp as string));

  const style = LEVEL_STYLES[level] || LEVEL_STYLES.info;
  const levelBadge = `${COLORS.bold}${style.fg}[${style.label}]${COLORS.reset}`;

  const contextStr = context ? ` ${context}` : '';
  const messageLine = `${style.bg}${style.bgText} ${message}${contextStr} ${COLORS.reset}`;

  const paramsStr = formatParams(params);

  return `${COLORS.dim}[${ts}]${COLORS.reset}  ${levelBadge}  ${messageLine}${paramsStr}`;
});

const localTimestamp = winston.format((info) => {
  info.timestamp = formatTimestamp(new Date());
  return info;
});

const productionFormat = winston.format.combine(
  localTimestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  coloredConsoleFormat,
);

export const winstonConfig: winston.LoggerOptions = {
  level: LOG_LEVEL,
  transports: [
    new winston.transports.Console({
      silent: isTest,
      format: isProduction ? productionFormat : developmentFormat,
    }),
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: productionFormat,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: productionFormat,
          }),
        ]
      : []),
  ],
};

export { LOG_LEVEL };
