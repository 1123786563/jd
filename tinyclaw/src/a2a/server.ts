/**
 * TinyClaw A2A Server - A2A 协议服务器
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { Task, AgentCard, JsonRpcRequest, JsonRpcResponse } from './types';
import { jsonRpcError, A2AError } from './types';
import { TINYCLAW_AGENT_CARD, getTinyClawAgentCard } from './agent-card';
import { handleJsonRpcRequest, handleBatchRequest, isBatchRequest, isNotification, MethodHandlers, JSON_RPC_ERRORS } from './jsonrpc';
import { createTask, getTask, cancelTask, updateTaskState, claimMessage, completeMessage, failMessage, handleHeartbeat, subscribeToTask } from './task-manager';
import { canAcceptNewConnection, registerSSEConnection, unregisterSSEConnection, handleSSEStream, SSE_CONFIG, formatSSEMessage } from './sse-handler';
import type { TasksCreateParams, TasksGetParams, TasksCancelParams, MessagesCompleteParams, MessagesFailParams, AgentsHeartbeatParams } from './types';

// ============================================
// 配置常量
// ============================================

/**
 * 从环境变量获取允许的 API Key 白名单
 * 格式: TINYCLAW_API_KEYS=key1,key2,key3
 */
const ALLOWED_API_KEYS = process.env.TINYCLAW_API_KEYS
  ? process.env.TINYCLAW_API_KEYS.split(',').map(k => k.trim())
  : [];
const A2A_STRICT_AUTH = process.env.TINYCLAW_A2A_STRICT_AUTH === 'true';
const A2A_ALLOW_INSECURE_DEV_AUTH = process.env.TINYCLAW_A2A_ALLOW_INSECURE_DEV_AUTH === 'true';

/**
 * 开发模式标志：需要显式设置 TINYCLAW_DEV_MODE=true
 * 仅在非生产环境且未配置 API Key 白名单时自动启用
 */
const DEV_MODE = !A2A_STRICT_AUTH && (
  process.env.TINYCLAW_DEV_MODE === 'true' ||
  (process.env.NODE_ENV !== 'production' && ALLOWED_API_KEYS.length === 0)
);

// ============================================
// 配置常量
// ============================================
const MAX_REQUEST_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * 有效的 Agent 状态值
 */
const VALID_AGENT_STATUSES = ['waking', 'running', 'sleeping', 'critical', 'dead'] as const;
type ValidAgentStatus = typeof VALID_AGENT_STATUSES[number];

// ============================================
// CORS 配置
// ============================================
const a2aApp = new Hono();

