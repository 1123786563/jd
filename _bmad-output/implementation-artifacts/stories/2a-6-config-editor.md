# Story 2a.6: 配置编辑器 (可视化)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TinyClaw 管理员**,
I want **一个可视化的 Web 配置编辑器**,
so that **我可以方便地管理和修改系统配置、LLM 供应商设置、渠道配置等，而无需直接编辑 JSON 文件**.

## Acceptance Criteria

1. [AC 1] 管理员可以通过 TinyOffice Web 界面访问配置编辑页面
2. [AC 2] 配置编辑器支持编辑 `tinyclaw.settings.json` 中的所有配置项，包括：
   - 工作区设置 (workspace.path)
   - LLM 默认配置 (llm.default_provider, llm.default_model)
   - 渠道配置 (channels.discord, channels.telegram, channels.whatsapp, channels.feishu)
3. [AC 3] 配置编辑器支持编辑 `tinyclaw.agents.json` 中的智能体配置，包括：
   - 智能体基本信息 (name, provider, model)
   - 系统提示词 (system_prompt)
   - 工作目录 (working_dir)
   - 自定义配置 (config JSON)
4. [AC 4] 配置编辑器支持编辑 `tinyclaw.teams.json` 中的团队配置，包括：
   - 团队基本信息 (name, description)
   - 领导智能体 (leader_agent)
   - 团队成员列表 (agents array)
   - 团队配置 (config JSON)
5. [AC 5] 表单验证：
   - 必填字段验证
   - 数据类型验证（数字、布尔值、JSON 等）
   - 渠道令牌格式验证
6. [AC 6] 配置修改后，点击保存按钮时：
   - 显示保存成功/失败提示
   - 保存到对应的 JSON 配置文件
   - 前端立即反映配置变更
7. [AC 7] 支持配置重置功能：
   - 可以恢复到上次保存的配置
   - 可以恢复到默认配置
8. [AC 8] 配置编辑页面包含帮助文本和示例：
   - 每个配置项都有清晰的说明
   - 复杂配置提供示例值
   - 敏感字段（如令牌）使用密码输入框
9. [AC 9] 响应式设计：
   - 在桌面、平板和移动端都能正常显示
   - 复杂表单在小屏幕上可滚动查看
10. [AC 10] 配置修改后，系统自动热重载（根据现有架构，配置在每次消息处理时重新加载）

## Tasks / Subtasks

### Task 1: 配置页面路由和布局 (AC: 1, 9)
- [ ] 在 TinyOffice Next.js 应用中创建配置页面路由 (`app/settings/config-editor/page.tsx`)
- [ ] 设计页面布局：侧边导航栏 + 主配置区域
- [ ] 实现响应式布局，支持移动端适配
- [ ] 添加页面标题和导航面包屑

### Task 2: 后端 API 端点实现 (AC: 2, 3, 4)

#### 认证与权限
- [ ] 实现 JWT 认证机制 (`lib/auth/jwt.ts`)
  - [ ] 生成 JWT Token (签名、过期时间)
  - [ ] 验证 JWT Token (解码、验证签名)
  - [ ] 刷新 Token 机制
- [ ] 实现管理员权限中间件 (`middleware/admin-auth.ts`)
  - [ ] 检查 Authorization 头
  - [ ] 验证 JWT Token 有效性
  - [ ] 检查管理员角色 (role === 'admin')
  - [ ] 设置用户上下文 (c.set('user'))
- [ ] 创建登录端点 (`POST /api/auth/login`)
  - [ ] 用户名密码验证
  - [ ] 生成管理员 Token
  - [ ] 返回 Token 和用户信息

#### 配置读写与文件锁
- [ ] 创建配置读取 API (`GET /api/config/all`)
  - [ ] 合并并返回 `tinyclaw.settings.json` 内容
  - [ ] 合并并返回 `tinyclaw.agents.json` 内容
  - [ ] 合并并返回 `tinyclaw.teams.json` 内容
  - [ ] 解析环境变量 (${VAR_NAME})
- [ ] 实现文件锁机制 (`lib/file-lock.ts`)
  - [ ] 使用 proper-lockfile 库
  - [ ] 实现 lock/unlock 函数
  - [ ] 添加超时处理 (30秒)
  - [ ] 添加错误处理和日志
