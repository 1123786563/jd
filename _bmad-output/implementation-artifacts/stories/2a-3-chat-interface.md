# 📝 2a.3: 实时聊天界面优化

**故事编号：** 2a-3-chat-interface
**状态：** ready-for-dev
**所属 Epic：** 2a - TinyOffice 前端完善
**创建日期：** 2026-03-04

---

## 📖 用户故事

作为 **TinyClaw 系统管理员和操作员**，
我想要 **一个实时、响应式、功能丰富的聊天界面**，
以便 **能够与单个 Agent 或 Team 进行高效的实时对话交互，查看完整的历史记录，并获得流畅的用户体验**。

### 业务价值

- **提高操作效率：** 实时聊天界面让管理员能够即时与 AI Agent 交互
- **改善用户体验：** 响应式、流畅的界面提升整体操作体验
- **增强可观察性：** 实时事件推送让管理员了解系统内部状态
- **简化故障排查：** 完整的会话历史便于调试和审计

---

## ✅ 验收标准 (Acceptance Criteria)

### 功能要求

1. **实时消息流**
   - [x] 通过 SSE (Server-Sent Events) 接收实时事件推送
   - [x] 支持 `message_received`, `agent_routed`, `response_ready` 等事件类型
   - [ ] 新消息到达时自动滚动到底部
   - [ ] 显示消息发送/接收时间（相对时间格式，如 "2分钟前"）

2. **消息展示**
   - [x] 区分用户发送的消息和 Agent 的回复
   - [x] 显示消息来源（渠道、发送者）
   - [x] 支持长消息的自动换行和预格式化
   - [ ] 显示消息状态图标（发送中、已发送、处理中、完成）

3. **输入框优化**
   - [x] 支持多行输入（2-5行自适应高度）
   - [x] Ctrl+Enter 或 Cmd+Enter 快捷键发送
   - [ ] 输入时显示字符计数（可选）
   - [ ] 输入历史记录（上/下箭头导航）

4. **Agent/Team 信息栏**
   - [x] 显示 Agent 名称和 ID
   - [x] 显示 LLM 供应商和模型信息
   - [x] 显示工作目录（如果配置）
   - [ ] 显示 Agent 在线/离线状态
   - [ ] 显示当前会话活跃度

5. **状态栏**
   - [x] 显示链式事件状态（`chain_step_start`, `chain_handoff` 等）
   - [ ] 使用不同颜色标识不同事件类型
   - [ ] 显示事件发生时间
   - [ ] 最多显示 6 个最近的事件

6. **连接状态**
   - [x] 显示实时连接状态（Live/Disconnected）
   - [x] 连接丢失时自动重连
   - [ ] 重连失败时显示错误提示

### 技术要求

7. **性能优化**
   - [ ] 消息列表虚拟滚动（处理大量消息时）
   - [ ] 消息去重机制（基于时间戳+内容指纹）
   - [ ] 限制消息历史显示数量（默认 200 条，可配置）

8. **错误处理**
   - [x] 网络错误时显示友好的错误消息
   - [x] SSE 连接中断时自动重连
   - [ ] 消息发送失败时显示重试选项

9. **响应式设计**
   - [ ] 在不同屏幕尺寸下正常显示（桌面、平板、手机）
   - [ ] 小屏幕下自动调整布局（横向滚动改为垂直滚动）

10. **可访问性**
    - [ ] 支持键盘导航（Tab 键切换焦点）
    - [ ] 支持屏幕阅读器（ARIA 标签）
    - [ ] 颜色对比度符合 WCAG 2.1 标准

---

## 🎯 实施任务

### 任务 1：消息历史加载和优化 (AC: 1, 2, 7)

#### 子任务 1.1：实现消息历史 API 集成
- [ ] 在 `src/lib/api.ts` 中添加 `getChatHistory(agentId: string, limit?: number)` 函数
- [ ] 实现从后端 `/api/chats/:agentId` 获取历史消息
- [ ] 在聊天页面加载时调用此 API 填充历史记录

