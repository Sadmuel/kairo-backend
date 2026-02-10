const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'sessionid',
  'credential',
  'privatekey',
];

const MAX_DEPTH = 10;

export function redactSensitiveData(
  obj: Record<string, any>,
  depth = 0,
): Record<string, any> {
  if (!obj || typeof obj !== 'object' || depth >= MAX_DEPTH) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? redactSensitiveData(item, depth + 1)
        : item,
    );
  }

  const redacted: Record<string, any> = { ...obj };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key], depth + 1);
    }
  }

  return redacted;
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[REDACTED]';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
