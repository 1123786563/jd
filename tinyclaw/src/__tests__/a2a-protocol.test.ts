/**
 * A2A 协议合规性测试
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

// ============================================
// 类型导入（用于测试）
// ============================================
import type { AgentCard, Task, JsonRpcRequest, JsonRpcResponse } from '../a2a/types';
import { A2AError, jsonRpcError } from '../a2a/types';
import { getTinyClawAgentCard } from '../a2a/agent-card';
import { generateTaskId } from '../a2a/task-manager';
import { isValidJsonRpcRequest, createSuccessResponse, createErrorResponse, JSON_RPC_ERRORS } from '../a2a/jsonrpc';

// ============================================
// Mock 数据库操作
// ============================================
const mockDbTasks = new Map<string, any>();

// Helper function to convert DbTask to Task (mimics dbTaskToTask)
function dbTaskToTask(dbTask: any): Task | null {
  if (!dbTask) return null;
  return {
    id: dbTask.id,
    status: {
      state: dbTask.status as any,
      timestamp: new Date(dbTask.updated_at).toISOString(),
      message: dbTask.error_message ?? undefined
    },
    history: JSON.parse(dbTask.history || '[]'),
    artifacts: JSON.parse(dbTask.artifacts || '[]'),
    metadata: dbTask.metadata ? JSON.parse(dbTask.metadata) : undefined
  };
}

vi.mock('../lib/db', () => ({
  initQueueDb: vi.fn(),
  createTask: vi.fn((task) => {
    const now = Date.now();
    const mockTask = {
      ...task,
      created_at: now,
      updated_at: now,
      completed_at: null,
      error_message: null
    };
    mockDbTasks.set(task.id, mockTask);
  }),
  getTask: vi.fn((id) => {
    const dbTask = mockDbTasks.get(id);
    return dbTask;
  }),
  updateTaskStatus: vi.fn((id, status, errorMessage) => {
    const dbTask = mockDbTasks.get(id);
    if (dbTask) {
      dbTask.status = status;
      dbTask.updated_at = Date.now();
      dbTask.error_message = errorMessage ?? null;
      if (['completed', 'failed', 'canceled'].includes(status)) {
        dbTask.completed_at = Date.now();
      }
    }
  }),
  enqueueMessage: vi.fn(() => 1),
  completeMessage: vi.fn(),
  failMessage: vi.fn(),
  claimNextMessage: vi.fn(() => null),
  upsertHeartbeat: vi.fn()
}));

// ============================================
// 导入被 mock 的模块
// ============================================
import { createTask as createTaskManager, getTask as getTaskManager, cancelTask as cancelTaskManager } from '../a2a/task-manager';

// ============================================
// Agent Card 测试
// ============================================
describe('Agent Card', () => {
  it('应返回有效的 Agent Card', () => {
    const card = getTinyClawAgentCard();

    expect(card.name).toBe('TinyClaw Message Router');
    expect(card.version).toBe('1.0.0');
    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(true);
    expect(card.authentication.schemes).toContain('bearer');
    expect(card.authentication.schemes).toContain('api-key');
    expect(card.skills.length).toBeGreaterThan(0);
  });

  it('应包含必要的技能', () => {
    const card = getTinyClawAgentCard();
    const skillIds = card.skills.map(s => s.id);

    expect(skillIds).toContain('route-message');
    expect(skillIds).toContain('claim-task');
    expect(skillIds).toContain('complete-task');
    expect(skillIds).toContain('send-heartbeat');
  });

  it('应包含正确的技能输入模式', () => {
    const card = getTinyClawAgentCard();
    const routeMessageSkill = card.skills.find(s => s.id === 'route-message');

    expect(routeMessageSkill?.inputSchema).toBeDefined();
    expect(routeMessageSkill?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        toAgent: { type: 'string' },
        content: { type: 'string' },
        priority: { type: 'integer' }
      }
    });
  });
});

// ============================================
// JSON-RPC 2.0 规范测试
// ============================================
describe('JSON-RPC 2.0', () => {
  it('应拒绝无效的 JSON-RPC 版本', () => {
    const invalidRequest = { jsonrpc: '1.0', method: 'test', id: 1 };
    expect(isValidJsonRpcRequest(invalidRequest)).toBe(false);
  });

  it('应接受有效的 JSON-RPC 请求', () => {
    const validRequest = { jsonrpc: '2.0', method: 'tasks/get', id: 1 };
    expect(isValidJsonRpcRequest(validRequest)).toBe(true);
  });

  it('应拒绝缺少 method 的请求', () => {
    const invalidRequest = { jsonrpc: '2.0', id: 1 };
    expect(isValidJsonRpcRequest(invalidRequest)).toBe(false);
  });

  it('应正确处理批量请求验证', () => {
    const batchRequest = [
      { jsonrpc: '2.0', method: 'tasks/get', id: 1 },
      { jsonrpc: '2.0', method: 'tasks/create', id: 2 }
    ];
    expect(isValidJsonRpcRequest(batchRequest)).toBe(true);
  });

  it('应拒绝包含无效请求的批量请求', () => {
    const invalidBatchRequest = [
      { jsonrpc: '2.0', method: 'tasks/get', id: 1 },
      { jsonrpc: '1.0', method: 'tasks/create', id: 2 }
    ];
    expect(isValidJsonRpcRequest(invalidBatchRequest)).toBe(false);
  });

  it('应正确创建成功响应', () => {
    const response = createSuccessResponse({ result: 'ok' }, 1);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.result).toEqual({ result: 'ok' });
    expect(response.id).toBe(1);
    expect(response.error).toBeUndefined();
  });

  it('应正确创建错误响应', () => {
    const response = createErrorResponse(1, JSON_RPC_ERRORS.METHOD_NOT_FOUND, 'Method not found');

    expect(response.jsonrpc).toBe('2.0');
    expect(response.error?.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    expect(response.error?.message).toBe('Method not found');
    expect(response.id).toBe(1);
    expect(response.result).toBeUndefined();
  });

  it('应包含所有标准 JSON-RPC 错误码', () => {
    expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700);
    expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600);
    expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602);
    expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603);
  });
});

// ============================================
// Task 生命周期测试
// ============================================
describe('Task Lifecycle', () => {
  beforeEach(() => {
    mockDbTasks.clear();
  });

  it('应生成唯一的 Task ID', () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^task-/);
    expect(id2).toMatch(/^task-/);
  });

  it('应正确创建 Task', () => {
    const task = createTaskManager({
      toAgent: 'test-agent',
      content: 'test message',
      priority: 1
    });

    expect(task.id).toBeDefined();
    expect(task.status.state).toBe('submitted');
    expect(task.history.length).toBe(1);
    expect(task.history[0].role).toBe('user');
    expect(task.metadata?.toAgent).toBe('test-agent');
    expect(task.metadata?.priority).toBe(1);
  });

  it('应正确获取 Task', () => {
    const created = createTaskManager({
      toAgent: 'test-agent',
      content: 'test'
    });

    const retrieved = getTaskManager(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.status.state).toBe('submitted');
  });

  it('获取不存在的 Task 应返回 null', () => {
    const result = getTaskManager('non-existent-task');
    expect(result).toBeNull();
  });

  it('应正确取消 Task', () => {
    const task = createTaskManager({
      toAgent: 'test-agent',
      content: 'test'
    });

    const canceled = cancelTaskManager(task.id);

    expect(canceled?.status).toBeDefined();
    expect(canceled?.status.state).toBe('canceled');
  });

  it('取消不存在的 Task 应返回 null', () => {
    const result = cancelTaskManager('non-existent-task');
    expect(result).toBeNull();
  });

  it('应支持自定义消息部分', () => {
    const task = createTaskManager({
      toAgent: 'test-agent',
      message: {
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello' },
          {
            type: 'file',
            file: { url: 'https://example.com/file.pdf', mimeType: 'application/pdf' }
          }
        ]
      }
    });

    expect(task.history[0].parts).toHaveLength(2);
    expect(task.history[0].parts[0]).toEqual({ type: 'text', text: 'Hello' });
    expect(task.history[0].parts[1]).toEqual({
      type: 'file',
      file: { url: 'https://example.com/file.pdf', mimeType: 'application/pdf' }
    });
  });
});

// ============================================
// A2AError 测试
// ============================================
describe('A2AError', () => {
  it('应正确创建 A2AError', () => {
    const error = new A2AError('Test error', -32600);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(-32600);
    expect(error.name).toBe('A2AError');
    expect(error.retryable).toBe(false);
  });

  it('服务器错误应可重试', () => {
    const error = new A2AError('Server error', -32603);
    expect(error.retryable).toBe(true);
  });

  it('网络错误应默认可重试', () => {
    const error = new A2AError('Network error');
    expect(error.retryable).toBe(true);
  });

  it('无效参数错误应可重试', () => {
    const error = new A2AError('Invalid params', -32602);
    expect(error.retryable).toBe(true);
  });

  it('方法不存在错误不可重试', () => {
    const error = new A2AError('Method not found', -32601);
    expect(error.retryable).toBe(false);
  });
});

// ============================================
// 幂等性测试
// ============================================
describe('Idempotency', () => {
  it('jsonRpcError 应生成一致的错误响应', () => {
    const response1 = jsonRpcError(1, -32600, 'Invalid request');
    const response2 = jsonRpcError(1, -32600, 'Invalid request');

    expect(response1).toEqual(response2);
  });

  it('createSuccessResponse 相同输入应生成相同响应', () => {
    const response1 = createSuccessResponse({ data: 'test' }, 'req-1');
    const response2 = createSuccessResponse({ data: 'test' }, 'req-1');

    expect(response1).toEqual(response2);
  });

  it('createErrorResponse 相同输入应生成相同响应', () => {
    const response1 = createErrorResponse(1, -32601, 'Not found');
    const response2 = createErrorResponse(1, -32601, 'Not found');

    expect(response1).toEqual(response2);
  });
});

// ============================================
// 边界条件测试
// ============================================
describe('Edge Cases', () => {
  it('应拒绝空字符串作为 method', () => {
    const invalidRequest = { jsonrpc: '2.0', method: '', id: 1 };
    // 空字符串不在白名单中，应被拒绝
    expect(isValidJsonRpcRequest(invalidRequest)).toBe(false);
  });

  it('应处理 null 作为 body', () => {
    expect(isValidJsonRpcRequest(null)).toBe(false);
  });

  it('应处理空数组作为批量请求', () => {
    const emptyBatch: any[] = [];
    expect(isValidJsonRpcRequest(emptyBatch)).toBe(true);
  });

  it('应处理通知请求（无 id）', () => {
    const notification = { jsonrpc: '2.0', method: 'tasks/get' };
    expect(isValidJsonRpcRequest(notification)).toBe(true);
  });

  it('应处理带 params 的有效请求', () => {
    const request = {
      jsonrpc: '2.0' as const,
      method: 'tasks/get',
      params: { key: 'value' },
      id: 1
    };
    expect(isValidJsonRpcRequest(request)).toBe(true);
  });
});

// ============================================
// 类型安全测试
// ============================================
describe('Type Safety', () => {
  it('Agent Card 应符合类型定义', () => {
    const card: AgentCard = getTinyClawAgentCard();

    expect(card.name).toBeDefined();
    expect(card.version).toBeDefined();
    expect(card.url).toBeDefined();
    expect(card.capabilities).toBeDefined();
    expect(card.authentication).toBeDefined();
    expect(card.skills).toBeInstanceOf(Array);
  });

  it('Task 应符合类型定义', () => {
    const task: Task = createTaskManager({
      toAgent: 'test',
      content: 'test'
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBeDefined();
    expect(task.history).toBeInstanceOf(Array);
    expect(task.artifacts).toBeInstanceOf(Array);
  });

  it('JsonRpcResponse 应包含必要字段', () => {
    const response: JsonRpcResponse = createSuccessResponse({ test: true }, 1);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBeDefined();
    expect(response.result !== undefined || response.error !== undefined).toBe(true);
  });
});
