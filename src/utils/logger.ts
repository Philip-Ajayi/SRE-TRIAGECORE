type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class StructuredLogger {
  private level: LogLevel = 'info';

  constructor() {
    const configuredLevel = process.env.LOG_LEVEL as LogLevel;
    if (configuredLevel) {
      this.level = configuredLevel;
    }
  }

  private log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (this.level === 'debug') this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

export const logger = new StructuredLogger();