- [ ] 创建配置保存 API (`POST /api/config/save`)
  - [ ] 接收完整的配置对象
  - [ ] 验证配置数据格式 (Zod)
  - [ ] 获取文件锁
  - [ ] 创建备份文件 (.backup)
  - [ ] 分别写入对应的 JSON 文件
  - [ ] 释放文件锁
  - [ ] 处理文件写入错误 (回滚到备份)
  - [ ] 清空配置缓存
  - [ ] 记录审计日志
  - [ ] 返回保存结果
- [ ] 创建配置重置 API (`POST /api/config/reset`)
  - [ ] 支持重置到上次保存状态 (从 .backup 恢复)
  - [ ] 支持重置到默认配置
- [ ] 在 `src/server/routes/settings.ts` 中实现所有配置相关路由
- [ ] 在 `src/server/routes/auth.ts` 中实现认证路由

### Task 3: 工作区配置表单 (AC: 2, 5, 8)
- [ ] 创建工作区配置表单组件 (`components/config/workspace-form.tsx`)
- [ ] 实现以下字段：
  - [ ] 工作区路径输入框 (workspace.path)
  - [ ] 帮助文本说明
  - [ ] 路径格式验证
- [ ] 添加实时验证反馈
- [ ] 添加示例值提示

### Task 4: LLM 配置表单 (AC: 2, 5, 8)
- [ ] 创建 LLM 配置表单组件 (`components/config/llm-form.tsx`)
- [ ] 实现以下字段：
  - [ ] 默认供应商下拉选择 (llm.default_provider)
    - [ ] 选项：claude, openai, zhipu, qwen, moonshot, ollama, local
  - [ ] 默认模型输入框 (llm.default_model)
  - [ ] 模型层级选择 (可选)
  - [ ] 成本估算显示
- [ ] 添加供应商文档链接
- [ ] 添加模型对比说明

### Task 5: 渠道配置表单 (AC: 2, 5, 6, 8)
- [ ] 创建渠道配置表单组件 (`components/config/channels-form.tsx`)
- [ ] 实现 Discord 配置：
  - [ ] 启用/禁用开关 (channels.discord.enabled)
  - [ ] 令牌输入框 (channels.discord.token) - 密码类型
  - [ ] 验证令牌格式
- [ ] 实现 Telegram 配置：
  - [ ] 启用/禁用开关 (channels.telegram.enabled)
  - [ ] 令牌输入框 (channels.telegram.token) - 密码类型
  - [ ] 验证令牌格式
- [ ] 实现 WhatsApp 配置：
  - [ ] 启用/禁用开关 (channels.whatsapp.enabled)
  - [ ] 会话配置字段
- [ ] 实现飞书配置：
  - [ ] 启用/禁用开关 (channels.feishu.enabled)
  - [ ] App ID 和 App Secret 输入
  - [ ] 验证密钥格式
- [ ] 渠道状态实时显示（已连接/未连接）

### Task 6: 智能体配置表单 (AC: 3, 5, 8)
- [ ] 创建智能体配置表单组件 (`components/config/agents-form.tsx`)
- [ ] 实现智能体列表显示：
  - [ ] 表格展示所有智能体
  - [ ] 支持添加新智能体
  - [ ] 支持编辑现有智能体
  - [ ] 支持删除智能体
- [ ] 智能体表单字段：
  - [ ] 智能体 ID (只读，创建时设置)
  - [ ] 名称输入 (name)
  - [ ] 供应商选择 (provider)
  - [ ] 模型选择 (model)
  - [ ] 系统提示词文本区域 (system_prompt)
  - [ ] 工作目录输入 (working_dir)
  - [ ] 自定义配置 JSON 编辑器 (config)
- [ ] 实现 JSON 编辑器组件（使用 react-monaco-editor 或类似库）
- [ ] 添加智能体配置验证
- [ ] 添加默认智能体配置模板

### Task 7: 团队配置表单 (AC: 4, 5, 8)
- [ ] 创建团队配置表单组件 (`components/config/teams-form.tsx`)
- [ ] 实现团队列表显示：
  - [ ] 表格展示所有团队
  - [ ] 支持添加新团队
  - [ ] 支持编辑现有团队
  - [ ] 支持删除团队
