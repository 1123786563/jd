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
    // 【A2A 日志】客户端初始化
    console.log('[A2A Client] 🚀 初始化 A2A 客户端', {
      baseUrl,
      apiKeyPreview: apiKey.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });
  }

  // ============================================
  // Agent 发现（带缓存）
  // ============================================
  async discoverAgent(): Promise<AgentCard> {
    if (this.agentCard) {
      console.log('[A2A Client] 📋 使用缓存的 Agent Card', { name: this.agentCard.name });
      return this.agentCard;
    }

    // A2A 标准：GET /.well-known/agent.json
    console.log('[A2A Client] 🔍 发现 Agent', { url: `${this.baseUrl}/.well-known/agent.json` });
    const res = await fetch(`${this.baseUrl}/.well-known/agent.json`);
    if (!res.ok) {
      console.log('[A2A Client] ❌ Agent 发现失败', { status: res.status });
      throw new A2AError(`Failed to discover agent: ${res.status}`);
    }

    this.agentCard = await res.json();
    console.log('[A2A Client] ✅ Agent 发现成功', {
      name: this.agentCard!.name,
      version: this.agentCard!.version,
      capabilities: this.agentCard!.capabilities
    });
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
    // 【A2A 日志】发起 JSON-RPC 调用
    console.log('[A2A Client] 📤 发起 JSON-RPC 调用', {
      method,
      params: JSON.stringify(params).substring(0, 200),
      timestamp: new Date().toISOString()
    });

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
        // 【A2A 日志】调用错误
        console.log('[A2A Client] ❌ JSON-RPC 调用错误', {
          method,
          errorCode: data.error.code,
          errorMessage: data.error.message
        });
        const error = new A2AError(data.error.message, data.error.code);
        // 认证错误不重试
        if (data.error.code === -32600) {
          error.retryable = false;
        }
        throw error;
      }

      // 【A2A 日志】调用成功
      console.log('[A2A Client] ✅ JSON-RPC 调用成功', {
        method,
        hasResult: !!data.result
      });

      return data.result as T;
    }, method);
  }

  // ============================================
  // Task 管理
  // ============================================
  async createTask(params: CreateTaskParams): Promise<Task> {
    console.log('[A2A Client] 📝 创建 Task', {
      toAgent: params.toAgent,
      fromAgent: params.fromAgent,
      contentPreview: params.content?.substring(0, 50)
    });
    const task = await this.call<Task>('tasks/create', params);
    console.log('[A2A Client] ✅ Task 创建成功', { taskId: task.id, state: task.status.state });
    return task;
  }

  async getTask(taskId: string): Promise<Task> {
    console.log('[A2A Client] 🔍 获取 Task', { taskId });
    return this.call<Task>('tasks/get', { taskId });
  }

  async cancelTask(taskId: string): Promise<Task> {
    console.log('[A2A Client] 🚫 取消 Task', { taskId });
    return this.call<Task>('tasks/cancel', { taskId });
  }

  async sendTaskMessage(taskId: string, message: MessageContent): Promise<Task> {
    console.log('[A2A Client] 📨 发送 Task 消息', { taskId, messagePreview: JSON.stringify(message).substring(0, 100) });
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