#### 子任务 1.2：优化消息渲染性能
- [ ] 使用 `useMemo` 缓存消息列表渲染
- [ ] 为消息项添加 `key` 以优化 React diff
- [ ] 考虑使用 `react-virtual` 或 `@tanstack/react-virtual` 实现虚拟滚动（如果消息超过 100 条）

#### 子任务 1.3：实现消息去重
- [ ] 基于消息指纹（类型+时间戳+关键字段）进行去重
- [ ] 使用 Set 数据结构存储已处理的消息指纹
- [ ] 定期清理旧的指纹（保持最近 500 条）

### 任务 2：输入框功能增强 (AC: 3, 8)

#### 子任务 2.1：实现输入历史
- [ ] 在 `src/lib/hooks.ts` 中添加 `useInputHistory` hook
- [ ] 使用 localStorage 存储历史（限制 20 条）
- [ ] 实现上/下箭头导航历史
- [ ] 回车发送时清空当前历史索引

#### 子任务 2.2：添加字符计数（可选）
- [ ] 在输入框下方显示当前字符数/最大字符数
- [ ] 超过限制时显示警告样式

#### 子任务 2.3：优化发送逻辑
- [ ] 发送前验证消息非空
- [ ] 发送中禁用发送按钮
- [ ] 发送成功后清空输入框
- [ ] 发送失败时保留消息内容并显示错误

### 任务 3：状态显示优化 (AC: 5, 6)

#### 子任务 3.1：增强状态栏功能
- [ ] 为不同事件类型添加颜色标识：
  - `agent_routed`: 蓝色
  - `chain_step_start`: 黄色
  - `chain_handoff`: 橙色
  - `team_chain_start/end`: 紫色
  - `message_enqueued`: 青色
  - `processor_start`: 主色
- [ ] 添加事件时间显示（使用 `timeAgo` 工具函数）
- [ ] 限制显示最近 6 个事件

#### 子任务 3.2：连接状态监控
- [ ] 实现 SSE 连接重连机制
- [ ] 显示连接尝试次数
- [ ] 重连失败 3 次后显示永久离线提示

### 任务 4：Agent 信息栏增强 (AC: 4)

#### 子任务 4.1：添加在线状态指示
- [ ] 从 API 获取 Agent 最后活跃时间
- [ ] 显示在线（<5 分钟）、离线（>5 分钟）状态
- [ ] 使用颜色标识（绿色=在线，灰色=离线）

#### 子任务 4.2：添加会话统计
- [ ] 显示当前会话消息数
- [ ] 显示会话开始时间
- [ ] 添加清除会话按钮

### 任务 5：响应式设计 (AC: 9)

#### 子任务 5.1：小屏幕适配
- [ ] 使用 Tailwind 的响应式类（`md:`, `lg:` 等）
- [ ] 小屏幕下简化状态栏显示
- [ ] 小屏幕下调整输入框高度
- [ ] 测试不同屏幕尺寸（320px, 768px, 1024px, 1920px）

### 任务 6：错误处理和可访问性 (AC: 8, 10)

#### 子任务 6.1：增强错误处理
- [ ] 捕获 SSE 连接错误
- [ ] 捕获 API 请求错误
- [ ] 显示用户友好的错误消息
- [ ] 提供重试按钮

#### 子任务 6.2：提升可访问性
- [ ] 为所有交互元素添加 ARIA 标签
- [ ] 确保颜色对比度符合标准（使用工具检查）
- [ ] 支持键盘焦点导航
- [ ] 添加加载状态的 ARIA 属性

---

## 🔧 技术实施指南

### 架构决策

#### 1. 状态管理

**当前方案：** React Hooks + Local State
- 使用 `useState` 管理消息列表、输入内容、连接状态
- 使用 `useEffect` 处理 SSE 订阅和清理
- 使用 `useRef` 保存滚动引用和去重集合