a2aApp.use('*', cors({
  origin: process.env.A2A_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// Agent Card 端点 (A2A 标准路径)
// ============================================
a2aApp.get('/.well-known/agent.json', (c) => {
  return c.json(getTinyClawAgentCard());
});

// ============================================
// 认证实现
// ============================================
interface AuthResult {
  valid: boolean;
  agentId?: string;
  error?: string;
}

async function verifyAuth(authHeader: string | undefined): Promise<AuthResult> {
  if (!DEV_MODE && ALLOWED_API_KEYS.length === 0) {
    return {
      valid: false,
      error: 'A2A auth is enabled but no API keys configured (set TINYCLAW_API_KEYS)',
    };
  }

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  // Bearer Token 认证
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // 生产模式：验证 token 是否在白名单中
    if (!DEV_MODE) {
      if (ALLOWED_API_KEYS.includes(token)) {
        // 从 token 提取 agent ID（假设格式为 agent-{agentId} 或纯 token）
        const agentId = token.startsWith('agent-') ? token : `agent-${token.slice(0, 8)}`;
        return { valid: true, agentId };
      }
      return { valid: false, error: 'Invalid Bearer token' };
    }

    // 开发模式：仅在显式允许时接受未验证 token
    if (token && token.length > 0 && A2A_ALLOW_INSECURE_DEV_AUTH) {
      console.warn(`[A2A] 开发模式：接受未验证的 Bearer token (长度: ${token.length})`);
      return { valid: true, agentId: `agent-${token.slice(0, 8)}` };
    }
  }

  // API Key 认证（支持 ApiKey 和 api-key 两种格式）
  const apiKeyMatch = authHeader.match(/^(?:ApiKey|api-key)\s+(.+)$/);
  if (apiKeyMatch) {
    const key = apiKeyMatch[1];

    // 生产模式：验证 key 是否在白名单中
    if (!DEV_MODE) {
      if (ALLOWED_API_KEYS.includes(key)) {
        const agentId = key.startsWith('agent-') ? key : `agent-${key.slice(0, 8)}`;
        return { valid: true, agentId };
      }
      return { valid: false, error: 'Invalid API key' };
    }

    // 开发模式：仅在显式允许时接受未验证 key
    if (key && key.length > 0 && A2A_ALLOW_INSECURE_DEV_AUTH) {
      console.warn(`[A2A] 开发模式：接受未验证的 API key (长度: ${key.length})`);
      return { valid: true, agentId: `agent-${key.slice(0, 8)}` };
    }
  }

  return { valid: false, error: 'Invalid credentials' };
}

// ============================================
// 方法处理器
// ============================================
const methodHandlers: MethodHandlers = {
  // Task 生命周期
  'tasks/create': async (params: TasksCreateParams) => {
    return createTask(params);
  },
  'tasks/get': async (params: TasksGetParams) => {
    const task = getTask(params.taskId);
    if (!task) {
      throw new A2AError('Task not found', JSON_RPC_ERRORS.INVALID_PARAMS);
    }
    return task;
  },
  'tasks/cancel': async (params: TasksCancelParams) => {
    const task = cancelTask(params.taskId);
    if (!task) {
      throw new A2AError('Task not found', JSON_RPC_ERRORS.INVALID_PARAMS);
    }
    return task;
  },
  'tasks/send': async (params: any) => {
    // TODO: 实现 send 方法
    throw new A2AError('Not implemented', JSON_RPC_ERRORS.INTERNAL_ERROR);
  },

  // 消息队列操作
  'messages/claim': async (params: undefined, agentId: string) => {
    return claimMessage(agentId);
  },
  'messages/complete': async (params: MessagesCompleteParams) => {
    completeMessage(params.messageId, params.output);
    return { success: true };
  },
  'messages/fail': async (params: MessagesFailParams) => {
    failMessage(params.messageId, params.error);
    return { success: true };
  },

  // 心跳
  'agents/heartbeat': async (params: AgentsHeartbeatParams) => {
    // 验证 status 值
    if (!VALID_AGENT_STATUSES.includes(params.status as ValidAgentStatus)) {
      throw new A2AError(`Invalid agent status: ${params.status}. Valid values are: ${VALID_AGENT_STATUSES.join(', ')}`, JSON_RPC_ERRORS.INVALID_PARAMS);
    }
    handleHeartbeat(params.agentId, params.status, params.currentTaskId);
    return { success: true };
  }
};

// ============================================
// JSON-RPC 2.0 端点（支持批量请求）
// ============================================
a2aApp.post('/a2a', async (c) => {
  // 验证请求体大小
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_BODY_SIZE) {
    console.log('[A2A Server] ❌ 请求体过大', { contentLength, maxSize: MAX_REQUEST_BODY_SIZE });
    return c.json(jsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Request body too large'), 413);
  }

  const body = await c.req.json();

  // 判断是单个请求还是批量请求
  const requests = isBatchRequest(body) ? body : [body];

  // 【A2A 日志】接收到的请求
  console.log('[A2A Server] 📨 收到 A2A 请求', {
    isBatch: isBatchRequest(body),
    requestCount: requests.length,
    methods: requests.map(r => r.method),
    timestamp: new Date().toISOString()
  });

  // 验证所有请求
  for (const request of requests) {
    if (request.jsonrpc !== '2.0') {
      console.log('[A2A Server] ❌ 无效的 JSON-RPC 版本', { request });
      return c.json(jsonRpcError(request.id ?? null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC version'));
    }
  }

  // 认证检查（所有请求共享同一个认证）
  const authResult = await verifyAuth(c.req.header('Authorization'));
  if (!authResult.valid) {
    console.log('[A2A Server] ❌ 认证失败', { error: authResult.error });
    return c.json(jsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, authResult.error || 'Unauthorized'));
  }

  // 【A2A 日志】认证成功
  console.log('[A2A Server] ✅ 认证成功', { agentId: authResult.agentId });

  // 处理所有请求
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        // 【A2A 日志】开始处理方法
        console.log('[A2A Server] 🔄 处理方法', {
          method: request.method,
          params: JSON.stringify(request.params).substring(0, 200)
        });

        const startTime = Date.now();
        const response = await handleJsonRpcRequest(request, authResult.agentId!, methodHandlers);
        const duration = Date.now() - startTime;

        // 【A2A 日志】方法处理完成
        console.log('[A2A Server] ✅ 方法处理完成', {
          method: request.method,
          duration: `${duration}ms`,
          hasResult: !!response?.result,
          hasError: !!response?.error
        });

        return response;
      } catch (error: any) {
        console.log('[A2A Server] ❌ 方法处理失败', {
          method: request.method,
          error: error.message
        });
        return jsonRpcError(request.id ?? null, JSON_RPC_ERRORS.INTERNAL_ERROR, error.message);
      }
    })
  );

  // 过滤掉通知的 null 响应
  const responses = results.filter(r => r !== null);

  // 如果全是通知，返回 204
  if (responses.length === 0) {
    console.log('[A2A Server] 📤 所有请求都是通知，返回 204');
    return c.body(null, 204 as const);
  }

  // 【A2A 日志】发送响应
  console.log('[A2A Server] 📤 发送响应', {
    responseCount: responses.length,
    timestamp: new Date().toISOString()
  });

  // 批量请求返回数组，单个请求返回对象
  return c.json(isBatchRequest(body) ? responses : responses[0]);
});

