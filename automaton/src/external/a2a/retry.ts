/**
 * 重试管理器 - 实现指数退避重试策略
 */
export interface RetryConfig {
  maxRetries: number;        // 最大重试次数
  baseDelayMs: number;       // 基础延迟（毫秒）
  maxDelayMs: number;        // 最大延迟（毫秒）
  jitterMs?: number;         // 抖动范围（毫秒）
}

export interface RetryContext {
  attempt: number;
  method: string;
  lastError?: Error;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterMs: 500
};

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 使用重试策略执行操作
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    method: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // 检查是否可重试
        if (!this.isRetryable(error, attempt)) {
          throw error;
        }

        // 计算延迟
        const delay = this.calculateDelay(attempt);

        console.warn(`[RetryManager] 方法 ${method} 第 ${attempt + 1} 次失败，${delay}ms 后重试`, {
          error: error.message,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryable(error: any, attempt: number): boolean {
    // 已达最大重试次数
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // A2AError 有 retryable 标志
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // 网络错误可重试
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP 5xx 错误可重试
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // 默认不重试
    return false;
  }

  /**
   * 计算指数退避延迟
   */
  private calculateDelay(attempt: number): number {
    // 指数退避: baseDelay * 2^attempt
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt);

    // 限制最大延迟
    let delay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // 添加随机抖动避免惊群效应
    if (this.config.jitterMs) {
      delay += Math.random() * this.config.jitterMs;
    }

    return Math.floor(delay);
  }

  /**
   * 异步等待
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
