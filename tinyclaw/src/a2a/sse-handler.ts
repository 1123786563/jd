/**
 * SSE 处理器 - Server-Sent Events 流式输出
 */
import type { Task, SSEEvent } from './types';
import { subscribeToTask } from './task-manager';

// ============================================
// SSE 配置常量
// ============================================
export const SSE_CONFIG = {
  MAX_CONNECTIONS: 100,                    // 最大 SSE 连接数
  MAX_CONNECTIONS_PER_TASK: 5,            // 单 Task 最大连接数
  TOTAL_TIMEOUT_MS: 30 * 60 * 1000,       // 30 分钟总超时
  HEARTBEAT_MS: 30 * 1000                  // 30 秒心跳
} as const;

// ============================================
// SSE 连接管理
// ============================================
const sseConnections = new Map<string, Set<AbortController>>();

export function getSSEConnectionCount(): number {
  let count = 0;
  sseConnections.forEach(set => count += set.size);
  return count;
}

export function getTaskConnectionCount(taskId: string): number {
  return sseConnections.get(taskId)?.size || 0;
}

export function canAcceptNewConnection(taskId: string): boolean {
  if (getSSEConnectionCount() >= SSE_CONFIG.MAX_CONNECTIONS) {
    return false;
  }
  if (getTaskConnectionCount(taskId) >= SSE_CONFIG.MAX_CONNECTIONS_PER_TASK) {
    return false;
  }
  return true;
}

// ============================================
// SSE 连接注册/注销
// ============================================
export function registerSSEConnection(taskId: string, controller: AbortController): void {
  if (!sseConnections.has(taskId)) {
    sseConnections.set(taskId, new Set());
  }
  sseConnections.get(taskId)!.add(controller);
}

export function unregisterSSEConnection(taskId: string, controller: AbortController): void {
  const connections = sseConnections.get(taskId);
  if (connections) {
    connections.delete(controller);
    if (connections.size === 0) {
      sseConnections.delete(taskId);
    }
  }
}

// ============================================
// SSE 消息格式化
// ============================================
export function formatSSEEvent(event: SSEEvent): string {
  let output = '';
  if (event.id) output += `id: ${event.id}\n`;
  if (event.event) output += `event: ${event.event}\n`;
  if (event.retry !== undefined) output += `retry: ${event.retry}\n`;
  if (event.data !== undefined) output += `data: ${event.data}\n`;
  output += '\n';
  return output;
}

export function formatSSEMessage(event: string, data: string): string {
  return formatSSEEvent({ event, data });
}

// ============================================
// SSE 流处理器（用于 Hono）
// ============================================
export interface SSEStreamContext {
  write: (data: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  close: () => void;
  signal: AbortSignal;
}

export async function handleSSEStream(
  taskId: string,
  task: Task,
  stream: SSEStreamContext
): Promise<void> {
  // 发送初始状态
  await stream.write(formatSSEMessage('task-update', JSON.stringify(task)));

  // 如果已经是终态，直接返回
  if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
    return;
  }

  // 订阅任务更新
  const unsubscribe = subscribeToTask(taskId, async (updatedTask) => {
    try {
      await stream.write(formatSSEMessage('task-update', JSON.stringify(updatedTask)));

      // 任务终态时关闭连接
      if (['completed', 'failed', 'canceled'].includes(updatedTask.status.state)) {
        stream.close();
      }
    } catch (error) {
      console.error('[SSE] 发送更新失败', { taskId, error });
    }
  });

  try {
    // 保持连接 + 心跳
    while (!stream.signal.aborted) {
      await stream.sleep(SSE_CONFIG.HEARTBEAT_MS);
      await stream.write(formatSSEMessage('ping', Date.now().toString()));
    }
  } finally {
    unsubscribe();
  }
}

// ============================================
// 清理过期连接
// ============================================
export function cleanupStaleConnections(): number {
  let cleaned = 0;

  sseConnections.forEach((controllers, taskId) => {
    controllers.forEach(controller => {
      if (controller.signal.aborted) {
        controllers.delete(controller);
        cleaned++;
      }
    });

    if (controllers.size === 0) {
      sseConnections.delete(taskId);
    }
  });

  return cleaned;
}