**为什么选择此方案：**
- 聊天界面状态相对简单，不需要全局状态管理
- React Hooks 提供了足够的灵活性和性能
- 避免引入额外的依赖（如 Redux、Zustand）

#### 2. SSE 事件处理

**当前实现：** `subscribeToEvents` 函数（`src/lib/api.ts`）
```typescript
export function subscribeToEvents(
  onEvent: (event: EventData) => void,
  onError?: (err: Event) => void
): () => void {
  const es = new EventSource(`${API_BASE}/api/events/stream`);
  // ... 事件监听逻辑
  return () => es.close();
}
```

**优化建议：**
- 添加自动重连机制（指数退避）
- 添加连接状态回调
- 支持取消订阅

#### 3. 消息去重

**当前实现：** 基于指纹的 Set 去重
```typescript
const seenRef = useRef(new Set<string>());
const fp = `${event.type}:${event.timestamp}:${messageId}:${agentId}`;
if (seenRef.current.has(fp)) return;
seenRef.current.add(fp);
```

**保留此方案，但添加清理逻辑：**
```typescript
if (seenRef.current.size > 500) {
  const entries = [...seenRef.current];
  seenRef.current = new Set(entries.slice(entries.length - 300));
}
```

### 关键代码位置

#### 前端文件
- `tinyclaw/tinyoffice/src/app/chat/agent/[id]/page.tsx` - Agent 聊天页面
- `tinyclaw/tinyoffice/src/app/chat/team/[id]/page.tsx` - Team 聊天页面
- `tinyclaw/tinyoffice/src/components/chat-view.tsx` - 聊天视图组件
- `tinyclaw/tinyoffice/src/lib/api.ts` - API 客户端
- `tinyclaw/tinyoffice/src/lib/hooks.ts` - 自定义 Hooks

#### 后端文件
- `tinyclaw/src/server/routes/chats.ts` - 聊天历史路由
- `tinyclaw/src/server/sse.ts` - SSE 事件流
- `tinyclaw/src/lib/logging.ts` - 事件日志

### 技术栈约束

**必须遵循的约束：**
1. **UI 框架：** Next.js 16 + React 19
2. **样式：** Tailwind CSS 4
3. **组件库：** Radix UI + Lucide React icons
4. **TypeScript：** 严格模式
5. **HTTP 客户端：** 原生 fetch API（已在 `src/lib/api.ts` 中封装）
6. **状态管理：** React Hooks（useState, useEffect, useRef）
7. **实时通信：** Server-Sent Events (SSE)

**禁止使用的方案：**
- ❌ 不要引入新的 UI 库（如 Ant Design、Material-UI）
- ❌ 不要使用 WebSocket（已有 SSE 基础设施）
- ❌ 不要使用全局状态管理库（除非必要）
- ❌ 不要修改现有 API 路由（除非必要）

### 代码规范

#### 组件结构
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { timeAgo } from "@/lib/hooks";
import { sendMessage, subscribeToEvents } from "@/lib/api";
// ... 其他导入

// 接口定义
interface Props {
  target: string;
  targetLabel: string;
}

export function ChatView({ target, targetLabel }: Props) {
  // 状态
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // 引用
  const feedEndRef = useRef<HTMLDivElement>(null);

  // 效应
  useEffect(() => {
    // SSE 订阅
    const unsub = subscribeToEvents(/* ... */);
    return unsub;
  }, []);

  // 回调
  const handleSend = useCallback(async () => {
    // ...
  }, [message, target]);

  // 渲染
  return (
    <div className="flex h-full flex-col">
      {/* ... */}
    </div>
  );
}
```

#### 类型定义
```typescript
interface FeedItem {
  id: string;
  type: "sent" | "event";
  timestamp: number;
  data: Record<string, unknown>;
}