- [ ] 团队表单字段：
  - [ ] 团队 ID (只读，创建时设置)
  - [ ] 团队名称输入 (name)
  - [ ] 描述输入 (description)
  - [ ] 领导智能体下拉选择 (leader_agent) - 从智能体列表中选择
  - [ ] 团队成员多选 (agents) - 从智能体列表中选择
  - [ ] 团队配置 JSON 编辑器 (config)
- [ ] 实现成员选择的智能体过滤
- [ ] 添加团队配置验证
- [ ] 团队成员数量限制提示

### Task 8: 表单验证和错误处理 (AC: 5, 6)

- [ ] 实现全局表单验证逻辑
- [ ] 添加必填字段验证 (Zod required)
- [ ] 添加数据类型验证：
  - [ ] 数字验证
  - [ ] 布尔值验证
  - [ ] JSON 格式验证 (AJV)
  - [ ] 令牌格式验证 (正则表达式)
  - [ ] 路径格式验证 (防止路径遍历)
- [ ] 实现环境变量解析验证
  - [ ] 检查 ${VAR_NAME} 格式
  - [ ] 验证环境变量是否存在
- [ ] 实现实时验证反馈 (React Hook Form + Zod)
- [ ] 添加错误提示组件 (Toast Notification)
  - [ ] 成功提示 (绿色)
  - [ ] 错误提示 (红色)
  - [ ] 警告提示 (黄色)
- [ ] 实现表单提交前的最终验证
- [ ] 处理 API 调用错误并显示友好的错误消息
- [ ] 配置验证失败时高亮显示错误字段
- [ ] 添加错误边界组件 (Error Boundary)

### Task 9: 保存和重置功能 (AC: 6, 7)
- [ ] 实现保存按钮逻辑：
  - [ ] 收集所有表单数据
  - [ ] 调用后端保存 API
  - [ ] 显示加载状态
  - [ ] 显示成功/失败 Toast 通知
  - [ ] 保存成功后重置表单脏状态
- [ ] 实现重置功能：
  - [ ] "重置到上次保存" 按钮
  - [ ] "恢复默认配置" 按钮
  - [ ] 重置确认对话框
- [ ] 实现表单脏状态检测：
  - [ ] 离开页面前检查是否有未保存的更改
  - [ ] 显示确认对话框

### Task 10: 帮助文档和用户体验 (AC: 8)

#### 基础功能
- [ ] 为每个配置项添加工具提示 (tooltip)
- [ ] 添加配置项说明文本
- [ ] 添加示例值和占位符
- [ ] 实现配置搜索功能（快速查找配置项）
- [ ] 添加配置导出功能（下载当前配置为 JSON）
- [ ] 添加配置导入功能（从 JSON 文件导入）
- [ ] 实现配置历史记录（最近的配置变更）
- [ ] 添加配置修改审计日志

#### 高级功能
- [ ] 实现配置缓存管理 (`lib/cache/config-cache.ts`)
  - [ ] 5秒 TTL 缓存
  - [ ] 读取时检查缓存
  - [ ] 保存后清空缓存
  - [ ] 手动刷新缓存按钮
- [ ] 添加配置预览功能
  - [ ] JSON 格式化展示
  - [ ] 差异对比 (修改前后)
- [ ] 实现自动保存功能 (30秒延迟)
- [ ] 添加配置版本对比
- [ ] 实现批量配置修改
- [ ] 添加快捷键支持 (Ctrl+S 保存)

### Task 11: 测试和验证

- [ ] 编写单元测试：
  - [ ] 表单验证逻辑测试 (>= 90%)
  - [ ] API 端点测试 (>= 85%)
  - [ ] 配置保存逻辑测试 (>= 95%)
  - [ ] 文件锁机制测试
  - [ ] 环境变量解析器测试
- [ ] 编写集成测试：
  - [ ] 完整的配置编辑流程测试
  - [ ] 配置热重载测试
  - [ ] 权限控制测试 (非管理员访问)
  - [ ] 文件并发写入测试
  - [ ] 敏感数据保护测试
- [ ] 编写 E2E 测试 (Playwright/Cypress):
  - [ ] 登录流程
  - [ ] 配置编辑和保存
  - [ ] 表单验证
  - [ ] 错误处理
- [ ] 性能测试：
  - [ ] 配置读取响应时间 (< 50ms)
  - [ ] 配置保存响应时间 (< 100ms)
  - [ ] 大配置文件性能测试
- [ ] 安全测试：
  - [ ] XSS 注入测试
  - [ ] 路径遍历测试
  - [ ] 权限绕过测试
  - [ ] 敏感数据泄露测试