// ============================================
// SSE 流式订阅
// ============================================
a2aApp.get('/a2a/sse/:taskId', async (c) => {
  const taskId = c.req.param('taskId');

  // 认证检查
  const authResult = await verifyAuth(c.req.header('Authorization'));
  if (!authResult.valid) {
    return c.text(authResult.error || 'Unauthorized', 401);
  }

  // 全局连接数限制
  if (!canAcceptNewConnection(taskId)) {
    return c.text('Too many SSE connections', 429);
  }

  // 获取任务
  const task = getTask(taskId);
  if (!task) {
    return c.text('Task not found', 404);
  }

  // 创建 AbortController 用于清理
  const abortController = new AbortController();
  registerSSEConnection(taskId, abortController);

  return streamSSE(c, async (stream) => {
    // 设置总超时
    const timeoutId = setTimeout(() => {
      stream.writeSSE({ event: 'timeout', data: 'Connection timeout' });
      stream.close();
    }, SSE_CONFIG.TOTAL_TIMEOUT_MS);

    // 客户端断开清理
    const cleanup = () => {
      clearTimeout(timeoutId);
      unregisterSSEConnection(taskId, abortController);
    };

    // 监听客户端断开
    c.req.raw.signal.addEventListener('abort', cleanup);

    try {
      // 发送初始状态
      await stream.writeSSE({
        event: 'task-update',
        data: JSON.stringify(task)
      });

      // 如果已经是终态，直接返回
      if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
        return;
      }

      // 订阅任务更新
      const unsubscribe = subscribeToTask(taskId, async (updatedTask) => {
        try {
          await stream.writeSSE({
            event: 'task-update',
            data: JSON.stringify(updatedTask)
          });

          // 任务终态时关闭连接
          if (['completed', 'failed', 'canceled'].includes(updatedTask.status.state)) {
            cleanup();
            stream.close();
          }
        } catch (error) {
          console.error('[SSE] 发送更新失败', { taskId, error });
        }
      });

      // 保持连接 + 心跳
      while (!c.req.raw.signal.aborted) {
        await stream.sleep(SSE_CONFIG.HEARTBEAT_MS);
        await stream.writeSSE({ event: 'ping', data: Date.now().toString() });
      }
    } finally {
      cleanup();
    }
  });
});

// ============================================
// 导出
// ============================================
export { a2aApp };
export default a2aApp;
