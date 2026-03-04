# 故事 2a.5: 日志查看器和搜索

状态: ready-for-dev

<!-- 注意：验证是可选的。在 dev-story 之前运行 validate-create-story 进行质量检查。 -->

## 故事背景

作为系统管理员和开发者，
我想要一个功能完善的日志查看和搜索界面，
以便快速定位系统问题、监控智能体活动、分析系统性能。

## 需求来源

- 用户需要在 TinyOffice 前端实时查看系统活动日志
- 支持按日志级别、时间范围、智能体、关键词等维度进行筛选
- 需要查看详细的日志上下文和错误堆栈
- 需要导出日志用于进一步分析

## 接受标准

1. **日志列表展示** - 从 `logs/tinyclaw.log` 文件读取并解析日志条目
2. **多维度筛选** - 支持按以下条件组合筛选：
   - 日志级别 (INFO, WARN, ERROR)
   - 时间范围 (开始时间、结束时间)
   - 关键词搜索 (消息内容)
   - *(注意: 智能体/团队筛选通过 context 关键词实现)*
3. **分页支持** - 支持分页加载日志，每页 20-50 条 (使用 OFFSET 分页)
4. **实时更新** - 通过 SSE 接收新日志并自动刷新列表 (带防抖和去重)
5. **日志详情** - 点击日志条目显示完整信息：
   - 完整消息内容
   - 时间戳 (格式化显示)
   - 日志级别徽章
   - 错误堆栈 (如果有，支持折叠/展开)
6. **日志导出** - 支持将筛选后的日志导出为 CSV 或 JSON 格式 (最多 10,000 条)
7. **性能优化** - 大数据量下的流畅体验 (虚拟滚动、防抖搜索)
8. **安全性** - 导出功能限制最大 10,000 条记录，防止内存溢出

## 任务/子任务

### 后端任务 (Node.js + Hono + File System)