- [ ] 可访问性测试 (a11y):
  - [ ] 颜色对比度测试
  - [ ] 键盘导航测试
  - [ ] 屏幕阅读器测试
- [ ] 手动测试：
  - [ ] 在不同浏览器上测试 (Chrome, Firefox, Safari, Edge)
  - [ ] 在不同设备上测试响应式布局 (桌面、平板、手机)
  - [ ] 测试所有配置项的编辑和保存
  - [ ] 测试边界条件 (空配置、大配置、格式错误)

## Dev Notes

### 技术栈要求

**前端 (TinyOffice):**
- Next.js 16 (App Router)
- React 19
- TypeScript 5.9.3
- Tailwind CSS 4
- Radix UI 组件库
- React Hook Form (表单管理)
- Zod (表单验证)
- Axios (API 调用)
- React Monaco Editor (JSON 编辑器，可选)

**后端 (TinyClaw API):**
- Hono 4.12.1
- TypeScript 5.9.3 (CommonJS 模块系统)
- better-sqlite3 12.6.2 (如果需要配置历史记录)
- Node.js >= 20.0.0

### 架构模式遵循

**根据 TinyClaw 架构文档 (docs/architecture-tinyclaw.md):**

1. **配置热重载机制**:
   - 配置文件在每次消息处理时重新加载（`getSettings()` 函数）
   - 无需重启服务即可生效
   - 参考 `src/lib/config.ts` 中的配置加载逻辑

2. **配置文件结构**:
   ```json
   // tinyclaw.settings.json
   {
     "workspace": {
       "path": "~/tinyclaw-workspace"
     },
     "llm": {
       "default_provider": "claude",
       "default_model": "claude-3-opus"
     },
     "channels": {
       "discord": { "enabled": true, "token": "..." },
       "telegram": { "enabled": true, "token": "..." },
       "whatsapp": { "enabled": true },
       "feishu": { "enabled": false }
     }
   }
   ```

   ```json
   // tinyclaw.agents.json
   {
     "default": {
       "name": "General Assistant",
       "provider": "claude",
       "model": "claude-3-opus",
       "system_prompt": "You are a helpful assistant...",
       "working_dir": "agents/default"
     }
   }
   ```

   ```json
   // tinyclaw.teams.json
   {
     "team-support": {
       "name": "Support Team",
       "leader_agent": "agent-support-lead",
       "agents": ["agent-support-lead", "agent-technical", "agent-billing"],
       "description": "Customer support team"
     }
   }
   ```

3. **API 设计模式**:
   - 遵循现有 API 路由模式 (`src/server/routes/settings.ts`)
   - 使用 Hono 路由器
   - 响应格式统一：`{ success: boolean, data?: any, error?: string }`

### 文件位置

**前端文件 (TinyOffice):**
- `tinyclaw/tinyoffice/app/settings/config-editor/page.tsx` - 配置编辑页面
- `tinyclaw/tinyoffice/components/config/` - 配置表单组件目录
  - `workspace-form.tsx`
  - `llm-form.tsx`
  - `channels-form.tsx`
  - `agents-form.tsx`
  - `teams-form.tsx`
- `tinyclaw/tinyoffice/lib/api/config.ts` - 配置 API 客户端

**后端文件 (TinyClaw):**
- `tinyclaw/src/server/routes/settings.ts` - 配置相关 API 路由
- `tinyclaw/src/lib/config-editor.ts` - 配置编辑业务逻辑
- `tinyclaw/src/lib/config.ts` - 现有配置加载逻辑（需要扩展）

### 关键实现要点 (优化版)

1. **配置文件读写与文件锁**:
   - 使用 `fs/promises` 异步读写 JSON 文件
   - **使用 proper-lockfile 库实现文件锁**，防止并发写入冲突
   ```typescript
   import lockfile from 'proper-lockfile';
   import fs from 'fs/promises';

   async function saveConfig(config: any, filePath: string) {
     // 获取文件锁
     await lockfile.lock(filePath);
     try {
       // 写入文件前创建备份
       const backupPath = `${filePath}.backup`;
       if (await fileExists(filePath)) {
         await fs.copyFile(filePath, backupPath);
       }
       // 写入新配置
       await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
     } finally {
       // 释放文件锁
       await lockfile.unlock(filePath);
     }
   }
   ```
   - 配置文件备份（保存前创建 `.backup` 文件）
   - 添加文件操作错误处理和回滚机制

