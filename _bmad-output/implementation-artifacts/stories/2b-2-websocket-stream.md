# Story 2b.2: WebSocket实时事件流

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## 故事背景

当前 TinyClaw 系统使用 **SSE (Server-Sent Events)** 作为前端的实时事件推送机制。虽然 SSE 可以实现服务器到客户端的单向通信，但它存在以下局限性：

1. **单向通信** - 只支持服务器推送到客户端，不支持客户端主动推送
2. **重连机制不灵活** - 自动重连可能不适合所有场景
3. **协议不够通用** - 现代实时应用更倾向于使用 WebSocket 协议
4. **双向交互缺失** - 无法支持前端主动发起实时指令

## 用户故事

**作为** TinyClaw 系统管理员
**我希望** 前端能够通过 WebSocket 与后端建立双向实时通信
**以便于** 实时接收系统事件、发送控制指令、查看智能体状态

## 验收标准

### 功能性要求

1. **WebSocket 连接建立**
   - [ ] 后端暴露 WebSocket 端点 `/ws` 或 `/api/events/ws`
   - [ ] 支持标准的 WebSocket 升级握手
   - [ ] 连接成功后发送 `connected` 事件确认

2. **事件推送（服务器 → 客户端）**
   - [ ] 实时推送消息接收事件 (`message_received`)
   - [ ] 推送智能体路由事件 (`agent_routed`)
   - [ ] 推送任务更新事件 (`task_updated`)
   - [ ] 推送智能体响应事件 (`agent_responded`)
   - [ ] 推送会话完成事件 (`conversation_completed`)
   - [ ] 推送队列状态变化事件 (`queue_status_changed`)
   - [ ] 推送系统健康状态事件 (`system_health`)

3. **双向通信（客户端 → 服务器）**
   - [ ] 支持客户端发送订阅/取消订阅请求
   - [ ] 支持客户端发送过滤器配置（仅接收特定事件类型）
   - [ ] 支持客户端发送心跳/保活消息
   - [ ] 支持客户端发送控制指令（暂停/恢复队列）

4. **错误处理与恢复**
   - [ ] 连接异常断开时记录详细日志
   - [ ] 支持自动重连机制（可配置）
   - [ ] 连接恢复后重新发送未确认事件（可选）
   - [ ] 提供连接状态查询接口

5. **兼容性**
   - [ ] 保留现有的 SSE 端点 `/api/events/stream`（向后兼容）
   - [ ] WebSocket 和 SSE 可以同时运行
   - [ ] 事件格式在两种协议间保持一致

### 技术性要求

1. **协议规范**
   - [ ] 使用标准 WebSocket 协议 (RFC 6455)
   - [ ] 消息格式采用 JSON
   - [ ] 支持文本帧和二进制帧（优先文本帧）

2. **消息格式**
   ```json
   {
     "type": "message_received",
     "timestamp": 1709500000000,
     "data": {
       "messageId": "msg_123",
       "channel": "discord",
       "sender": "user123",
       "content": "Hello"
     }
   }
   ```

3. **安全性**
   - [ ] 支持可选的身份验证机制（JWT Token）
   - [ ] 防止未授权的连接（默认开放，生产环境建议开启认证）
   - [ ] 设置连接数限制（防止 DoS 攻击）

4. **性能**
   - [ ] 支持至少 1000 个并发 WebSocket 连接
   - [ ] 事件推送延迟 < 100ms
   - [ ] 内存使用稳定，无内存泄漏

## 技术实现方案

### 方案选择

**推荐方案：使用 `ws` 库实现 WebSocket 服务器**

理由：
- `ws` 是 Node.js 最流行和成熟的 WebSocket 库
- 与 Hono 框架可以良好集成
- 支持 TypeScript，类型安全
- 性能优异，支持大量并发连接
- 社区活跃，文档完善

**替代方案：**
- `uWebSockets.js` - 性能更高但学习曲线陡峭
- 原生 `http` + `websocket` 手动实现 - 复杂度高，不推荐

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      WebSocket Server                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          WebSocket Connection Manager                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  - Connection Pool (Map<clientId, WebSocket>)   │  │  │
│  │  │  - Heartbeat Manager                            │  │  │
│  │  │  - Subscription Manager                         │  │  │
│  │  │  - Event Broadcast System                       │  │  │
│  │  └──────────────────┬──────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────┘  │
│                       │                                       │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │            WebSocket Event Handler                    │  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  - onConnection (handshake, auth, init)         │  │  │
│  │  │  - onMessage (parse, route, handle)             │  │  │
│  │  │  - onError (log, cleanup)                       │  │  │
│  │  │  - onClose (cleanup, reconnect logic)           │  │  │
│  │  └──────────────────┬──────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────┘  │
│                       │                                       │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │          Event Subscription System                    │  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  - Subscribe: { eventTypes: [...], filters: {} }│  │  │
│  │  │  - Unsubscribe                                  │  │  │
│  │  │  - Broadcast to Subscribers                     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Integration with Existing SSE              │  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  - emitEvent() → broadcastWebSocketEvent()     │  │  │
│  │  │  - SSE clients ← broadcastSSE()                 │  │  │
│  │  │  - WebSocket clients ← broadcastWebSocket()     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

