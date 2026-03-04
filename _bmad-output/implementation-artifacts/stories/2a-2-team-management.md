# Story 2a.2: Team管理页面 (团队配置、成员管理)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 系统管理员,
I want 创建和管理团队，配置团队成员和权限，
so that 多个AI智能体能够以团队形式协作完成复杂任务。

## Acceptance Criteria

1. 团队列表页面显示所有现有团队的基本信息（名称、负责人、成员数量、描述）
2. 创建新团队表单包含：团队名称、负责人智能体、团队成员选择、描述字段
3. 编辑团队功能允许修改团队配置和成员
4. 删除团队功能，删除前需确认
5. 团队详情页面展示完整的团队信息和成员列表
6. 实时验证：创建/编辑团队时验证负责人是否已选择、成员列表是否非空
7. 前端表单验证和错误提示
8. 成功操作后显示通知反馈
9. 支持取消操作返回列表页
10. 页面加载时显示加载状态

## Tasks / Subtasks

### 前端开发 (TinyOffice)

- [ ] 任务 1: 团队列表页面 (AC: #1, #5, #9, #10)
  - [ ] 创建 `app/teams/page.tsx` 团队列表页面
  - [ ] 实现团队列表数据获取（调用 `/api/teams` API）
  - [ ] 使用 Radix UI Table 组件展示团队列表
  - [ ] 添加加载状态和空状态处理
  - [ ] 实现团队卡片视图（名称、负责人、成员数、描述）
  - [ ] 添加创建团队按钮跳转到表单页
  - [ ] 添加查看详情按钮跳转到详情页
  - [ ] 添加编辑按钮跳转到编辑页
  - [ ] 添加删除按钮（带确认对话框）
  - [ ] 实现 SSE 事件监听以获取实时更新

- [ ] 任务 2: 创建团队表单 (AC: #2, #6, #7, #8, #9)
  - [ ] 创建 `app/teams/new/page.tsx` 创建团队页面
  - [ ] 使用 React Hook Form 管理表单状态
  - [ ] 实现团队名称输入字段（必填）
  - [ ] 实现负责人智能体选择下拉框（必填，从 `/api/agents` 获取）
  - [ ] 实现团队成员多选组件（必选至少1人，从 `/api/agents` 获取）
  - [ ] 实现描述文本区域
  - [ ] 添加表单验证规则（Zod schema）
  - [ ] 实现提交按钮和加载状态
  - [ ] 实现取消按钮返回列表页
  - [ ] 添加错误提示和成功通知
  - [ ] 调用 `POST /api/teams` API 创建团队

- [ ] 任务 3: 编辑团队表单 (AC: #3, #6, #7, #8, #9)
  - [ ] 创建 `app/teams/[id]/edit/page.tsx` 编辑团队页面
  - [ ] 加载现有团队数据（调用 `GET /api/teams/:id`）
  - [ ] 预填充表单字段
  - [ ] 实现与创建表单相同的字段和验证
  - [ ] 调用 `PUT /api/teams/:id` API 更新团队
  - [ ] 实现取消按钮返回详情页或列表页

- [ ] 任务 4: 团队详情页面 (AC: #5, #9, #10)
  - [ ] 创建 `app/teams/[id]/page.tsx` 团队详情页面
  - [ ] 显示团队完整信息（名称、描述）
  - [ ] 显示负责人智能体信息（头像、名称、状态）
  - [ ] 显示团队成员列表（每个成员的详细信息）
  - [ ] 显示团队创建时间、更新时间
  - [ ] 添加编辑和删除操作按钮
  - [ ] 添加返回列表按钮

- [ ] 任务 5: 组件和样式 (AC: #1, #2, #3, #4, #5)
  - [ ] 创建 `app/teams/components/TeamCard.tsx` 团队卡片组件
  - [ ] 创建 `app/teams/components/TeamForm.tsx` 团队表单组件（可复用于创建和编辑）
  - [ ] 创建 `app/teams/components/MemberSelector.tsx` 成员选择器组件
  - [ ] 使用 Tailwind CSS 4 样式美化页面
  - [ ] 使用 Radix UI 组件（Dialog, Select, Checkbox, Input, Textarea, Button, Table, Card）
  - [ ] 实现响应式设计（移动端适配）
  - [ ] 添加团队相关图标（使用 Radix Icons）

- [ ] 任务 6: 状态管理和工具 (AC: #1, #5, #10)
  - [ ] 创建 `app/teams/lib/api.ts` 团队 API 客户端
    - [ ] 实现 `getTeams()` - 获取团队列表
    - [ ] 实现 `getTeam(id)` - 获取团队详情
    - [ ] 实现 `createTeam(data)` - 创建团队
    - [ ] 实现 `updateTeam(id, data)` - 更新团队
    - [ ] 实现 `deleteTeam(id)` - 删除团队
  - [ ] 创建 `app/teams/lib/hooks.ts` 自定义 React Hooks
    - [ ] 实现 `useTeams()` - 获取团队列表并订阅 SSE
    - [ ] 实现 `useTeam(id)` - 获取单个团队详情
    - [ ] 实现 `useCreateTeam()` - 创建团队的 mutation hook
    - [ ] 实现 `useUpdateTeam(id)` - 更新团队的 mutation hook
    - [ ] 实现 `useDeleteTeam(id)` - 删除团队的 mutation hook
  - [ ] 创建 `app/teams/lib/types.ts` TypeScript 类型定义
    - [ ] 定义 `Team` 接口
    - [ ] 定义 `CreateTeamData` 和 `UpdateTeamData` 接口
    - [ ] 定义 `TeamFormValues` Zod schema

- [ ] 任务 7: 通知和反馈 (AC: #8)
  - [ ] 集成通知系统（使用 Radix Toast）
  - [ ] 创建成功通知组件
  - [ ] 创建错误通知组件
  - [ ] 在创建/更新/删除操作后显示相应通知
  - [ ] 实现操作取消确认对话框

### 后端开发 (TinyClaw API)

- [ ] 任务 8: 团队 API 端点 (AC: #1, #2, #3, #4, #5)
  - [ ] 在 `src/server/routes/teams.ts` 实现团队 CRUD API
    - [ ] `GET /api/teams` - 获取团队列表
      - 查询 teams 表
      - 关联查询 agent_state 表获取负责人和成员详细信息
      - 返回团队列表（包含成员信息）
    - [ ] `GET /api/teams/:id` - 获取团队详情
      - 根据 team_id 查询 teams 表
      - 关联查询 agent_state 表获取负责人和所有成员详细信息
      - 返回团队详情对象
    - [ ] `POST /api/teams` - 创建团队
      - 验证请求体（名称、负责人、成员列表、描述）
      - 验证负责人和成员是否存在于 agent_state 表
      - 插入 teams 表
      - 返回创建的团队对象
      - 触发 SSE 事件 `team_created`
    - [ ] `PUT /api/teams/:id` - 更新团队
      - 验证团队是否存在
      - 验证请求体（可选字段：名称、负责人、成员列表、描述）
      - 更新 teams 表
      - 返回更新后的团队对象
      - 触发 SSE 事件 `team_updated`
    - [ ] `DELETE /api/teams/:id` - 删除团队
      - 验证团队是否存在
      - 删除 teams 表记录
      - 返回删除成功消息
      - 触发 SSE 事件 `team_deleted`
  - [ ] 添加输入验证中间件
  - [ ] 添加错误处理中间件
  - [ ] 添加 SSE 事件发射逻辑

- [ ] 任务 9: 数据库操作 (AC: #1, #2, #3, #4, #5)
  - [ ] 在 `src/lib/db.ts` 添加团队相关数据库函数
    - [ ] 实现 `getTeams()` - 查询所有团队（包含成员信息）
    - [ ] 实现 `getTeamById(teamId)` - 根据 ID 查询团队
    - [ ] 实现 `createTeam(teamData)` - 创建团队
    - [ ] 实现 `updateTeam(teamId, teamData)` - 更新团队
    - [ ] 实现 `deleteTeam(teamId)` - 删除团队
    - [ ] 实现 `getAgentsForTeam(teamId)` - 获取团队所有成员（包含负责人）
    - [ ] 使用 JOIN 查询关联 agent_state 表
    - [ ] 使用 JSON 函数处理 agents 数组字段
  - [ ] 确保数据库表结构正确（teams 表已存在）

### 集成和测试

- [ ] 任务 10: 端到端测试
  - [ ] 测试团队列表页面加载
  - [ ] 测试创建团队流程（表单填写、提交、验证）
  - [ ] 测试编辑团队流程
  - [ ] 测试删除团队流程（带确认）
  - [ ] 测试团队详情页面
  - [ ] 测试表单验证（必填字段、错误提示）
  - [ ] 测试错误处理（网络错误、服务器错误）
  - [ ] 测试 SSE 实时更新
  - [ ] 测试移动端响应式布局

## Dev Notes

### 技术栈和依赖

**前端 (TinyOffice):**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI 组件库
- React Hook Form (表单管理)
- Zod (表单验证)
- zustand (状态管理，可选)
- Radix Toast (通知)

**后端 (TinyClaw):**
- Hono (Web 框架)
- TypeScript (CommonJS 模块)
- better-sqlite3 (数据库)
- npm (包管理器)

### 架构遵循

- 遵循 TinyClaw 架构文档中的 API 设计模式
- 使用现有的团队数据库表结构（`teams` 表）
- 使用现有的智能体数据库表（`agent_state` 表）
- 遵循现有 API 路由模式（`src/server/routes/teams.ts`）
- 使用 SSE 事件实现实时更新（参考 `src/server/sse.ts`）

### 关键设计决策

1. **表单复用**: `TeamForm` 组件同时用于创建和编辑，通过 `mode` prop 区分
2. **数据获取**: 使用自定义 hooks 管理数据获取和缓存
3. **实时更新**: 通过 SSE 监听团队变更事件，自动刷新列表
4. **成员选择**: 使用多选下拉框，支持搜索和过滤
5. **验证**: 前端使用 Zod 验证，后端重复验证确保安全

### 数据库模式

团队表 (`teams`) 已存在，包含以下字段：
- `team_id` (TEXT, PRIMARY KEY) - 团队唯一标识符
- `name` (TEXT, NOT NULL) - 团队名称
- `leader_agent` (TEXT, NOT NULL) - 负责人智能体 ID（外键到 `agent_state.agent_id`）
- `agents` (JSON, NOT NULL) - 团队成员智能体 ID 数组
- `description` (TEXT) - 团队描述
- `config` (JSON) - 团队配置（可选）
- `created_at` (INTEGER) - 创建时间戳
- `updated_at` (INTEGER) - 更新时间戳

智能体表 (`agent_state`) 用于关联查询成员详细信息。

### API 端点设计

遵循 RESTful 设计原则，与现有 API 保持一致：

```
GET    /api/teams          - 列出所有团队
GET    /api/teams/:id      - 获取团队详情
POST   /api/teams          - 创建团队
PUT    /api/teams/:id      - 更新团队
DELETE /api/teams/:id      - 删除团队
```

### 文件结构

```
tinyclaw/tinyoffice/
├── app/
│   ├── teams/
│   │   ├── page.tsx                    # 团队列表页面
│   │   ├── new/
│   │   │   └── page.tsx                # 创建团队页面
│   │   ├── [id]/
│   │   │   ├── page.tsx                # 团队详情页面
│   │   │   └── edit/
│   │   │       └── page.tsx            # 编辑团队页面
│   │   └── components/
│   │       ├── TeamCard.tsx            # 团队卡片组件
│   │       ├── TeamForm.tsx            # 团队表单组件
│   │       ├── MemberSelector.tsx      # 成员选择器组件
│   │       └── ...                     # 其他可复用组件
│   └── lib/
│       ├── types/
│       │   └── teams.ts                # 团队相关类型定义
│       └── hooks/
│           └── useTeams.ts             # 团队数据 hooks
└── src/
    └── lib/
        ├── api/
        │   └── teams.ts                # 团队 API 客户端
        └── hooks/
            └── useTeams.ts             # 团队 hooks

tinyclaw/src/
├── server/
│   └── routes/
│       └── teams.ts                    # 团队 API 路由
└── lib/
    └── db.ts                           # 数据库操作（添加团队相关函数）
```

### 前端路由结构

- `/teams` - 团队列表页面
- `/teams/new` - 创建团队页面
- `/teams/[id]` - 团队详情页面
- `/teams/[id]/edit` - 编辑团队页面

### 表单字段定义

**团队名称 (name):**
- 类型: string
- 必填: 是
- 长度: 1-100 字符
- 验证: 非空，长度限制

**负责人智能体 (leader_agent):**
- 类型: string (agent_id)
- 必填: 是
- 验证: 必须是已存在的智能体 ID

**团队成员 (agents):**
- 类型: string[] (agent_id array)
- 必填: 是（至少1个成员，包含负责人）
- 验证: 必须是已存在的智能体 ID 数组

**描述 (description):**
- 类型: string (可选)
- 长度: 0-500 字符
- 验证: 长度限制

### 错误处理

**前端错误:**
- 网络请求失败显示错误通知
- 表单验证失败显示字段错误
- 404 错误：团队不存在
- 400 错误：验证失败，显示服务器返回的错误信息
- 500 错误：服务器内部错误

**后端错误:**
- 团队不存在：404 Not Found
- 智能体不存在：400 Bad Request
- 验证失败：400 Bad Request
- 数据库错误：500 Internal Server Error
- 返回标准化错误响应格式

### 样式和 UI 规范

**颜色方案:**
- 遵循现有 TinyOffice 设计系统
- 使用 Tailwind CSS 颜色变量

**布局:**
- 使用卡片式布局展示团队信息
- 表单使用网格布局（2列）
- 响应式设计（移动端单列，桌面端多列）

**交互:**
- 按钮悬停效果
- 加载状态指示
- 成功/错误状态反馈
- 对话框动画

### 性能优化

1. **数据获取优化**
   - 使用 SWR 或 React Query 进行数据缓存（可选）
   - 实现分页加载（如果团队数量很多）
   - 使用 SSE 实现实时更新，减少轮询

2. **渲染优化**
   - 使用 React.memo 优化列表渲染
   - 虚拟滚动（如果团队列表很长）
   - 懒加载图片和头像

3. **打包优化**
   - 代码分割（按路由分割）
   - 图片优化（使用 Next.js Image 组件）

### 测试策略

**单元测试:**
- 测试表单验证逻辑
- 测试 API 客户端函数
- 测试自定义 hooks

**集成测试:**
- 测试 API 端点（使用内存 SQLite）
- 测试数据库操作

**端到端测试:**
- 测试完整用户流程（创建、编辑、删除、查看详情）
- 测试表单交互
- 测试错误处理

### 安全考虑

1. **输入验证**
   - 前端和后端双重验证
   - 防止 SQL 注入（使用预处理语句）
   - 防止 XSS（React 自动转义）

2. **访问控制**
   - 当前实现无权限控制（开放访问）
   - 未来可添加团队级别的权限控制

3. **数据验证**
   - 验证智能体 ID 是否存在
   - 验证团队成员是否为有效智能体

### 已知限制和边界情况

1. **团队数量**: 无硬性限制，但大量团队时需考虑分页
2. **成员数量**: 无硬性限制，但建议不超过 20 个成员
3. **团队名称**: 1-100 字符，支持中英文和数字
4. **描述长度**: 0-500 字符
5. **智能体依赖**: 团队依赖的智能体必须存在，删除智能体会导致团队失效

### 与现有功能集成

1. **智能体管理**: 团队成员从现有智能体列表中选择
2. **SSE 事件**: 监听 `team_created`, `team_updated`, `team_deleted` 事件
3. **日志系统**: 所有团队操作记录到日志
4. **任务系统**: 团队可被分配任务（未来扩展）

### 后续改进建议

1. 团队权限管理（RBAC）
2. 团队活动日志
3. 团队聊天历史
4. 团队统计和分析
5. 团队模板（快速创建常用团队配置）
6. 团队导出/导入功能
7. 团队成员角色定义（不仅仅是负责人）
8. 团队级别的配置覆盖

### 开发顺序建议

1. 先实现后端 API 端点（确保数据层正常工作）
2. 实现前端 API 客户端和 hooks
3. 实现团队列表页面
4. 实现创建团队表单
5. 实现团队详情页面
6. 实现编辑团队表单
7. 实现删除功能
8. 添加样式和 UI 优化
9. 添加通知和反馈
10. 添加 SSE 实时更新
11. 进行端到端测试
12. 修复发现的问题

### 参考实现

参考现有的 Agent 管理页面实现：
- `tinyclaw/tinyoffice/app/agents/page.tsx` (列表页面)
- `tinyclaw/tinyoffice/app/agents/new/page.tsx` (创建页面)
- `tinyclaw/tinyoffice/app/agents/[id]/page.tsx` (详情页面)
- `tinyclaw/tinyoffice/app/agents/[id]/edit/page.tsx` (编辑页面)

后端参考：
- `tinyclaw/src/server/routes/agents.ts` (Agent API 路由)
- `tinyclaw/src/lib/db.ts` (数据库操作)

### 项目上下文引用

- [架构文档 - TinyClaw](docs/architecture-tinyclaw.md)
- [项目上下文](docs/project-context.md)
- [项目概览](docs/project-overview.md)

### 技术文档参考

- [Radix UI Documentation](https://www.radix-ui.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Hono Framework](https://hono.dev/)

## Dev Agent Record

### Agent Model Used

Claude 4.6 Opus (claude-opus-4-6)

### Debug Log References

N/A

### Completion Notes List

1. 已更新 sprint-status.yaml，将 epic-2a 状态改为 in-progress
2. 故事基于 TinyClaw 架构文档中的团队管理需求
3. 遵循现有 TinyOffice 前端页面模式（Agent 管理页面）
4. 使用 Next.js 16 App Router 架构
5. 使用 Radix UI 和 Tailwind CSS 4 保持设计一致性
6. 后端使用 Hono 框架，遵循现有 API 路由模式
7. 数据库使用现有的 teams 表结构
8. 包含完整的 CRUD 功能和表单验证
9. 包含实时更新（SSE）支持
10. 包含详细的测试策略

### File List

**前端文件 (TinyOffice):**
- `tinyclaw/tinyoffice/app/teams/page.tsx`
- `tinyclaw/tinyoffice/app/teams/new/page.tsx`
- `tinyclaw/tinyoffice/app/teams/[id]/page.tsx`
- `tinyclaw/tinyoffice/app/teams/[id]/edit/page.tsx`
- `tinyclaw/tinyoffice/app/teams/components/TeamCard.tsx`
- `tinyclaw/tinyoffice/app/teams/components/TeamForm.tsx`
- `tinyclaw/tinyoffice/app/teams/components/MemberSelector.tsx`
- `tinyclaw/tinyoffice/src/lib/api/teams.ts`
- `tinyclaw/tinyoffice/src/lib/hooks/useTeams.ts`
- `tinyclaw/tinyoffice/src/lib/types/teams.ts`

**后端文件 (TinyClaw):**
- `tinyclaw/src/server/routes/teams.ts`
- `tinyclaw/src/lib/db.ts` (添加团队相关函数)

**测试文件:**
- `tinyclaw/tinyoffice/src/__tests__/teams/` (前端测试)
- `tinyclaw/src/__tests__/routes/teams.test.ts` (后端测试)
- `tinyclaw/src/__tests__/lib/db.teams.test.ts` (数据库测试)