2. **权限控制与认证**:
   - **实现基于 JWT 的认证机制**
   ```typescript
   // 后端中间件: admin-auth-middleware.ts
   import { Context, Next } from 'hono';
   import jwt from 'jsonwebtoken';

   export async function adminAuthMiddleware(c: Context, next: Next) {
     const authHeader = c.req.header('Authorization');

     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return c.json({ success: false, error: 'Unauthorized' }, 401);
     }

     const token = authHeader.substring(7);
     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

       // 检查管理员权限
       if (decoded.role !== 'admin') {
         return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
       }

       // 设置用户上下文
       c.set('user', decoded);
       await next();
     } catch (error) {
       return c.json({ success: false, error: 'Invalid token' }, 401);
     }
   }
   ```
   - 所有配置相关 API 都需要通过权限验证中间件
   - 管理员角色检查 (role === 'admin')
   - Token 过期时间设置 (建议 1 小时)

2. **表单状态管理**:
   - 使用 React Hook Form 管理复杂表单
   - 使用 Zod 定义配置数据的类型和验证规则
   - 实现表单脏状态检测（useForm 的 dirtyFields）

3. **JSON 编辑器**:
   - 对于复杂的 config 字段，使用代码编辑器组件
   - 实时语法高亮和错误提示
   - 支持折叠/展开

4. **敏感数据处理与安全存储**:
   - **令牌字段使用密码输入框**，前端不存储敏感数据
   - **推荐使用环境变量存储敏感数据**:
   ```json
   // tinyclaw.settings.json
   {
     "channels": {
       "discord": {
         "enabled": true,
         "token": "${DISCORD_TOKEN}"  // 从环境变量读取
       },
       "telegram": {
         "enabled": true,
         "token": "${TELEGRAM_TOKEN}"
       }
     }
   }
   ```
   - 实现环境变量解析器:
   ```typescript
   function resolveEnvVars(config: any): any {
     const envPattern = /\${(\w+)}/g;
     return JSON.parse(JSON.stringify(config), (key, value) => {
       if (typeof value === 'string') {
         return value.replace(envPattern, (match, envVar) => {
           return process.env[envVar] || match;
         });
       }
       return value;
     });
   }
   ```
   - **传输过程中使用 HTTPS** (生产环境强制)
   - 敏感字段不在日志中显示
   - 表单提交前加密敏感数据 (可选)

5. **配置缓存与性能优化**:
   - 实现配置缓存机制，减少文件 I/O:
   ```typescript
   class ConfigCache {
     private cache = new Map<string, any>();
     private ttl = 5000; // 5秒缓存

     async getConfig<T>(key: string, loader: () => Promise<T>): Promise<T> {
       const cached = this.cache.get(key);
       if (cached && Date.now() - cached.timestamp < this.ttl) {
         return cached.value;
       }

       const value = await loader();
       this.cache.set(key, { value, timestamp: Date.now() });
       return value;
     }

     invalidate(key: string) {
       this.cache.delete(key);
     }

     invalidateAll() {
       this.cache.clear();
     }
   }

   // 使用示例
   const configCache = new ConfigCache();
   const settings = await configCache.getConfig('settings', loadSettings);
   ```
   - 配置保存后立即清空缓存，确保下次读取最新配置
   - 使用内存缓存，避免频繁读取文件

6. **表单状态管理**:
   - 使用 React Hook Form 管理复杂表单
   - 使用 Zod 定义配置数据的类型和验证规则
   - 实现表单脏状态检测（useForm 的 dirtyFields）
   - 使用 TanStack Query (React Query) 管理服务器状态

7. **JSON 编辑器**:
   - 对于复杂的 config 字段，使用 react-monaco-editor 或 codemirror
   - 实时语法高亮和错误提示
   - 支持折叠/展开、自动补全
   - 使用 AJV 进行 JSON Schema 验证

8. **错误处理与用户反馈**:
   - 友好的用户错误提示 (Toast Notification)
   - 详细的开发错误日志 (console.error + structured logging)
   - 配置验证失败时高亮显示错误字段
   - 使用 React Context 或 Zustand 管理全局错误状态

