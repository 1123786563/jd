# Story 1b.5: 审计日志可视化 (优化版)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **开发者和系统管理员**,
I want **审计日志可视化功能**,
so that **能够直观地查看所有自修改操作的历史记录、变更趋势和操作统计**.

## Acceptance Criteria

**P0 - 必须实现:**
1. [CLI命令基础] 提供`automaton-cli audit` CLI命令,查看最近的审计日志
2. [终端表格展示] 以清晰的文本格式展示审计记录(时间戳、类型、描述、文件路径)
3. [分页功能] 默认显示20条,支持`--limit`参数自定义数量

**P1 - 推荐实现:**
4. [按类型过滤] 支持`--type <type>`过滤特定类型的修改
5. [统计摘要] 显示总数、按类型分布、可回滚数量
6. [基础导出] 支持导出为JSON格式
7. [颜色高亮] 使用chalk进行类型颜色编码

**P2 - 可选实现:**
8. [详细差异查看] 支持`--diff <id>`查看特定修改的详细差异
9. [按日期过滤] 支持`--since/--until`日期范围过滤
10. [按文件过滤] 支持`--file <path>`查看特定文件的修改历史
11. [CSV导出] 支持导出为CSV格式

**P3 - 未来扩展:**
12. [交互式模式] 类似`git log --oneline`的交互式查看
13. [回滚预览] 显示可回滚的修改列表
14. [高级统计] 按天/周/月的趋势分析

## Tasks / Subtasks

### P0 任务 (核心功能)