interface EventData {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}
```

### 性能优化建议

1. **防抖/节流：**
   - 输入框变化使用防抖（如果需要实时预览）
   - 窗口大小变化使用节流

2. **懒加载：**
   - 大量历史消息使用虚拟滚动
   - 图片/附件使用懒加载

3. **记忆化：**
   - 使用 `useMemo` 缓存计算结果
   - 使用 `useCallback` 缓存函数引用

4. **批量更新：**
   - 使用函数式更新（`setState(prev => ...)`）
   - 避免在循环中多次调用 `setState`

### 测试建议

#### 单元测试
- 测试 `timeAgo` 工具函数
- 测试消息去重逻辑
- 测试输入历史管理

#### 集成测试
- 测试 SSE 连接和事件接收
- 测试消息发送和响应接收
- 测试错误处理流程

#### E2E 测试
- 测试完整聊天流程
- 测试连接断开和重连
- 测试不同屏幕尺寸下的布局

---

## 📚 参考文档

### 项目文档
- [TinyClaw 架构指南](/docs/architecture-tinyclaw.md) - 完整架构说明
- [TinyClaw 开发指南](/docs/development-guide-tinyclaw.md) - 开发流程和配置
- [Epic 2a: TinyOffice 前端完善](/_bmad-output/planning-artifacts/epics.md#epic-2a-tinyoffice-前端完善) - 整体规划

### 技术文档
- [Next.js 16 文档](https://nextjs.org/docs)
- [React 19 文档](https://react.dev)
- [Tailwind CSS 4 文档](https://tailwindcss.com/docs)
- [Radix UI 组件](https://www.radix-ui.com/docs)
- [Server-Sent Events (SSE) MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

### 相关代码文件
- [`tinyclaw/tinyoffice/src/components/chat-view.tsx`](/tinyclaw/tinyoffice/src/components/chat-view.tsx) - 当前聊天组件实现
- [`tinyclaw/tinyoffice/src/lib/api.ts`](/tinyclaw/tinyoffice/src/lib/api.ts) - API 客户端
- [`tinyclaw/src/server/sse.ts`](/tinyclaw/src/server/sse.ts) - SSE 服务器实现
- [`tinyclaw/src/server/routes/chats.ts`](/tinyclaw/src/server/routes/chats.ts) - 聊天路由

---

## 🔍 技术细节

### SSE 事件类型

系统支持以下 SSE 事件类型：

| 事件类型 | 描述 | 数据字段 |
|---------|------|---------|
| `message_received` | 消息从渠道接收 | `channel`, `sender`, `message` |
| `agent_routed` | 消息路由到 Agent | `agentId`, `target` |
| `response_ready` | Agent 响应生成 | `responseText`, `agentId` |
| `chain_step_start` | 链式步骤开始 | `step`, `agentId` |
| `chain_handoff` | 链式步骤交接 | `fromAgent`, `toAgent` |
| `team_chain_start` | 团队链开始 | `teamId`, `leaderAgent` |
| `team_chain_end` | 团队链结束 | `teamId`, `completed` |
| `processor_start` | 处理器启动 | `processorId` |
| `message_enqueued` | 消息入队 | `messageId`, `queueSize` |
| `error` | 错误发生 | `message`, `stack` |

### 消息数据结构

```typescript
// 用户发送的消息
{
  id: string;
  type: "sent";
  timestamp: number;
  data: {
    message: string;
    messageId: string;
    target?: string; // @agent_id 或 @team_name
  };
}