9. **可访问性 (a11y)**:
   - 遵循 WCAG 2.1 AA 标准
   - 使用语义化 HTML 标签
   - 添加 ARIA 属性 (aria-label, aria-required)
   - 确保颜色对比度 (至少 4.5:1)
   - 支持键盘导航 (Tab, Enter, Escape)
   - 屏幕阅读器测试

   ```tsx
   // 可访问的表单字段示例
   <label htmlFor="workspace-path" className="sr-only">
     工作区路径
   </label>
   <input
     id="workspace-path"
     type="text"
     aria-label="工作区路径"
     aria-required="true"
     aria-invalid={errors.workspacePath ? "true" : "false"}
   />
   ```

### 与现有代码集成

1. **配置加载逻辑**:
   - 参考 `tinyclaw/src/lib/config.ts` 中的 `getSettings()`, `getAgents()`, `getTeams()` 函数
   - 确保新的配置编辑器与现有配置加载逻辑兼容

2. **热重载机制**:
   - 配置保存后，下一次消息处理时自动加载新配置
   - 无需手动重启服务

3. **配置验证**:
   - 在保存前验证配置格式
   - 防止无效配置导致系统崩溃

### 测试标准

**单元测试覆盖率**:
- 表单验证逻辑: >= 90%
- API 端点: >= 85%
- 配置保存逻辑: >= 95%

**集成测试**:
- 完整的配置编辑流程
- 配置热重载验证
- 错误处理场景

**手动测试清单**:
- [ ] 所有配置项可以正常编辑
- [ ] 表单验证生效
- [ ] 保存功能正常
- [ ] 重置功能正常
- [ ] 配置修改后系统正常运行
- [ ] 响应式布局在不同设备上正常显示

### 性能考虑

1. **配置文件大小**:
   - 预期配置文件较小 (< 100KB)
   - 无需特殊优化

2. **表单渲染性能**:
   - 使用 React.memo 优化大型表单
   - 懒加载不常用的配置部分

3. **API 响应时间**:
   - 配置读取: < 50ms
   - 配置保存: < 100ms

### 安全考虑 (优化版)

1. **权限控制**:
   - 配置编辑功能需要管理员权限 (role === 'admin')
   - 在 API 层面使用 JWT 认证和角色检查中间件
   - 所有配置相关 API 都需要权限验证
   - Token 设置合理的过期时间 (1小时)
   - 实现登录页面和 Token 刷新机制

2. **输入验证**:
   - 所有配置输入都经过严格的格式验证 (Zod)
   - 防止注入攻击 (XSS、SQL injection)
   - 渠道令牌格式验证 (正则表达式)
   - 使用 escape-html 转义用户输入

3. **文件操作安全**:
   - 限制配置文件写入路径 (只允许特定目录)
   - 防止路径遍历攻击 (检查路径是否包含 '../')
   - 文件操作添加 try-catch 错误处理
   - 备份文件保留策略 (保留最近 3 个备份)
   - 实现文件锁机制 (proper-lockfile)

4. **敏感数据保护**:
   - 令牌等敏感数据不在日志中显示
   - 前端不缓存敏感数据 (使用 React state 临时存储)
   - 使用 HTTPS 加密传输 (生产环境强制)
   - **推荐使用环境变量存储敏感数据**
   - 实现环境变量解析器

5. **CSRF 保护**:
   - 使用 SameSite cookie 属性
   - 添加 CSRF token 验证 (可选)
   - CORS 配置只允许受信任的源

6. **审计日志**:
   - 记录所有配置变更操作
   - 记录用户、时间、变更内容
   - 记录敏感操作 (配置删除、重置)
   - 日志保留策略 (保留 30 天)

7. **会话管理**:
   - 实现会话超时自动登出
   - 支持手动登出
   - 登出时清除所有敏感数据

### 参考文档