#### 1. WebSocket 服务器 (`src/server/websocket.ts`)

```typescript
import { WebSocketServer } from 'ws';
import http from 'http';

export class WebSocketEventServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupListeners();
  }

  private setupListeners(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      this.subscriptions.set(clientId, new Set(['*'])); // 默认订阅所有事件

      // 发送连接确认
      this.sendEvent(ws, 'connected', {
        clientId,
        timestamp: Date.now(),
        message: 'WebSocket connected successfully'
      });

      // 设置心跳
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendEvent(ws, 'heartbeat', { timestamp: Date.now() });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // 30秒心跳

      ws.on('message', (data: Buffer) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleClose(clientId));
      ws.on('error', (error: Error) => this.handleError(clientId, error));
    });
  }

  private handleMessage(clientId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.eventTypes || ['*']);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.eventTypes);
          break;
        case 'filter':
          this.handleFilter(clientId, message.filters);
          break;
        case 'pause':
          this.handlePause(clientId);
          break;
        case 'resume':
          this.handleResume(clientId);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(clientId, 'Invalid message format');
    }
  }

  broadcastEvent(eventType: string, data: any): void {
    const message = JSON.stringify({
      type: eventType,
      timestamp: Date.now(),
      data
    });

    for (const [clientId, ws] of this.clients.entries()) {
      const subscriptions = this.subscriptions.get(clientId) || new Set();

      // 检查是否订阅了该事件类型
      if (subscriptions.has('*') || subscriptions.has(eventType)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }

  // ... 其他方法：handleSubscribe, handleUnsubscribe, handleClose, handleError, sendEvent, sendError
}
```

#### 2. 事件集成 (`src/lib/logging.ts`)

当前的 `emitEvent()` 函数已经通过 `onEvent()` 机制广播到 SSE。我们需要扩展这个机制：

```typescript
// src/lib/logging.ts

// 现有代码
export function emitEvent(type: string, data: Record<string, unknown>): void {
    for (const listener of eventListeners) {
        try { listener(type, data); } catch { /* never break the queue processor */ }
    }
}

// 新增：集成 WebSocket 广播
import { broadcastWebSocketEvent } from '../server/websocket';

// 修改 emitEvent 以支持 WebSocket
export function emitEvent(type: string, data: Record<string, unknown>): void {
    for (const listener of eventListeners) {
        try { listener(type, data); } catch { /* never break the queue processor */ }
    }

    // 同时广播到 WebSocket 客户端
    broadcastWebSocketEvent(type, data);
}
```

#### 3. API 服务器集成 (`src/server/index.ts`)

```typescript
import { WebSocketEventServer } from './websocket';

export function startApiServer(conversations: Map<string, Conversation>): http.Server {
    // ... 现有代码

    // 创建 WebSocket 服务器
    const websocketServer = new WebSocketEventServer(server as unknown as http.Server);

    // 修改 emitEvent 以支持 WebSocket 广播
    onEvent((type, data) => {
        broadcastSSE(type, { type, timestamp: Date.now(), ...data });
        websocketServer.broadcastEvent(type, data);
    });

    return server as unknown as http.Server;
}
```

### 文件结构

```
tinyclaw/src/server/
├── index.ts                 # API 服务器入口（修改）
├── sse.ts                   # SSE 广播（保留，现有）
├── websocket.ts             # NEW: WebSocket 服务器实现
└── routes/
    └── ...                  # 现有路由（不变）

tinyclaw/src/lib/
├── logging.ts               # 事件发射（修改，集成 WebSocket）
└── types.ts                 # 类型定义（可选，添加 WebSocket 相关类型）
```

## 开发任务分解

### 阶段 1: 基础设施搭建 (预计 2-3 小时)

- [ ] 安装 `ws` 依赖：`npm install ws` 和 `npm install -D @types/ws`
- [ ] 创建 `src/server/websocket.ts` 基础框架
- [ ] 实现 WebSocket 服务器类的基础结构
- [ ] 添加连接建立和断开处理