// 事件消息（Agent 响应、系统事件）
{
  id: string;
  type: "event";
  timestamp: number;
  data: {
    type: string; // 事件类型
    responseText?: string; // Agent 响应文本
    message?: string; // 原始消息
    agentId?: string; // Agent ID
    channel?: string; // 渠道
    sender?: string; // 发送者
    // ... 其他事件特定字段
  };
}
```

### 响应式设计断点

```tailwind
// Tailwind CSS 4 默认断点
sm: 640px   // 小屏幕（手机横屏）
md: 768px   // 中等屏幕（平板）
lg: 1024px  // 大屏幕（笔记本）
xl: 1280px  // 超大屏幕（桌面）
2xl: 1536px // 2K 显示器
```

建议的响应式策略：
- `< 640px`: 简化状态栏，隐藏次要信息
- `640px - 1024px`: 标准移动/平板布局
- `> 1024px`: 完整桌面布局

---

## 💡 实施提示

### 1. 优先级建议
按照以下顺序实施以降低风险：
1. **第一优先级：** 消息历史加载、输入框优化、基本错误处理
2. **第二优先级：** 状态栏优化、连接状态监控
3. **第三优先级：** 响应式设计、可访问性改进
4. **可选：** 字符计数、输入历史、虚拟滚动

### 2. 常见陷阱
- ❌ **忘记清理 SSE 连接：** 必须在组件卸载时调用 `unsub()`
- ❌ **无限滚动循环：** 使用 `useEffect` 依赖数组避免重复订阅
- ❌ **状态更新竞态：** 使用函数式更新避免闭包陷阱
- ❌ **内存泄漏：** 定期清理去重集合和历史记录

### 3. 调试技巧
- 使用浏览器开发者工具的 Network 面板查看 SSE 连接
- 在控制台打印关键状态变化
- 使用 React DevTools 检查组件渲染
- 使用 `console.time()` 测量性能

### 4. 代码复用
- 已有的 `timeAgo` 函数可以在多个地方使用
- `Badge`, `Button`, `Textarea` 等组件已定义，直接使用
- `subscribeToEvents` 已封装，直接调用

---

## 🎨 设计参考

### 当前界面布局
```
┌─────────────────────────────────────────┐
│ Header: Agent Info + Connection Status  │
├─────────────────────────────────────────┤
│                                         │
│  Message Feed (scrollable)              │
│  - Sent messages (blue icon)            │
│  - Agent responses (green icon)         │
│  - System events (gray icon)            │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ Status Bar (optional, max 6 events)     │
│ ● chain_step_start @agent1 2m ago       │
├─────────────────────────────────────────┤
│ Composer:                               │
│ ┌─────────────────────┐  ┌─────┐       │
│ │ Type your message   │  │Send │       │
│ │ Ctrl+Enter to send  │  └─────┘       │
│ └─────────────────────┘                 │
│ Hint: Ctrl+Enter to send                │
└─────────────────────────────────────────┘
```

### 颜色方案（使用现有 Tailwind 配色）
- **Primary:** `text-primary`, `bg-primary`
- **Success:** `text-emerald-500`, `bg-emerald-500/10`
- **Warning:** `text-yellow-500`, `bg-yellow-500/10`
- **Error:** `text-destructive`, `bg-destructive/10`
- **Info:** `text-blue-500`, `bg-blue-500/10`
- **Muted:** `text-muted-foreground`, `bg-muted`

---

## ✅ 完成检查清单

在标记故事为完成之前，请确保：

- [ ] 所有验收标准已实现并通过测试
- [ ] 代码符合项目代码规范
- [ ] 添加了必要的类型定义
- [ ] 代码已通过 ESLint 检查
- [ ] 在不同浏览器和设备上测试通过
- [ ] 性能指标达标（加载时间 < 2 秒，无明显卡顿）
- [ ] 可访问性检查通过
- [ ] 更新了相关文档（如需要）
- [ ] 代码已提交到 git 并推送到远程仓库

---

## 📝 备注

- 本故事专注于**聊天界面优化**，不包括后端 API 修改
- 如果需要新的 API 端点，请在实施前与后端开发人员协调
- 保持与现有设计系统的一致性（颜色、间距、字体）
- 优先考虑用户体验和性能，而不是花哨的动画效果
- 所有改动必须向后兼容，不能破坏现有功能

---

**故事文件版本：** 1.0
**最后更新：** 2026-03-04
**创建者：** BMAD Create-Story Workflow