- [ ] **任务 1: 日志 API 增强 (AC: #1, #2, #3, #6, #8)**
  - [ ] 子任务 1.1: 重构 `/api/logs` GET 接口，实现完整筛选逻辑
  - [ ] 子任务 1.2: 实现分页逻辑 (page, pageSize, total)
  - [ ] 子任务 1.3: 添加日志导出端点 `/api/logs/export` (带 10,000 条限制)
  - [ ] 子任务 1.4: 实现日志文件流式读取和解析
  - [ ] 子任务 1.5: 实现智能解析 JSON context (如果存在)

- [ ] **任务 2: 日志解析器 (AC: #1, #2)**
  - [ ] 子任务 2.1: 创建日志行解析器 (解析时间戳、级别、消息)
  - [ ] 子任务 2.2: 实现日志筛选引擎 (内存中过滤)
  - [ ] 子任务 2.3: 添加日志统计功能 (按级别、时间分组)

- [ ] **任务 3: 日志事件流增强 (AC: #4)**
  - [ ] 子任务 3.1: 增强 `logging.ts` 的 `emitEvent()`，添加日志事件类型
  - [ ] 子任务 3.2: 添加事件类型: `log_new` (新日志)
  - [ ] 子任务 3.3: 在 SSE 流中广播日志事件
  - [ ] 子任务 3.4: 实现事件去重机制 (基于内容哈希)
  - [ ] 子任务 3.5: 实现防抖机制 (500ms)

### 前端任务 (Next.js 16 + React 19 + Tailwind CSS 4)

- [ ] **任务 4: 日志列表页面 (AC: #1, #3, #4)**
  - [ ] 子任务 4.1: 创建 `app/logs/page.tsx` 主页面
  - [ ] 子任务 4.2: 实现日志表格组件
  - [ ] 子任务 4.3: 实现分页组件
  - [ ] 子任务 4.4: 实现实时日志更新 (SSE)

- [ ] **任务 5: 筛选表单 (AC: #2)**
  - [ ] 子任务 5.1: 创建筛选表单组件
  - [ ] 子任务 5.2: 实现级别下拉选择 (INFO, WARN, ERROR)
  - [ ] 子任务 5.3: 实现日期范围选择器
  - [ ] 子任务 5.4: 实现智能体/团队下拉选择
  - [ ] 子任务 5.5: 实现关键词搜索框
  - [ ] 子任务 5.6: 实现"重置筛选"按钮

- [ ] **任务 6: 日志详情对话框 (AC: #5)**
  - [ ] 子任务 6.1: 创建日志详情模态框
  - [ ] 子任务 6.2: 格式化显示 JSON 上下文
  - [ ] 子任务 6.3: 高亮显示错误堆栈
  - [ ] 子任务 6.4: 添加复制到剪贴板功能

- [ ] **任务 7: 导出功能 (AC: #6)**
  - [ ] 子任务 7.1: 添加导出按钮 (CSV, JSON)
  - [ ] 子任务 7.2: 实现 CSV 导出格式化
  - [ ] 子任务 7.3: 实现 JSON 导出格式化
  - [ ] 子任务 7.4: 触发浏览器下载

- [ ] **任务 8: 样式和用户体验 (AC: #7)**
  - [ ] 子任务 8.1: 使用 Tailwind CSS 4 实现响应式布局
  - [ ] 子任务 8.2: 根据日志级别使用不同颜色
  - [ ] 子任务 8.3: 实现加载状态指示器
  - [ ] 子任务 8.4: 添加空状态提示
  - [ ] 子任务 8.5: 使用 Radix UI 组件确保无障碍性

## 开发者注意事项

### 架构合规性

- **后端架构**: 遵循 Hono API 服务器模式，路由位于 `src/server/routes/logs.ts`
- **前端架构**: 遵循 Next.js 16 App Router 模式，页面位于 `tinyclaw/tinyoffice/app/logs/`
- **数据流**: 数据库 → API → 前端，通过 SSE 实现实时更新

### 技术要求

#### 后端 (TinyClaw - CommonJS)

- **语言**: TypeScript 5.9.3
- **模块系统**: CommonJS (导入不带扩展名)
- **框架**: Hono 4.12.1
- **数据库**: SQLite (better-sqlite3 11.0.0)
- **文件位置**:
  - 路由: `tinyclaw/src/server/routes/logs.ts`
  - 类型: `tinyclaw/src/lib/types.ts` (如需扩展)
  - 日志: `tinyclaw/src/lib/logging.ts`

#### 前端 (TinyOffice - Next.js)

- **框架**: Next.js 16.1.6 (App Router)
- **UI 库**: React 19.2.3
- **样式**: Tailwind CSS 4
- **组件库**: Radix UI 1.4.3
- **文件位置**:
  - 页面: `tinyclaw/tinyoffice/app/logs/page.tsx`
  - 组件: `tinyclaw/tinyoffice/components/logs/` (按需创建)
  - 工具函数: `tinyclaw/tinyoffice/src/lib/`

### 代码结构要求

```
tinyclaw/
├── src/
│   ├── server/
│   │   └── routes/
│   │       └── logs.ts                    # ← 重构此文件
│   ├── lib/
│   │   ├── logging.ts                     # ← 增强 SSE 事件
│   │   ├── types.ts                       # ← 添加日志类型定义
│   │   └── log-parser.ts                  # ← NEW: 日志解析器
│   └── lib/
│       └── config.ts                      # ← LOG_FILE 配置
│
└── tinyoffice/
    ├── app/
    │   └── logs/
    │       └── page.tsx                   # ← 新建主页面
    ├── components/
    │   └── logs/                          # ← 新建组件目录
    │       ├── LogTable.tsx               # ← 日志表格
    │       ├── LogFilters.tsx             # ← 筛选表单
    │       ├── LogDetailModal.tsx         # ← 详情对话框
    │       └── LogExportButton.tsx        # ← 导出按钮
    └── src/
        └── lib/
            └── api-client.ts              # ← 扩展 API 客户端
```

### 日志文件格式

当前日志格式 (`logs/tinyclaw.log`):
```
[2026-03-04T10:30:15.123Z] [INFO] Message content here
[2026-03-04T10:30:16.456Z] [WARN] Warning message
[2026-03-04T10:30:17.789Z] [ERROR] Error message with stack trace
```

**解析规则**:
- 时间戳: ISO 8601 格式 `[YYYY-MM-DDTHH:mm:ss.sssZ]`
- 级别: `[INFO]`, `[WARN]`, `[ERROR]`
- 消息: 剩余内容 (可能包含多行堆栈跟踪)

### 数据设计

#### 日志文件结构

**文件位置**: `tinyclaw/logs/tinyclaw.log`

**格式**: 每行一条日志
```
[{timestamp}] [{level}] {message}
```

**示例**:
```
[2026-03-04T10:30:15.123Z] [INFO] Queue processor started successfully
[2026-03-04T10:30:16.456Z] [WARN] Agent response timeout after 30s
[2026-03-04T10:30:17.789Z] [ERROR] Database connection failed
Error: Connection refused
    at connect (/path/to/db.ts:10)
    at processQueue (/path/to/queue.ts:20)
```

#### 日志解析器设计 (新增)

**文件**: `tinyclaw/src/lib/log-parser.ts`

**核心函数**:
```typescript
export interface ParsedLogEntry {
  id: string;                    // 哈希值或行号
  timestamp: string;             // ISO 8601
  timestampUnix: number;         // Unix timestamp (用于筛选)
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;               // 完整消息 (含堆栈)
  stackTrace?: string;           // 分离的堆栈跟踪
  context?: Record<string, any>; // 如果消息包含 JSON
}

// 从文件读取并解析日志
export function parseLogFile(filePath: string, options?: {
  limit?: number;
  offset?: number;
  filters?: LogFilters;
}): { entries: ParsedLogEntry[]; total: number };

// 筛选日志 (内存中)
export function filterLogs(entries: ParsedLogEntry[], filters: LogFilters): ParsedLogEntry[];

// 导出为 CSV
export function exportToCSV(entries: ParsedLogEntry[]): string;

// 导出为 JSON
export function exportToJSON(entries: ParsedLogEntry[]): string;
```

#### 筛选参数设计

```typescript
export interface LogFilters {
  page?: number;                 // 页码 (从 1 开始)
  pageSize?: number;             // 每页数量 (默认: 20, 最大: 100)
  level?: 'INFO' | 'WARN' | 'ERROR' | 'ALL';  // 级别
  startDate?: number;            // Unix timestamp (开始时间)
  endDate?: number;              // Unix timestamp (结束时间)
  search?: string;               // 关键词 (消息内容)
  includeStack?: boolean;        // 是否包含堆栈
}
```

### API 设计

#### 重构的端点

**GET /api/logs** - 获取日志列表 (重构版本)

查询参数:
```typescript
{
  page?: number;                 // 页码 (默认: 1)
  pageSize?: number;             // 每页数量 (默认: 20, 最大: 100)
  level?: 'INFO' | 'WARN' | 'ERROR' | 'ALL';  // 筛选级别 (默认: ALL)
  startDate?: number;            // Unix timestamp (开始时间)
  endDate?: number;              // Unix timestamp (结束时间)
  search?: string;               // 关键词搜索 (消息内容)
  includeStack?: boolean;        // 是否包含堆栈跟踪 (默认: false)
}
```

响应格式:
```typescript
{
  logs: ParsedLogEntry[];        // 解析后的日志条目
  pagination: {
    page: number;                // 当前页
    pageSize: number;            // 每页数量
    total: number;               // 总条数
    totalPages: number;          // 总页数
    hasMore: boolean;            // 是否有更多
  };
  stats: {                       // 统计信息
    total: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    dateRange: {
      min: number;               // Unix timestamp
      max: number;
    };
  };
  appliedFilters: LogFilters;   // 应用的筛选条件
}
```

**错误处理**:
```typescript
// 超过最大导出限制
{ error: 'EXPORT_LIMIT_EXCEEDED', maxRows: 10000, actualRows: 15000 }

// 文件读取错误
{ error: 'LOG_FILE_READ_ERROR', message: '无法读取日志文件' }
```

#### 新增端点

**GET /api/logs/export** - 导出日志

查询参数: 同 `/api/logs` + `format: 'csv' | 'json'`

**限制**: 最多导出 10,000 条记录

响应:
- `Content-Type: text/csv` 或 `application/json`
- `Content-Disposition: attachment; filename="logs-2026-03-04.csv"`

**实现示例**:
```typescript
app.get('/api/logs/export', async (c) => {
  const { format = 'csv' } = c.req.query();
  const filters = parseFilters(c.req.query());

  // 获取筛选后的日志
  const { entries, total } = await parseLogFile(LOG_FILE, filters);

  // 限制导出数量
  const MAX_EXPORT_ROWS = 10000;
  if (total > MAX_EXPORT_ROWS) {
    return c.json({
      error: 'EXPORT_LIMIT_EXCEEDED',
      maxRows: MAX_EXPORT_ROWS,
      actualRows: total
    }, 400);
  }

  // 导出
  const content = format === 'csv'
    ? exportToCSV(entries)
    : JSON.stringify(entries, null, 2);

  return c.body(content, 200, {
    'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
    'Content-Disposition': `attachment; filename="logs-${Date.now()}.${format}"`,
  });
});
```

### 前端组件设计

#### 页面结构 (page.tsx)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useLogs } from '@/lib/api-client';
import LogFilters from '@/components/logs/LogFilters';
import LogTable from '@/components/logs/LogTable';
import Pagination from '@/components/logs/Pagination';
import LogExportButton from '@/components/logs/LogExportButton';
import LogDetailModal from '@/components/logs/LogDetailModal';
import { useLogEvents } from '@/lib/sse-client';

export default function LogsPage() {
  // 筛选状态
  const [filters, setFilters] = useState<LogFilters>({
    page: 1,
    pageSize: 20,
    level: 'ALL',
  });

  // 日志数据
  const { logs, pagination, stats, isLoading, error, refetch } = useLogs(filters);

  // 详情模态框
  const [selectedLog, setSelectedLog] = useState<ParsedLogEntry | null>(null);

  // SSE 实时更新 (带防抖)
  useLogEvents({
    onLogReceived: (newLog) => {
      // 防抖处理: 500ms 内只触发一次
      // 检查是否符合当前筛选条件
      if (matchesFilters(newLog, filters)) {
        refetch(); // 重新获取数据
      }
    },
    enabled: true, // 页面可见时启用
  });

  // 页面可见性控制 SSE
  useEffect(() => {
    const handleVisibilityChange = () => {
      // 页面可见时重新连接，不可见时暂停
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计摘要 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-blue-600 font-bold">{stats?.total || 0}</div>
          <div className="text-sm text-gray-600">总日志</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-blue-600 font-bold">{stats?.infoCount || 0}</div>
          <div className="text-sm text-gray-600">Info</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-yellow-600 font-bold">{stats?.warnCount || 0}</div>
          <div className="text-sm text-gray-600">Warning</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-red-600 font-bold">{stats?.errorCount || 0}</div>
          <div className="text-sm text-gray-600">Error</div>
        </div>
      </div>

      {/* 筛选表单 */}
      <LogFilters
        value={filters}
        onChange={setFilters}
        stats={stats}
      />

      {/* 加载状态 */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-600">❌ {error.message}</div>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && logs?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-4">📄</div>
          <div className="text-gray-600">暂无日志记录</div>
        </div>
      )}

      {/* 日志表格 */}
      {logs && logs.length > 0 && (
        <>
          <LogTable
            logs={logs}
            onRowClick={setSelectedLog}
          />
          <div className="flex justify-between items-center">
            <Pagination
              {...pagination}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
            <LogExportButton filters={filters} />
          </div>
        </>
      )}

      {/* 详情对话框 */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
```

#### 筛选表单 (LogFilters.tsx)

```typescript
interface LogFiltersProps {
  value: LogFilters;
  onChange: (filters: LogFilters) => void;
  stats?: LogStats;
}

export function LogFilters({ value, onChange, stats }: LogFiltersProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 级别筛选 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日志级别
          </label>
          <select
            value={value.level || 'ALL'}
            onChange={(e) => onChange({ ...value, level: e.target.value as any, page: 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">全部</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warning</option>
            <option value="ERROR">Error</option>
          </select>
        </div>

        {/* 时间范围 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            时间范围
          </label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={value.startDate ? formatDateTime(value.startDate) : ''}
              onChange={(e) => {
                const date = new Date(e.target.value);
                onChange({ ...value, startDate: date.getTime() / 1000, page: 1 });
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="开始时间"
            />
            <span className="self-center text-gray-500">至</span>
            <input
              type="datetime-local"
              value={value.endDate ? formatDateTime(value.endDate) : ''}
              onChange={(e) => {
                const date = new Date(e.target.value);
                onChange({ ...value, endDate: date.getTime() / 1000, page: 1 });
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="结束时间"
            />
          </div>
        </div>

        {/* 每页数量 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            每页数量
          </label>
          <select
            value={value.pageSize || 20}
            onChange={(e) => onChange({ ...value, pageSize: parseInt(e.target.value), page: 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={20}>20 条</option>
            <option value={50}>50 条</option>
            <option value={100}>100 条</option>
          </select>
        </div>

        {/* 关键词搜索 */}
        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            搜索关键词
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={value.search || ''}
              onChange={(e) => onChange({ ...value, search: e.target.value, page: 1 })}
              placeholder="搜索日志消息..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => onChange({ ...value, search: '', page: 1 })}
              disabled={!value.search}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              清除
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            在日志消息中搜索关键词
          </p>
        </div>

        {/* 包含堆栈选项 */}
        <div className="lg:col-span-1 flex items-end">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={value.includeStack || false}
              onChange={(e) => onChange({ ...value, includeStack: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">包含堆栈</span>
          </label>
        </div>

        {/* 重置按钮 */}
        <div className="lg:col-span-4 flex justify-end">
          <button
            type="button"
            onClick={() => onChange({
              page: 1,
              pageSize: 20,
              level: 'ALL',
              startDate: undefined,
              endDate: undefined,
              search: '',
              includeStack: false,
            })}
            disabled={isDefaultFilters(value)}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            重置筛选
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 日志表格 (LogTable.tsx)

- 表格列: 时间、级别、消息、操作
- 点击行显示详情
- 悬停效果
- 响应式设计

#### 日志详情 (LogDetailModal.tsx)

- 完整消息
- 时间戳 (格式化)
- 级别徽章
- JSON 上下文 (格式化显示)
- 错误堆栈 (如果有)

### 日志级别颜色方案 (增强版)

```css
/* Tailwind CSS 配置 */
.level-info {
  @apply text-blue-600 bg-blue-100 border-blue-200;
}

.level-warn {
  @apply text-yellow-600 bg-yellow-100 border-yellow-200;
}

.level-error {
  @apply text-red-600 bg-red-100 border-red-200;
}

/* 统计卡片 */
.stat-info {
  @apply bg-blue-50 text-blue-600;
}

.stat-warn {
  @apply bg-yellow-50 text-yellow-600;
}

.stat-error {
  @apply bg-red-50 text-red-600;
}

/* 表格行 */
.row-info {
  @apply hover:bg-blue-50;
}

.row-warn {
  @apply hover:bg-yellow-50;
}

.row-error {
  @apply hover:bg-red-50;
}

/* 徽章 */
.badge-info {
  @apply bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded;
}

.badge-warn {
  @apply bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded;
}

.badge-error {
  @apply bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded;
}
```

**使用示例**:
```tsx
<span className={`badge-${log.level.toLowerCase()}`}>
  {log.level}
</span>
```

#### 性能优化 (增强版)

1. **日志文件读取优化**
   - 使用流式读取，避免一次性加载大文件
   - 实现反向读取 (从文件末尾开始)
   - 缓存最近的筛选结果

2. **前端优化**
   - **虚拟滚动**: 使用 `react-window` 或 `react-virtualized` 处理大数据量表格
   - **防抖搜索**: 300-500ms 防抖
   - **延迟加载**: 只渲染可视区域的日志行
   - **图片懒加载**: 日志中的图片使用懒加载
   - **缓存筛选结果**: 使用 React Query 或 SWR 缓存

3. **实时更新优化**
   - **可见性检测**: 仅在页面可见时订阅 SSE
   - **事件去重**: 基于日志内容的哈希值去重
   - **批量处理**: 500ms 内的多个事件合并处理
   - **节流**: 每秒最多更新一次界面

4. **内存管理**
   - 限制内存中保留的日志数量 (最多 1000 条)
   - 定期清理旧的筛选缓存
   - 使用 WeakMap 存储临时数据

**实现示例**:

```typescript
// 虚拟滚动优化
import { FixedSizeList as List } from 'react-window';

function LogTable({ logs }) {
  const Row = ({ index, style }) => (
    <div style={style} className="border-b border-gray-200">
      {logs[index].message}
    </div>
  );

  return (
    <List
      height={600}
      itemCount={logs.length}
      itemSize={60}
      width="100%"
    >
      {Row}
    </List>
  );
}

// 防抖搜索
import { debounce } from 'lodash';

const debouncedSearch = debounce((value) => {
  setFilters({ ...filters, search: value, page: 1 });
}, 500);

// SSE 事件去重
const seenLogHashes = new Set();

function handleNewLog(log) {
  const hash = hashLogContent(log);
  if (seenLogHashes.has(hash)) return;
  seenLogHashes.add(hash);
  // 处理日志...
}
```

### 测试要求

#### 后端测试

- [ ] **日志解析测试**
  - [ ] 测试正常日志行的解析
  - [ ] 测试多行堆栈跟踪的解析
  - [ ] 测试无效格式的容错
  - [ ] 测试时间戳解析准确性

- [ ] **筛选逻辑测试**
  - [ ] 测试按级别的筛选 (INFO, WARN, ERROR, ALL)
  - [ ] 测试时间范围筛选
  - [ ] 测试关键词搜索 (模糊匹配)
  - [ ] 测试组合筛选 (级别 + 时间 + 关键词)
  - [ ] 测试边界情况 (无结果、全匹配)

- [ ] **分页功能测试**
  - [ ] 测试第一页、最后一页
  - [ ] 测试不同每页数量 (20, 50, 100)
  - [ ] 测试总页数计算
  - [ ] 测试偏移量计算

- [ ] **导出功能测试**
  - [ ] 测试 CSV 导出格式
  - [ ] 测试 JSON 导出格式
  - [ ] 测试导出限制 (10,000 条)
  - [ ] 测试大文件导出性能
  - [ ] 测试文件下载头正确性

- [ ] **性能测试**
  - [ ] 测试 10,000 行日志的读取速度
  - [ ] 测试 100,000 行日志的读取速度
  - [ ] 测试复杂筛选的响应时间
  - [ ] 测试内存使用情况

#### 前端测试

- [ ] **筛选表单测试**
  - [ ] 测试级别下拉选择
  - [ ] 测试日期范围选择
  - [ ] 测试关键词搜索
  - [ ] 测试重置功能
  - [ ] 测试表单验证

- [ ] **日志表格测试**
  - [ ] 测试表格渲染
  - [ ] 测试点击查看详情
  - [ ] 测试悬停效果
  - [ ] 测试响应式布局
  - [ ] 测试虚拟滚动 (如果实现)

- [ ] **分页测试**
  - [ ] 测试页码切换
  - [ ] 测试每页数量切换
  - [ ] 测试边界页码 (1, 最后一页)

- [ ] **导出功能测试**
  - [ ] 测试导出按钮点击
  - [ ] 测试浏览器下载触发
  - [ ] 测试文件名格式

- [ ] **实时更新测试**
  - [ ] 测试 SSE 连接
  - [ ] 测试新日志接收
  - [ ] 测试防抖效果
  - [ ] 测试事件去重

- [ ] **错误处理测试**
  - [ ] 测试空状态显示
  - [ ] 测试加载状态
  - [ ] 测试错误消息显示
  - [ ] 测试网络错误处理

#### 集成测试

- [ ] 测试完整的日志查看流程 (加载 → 筛选 → 查看 → 导出)
- [ ] 测试筛选 + 导出组合
- [ ] 测试实时日志接收和显示
- [ ] 测试大数据量下的性能
- [ ] 测试页面刷新后的状态保持
- [ ] 测试多标签页同时打开

### 安全考虑 (增强版)

- [ ] **输入验证**
  - [ ] 所有查询参数必须验证类型和范围
  - [ ] 页码必须 >= 1
  - [ ] 每页数量限制在 20-100 之间
  - [ ] 日期范围必须是有效的 Unix timestamp

- [ ] **文件访问安全**
  - [ ] 防止路径遍历攻击 (../)
  - [ ] 限制只能读取 `logs/` 目录
  - [ ] 验证文件存在性

- [ ] **内存安全**
  - [ ] 导出功能限制最大 10,000 条记录
  - [ ] 防止内存溢出攻击
  - [ ] 大文件分块读取

- [ ] **XSS 防护**
  - [ ] 前端显示日志消息时进行 HTML 转义
  - [ ] 禁止直接渲染用户输入
  - [ ] 使用 React 的自动转义

- [ ] **权限控制 (后续增强)**
  - [ ] 日志查看可能需要身份验证
  - [ ] 敏感日志需要特殊权限
  - [ ] 操作审计日志

**实现示例**:

```typescript
// 输入验证
function validateFilters(filters: any): filters is LogFilters {
  if (filters.page && (filters.page < 1 || filters.page > 1000000)) {
    throw new Error('无效的页码');
  }
  if (filters.pageSize && (filters.pageSize < 20 || filters.pageSize > 100)) {
    throw new Error('每页数量必须在 20-100 之间');
  }
  if (filters.startDate && isNaN(filters.startDate)) {
    throw new Error('无效的开始时间');
  }
  if (filters.endDate && isNaN(filters.endDate)) {
    throw new Error('无效的结束时间');
  }
  return true;
}

// XSS 防护 (React 自动处理)
function LogMessage({ message }: { message: string }) {
  return <div className="whitespace-pre-wrap">{message}</div>;
  // React 自动转义, 无需手动处理
}
```

### 安全考虑

- [ ] 输入验证: 所有查询参数必须验证
- [ ] SQL 注入防护: 使用参数化查询
- [ ] 日志脱敏: 敏感信息不应记录到日志
- [ ] 权限控制: 日志查看可能需要身份验证 (后续增强)

### 与其他故事的依赖关系

- **依赖**: 日志文件系统已存在 (`logs/tinyclaw.log`)
- **依赖**: 基础日志路由 (`/api/logs`) 已存在 (当前仅返回最后 100 行)
- **依赖**: SSE 事件系统已存在 (`logging.ts` 的 `emitEvent()`)
- **依赖**: TinyOffice 基础框架已存在 (Next.js, Tailwind CSS)
- **影响**: 本故事完成后，日志查看器可直接使用
- **注意**:
  - 当前日志存储在文件中，非数据库
  - 智能体/团队筛选通过关键词搜索实现 (日志消息中包含 agentId/teamId)
  - 如需精确筛选，建议未来将日志迁移到数据库

### 已知限制 (新增)

1. **智能体/团队筛选**: 当前日志格式不包含结构化的 agentId/teamId，筛选依赖消息中的文本匹配
2. **性能限制**: 文件读取在超大日志文件 (>100MB) 时可能较慢
3. **实时更新**: 仅能接收新增日志，无法更新已有日志
4. **历史同步**: 页面刷新后不会自动拉取历史日志

### 未来改进方向 (新增)

1. **数据库迁移**: 将日志迁移到 SQLite，支持结构化查询
2. **索引优化**: 在数据库中添加索引，提升查询性能
3. **日志轮转**: 实现日志文件轮转，防止文件过大
4. **归档策略**: 自动归档旧日志，保留最近 30 天
5. **权限控制**: 添加身份验证和授权
6. **日志级别动态调整**: 运行时调整日志级别
7. **日志采样**: 高负载时自动采样日志

### 参考资料

- [架构文档 (中文)](docs/architecture-tinyclaw.md) - 系统架构
- [开发指南 (中文)](docs/development-guide-tinyclaw.md) - 开发流程
- [组件清单 (中文)](docs/component-inventory-tinyclaw.md) - 现有组件
- [项目上下文 (中文)](docs/project-context.md) - 技术栈和规则

**源文件引用:**
- [源: docs/architecture-tinyclaw.md#API 服务器] - API 服务器设计
- [源: docs/architecture-tinyclaw.md#日志与事件] - 日志系统设计
- [源: docs/development-guide-tinyclaw.md#项目结构] - 项目结构
- [源: docs/project-context.md#TinyClaw 技术栈] - 技术版本要求

## 开发者代理记录

### 代理模型使用

开发者代理将使用 **Claude Opus 4.6** (最新版) 进行实现。

### 调试日志引用

实现过程中将记录详细的调试信息到:
- 后端: `tinyclaw/logs/tinyclaw.log`
- 前端: 浏览器控制台

### 完成说明列表

(待开发完成后填写)

### 文件列表

(待开发完成后列出所有创建/修改的文件)

---

**故事状态**: ready-for-dev
**创建日期**: 2026-03-04
**审核修复日期**: 2026-03-04
**预计完成时间**: 2-3 小时 (包括测试)
**优先级**: 中等 (核心监控功能)

---

## 审核修复记录

### 修复内容

1. **✅ 数据源修正**
   - 从"数据库表"改为"日志文件" (`logs/tinyclaw.log`)
   - 添加日志文件格式说明和解析规则

2. **✅ 筛选字段调整**
   - 移除 `agentId` 和 `teamId` 字段 (文件日志不支持结构化字段)
   - 改为通过关键词搜索实现智能体/团队筛选
   - 添加说明: 如需精确筛选，建议未来迁移到数据库

3. **✅ 分页策略明确**
   - 明确使用 OFFSET 分页 (基于文件读取)
   - 添加性能提示: 大数据量时可能较慢

4. **✅ 导出限制**
   - 添加明确的 10,000 条导出限制
   - 防止内存溢出攻击

5. **✅ 日期格式统一**
   - 从 ISO 8601 改为 Unix timestamp
   - 与日志文件格式保持一致

6. **✅ 性能优化增强**
   - 添加流式读取实现
   - 添加反向读取优化
   - 添加虚拟滚动建议
   - 添加 SSE 事件去重和防抖

7. **✅ 错误处理完善**
   - 添加导出限制错误
   - 添加文件读取错误
   - 添加输入验证

8. **✅ 安全增强**
   - 添加输入验证规则
   - 添加文件访问安全
   - 添加内存安全防护
   - 添加 XSS 防护说明

9. **✅ 已知限制文档化**
   - 智能体/团队筛选限制
   - 性能限制 (>100MB 文件)
   - 实时更新限制
   - 历史同步限制

10. **✅ 未来改进方向**
    - 数据库迁移建议
    - 索引优化建议
    - 日志轮转建议
    - 归档策略建议
    - 权限控制建议

### 新增内容

- **日志解析器设计**: 详细的解析器接口和实现
- **筛选参数设计**: 完整的 TypeScript 接口
- **API 响应格式**: 包含统计信息和错误处理
- **前端组件代码**: 完整的页面和表单实现
- **性能优化示例**: 虚拟滚动、防抖、去重代码
- **测试用例**: 详细的测试清单 (后端、前端、集成)
- **颜色方案**: 完整的 Tailwind CSS 配置
- **已知限制**: 明确的当前限制说明
- **未来改进**: 清晰的后续优化方向

### 审核结论

**修复质量**: 🟢 优秀

**剩余问题**: 无阻塞性问题

**建议**: 可以开始实现，基于文件的日志查看器方案合理且可行。未来如需更强大的功能，建议迁移到数据库。