- [Source: docs/architecture-tinyclaw.md#Configuration System] - 配置系统架构
- [Source: docs/component-inventory-automaton.md#Configuration Manager] - 配置管理器组件
- [Source: docs/project-context.md#Framework Specific Rules] - Hono 框架规则
- [Source: docs/project-context.md#Testing Rules] - 测试标准和覆盖率要求
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2a] - Epic 2a 完整需求

### 与现有功能的差异

**Automaton 的配置编辑器 (src/setup/configure.ts):**
- Automaton 使用 CLI 交互式配置
- 基于命令行提示
- 适合初次设置和简单修改

**TinyClaw 的配置编辑器 (本故事):**
- Web 可视化界面
- 支持实时编辑和保存
- 适合日常管理和复杂配置
- 与 TinyOffice 控制面板集成

### 未来扩展考虑

1. **配置版本控制**:
   - 保存配置历史
   - 支持配置版本对比
   - 支持回滚到历史版本

2. **配置模板**:
   - 提供预定义的配置模板
   - 支持导入/导出配置模板

3. **配置同步**:
   - 支持多实例配置同步
   - 云端配置备份

4. **配置审计**:
   - 记录所有配置变更
   - 显示变更历史和变更人

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A (Story creation phase)

### Completion Notes List

- 配置编辑器需要支持三个主要配置文件：settings, agents, teams
- 表单验证是关键，需要防止无效配置
- 与现有配置加载逻辑集成，确保热重载正常工作
- 敏感数据（如令牌）需要特殊处理
- 响应式设计确保在不同设备上都能正常使用
- 需要完善的错误处理和用户反馈机制

### File List

**前端文件:**
- `tinyclaw/tinyoffice/app/settings/config-editor/page.tsx`
- `tinyclaw/tinyoffice/components/config/workspace-form.tsx`
- `tinyclaw/tinyoffice/components/config/llm-form.tsx`
- `tinyclaw/tinyoffice/components/config/channels-form.tsx`
- `tinyclaw/tinyoffice/components/config/agents-form.tsx`
- `tinyclaw/tinyoffice/components/config/teams-form.tsx`
- `tinyclaw/tinyoffice/components/config/config-editor.tsx` (主编辑器组件)
- `tinyclaw/tinyoffice/lib/api/config.ts`
- `tinyclaw/tinyoffice/lib/validation/config-schema.ts` (Zod 验证模式)

**后端文件:**
- `tinyclaw/src/server/routes/settings.ts` (扩展)
- `tinyclaw/src/server/routes/auth.ts` (新增)
- `tinyclaw/src/lib/config-editor.ts` (新增)
- `tinyclaw/src/lib/config.ts` (可能需要扩展)
- `tinyclaw/src/middleware/admin-auth.ts` (新增)
- `tinyclaw/src/lib/auth/jwt.ts` (新增)
- `tinyclaw/src/lib/file-lock.ts` (新增)
- `tinyclaw/src/lib/env-parser.ts` (新增)
- `tinyclaw/src/lib/cache/config-cache.ts` (新增)
- `tinyclaw/src/lib/audit/config-audit.ts` (新增)

**前端页面:**
- `tinyclaw/tinyoffice/app/login/page.tsx` (新增)

**测试文件:**
- `tinyclaw/tinyoffice/src/__tests__/config-editor.test.tsx`
- `tinyclaw/tinyoffice/src/__tests__/login.test.tsx`
- `tinyclaw/src/__tests__/config-editor-api.test.ts`
- `tinyclaw/src/__tests__/config-validation.test.ts`
- `tinyclaw/src/__tests__/file-lock.test.ts`
- `tinyclaw/src/__tests__/env-parser.test.ts`
- `tinyclaw/src/__tests__/e2e/config-editor.spec.ts` (Playwright/Cypress)

---

**Story 优化完成日期**: 2026-03-04
**审核状态**: ✅ 已通过派对模式审核 (7位专家)
**优化内容**:
- ✅ 权限控制与 JWT 认证
- ✅ 文件锁机制 (proper-lockfile)
- ✅ 敏感数据处理 (环境变量存储)
- ✅ 配置缓存与性能优化
- ✅ 可访问性 (WCAG 2.1 AA)
- ✅ 审计日志与安全增强
- ✅ 完整的测试策略
**状态**: ready-for-dev
**优先级**: ⭐⭐⭐⭐ (Phase 2 - TinyClaw 功能增强)

### Task 11: 权限认证与登录页面

- [ ] 实现 JWT 认证系统
  - [ ] 生成 JWT Token (签名、过期时间 1 小时)
  - [ ] 验证 JWT Token (解码、验证签名)
  - [ ] 刷新 Token 机制
- [ ] 创建登录页面 (`app/login/page.tsx`)
  - [ ] 用户名密码输入
  - [ ] 登录按钮
  - [ ] 错误提示
  - [ ] 密码可见切换
- [ ] 实现登录端点 (`POST /api/auth/login`)
  - [ ] 用户名密码验证
  - [ ] 生成管理员 Token
  - [ ] 返回 Token 和用户信息
- [ ] 实现登出功能
  - [ ] 清除 Token
  - [ ] 清除敏感数据
  - [ ] 返回登录页面
- [ ] 实现会话管理
  - [ ] 会话超时自动登出 (30分钟)
  - [ ] 活动检测
  - [ ] 手动登出

### Task 12: 敏感数据处理与环境变量支持

- [ ] 实现环境变量存储方案
  - [ ] 配置文件支持 ${VAR_NAME} 语法
  - [ ] 实现环境变量解析器 (`lib/env-parser.ts`)
  - [ ] 敏感字段自动识别和替换
- [ ] 实现敏感数据保护
  - [ ] 令牌字段使用密码输入框
  - [ ] 表单提交前数据脱敏
  - [ ] 响应数据中敏感字段隐藏 (后端过滤)
- [ ] 实现安全传输
  - [ ] 强制 HTTPS (生产环境)
  - [ ] HTTP 到 HTTPS 自动重定向
- [ ] 添加敏感数据审计日志
  - [ ] 记录所有敏感数据访问
  - [ ] 敏感操作告警
  - [ ] 日志保留策略 (30天)

### Task 13: 性能优化与可访问性增强

#### 性能优化
- [ ] 实现配置缓存机制 (`lib/cache/config-cache.ts`)
  - [ ] 5秒 TTL 缓存
  - [ ] 读取缓存优先
  - [ ] 保存后清空缓存
- [ ] 优化表单渲染性能
  - [ ] 使用 React.memo 优化大型表单
  - [ ] 懒加载不常用的配置部分
  - [ ] 虚拟滚动大型列表 (智能体/团队列表)
- [ ] 优化 API 响应时间
  - [ ] 配置读取: < 50ms
  - [ ] 配置保存: < 100ms
- [ ] 添加性能监控
  - [ ] 记录关键操作耗时
  - [ ] 性能瓶颈分析

#### 可访问性 (a11y)
- [ ] 遵循 WCAG 2.1 AA 标准
- [ ] 使用语义化 HTML 标签
- [ ] 添加 ARIA 属性 (aria-label, aria-required, aria-invalid)
- [ ] 确保颜色对比度 (至少 4.5:1)
- [ ] 支持键盘导航 (Tab, Enter, Escape)
- [ ] 屏幕阅读器测试 (VoiceOver, NVDA)
- [ ] 添加错误边界组件 (Error Boundary)
- [ ] 实现焦点管理
- [ ] 添加跳过链接 (Skip to content)

### Task 14: 测试和验证

- [ ] 编写单元测试：
  - [ ] 表单验证逻辑测试 (>= 90%)
  - [ ] API 端点测试 (>= 85%)
  - [ ] 配置保存逻辑测试 (>= 95%)
  - [ ] 文件锁机制测试
  - [ ] 环境变量解析器测试
- [ ] 编写集成测试：
  - [ ] 完整的配置编辑流程测试
  - [ ] 配置热重载测试
  - [ ] 权限控制测试 (非管理员访问)
  - [ ] 文件并发写入测试
  - [ ] 敏感数据保护测试
- [ ] 编写 E2E 测试 (Playwright/Cypress):
  - [ ] 登录流程
  - [ ] 配置编辑和保存
  - [ ] 表单验证
  - [ ] 错误处理
- [ ] 性能测试：
  - [ ] 配置读取响应时间 (< 50ms)
  - [ ] 配置保存响应时间 (< 100ms)
  - [ ] 大配置文件性能测试
- [ ] 安全测试：
  - [ ] XSS 注入测试
  - [ ] 路径遍历测试
  - [ ] 权限绕过测试
  - [ ] 敏感数据泄露测试
- [ ] 可访问性测试 (a11y):
  - [ ] 颜色对比度测试
  - [ ] 键盘导航测试
  - [ ] 屏幕阅读器测试
- [ ] 手动测试：
  - [ ] 在不同浏览器上测试 (Chrome, Firefox, Safari, Edge)
  - [ ] 在不同设备上测试响应式布局 (桌面、平板、手机)
  - [ ] 测试所有配置项的编辑和保存
  - [ ] 测试边界条件 (空配置、大配置、格式错误)

## Dev Notes
