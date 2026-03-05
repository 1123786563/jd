// ============================================
// Agent Card
// ============================================
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  authentication: {
    schemes: string[];
  };
  skills: Skill[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  inputSchema?: object;
  outputSchema?: object;
}

// ============================================
// Task
// ============================================
export interface Task {
  id: string;
  status: TaskStatus;
  history: Message[];
  artifacts: Artifact[];
  metadata?: Record<string, any>;
}

export interface TaskStatus {
  state: TaskState;
  timestamp: string;
  message?: string;
}

export type TaskState = 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';

export interface Message {
  role: 'user' | 'agent';
  parts: MessagePart[];
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { url: string; mimeType?: string } };

export interface Artifact {
  id: string;
  name?: string;
  parts: MessagePart[];
}

// ============================================
// JSON-RPC 2.0
// ============================================
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: object;
  id: string | number;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

// ============================================
// 业务类型
// ============================================
export interface CreateTaskParams {
  conversationId?: string;
  fromAgent?: string;
  toAgent: string;
  content?: string;
  message?: Message;
  priority?: number;
  metadata?: Record<string, any>;
}

export type AgentStatus = 'waking' | 'running' | 'sleeping' | 'critical' | 'dead';

export interface MessageContent {
  parts: MessagePart[];
}

// ============================================
// 错误
// ============================================
export class A2AError extends Error {
  public retryable: boolean = true;

  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'A2AError';

    // 网络错误和服务器错误可重试
    if (code && [-32603, -32602].includes(code)) {
      this.retryable = true;
    }
    // 认证错误和无效请求不重试
    if (code && [-32600, -32601].includes(code)) {
      this.retryable = false;
    }
  }
}

// ============================================
// SSE 类型
// ============================================
export interface SSEEvent {
  event?: string;
  data?: string;
  id?: string;
  retry?: number;
}