- [ ] Task 1: CLI命令框架 (AC: #1)
  - [ ] Subtask 1.1: 创建`automaton/src/audit/audit-reader.ts` - 数据访问层
  - [ ] Subtask 1.2: 创建`automaton/packages/cli/src/commands/audit.ts` - CLI命令
  - [ ] Subtask 1.3: 更新`automaton/packages/cli/src/index.ts`注册`audit`命令
  - [ ] Subtask 1.4: 实现基础命令解析(读取`--limit`参数)

- [ ] Task 2: 数据访问层 (AC: #1, #2)
  - [ ] Subtask 2.1: 实现`getAllModifications(limit)`查询最近记录
  - [ ] Subtask 2.2: 实现`getModificationById(id)`查询单条记录
  - [ ] Subtask 2.3: 实现数据转换(数据库记录 → 展示格式)

- [ ] Task 3: 终端输出渲染 (AC: #2, #3)
  - [ ] Subtask 3.1: 实现`renderAuditLog(modifications)` - 文本格式化输出
  - [ ] Subtask 3.2: 实现分页显示逻辑
  - [ ] Subtask 3.3: 实现空数据集的友好提示

### P1 任务 (增强功能)

- [ ] Task 4: 过滤功能 (AC: #4)
  - [ ] Subtask 4.1: 实现`getModificationsByType(type, limit)`类型过滤查询
  - [ ] Subtask 4.2: 添加CLI参数`--type <type>`支持
  - [ ] Subtask 4.3: 实现类型参数验证

- [ ] Task 5: 统计信息 (AC: #5)
  - [ ] Subtask 5.1: 实现`getModificationStats()`统计计算
  - [ ] Subtask 5.2: 实现统计输出格式(总数、类型分布、可回滚数)
  - [ ] Subtask 5.3: 添加`--stats`选项显示统计信息

- [ ] Task 6: JSON导出 (AC: #6)
  - [ ] Subtask 6.1: 实现`exportToJson(modifications, filePath)`导出函数
  - [ ] Subtask 6.2: 添加`--export json`选项
  - [ ] Subtask 6.3: 支持自定义输出路径`--output <file>`

- [ ] Task 7: 颜色高亮 (AC: #7)
  - [ ] Subtask 7.1: 实现类型到颜色的映射
  - [ ] Subtask 7.2: 集成chalk库进行颜色输出
  - [ ] Subtask 7.3: 实现带颜色的渲染函数

### P2 任务 (高级功能)

- [ ] Task 8: 差异查看 (AC: #8)
  - [ ] Subtask 8.1: 实现`--diff <id>`选项
  - [ ] Subtask 8.2: 实现详细的diff渲染(如果有diff字段)

- [ ] Task 9: 日期过滤 (AC: #9)
  - [ ] Subtask 9.1: 实现`getModificationsByDateRange(since, until)`查询
  - [ ] Subtask 9.2: 添加`--since <date>`和`--until <date>`选项
  - [ ] Subtask 9.3: 实现日期参数解析和验证

- [ ] Task 10: 文件过滤 (AC: #10)
  - [ ] Subtask 10.1: 实现`getModificationsByFile(path)`查询
  - [ ] Subtask 10.2: 添加`--file <path>`选项

- [ ] Task 11: CSV导出 (AC: #11)
  - [ ] Subtask 11.1: 实现`exportToCsv(modifications, filePath)`导出函数
  - [ ] Subtask 11.2: 添加`--export csv`选项

### P3 任务 (未来扩展) - 可选

- [ ] Task 12: 交互式模式 (AC: #12)
- [ ] Task 13: 回滚预览 (AC: #13)
- [ ] Task 14: 高级统计图表 (AC: #14)

### 测试与文档

- [ ] Task 15: 测试 (所有AC)
  - [ ] Subtask 15.1: 为audit-reader.ts编写单元测试
  - [ ] Subtask 15.2: 为CLI命令编写集成测试
  - [ ] Subtask 15.3: 边界测试(空数据、大数据量、无效参数)

- [ ] Task 16: 文档
  - [ ] Subtask 16.1: 更新CLI帮助文档
  - [ ] Subtask 16.2: 添加README.md使用示例
  - [ ] Subtask 16.3: 编写API文档注释

## Dev Notes

### 架构约束

#### 1. 遵循现有CLI模式
参考现有命令实现:
- `packages/cli/src/commands/logs.ts` - 日志查看命令
- `packages/cli/src/commands/status.ts` - 状态查看命令
- `packages/cli/src/index.ts` - 命令注册入口

**命令调用方式:**
```bash
automaton-cli audit [options]
```

#### 2. 使用现有依赖
项目已安装的依赖:
- ✅ `chalk` ^5.3.0 - 终端颜色输出
- ✅ `ora` ^8.0.0 - 加载指示器
- ❌ 无表格库 - 使用纯文本格式(避免新增依赖)

#### 3. 数据库访问
使用现有数据库接口:
```typescript
import { createDatabase } from "@conway/automaton/state/database.js";
const db = createDatabase(dbPath);
const mods = db.getRecentModifications(limit); // 现有方法
```

### 技术栈要求
- **语言**: TypeScript 5.9.3
- **运行时**: Node.js >= 20.0.0
- **包管理器**: pnpm
- **CLI框架**: 简单的命令行参数解析(不使用commander.js,保持与现有CLI一致)
- **终端渲染**: chalk (颜色), 纯文本格式(避免新增依赖)

### 数据库表结构
审计日志存储在`modifications`表中 (src/state/schema.ts:86-95):
```sql
CREATE TABLE modifications (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,           -- ModificationType
  description TEXT NOT NULL,
  file_path TEXT,               -- 可选
  diff TEXT,                    -- 可选,差异内容
  reversible INTEGER NOT NULL DEFAULT 1,  -- 1=true, 0=false
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### ModificationType 枚举
来自src/types.ts:256-272:
```typescript
export type ModificationType =
  | "code_edit" | "code_revert"
  | "tool_install" | "mcp_install"
  | "config_change" | "port_expose" | "vm_deploy"
  | "heartbeat_change" | "prompt_change"
  | "skill_install" | "skill_remove"
  | "soul_update" | "registry_update"
  | "child_spawn" | "upstream_pull" | "upstream_reset";
```

### 颜色编码方案
```typescript
const TYPE_COLORS = {
  code_edit: 'green',      // 安全的代码修改
  code_revert: 'yellow',   // 代码回滚
  config_change: 'blue',   // 配置变更
  tool_install: 'cyan',    // 工具安装
  skill_install: 'cyan',   // 技能安装
  security: 'red',         // 安全相关(需要特别注意)
  // 默认: 'white'
} as const;
```

### 文件组织结构
```
automaton/
├── src/
│   └── audit/                          # 审计日志可视化模块
│       ├── audit-reader.ts             # 数据访问层(查询数据库)
│       └── renderer.ts                 # 终端渲染逻辑(可选,可合并到CLI)
├── packages/cli/
│   └── src/
│       ├── commands/
│       │   ├── audit.ts                # 新建:audit命令
│       │   └── [现有命令]
│       └── index.ts                    # 更新:注册audit命令
└── tests/
    └── audit/
        ├── audit-reader.test.ts
        └── audit-cli.test.ts
```

### CLI命令设计

#### 基础用法
```bash
# 查看最近20条审计日志
automaton-cli audit

# 查看最近50条
automaton-cli audit --limit 50

# 只显示可回滚的修改
automaton-cli audit --reversible

# 按类型过滤
automaton-cli audit --type code_edit

# 查看统计信息
automaton-cli audit --stats
```

#### 导出功能
```bash
# 导出为JSON
automaton-cli audit --export json --output audit.json

# 导出最近100条
automaton-cli audit --limit 100 --export json > audit.json
```

#### 详细查看
```bash
# 查看特定修改的详细信息(包括diff)
automaton-cli audit --diff <modification-id>
```

#### 高级过滤
```bash
# 查看今天的修改
automaton-cli audit --since "2026-03-04"

# 查看特定文件的修改历史
automaton-cli audit --file "src/agent/loop.ts"

# 组合过滤
automaton-cli audit --type code_edit --since "2026-03-01" --limit 30
```

### 输出格式示例

#### 默认文本格式
```
=== 审计日志 (最近 20 条) ===

[2026-03-04 10:30:15] code_edit: 优化agent循环性能 (src/agent/loop.ts)
[2026-03-04 09:15:22] config_change: 更新推理模型配置 (config.json)
[2026-03-03 18:45:10] tool_install: 安装新工具"git-manager"
[2026-03-03 14:20:05] code_revert: 回滚错误的配置修改
...

总计: 45 条记录 | 可回滚: 42 条
```

#### 带颜色输出
```
[2026-03-04 10:30:15] 🔵 code_edit: 优化agent循环性能
[2026-03-04 09:15:22] 🟢 config_change: 更新推理模型配置
```

#### 详细差异查看
```bash
$ automaton-cli audit --diff abc123def456

修改ID: abc123def456
时间: 2026-03-04 10:30:15
类型: code_edit
描述: 优化agent循环性能
文件: src/agent/loop.ts
可回滚: 是

差异:
--- 原始代码
+++ 修改后
@@ -150,7 +150,7 @@
-  const MAX_TURNS = 100;
+  const MAX_TURNS = 200;
```

#### 统计信息
```bash
$ automaton-cli audit --stats

=== 审计日志统计 ===

总修改数: 45
时间范围: 2026-02-01 至 2026-03-04

按类型分布:
  code_edit:       20 (44.4%)
  config_change:   10 (22.2%)
  tool_install:     8 (17.8%)
  code_revert:      5 (11.1%)
  other:            2 (4.4%)

可回滚: 42 (93.3%)
不可回滚: 3 (6.7%)
```

### 性能优化

1. **数据库查询优化**
   - 使用现有索引: `idx_modifications_type` (schema.ts:159)
   - 限制返回数量(默认20条)
   - 使用`ORDER BY timestamp DESC LIMIT ?`避免全表扫描

2. **内存优化**
   - 避免一次性加载所有记录
   - 大数据量时使用流式处理(如果需要)

3. **渲染优化**
   - 使用模板字符串而非字符串拼接
   - 避免重复计算

### 错误处理

```typescript
// 数据库访问失败
try {
  const mods = db.getRecentModifications(limit);
} catch (error) {
  console.error("数据库错误:", error.message);
  process.exit(1);
}

// 空数据集
if (modifications.length === 0) {
  console.log("没有找到审计日志记录");
  return;
}

// 无效参数
if (isNaN(limit) || limit <= 0) {
  console.error("错误: --limit 参数必须是正整数");
  process.exit(1);
}
```

### 与现有系统的整合

1. **不干扰现有功能**
   - 审计日志查询是只读操作
   - 不修改现有的`modifications`表结构
   - 不影响现有的`logModification()`功能

2. **保持一致性**
   - 使用与`automaton-cli logs`相同的参数风格
   - 使用与`automaton-cli status`相同的输出格式

3. **日志系统**
   - 审计日志是独立的,不与`observability/logger.ts`的日志系统混合
   - 审计日志关注修改历史,日志系统关注运行时事件

### 实施优先级

**第一阶段 (MVP - 1-2天):**
- [ ] Task 1 (CLI框架)
- [ ] Task 2 (数据访问)
- [ ] Task 3 (基础渲染)
- [ ] 基础测试

**第二阶段 (增强 - 1天):**
- [ ] Task 4 (类型过滤)
- [ ] Task 5 (统计信息)
- [ ] Task 6 (JSON导出)
- [ ] 颜色高亮

**第三阶段 (可选 - 按需):**
- [ ] Task 8-11 (高级过滤和导出)
- [ ] 完整测试覆盖

### 潜在风险和缓解

1. **数据库性能问题**
   - 缓解: 默认限制20条,添加分页提示

2. **数据格式不一致**
   - 缓解: 添加数据验证和错误处理

3. **用户体验不佳**
   - 缓解: 参考git log等成熟工具的输出格式

4. **依赖冲突**
   - 缓解: 使用项目已有的chalk,避免新增依赖

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Validation Notes

✅ **通过审核的要点:**
1. 遵循现有CLI架构和代码风格
2. 使用项目已有依赖,避免不必要的新增
3. 任务分解合理,优先级清晰
4. 考虑了性能、错误处理、用户体验
5. 与现有系统整合良好,无冲突

🔧 **优化改进:**
1. 简化了输出格式(使用纯文本而非复杂表格)
2. 明确了实施优先级(P0/P1/P2/P3)
3. 添加了详细的输出格式示例
4. 强调了与现有CLI命令的一致性
5. 移除了不必要的依赖建议(如cli-table3)

⚠️ **注意事项:**
1. 需要测试大数据量场景
2. 需要验证日期过滤的时区处理
3. 需要考虑diff字段为空的情况

### Debug Log References

### Completion Notes List

### File List

- `automaton/src/audit/audit-reader.ts`
- `automaton/packages/cli/src/commands/audit.ts`
- `automaton/packages/cli/src/index.ts` (更新 - 注册audit命令)
- `automaton/tests/audit/audit-reader.test.ts`
- `automaton/tests/audit/audit-cli.test.ts`
- `automaton/README.md` (更新CLI文档)
