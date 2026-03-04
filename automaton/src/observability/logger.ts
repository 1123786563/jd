/**
 * 结构化日志记录器
 *
 * JSON 格式的结构化日志，支持日志级别、上下文和子日志记录器。
 * 使用 process.stdout.write 避免 console.log 递归。
 * 永不抛出异常 — 所有错误都被优雅处理。
 */

import type { LogLevel, LogEntry } from "../types.js";
import { LOG_LEVEL_PRIORITY } from "../types.js";

let globalLogLevel: LogLevel = "info";
let customSink: ((entry: LogEntry) => void) | null = null;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

export class StructuredLogger {
  private module: string;
  private minLevel: LogLevel;

  constructor(module: string, minLevel?: LogLevel) {
    this.module = module;
    this.minLevel = minLevel ?? globalLogLevel;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, undefined, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, undefined, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", message, undefined, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.write("error", message, error, context);
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.write("fatal", message, error, context);
  }

  child(subModule: string): StructuredLogger {
    return new StructuredLogger(`${this.module}.${subModule}`, this.minLevel);
  }

  static setSink(sink: (entry: LogEntry) => void): void {
    customSink = sink;
  }

  static resetSink(): void {
    customSink = null;
  }

  private write(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    try {
      const effectiveLevel = this.minLevel ?? globalLogLevel;
      if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[effectiveLevel]) {
        return;
      }

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        module: this.module,
        message,
      };

      if (context && Object.keys(context).length > 0) {
        entry.context = context;
      }

      if (error) {
        entry.error = {
          message: error.message,
          stack: error.stack,
        };
        if ((error as any).code) {
          entry.error.code = (error as any).code;
        }
      }

      if (customSink) {
        customSink(entry);
        return;
      }

      const json = JSON.stringify(entry);
      process.stdout.write(json + "\n");
    } catch {
      // 如果 JSON 序列化失败，使用回退方案
      try {
        process.stderr.write(`[logger-fallback] ${message}\n`);
      } catch {
        // 完全静默 — 永不从日志记录器抛出异常
      }
    }
  }
}

export function createLogger(module: string): StructuredLogger {
  return new StructuredLogger(module);
}