### 阶段 2: 事件广播实现 (预计 2-3 小时)

- [ ] 实现 `broadcastEvent()` 方法
- [ ] 集成 `emitEvent()` 事件发射机制
- [ ] 测试基本事件推送功能
- [ ] 添加事件类型验证

### 阶段 3: 客户端消息处理 (预计 3-4 小时)

- [ ] 实现 `subscribe/unsubscribe` 消息处理
- [ ] 实现事件过滤器功能
- [ ] 实现心跳/保活机制
- [ ] 实现错误处理和重连逻辑

### 阶段 4: 集成与测试 (预计 3-4 小时)

- [ ] 集成到 API 服务器
- [ ] 编写单元测试
- [ ] 编写集成测试（模拟前端连接）
- [ ] 压力测试（100+ 并发连接）
- [ ] 文档更新

### 阶段 5: 向后兼容与优化 (预计 2 小时)

- [ ] 确保 SSE 端点继续正常工作
- [ ] 性能优化和内存泄漏检查
- [ ] 添加日志和监控
- [ ] 更新 README 和 API 文档

## 技术依赖

### 必需依赖

```json
{
  "ws": "^8.17.0",
  "@types/ws": "^8.5.11"
}
```

### 可选依赖（用于测试）

```json
{
  "wscat": "^5.2.1"  // 命令行 WebSocket 客户端，用于手动测试
}
```

## 事件类型参考

### 系统事件

| 事件类型 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `connected` | WebSocket 连接建立 | `clientId`, `timestamp` |
| `disconnected` | 连接断开 | `clientId`, `reason` |
| `heartbeat` | 心跳保活 | `timestamp` |
| `error` | 错误发生 | `message`, `details` |
| `system_health` | 系统健康检查 | `status`, `metrics` |

### 消息事件

| 事件类型 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `message_received` | 收到新消息 | `messageId`, `channel`, `sender`, `content` |
| `agent_routed` | 消息路由到智能体 | `messageId`, `agentId`, `routeType` |
| `agent_responded` | 智能体生成响应 | `messageId`, `agentId`, `response` |
| `message_sent` | 响应发送到渠道 | `messageId`, `channel`, `status` |

### 任务事件

| 事件类型 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `task_created` | 任务创建 | `taskId`, `title`, `assignedTo` |
| `task_updated` | 任务更新 | `taskId`, `status`, `progress` |
| `task_completed` | 任务完成 | `taskId`, `result` |

### 队列事件

| 事件类型 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `queue_status_changed` | 队列状态变化 | `pending`, `processing`, `completed` |
| `queue_paused` | 队列暂停 | `reason` |
| `queue_resumed` | 队列恢复 | `timestamp` |

### 会话事件

| 事件类型 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `conversation_started` | 会话开始 | `conversationId`, `participants` |
| `conversation_updated` | 会话更新 | `conversationId`, `state` |
| `conversation_completed` | 会话完成 | `conversationId`, `summary` |

## 测试场景

### 单元测试

```typescript
describe('WebSocketEventServer', () => {
  it('should broadcast events to all connected clients', async () => {
    // 创建服务器和模拟客户端
    // 发送事件并验证所有客户端收到
  });

  it('should handle subscribe/unsubscribe correctly', async () => {
    // 测试事件过滤功能
  });

  it('should clean up disconnected clients', async () => {
    // 测试连接断开后的资源清理
  });
});
```

### 集成测试

```typescript
describe('WebSocket Integration', () => {
  it('should receive message_received events in real-time', async () => {
    // 模拟队列处理器发送消息
    // 验证 WebSocket 客户端实时收到事件
  });

  it('should handle 100 concurrent connections', async () => {
    // 压力测试
  });
});
```

### 手动测试

1. **基本连接测试**
   ```bash
   npx wscat -c ws://localhost:3777/ws
   # 应该收到 {"type":"connected",...}
   ```

2. **事件订阅测试**
   ```bash
   npx wscat -c ws://localhost:3777/ws
   # 发送: {"type":"subscribe","eventTypes":["message_received"]}
   # 触发消息接收，验证只收到 message_received 事件
   ```

3. **前端集成测试**
   - 使用浏览器 WebSocket API 连接
   - 验证事件接收和显示
   - 测试断线重连

## 向后兼容性

### 保留的 SSE 端点

- `/api/events/stream` - 保持不变，继续提供 SSE 流
- 现有前端可以继续使用，无需修改

### 新增的 WebSocket 端点

