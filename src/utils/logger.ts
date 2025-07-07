import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

// Log levels enum for type safety
export enum LogLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
}

// Log categories for better organization
export enum LogCategory {
  HTTP = 'http',
  AUTH = 'auth',
  REDIS = 'redis',
  GEMINI = 'gemini',
  HEALTH = 'health',
  SYSTEM = 'system',
  DASHBOARD = 'dashboard'
}

// Structured log entry interface
export interface LogEntry {
  timestamp: string;
  level: string;
  category: LogCategory;
  msg: string;
  correlation_id?: string;
  req?: {
    method: string;
    url: string;
    ip: string;
    userAgent?: string;
  };
  res?: {
    statusCode: number;
    responseTime: number;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: Record<string, unknown>;
}

// In-memory log storage for dashboard real-time viewing
class LogBuffer {
  private logs: LogEntry[] = [];
  private maxSize = 1000;
  private subscribers: Array<(log: LogEntry) => void> = [];

  add(log: LogEntry): void {
    this.logs.unshift(log);
    if (this.logs.length > this.maxSize) {
      this.logs.pop();
    }
    
    // Notify all subscribers for real-time updates
    this.subscribers.forEach(callback => {
      try {
        callback(log);
      } catch (error) {
        console.error('Error notifying log subscriber:', error);
      }
    });
  }

  clear(): void {
    this.logs = [];
  }

  getRecent(limit: number = 100): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  filter(filters: {
    level?: string;
    category?: LogCategory;
    search?: string;
    since?: Date;
  }): LogEntry[] {
    return this.logs.filter(log => {
      if (filters.level && log.level !== filters.level) return false;
      if (filters.category && log.category !== filters.category) return false;
      if (filters.search && !log.msg.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.since && new Date(log.timestamp) < filters.since) return false;
      return true;
    });
  }

  subscribe(callback: (log: LogEntry) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
}

// Global log buffer instance
export const logBuffer = new LogBuffer();

// Create logs directory if it doesn't exist (with error handling)
// Try to use the data directory first (which should have correct permissions), then /tmp as fallback
let logsDir: string = '/tmp';
let logsDirectoryAvailable = false;

// Try data directory first
try {
  const dataLogsDir = path.resolve('./data/logs');
  if (!fs.existsSync(dataLogsDir)) {
    fs.mkdirSync(dataLogsDir, { recursive: true });
  }
  logsDir = dataLogsDir;
  logsDirectoryAvailable = true;
  console.log('✅ Using data/logs directory for file logging');
} catch (dataError) {
  // Try /tmp directory as fallback
  try {
    const tmpLogsDir = '/tmp/gemini-logs';
    if (!fs.existsSync(tmpLogsDir)) {
      fs.mkdirSync(tmpLogsDir, { recursive: true });
    }
    logsDir = tmpLogsDir;
    logsDirectoryAvailable = true;
    console.warn('⚠️  Using /tmp for logs directory due to permission issues with data directory');
  } catch (tmpError) {
    console.warn('⚠️  Failed to create any logs directory, file logging will be disabled');
    console.warn('   Data error:', dataError);
    console.warn('   Tmp error:', tmpError);
    logsDirectoryAvailable = false;
    logsDir = '/tmp'; // fallback value that won't be used
  }
}

// Pino transport configuration for file rotation
const transport = pino.transport({
  targets: [
    // File transport with daily rotation (only if logs directory is available)
    ...(logsDirectoryAvailable ? [{
      target: 'pino/file',
      options: {
        destination: path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`),
        mkdir: true
      },
      level: 'info'
    }] : []),
    // Console transport for development (only in non-production)
    ...(process.env.NODE_ENV !== 'production' ? [{
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname'
      },
      level: 'debug'
    }] : []),
    // Always include a basic console transport as fallback
    ...(!logsDirectoryAvailable || process.env.NODE_ENV === 'production' ? [{
      target: 'pino/file',
      options: {
        destination: 1 // stdout
      },
      level: 'info'
    }] : [])
  ]
});

// Create the main logger instance
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent']
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      responseTime: res.responseTime
    }),
    error: pino.stdSerializers.err
  }
}, transport);

// Enhanced logger class with buffer integration
export class Logger {
  private correlationId?: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
  }

  private log(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(LogLevel)[Object.values(LogLevel).indexOf(level)].toLowerCase(),
      category,
      msg: message,
      correlation_id: this.correlationId,
      ...meta
    };

    // Add to in-memory buffer for dashboard
    logBuffer.add(logEntry);

    // Log with pino
    const pinoLevel = logEntry.level as keyof typeof pinoLogger;
    if (typeof pinoLogger[pinoLevel] === 'function') {
      (pinoLogger[pinoLevel] as (obj: unknown, msg: string) => void)(logEntry, message);
    }
  }

  trace(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, category, message, meta);
  }

  debug(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, meta);
  }

  info(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, meta);
  }

  warn(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, meta);
  }

  error(category: LogCategory, message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : {};
    this.log(LogLevel.ERROR, category, message, { ...errorMeta, ...meta });
  }

  fatal(category: LogCategory, message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : {};
    this.log(LogLevel.FATAL, category, message, { ...errorMeta, ...meta });
  }

  // Create child logger with correlation ID
  child(correlationId: string): Logger {
    return new Logger(correlationId);
  }
}

// Default logger instance
export const logger = new Logger();

// Utility function to generate correlation IDs
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}