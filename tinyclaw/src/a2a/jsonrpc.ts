/**
 * JSON-RPC 2.0 处理器
 */
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  TasksCreateParams,
  TasksGetParams,
  TasksCancelParams,
  MessagesCompleteParams,
  MessagesFailParams,
  AgentsHeartbeatParams
} from './types';
import { jsonRpcError } from './types';

// ============================================
// JSON-RPC 错误码
// ============================================
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
} as const;

// ============================================
// 允许的方法白名单
// ============================================
/**
 * 允许的 JSON-RPC 方法名白名单
 * 防止任意方法调用攻击
 */
export const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  // Task 生命周期
  'tasks/create',
  'tasks/get',
  'tasks/cancel',
  'tasks/send',
  // 消息队列操作
  'messages/claim',
  'messages/complete',
  'messages/fail',
  // 心跳
  'agents/heartbeat'
]);

/**
 * 验证方法名是否在白名单中
 */
export function validateMethodName(method: string): boolean {
  return ALLOWED_METHODS.has(method);
}

// ============================================
// 请求验证
// ============================================
export function isValidJsonRpcRequest(body: any): body is JsonRpcRequest | JsonRpcRequest[] {
  // 批量请求
  if (Array.isArray(body)) {
    return body.every(isSingleRequest);
  }
  // 单个请求
  return isSingleRequest(body);
}

function isSingleRequest(body: any): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    body.jsonrpc === '2.0' &&
    typeof body.method === 'string' &&
    validateMethodName(body.method)
  );
}

// ============================================
// 响应构建
// ============================================
export function createSuccessResponse<T>(result: T, id: string | number | null): JsonRpcResponse<T> {
  return {
    jsonrpc: '2.0',
    result,
    id
  };
}

export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: any
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    error: { code, message, data },
    id
  };
}

// ============================================
// 批量请求处理
// ============================================
export function isBatchRequest(body: any): body is JsonRpcRequest[] {
  return Array.isArray(body);
}

export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

// ============================================
// 方法处理器类型
// ============================================
export type MethodHandler<TParams = any, TResult = any> = (params: TParams, agentId: string) => Promise<TResult>;

export interface MethodHandlers {
  'tasks/create': MethodHandler<TasksCreateParams, any>;
  'tasks/get': MethodHandler<TasksGetParams, any>;
  'tasks/cancel': MethodHandler<TasksCancelParams, any>;
  'tasks/send': MethodHandler<any, any>;
  'messages/claim': MethodHandler<undefined, any>;
  'messages/complete': MethodHandler<MessagesCompleteParams, { success: boolean }>;
  'messages/fail': MethodHandler<MessagesFailParams, { success: boolean }>;
  'agents/heartbeat': MethodHandler<AgentsHeartbeatParams, { success: boolean }>;
}

// ============================================
// JSON-RPC 请求处理器
// ============================================
export async function handleJsonRpcRequest(
  request: JsonRpcRequest,
  agentId: string,
  handlers: MethodHandlers
): Promise<JsonRpcResponse | null> {
  const { method, params, id } = request;

  // 检查方法是否存在
  const handler = handlers[method as keyof MethodHandlers];
  if (!handler) {
    return createErrorResponse(id ?? null, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }

  try {
    const result = await handler(params || {}, agentId);

    // 通知（无 id）不需要响应
    if (id === undefined) {
      return null;
    }

    return createSuccessResponse(result, id);
  } catch (error: any) {
    const errorCode = error.code || JSON_RPC_ERRORS.INTERNAL_ERROR;
    return createErrorResponse(id ?? null, errorCode, error.message);
  }
}

// ============================================
// 批量请求处理
// ============================================
export async function handleBatchRequest(
  requests: JsonRpcRequest[],
  agentId: string,
  handlers: MethodHandlers
): Promise<JsonRpcResponse[]> {
  const results = await Promise.all(
    requests.map(request => handleJsonRpcRequest(request, agentId, handlers))
  );

  // 过滤掉通知的 null 响应
  return results.filter((r): r is JsonRpcResponse => r !== null);
}