- `/ws` - 主要的 WebSocket 端点
- 或者 `/api/events/ws` - 与现有路由风格一致

### 迁移策略

1. **阶段 1**: 同时支持 SSE 和 WebSocket
2. **阶段 2**: 新功能只在 WebSocket 中实现
3. **阶段 3**: 标记 SSE 为 deprecated
4. **阶段 4**: 移除 SSE（可选，取决于使用情况）

## 安全考虑

### 认证机制（可选）

```typescript
// 支持 JWT Token 认证
ws.on('connection', (socket, req) => {
  const token = req.url?.split('token=')[1];
  if (token && !verifyToken(token)) {
    socket.close(4001, 'Unauthorized');
    return;
  }
  // 继续处理
});
```

### 连接数限制

```typescript
if (this.clients.size > MAX_CONNECTIONS) {
  ws.close(4002, 'Too many connections');
  return;
}
```

### 输入验证

- 所有客户端消息必须经过 JSON Schema 验证
- 事件类型必须在白名单内
- 防止恶意消息导致服务器崩溃

## 性能优化

### 连接池管理

- 使用 `Map` 存储连接，快速查找
- 定期清理已断开的连接
- 使用弱引用避免内存泄漏

### 事件批量处理

```typescript
// 对于高频事件，考虑批量发送
const eventQueue: any[] = [];
setInterval(() => {
  if (eventQueue.length > 0) {
    broadcastBatch(eventQueue);
    eventQueue.length = 0;
  }
}, 100);
```

### 压缩传输

```typescript
// 对于大体积消息启用压缩
const WebSocket = require('ws');
const wss = new WebSocket.Server({
  perMessageDeflate: {
    zlibDeflateOptions: { level: 9 },
    zlibInflateOptions: { chunkSize: 1024 },
  }
});
```

## 监控与日志

### 关键指标

- 活跃连接数
- 消息发送速率
- 错误率
- 平均延迟
- 内存使用

### 日志级别

```typescript
log('INFO', `[WebSocket] Client ${clientId} connected`);
log('INFO', `[WebSocket] Broadcast event: ${eventType} to ${count} clients`);
log('WARN', `[WebSocket] Client ${clientId} sent invalid message`);
log('ERROR', `[WebSocket] Broadcast failed: ${error.message}`);
```

## 文档更新清单

- [ ] 更新 `tinyclaw/README.md` - 添加 WebSocket 使用说明
- [ ] 更新 API 文档 - 添加 WebSocket 端点文档
- [ ] 添加示例代码 - 前端如何使用 WebSocket
- [ ] 更新架构文档 - 说明 WebSocket 在系统中的位置

## 已知问题与限制

1. **浏览器兼容性**: 所有现代浏览器都支持 WebSocket，无需担心
2. **代理和防火墙**: WebSocket 使用 80/443 端口，通常不会被拦截
3. **消息大小限制**: 单条消息最大 128KB（可配置）
4. **并发连接数**: 默认无限制，生产环境建议设置上限

## 参考资料

- WebSocket 协议规范: https://tools.ietf.org/html/rfc6455
- ws 库文档: https://github.com/websockets/ws
- MDN WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- TinyClaw 架构文档: `/docs/architecture-tinyclaw.md`

## 验收检查清单

完成此故事后，应该能够：

- [ ] 通过浏览器或 wscat 建立 WebSocket 连接
- [ ] 实时接收系统事件（消息、任务、队列状态）
- [ ] 通过 WebSocket 发送控制指令（订阅、过滤）
- [ ] SSE 端点继续正常工作（向后兼容）
- [ ] 支持至少 100 个并发连接
- [ ] 事件推送延迟 < 100ms
- [ ] 无内存泄漏，运行 24 小时稳定
- [ ] 有完整的单元测试和集成测试
- [ ] 有使用文档和示例代码

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List

- `tinyclaw/src/server/websocket.ts` - WebSocket 服务器实现
- `tinyclaw/src/server/index.ts` - API 服务器集成（修改）
- `tinyclaw/src/lib/logging.ts` - 事件发射集成（修改）
- `tinyclaw/src/__tests__/server/websocket.test.ts` - 单元测试
- `tinyclaw/src/__tests__/integration/websocket.test.ts` - 集成测试
- `tinyclaw/package.json` - 添加 `ws` 依赖

---

**故事创建时间**: 2026-03-04
**优先级**: ⭐⭐⭐⭐ (Epic 2b 的核心功能)
**估计工时**: 12-16 小时
**依赖关系**: 无（独立实现）
**风险评估**: 低风险（有成熟的库支持，向后兼容）
