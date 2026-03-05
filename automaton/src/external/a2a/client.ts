/**
 * A2A Client - A2A 协议客户端实现
 */
import type { AgentCard, Task, CreateTaskParams, MessageContent, AgentStatus, SSEEvent } from './types.js';
import { A2AError } from './types.js';
import { RetryManager, generateRequestId } from './retry.js';

// ============================================
// A2A Client
// ============================================
export class A2AClient {
  private agentCard: AgentCard | null = null;
  private retryManager: RetryManager;

  // 幂等性保证：实例级别的已处理消息集合
  private completedMessages = new Set<number>();
  private failedMessages = new Set<number>();

  constructor(private baseUrl: string, private apiKey: string) {
    this.retryManager = new RetryManager({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000
    });
  }

  // ============================================
  // Agent 发现（带缓存）
  // ============================================
  async discoverAgent(): Promise<AgentCard> {
    if (this.agentCard) {
      return this.agentCard;
    }

    // A2A 标准：GET /.well-known/agent.json
    const res = await fetch(`${this.baseUrl}/.well-known/agent.json`);
    if (!res.ok) {
      throw new A2AError(`Failed to discover agent: ${res.status}`);
    }

    this.agentCard = await res.json();
    return this.agentCard!;
  }

  // 清除 Agent Card 缓存（用于刷新）
  clearAgentCardCache(): void {
    this.agentCard = null;
  }

  // ============================================
  // JSON-RPC 调用
  // ============================================
  private async call<T>(method: string, params: object): Promise<T> {
    return this.retryManager.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: generateRequestId()
        })
      });

      const data = await res.json();

      if (data.error) {
        const error = new A2AError(data.error.message, data.error.code);
        // 认证错误不重试
        if (data.error.code === -32600) {
          error.retryable = false;
        }
        throw error;
      }

      return data.result as T;
    }, method);
  }

  // ============================================
  // Task 管理
  // ============================================
  async createTask(params: CreateTaskParams): Promise<Task> {
    return this.call<Task>('tasks/create', params);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.call<Task>('tasks/get', { taskId });
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.call<Task>('tasks/cancel', { taskId });
  }

  async sendTaskMessage(taskId: string, message: MessageContent): Promise<Task> {
    return this.call<Task>('tasks/send', { taskId, message });
  }

  // ============================================
  // 消息队列操作（幂等性保证）
  // ============================================
  async claimMessage(agentId: string): Promise<{ taskId: string; messageId: number; content: string } | null> {
    return this.call<{ taskId: string; messageId: number; content: string } | null>('messages/claim', { agentId });
  }

  async completeMessage(messageId: number, output?: string): Promise<void> {
    // 幂等性检查：实例级别的 Set
    if (this.completedMessages.has(messageId)) {
      return;
    }

    await this.call('messages/complete', { messageId, output });
    this.completedMessages.add(messageId);
  }

  async failMessage(messageId: number, error: string): Promise<void> {
    // 幂等性检查
    if (this.failedMessages.has(messageId)) {
      return;
    }

    await this.call('messages/fail', { messageId, error });
    this.failedMessages.add(messageId);
  }

  // ============================================
  // 心跳
  // ============================================
  async heartbeat(agentId: string, status: AgentStatus, currentTaskId?: string): Promise<void> {
    await this.call('agents/heartbeat', {
      agentId,
      status,
      currentTaskId,
      timestamp: Date.now()
    });
  }

  // ============================================
  // SSE 流式订阅（完整实现）
  // ============================================
  async subscribeToTask(
    taskId: string,
    onUpdate: (task: Task) => void,
    onError?: (error: Error) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/a2a/sse/${taskId}`, {
      signal,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream'
      }
    });

    if (!res.ok) {
      throw new A2AError(`SSE subscription failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new A2AError('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 完整的 SSE 事件解析
        const events = this.parseSSEEvents(buffer);
        buffer = events.remainingBuffer;

        for (const event of events.parsed) {
          if (event.event === 'task-update' && event.data) {
            try {
              const task = JSON.parse(event.data) as Task;
              onUpdate(task);

              // 终态时自动结束
              if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
                return;
              }
            } catch (e) {
              onError?.(new Error(`Failed to parse task: ${e}`));
            }
          } else if (event.event === 'error' && event.data) {
            onError?.(new Error(event.data));
          }
          // ping 事件忽略
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // SSE 事件解析器
  private parseSSEEvents(buffer: string): { parsed: SSEEvent[]; remainingBuffer: string } {
    const events: SSEEvent[] = [];
    let current: SSEEvent = {};

    const lines = buffer.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];

      if (line === '') {
        // 空行表示事件结束
        if (current.data !== undefined) {
          events.push(current);
        }
        current = {};
      } else if (line.startsWith('event:')) {
        current.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        current.data = (current.data || '') + line.slice(5).trim();
      } else if (line.startsWith('id:')) {
        current.id = line.slice(3).trim();
      } else if (line.startsWith('retry:')) {
        current.retry = parseInt(line.slice(6).trim(), 10);
      }
    }

    // 最后一行可能不完整，保留到下次处理
    const remainingBuffer = lines[lines.length - 1];

    return { parsed: events, remainingBuffer };
  }
}

// ============================================
// 导出
// ============================================
export default A2AClient;
