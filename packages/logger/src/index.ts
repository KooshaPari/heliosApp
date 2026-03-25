export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error | unknown;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  withLevel(level: LogLevel): Logger;
}

export class ConsoleLogger implements Logger {
  private readonly minLevel: LogLevel;
  private readonly baseContext: Record<string, unknown>;

  constructor(minLevel: LogLevel = LogLevel.INFO, baseContext: Record<string, unknown> = {}) {
    this.minLevel = minLevel;
    this.baseContext = baseContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLevel(level: LogLevel): string {
    return LogLevel[level];
  }

  private log(
    level: LogLevel,
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const mergedContext = { ...this.baseContext, ...context };
    const _entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: mergedContext,
      error,
    };
    const _levelStr = this.formatLevel(level);
    if (error) {
    } else {
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, error, context);
  }

  child(context: Record<string, unknown>): Logger {
    return new ConsoleLogger(this.minLevel, { ...this.baseContext, ...context });
  }

  withLevel(level: LogLevel): Logger {
    return new ConsoleLogger(level, this.baseContext);
  }
}

export function createLogger(minLevel: LogLevel = LogLevel.INFO): Logger {
  return new ConsoleLogger(minLevel);
}
