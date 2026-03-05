/**
 * A2A Task 管理器 - Task 生命周期管理
 */
import type { Task, TaskStatus, TaskState, Message, Artifact, CreateTaskParams } from './types';
import {
  createTask as dbCreateTask,
  getTask as dbGetTask,
  updateTaskStatus as dbUpdateTaskStatus,
  enqueueMessage,
  completeMessage as dbCompleteMessage,
  failMessage as dbFailMessage,
  claimNextMessage,
  upsertHeartbeat
} from '../lib/db';
import { EventEmitter } from 'events';

// ============================================
// Task 事件发射器
// ============================================
export const taskEvents = new EventEmitter();

// ============================================
// Task ID 生成
// ============================================
export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================
// Task 创建
// ============================================
export function createTask(params: CreateTaskParams): Task {
  const taskId = generateTaskId();
  const now = new Date().toISOString();

  const initialMessage: Message = {
    role: 'user',
    parts: params.message?.parts || [{ type: 'text', text: params.content || '' }]
  };

  const task: Task = {
    id: taskId,
    status: {
      state: 'submitted',
      timestamp: now
    },
    history: [initialMessage],
    artifacts: [],
    metadata: {
      conversationId: params.conversationId,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      priority: params.priority ?? 0
    }
  };

  // 存储到数据库
  dbCreateTask({
    id: taskId,
    status: 'submitted',
    conversation_id: params.conversationId ?? null,
    history: JSON.stringify(task.history),
    artifacts: JSON.stringify(task.artifacts),
    from_agent: params.fromAgent ?? null,
    to_agent: params.toAgent,
    priority: params.priority ?? 0,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    retry_count: 0,
    max_retries: 3,
    completed_at: null,
    error_message: null,
    message_id: null
  });

  // 入队消息
  enqueueMessage({
    channel: 'a2a',
    sender: params.fromAgent || 'system',
    messageId: taskId,
    agent: params.toAgent,
    message: params.content || '',
    conversationId: params.conversationId,
    fromAgent: params.fromAgent
  });

  // 发送事件
  taskEvents.emit('task:created', task);

  return task;
}

// ============================================
// Task 获取
// ============================================
export function getTask(taskId: string): Task | null {
  // 验证 taskId 格式
  if (!taskId || typeof taskId !== 'string') {
    return null;
  }

  // 验证 taskId 格式：必须以 'task-' 开头，且长度至少为 15
  if (!taskId.startsWith('task-') || taskId.length < 15) {
    console.warn('[TaskManager] 无效的 taskId 格式', { taskId, length: taskId?.length });
    return null;
  }

  const dbTask = dbGetTask(taskId);
  if (!dbTask) return null;

  return dbTaskToTask(dbTask);
}

// ============================================
// Task 取消
// ============================================
export function cancelTask(taskId: string): Task | null {
  const task = getTask(taskId);
  if (!task) return null;

  if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
    return task; // 终态不可取消
  }

  dbUpdateTaskStatus(taskId, 'canceled');

  const updatedTask = getTask(taskId);
  if (updatedTask) {
    taskEvents.emit('task:canceled', updatedTask);
  }

  return updatedTask;
}

// ============================================
// Task 状态更新
// ============================================
export function updateTaskState(taskId: string, state: TaskState, message?: string): Task | null {
  const task = getTask(taskId);
  if (!task) return null;

  dbUpdateTaskStatus(taskId, state, message);

  const updatedTask = getTask(taskId);
  if (updatedTask) {
    taskEvents.emit('task:updated', updatedTask);

    if (['completed', 'failed', 'canceled'].includes(state)) {
      taskEvents.emit(`task:${state}`, updatedTask);
    }
  }

  return updatedTask;
}

// ============================================
// 消息操作
// ============================================
export function claimMessage(agentId: string): { taskId: string; messageId: number; content: string } | null {
  const msg = claimNextMessage(agentId);
  if (!msg) return null;

  // 更新 Task 状态为 working
  const task = getTask(msg.message_id);
  if (task && task.status.state === 'submitted') {
    updateTaskState(task.id, 'working');
  }

  return {
    taskId: msg.message_id,
    messageId: msg.id,
    content: msg.message
  };
}

export function completeMessage(messageId: number, output?: string): void {
  dbCompleteMessage(messageId);

  // 如果有关联的 Task，更新其状态
  // 这里需要从消息中获取 task_id
}

export function failMessage(messageId: number, error: string): void {
  dbFailMessage(messageId, error);
}

// ============================================
// 心跳处理
// ============================================
export function handleHeartbeat(
  agentId: string,
  status: 'waking' | 'running' | 'sleeping' | 'critical' | 'dead',
  currentTaskId?: string
): void {
  upsertHeartbeat({
    agent_id: agentId,
    status,
    current_task_id: currentTaskId ?? null,
    metadata: null
  });
}

// ============================================
// 订阅 Task 更新
// ============================================
export function subscribeToTask(
  taskId: string,
  callback: (task: Task) => void
): () => void {
  const handler = (updatedTask: Task) => {
    if (updatedTask.id === taskId) {
      callback(updatedTask);
    }
  };

  taskEvents.on('task:updated', handler);

  return () => {
    taskEvents.off('task:updated', handler);
  };
}

// ============================================
// 辅助函数：数据库 Task 转协议 Task
// ============================================
function dbTaskToTask(dbTask: any): Task | null {
  try {
    return {
      id: dbTask.id,
      status: {
        state: dbTask.status as TaskState,
        timestamp: new Date(dbTask.updated_at).toISOString(),
        message: dbTask.error_message ?? undefined
      },
      history: safeJsonParse(dbTask.history || '[]', []),
      artifacts: safeJsonParse(dbTask.artifacts || '[]', []),
      metadata: dbTask.metadata ? safeJsonParse(dbTask.metadata, undefined) : undefined
    };
  } catch (error) {
    console.error('[TaskManager] dbTaskToTask 解析失败', {
      taskId: dbTask?.id,
      error
    });
    return null;
  }
}

/**
 * 安全的 JSON.parse，失败时返回默认值
 */
function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('[TaskManager] JSON.parse 失败，使用默认值', {
      json: json.substring(0, 100),
      error
    });
    return defaultValue;
  }
}
