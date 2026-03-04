# Story 2b.5: 备份与恢复功能

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a TinyClaw 系统管理员,
I want 实现完整的数据库和文件备份与恢复功能,
so that 在系统故障或数据损坏时能够快速恢复服务，确保数据不丢失。

## Acceptance Criteria

1. [实现数据库自动备份功能](#task-1-实现数据库自动备份功能)
2. [实现手动触发备份的API端点](#task-2-实现手动触发备份的api端点)
3. [实现备份文件的压缩和加密](#task-3-实现备份文件的压缩和加密)
4. [实现备份恢复功能](#task-4-实现备份恢复功能)
5. [实现备份管理界面](#task-5-实现备份管理界面)
6. [实现备份策略配置](#task-6-实现备份策略配置)
7. [实现备份验证和完整性检查](#task-7-实现备份验证和完整性检查)

## Detailed Requirements Analysis

### 背景与需求来源

根据 `docs/architecture-tinyclaw.md` 中的架构设计：

**核心数据组件：**
- **SQLite 数据库** (`tinyclaw.db`) - 存储所有队列消息、Agent状态、Team定义、任务、日志等
  - 数据库路径：`~/.tinyclaw/tinyclaw.db` (或通过 `TINYCLAW_HOME` 环境变量配置)
  - 表结构包括：`messages`, `responses`, `agent_state`, `teams`, `tasks`, `logs` 等

- **文件系统数据**：
  - 配置文件：`~/.tinyclaw/settings.json`, `tinyclaw.agents.json`, `tinyclaw.teams.json`
  - 聊天历史：`~/.tinyclaw/chats/`
  - 附件文件：`~/.tinyclaw/files/`
  - 日志文件：`~/.tinyclaw/logs/`

### 当前系统的恢复能力

根据代码分析，现有系统已经具备一些基础的恢复机制：

1. **消息恢复** (`recoverStaleMessages`)：
   - 在 `tinyclaw/src/lib/db.ts` 中实现
   - 自动恢复卡在 `processing` 状态超过 10 分钟的消息
   - 通过重置 `status` 为 `pending` 让消息重新被处理

2. **配置文件自动修复**：
   - 在 `tinyclaw/src/lib/config.ts` 中使用 `jsonrepair` 自动修复损坏的 JSON 配置
   - 创建 `.bak` 备份文件后写入修复的配置

3. **响应清理**：
   - `pruneAckedResponses()` - 清理已确认的响应
   - `pruneCompletedMessages()` - 清理已完成的消息

### 需要增强的备份与恢复能力

基于 Epic 2b 的规划，需要补充完整的备份与恢复系统：

**Epic 2b 规划中的相关故事：**
- 2b.5: 备份与恢复功能 ✅ (当前故事)
- 2b.8: 消息队列灾难恢复机制 - recoverStaleMessages() 从 SQLite 恢复处理中消息
- 2b.11: 数据库表设计与迁移
- 2b.12: 索引优化与查询性能

**备份策略需求：**
1. **全量备份** - 定期完整备份整个系统数据
2. **增量备份** - 只备份自上次备份以来的变化
3. **差异备份** - 基于基准备份的差异数据

**恢复场景：**
1. **完整恢复** - 恢复到特定时间点的完整状态
2. **部分恢复** - 只恢复特定组件（如只恢复数据库，不恢复文件）
3. **时间点恢复** - 恢复到指定的历史时间点
4. **灾难恢复** - 在系统完全崩溃后快速恢复

## Tasks / Subtasks

### Task 1: 实现数据库自动备份功能

- [ ] 1.1 设计备份文件命名规范（包含时间戳、备份类型）
- [ ] 1.2 实现定时备份任务调度器
- [ ] 1.3 实现 SQLite 数据库热备份（使用 `sqlite3_backup_init` 或文件复制）
- [ ] 1.4 实现备份文件轮转和清理策略
- [ ] 1.5 编写单元测试覆盖备份逻辑

### Task 2: 实现手动触发备份的API端点

- [ ] 2.1 设计 `/api/backup/trigger` POST 端点
- [ ] 2.2 实现备份触发逻辑（调用备份服务）
- [ ] 2.3 实现备份进度状态查询 `/api/backup/status`
- [ ] 2.4 实现备份历史记录查询 `/api/backup/history`
- [ ] 2.5 编写API集成测试

### Task 3: 实现备份文件的压缩和加密

- [ ] 3.1 选择压缩算法（如 gzip, bzip2, zstd）
- [ ] 3.2 实现备份文件压缩逻辑
- [ ] 3.3 选择加密方案（如 AES-256-GCM）
- [ ] 3.4 实现基于环境变量的加密密钥管理
- [ ] 3.5 实现加密备份文件的创建和解密验证
- [ ] 3.6 编写安全性测试

### Task 4: 实现备份恢复功能

- [ ] 4.1 设计恢复命令行工具（`tinyclaw restore <backup-file>`）
- [ ] 4.2 实现数据库恢复逻辑（替换并重启）
- [ ] 4.3 实现文件系统数据恢复（配置、聊天、附件）
- [ ] 4.4 实现恢复前的数据验证（完整性检查）
- [ ] 4.5 实现恢复过程的原子性保证（失败回滚）
- [ ] 4.6 编写恢复流程测试

### Task 5: 实现备份管理界面

- [ ] 5.1 设计备份管理页面 (`app/backups/page.tsx`)
- [ ] 5.2 实现备份列表表格（时间、大小、类型、状态）
- [ ] 5.3 实现备份文件预览和下载功能
- [ ] 5.4 实现手动备份按钮和进度指示器
- [ ] 5.5 实现备份文件删除功能（需要确认）
- [ ] 5.6 实现备份恢复向导界面
- [ ] 5.7 编写前端组件测试

### Task 6: 实现备份策略配置

- [ ] 6.1 在 `settings.json` 中添加备份配置节
- [ ] 6.2 设计配置字段：
  - `backup.enabled`: 是否启用自动备份
  - `backup.schedule`: 备份计划（cron 表达式或简单选项如 "daily", "hourly"）
  - `backup.retention`: 保留策略（如保留最近7天的每日备份、最近4周的每周备份）
  - `backup.location`: 备份存储位置（本地路径或远程存储）
  - `backup.compress`: 是否压缩备份
  - `backup.encrypt`: 是否加密备份
  - `backup.key`: 加密密钥（通过环境变量或密钥管理服务）
- [ ] 6.3 实现配置热重载和验证
- [ ] 6.4 在设置页面添加备份配置表单

### Task 7: 实现备份验证和完整性检查

- [ ] 7.1 实现备份文件完整性验证（校验和、数字签名）
- [ ] 7.2 实现备份恢复测试功能（沙箱环境中测试恢复）
- [ ] 7.3 实现备份健康监控（定期验证备份可用性）
- [ ] 7.4 实现备份失败告警（通过日志、邮件或消息通知）
- [ ] 7.5 编写验证测试

## Dev Notes

### Technical Implementation Guidance

#### 1. 数据库备份技术方案

**推荐方案：** 使用 SQLite 内置的备份API或WAL模式下的文件复制

**方案A：SQLite Backup API** (推荐)
```typescript
// 使用 better-sqlite3 的 backup 功能
const backupDb = new Database(backupPath);
sourceDb.backup(backupDb, {
  progress: (progress) => {
    // 监控进度
  }
});
backupDb.close();
```

**方案B：文件系统复制** (简单但需要停止写入)
```typescript
// 在事务安全的时刻复制文件
const backupPath = `${baseName}-${timestamp}.db`;
fs.copyFileSync(dbPath, backupPath);
// 同时复制 WAL 和 SHM 文件
fs.copyFileSync(`${dbPath}-wal`, `${backupPath}-wal`);
fs.copyFileSync(`${dbPath}-shm`, `${backupPath}-shm`);
```

**方案C：导出SQL脚本** (便于版本控制但恢复慢)
```typescript
// 导出为 SQL 脚本
const sql = db.serialize();
fs.writeFileSync(`${backupPath}.sql`, sql);
```

#### 2. 文件系统数据备份策略

**需要备份的目录和文件：**

| 路径 | 说明 | 备份策略 |
|------|------|---------|
| `~/.tinyclaw/tinyclaw.db` | SQLite 数据库 | 核心数据，必须备份 |
| `~/.tinyclaw/settings.json` | 全局配置 | 必须备份 |
| `~/.tinyclaw/tinyclaw.agents.json` | Agent 配置 | 必须备份 |
| `~/.tinyclaw/tinyclaw.teams.json` | Team 配置 | 必须备份 |
| `~/.tinyclaw/chats/` | 聊天历史 | 可选备份（大文件） |
| `~/.tinyclaw/files/` | 附件文件 | 可选备份（大文件） |
| `~/.tinyclaw/logs/` | 系统日志 | 可选备份（仅保留最近7天） |

**备份压缩方案：**
- 使用 `archiver` 库创建 `.tar.gz` 或 `.zip` 归档
- 对大文件进行分卷压缩（如每个分卷100MB）

#### 3. 加密方案

**推荐：** AES-256-GCM (认证加密)

```typescript
import crypto from 'crypto';

function encryptBackup(data: Buffer, key: string): Buffer {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBackup(encrypted: Buffer, key: string): Buffer {
  const iv = encrypted.slice(0, 16);
  const authTag = encrypted.slice(16, 32);
  const data = encrypted.slice(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
```

**密钥管理：**
- 通过环境变量 `TINYCLAW_BACKUP_KEY` 提供
- 或使用密钥管理服务（如 AWS KMS, Hashicorp Vault）
- 在配置文件中只存储密钥引用，不存储密钥本身

#### 4. 备份调度器设计

**推荐方案：** 使用 `node-cron` 或 `cron` 包

```typescript
import cron from 'node-cron';

class BackupScheduler {
  constructor(config: BackupConfig) {
    this.schedule = config.schedule;
    this.start();
  }

  start() {
    cron.schedule(this.schedule, async () => {
      await this.performBackup();
    });
  }

  async performBackup() {
    try {
      // 执行备份逻辑
      const backupFile = await createBackup();
      // 记录成功
      this.logBackup(backupFile, 'success');
    } catch (error) {
      // 记录失败
      this.logBackup(null, 'failed', error);
      // 可选：发送告警
      this.sendAlert(error);
    }
  }
}
```

#### 5. 备份轮转和清理策略

**保留策略实现：**

```typescript
interface RetentionPolicy {
  daily: number;    // 保留最近 N 天的每日备份
  weekly: number;   // 保留最近 N 周的每周备份
  monthly: number;  // 保留最近 N 月的每月备份
  maxTotal: number; // 最多保留 N 个备份
}

async function cleanupOldBackups(policy: RetentionPolicy) {
  const backups = await getBackupFiles();

  // 按时间排序
  backups.sort((a, b) => b.timestamp - a.timestamp);

  // 保留最新的
  const toKeep = backups.slice(0, policy.maxTotal);

  // 删除旧的
  const toDelete = backups.slice(policy.maxTotal);
  await Promise.all(toDelete.map(f => fs.unlink(f.path)));
}
```

### Project Structure Notes

#### 新增文件位置

**后端：**
```
tinyclaw/src/
├── backup/                      # 备份功能核心模块
│   ├── index.ts                # 备份服务主入口
│   ├── scheduler.ts            # 备份调度器
│   ├── backup.ts               # 备份执行逻辑
│   ├── restore.ts              # 恢复执行逻辑
│   ├── encrypt.ts              # 加密/解密工具
│   ├── compress.ts             # 压缩/解压工具
│   ├── validate.ts             # 备份验证工具
│   └── types.ts                # 备份相关类型定义
├── lib/
│   └── (现有文件)
└── server/routes/
    ├── backup.ts              # 备份管理API路由
    └── (现有路由)
```

**前端：**
```
tinyclaw/tinyoffice/app/
├── backups/
│   ├── page.tsx              # 备份管理页面
│   ├── components/
│   │   ├── BackupList.tsx    # 备份列表组件
│   │   ├── BackupItem.tsx    # 备份项组件
│   │   ├── RestoreWizard.tsx # 恢复向导组件
│   │   └── BackupForm.tsx    # 备份配置表单
│   └── hooks/
│       └── useBackups.ts     # 备份数据hook
└── settings/
    └── components/
        └── BackupSettings.tsx # 备份配置组件
```

#### 配置文件变更

**tinyclaw.settings.json 新增节：**

```json
{
  "backup": {
    "enabled": true,
    "schedule": "0 2 * * *",  // 每天凌晨2点
    "location": "~/.tinyclaw/backups",
    "compress": true,
    "encrypt": true,
    "retention": {
      "daily": 7,
      "weekly": 4,
      "monthly": 12,
      "maxTotal": 50
    },
    "validateInterval": "7d",  // 每7天验证一次
    "alertOnFailure": true
  }
}
```

### Architecture Compliance

#### 遵循的设计模式

1. **服务模式** - `BackupService` 作为独立服务模块
2. **策略模式** - 备份策略可配置（全量/增量/差异）
3. **工厂模式** - 备份文件命名和格式工厂
4. **观察者模式** - 备份进度事件通知
5. **单例模式** - 备份调度器单例

#### 与现有架构集成

**与队列处理器集成：**
- 在 `queue-processor.ts` 中初始化备份调度器
- 备份操作不应阻塞消息处理（异步执行）
- 在系统关闭时等待备份完成

**与API服务器集成：**
- 在 `src/server/index.ts` 中注册备份路由
- 提供 SSE 事件流用于实时进度更新
- 支持 CORS 和认证（如果启用）

**与日志系统集成：**
- 使用现有 `log()` 函数记录备份操作
- 通过 `emitEvent()` 发送备份事件到前端
- 在日志中包含备份文件大小、耗时等指标

### Security Considerations

1. **加密密钥保护**
   - 密钥不应硬编码在源码中
   - 使用环境变量或密钥管理服务
   - 定期轮换加密密钥

2. **备份文件访问控制**
   - 备份文件应设置适当权限（600）
   - 限制备份目录的访问
   - 远程存储时使用安全传输协议（S3, SSH）

3. **API安全**
   - 备份触发端点需要认证
   - 防止未授权访问和恶意触发
   - 限制备份文件下载权限

4. **审计日志**
   - 记录所有备份和恢复操作
   - 包括操作者、时间、文件、结果
   - 用于安全审计和故障排查

### Performance Considerations

1. **备份性能优化**
   - 使用增量备份减少数据量
   - 异步执行避免阻塞主流程
   - 在低峰期执行（如凌晨2点）

2. **压缩率与速度平衡**
   - 选择合适的压缩级别（如 gzip level 6）
   - 对大文件使用流式压缩
   - 考虑使用 zstd 获得更好的压缩比

3. **磁盘I/O优化**
   - 使用 SSD 存储备份文件
   - 避免与数据库文件同一磁盘
   - 使用 `fs.copyFile()` 而非 `fs.readFile()` + `fs.writeFile()`

4. **内存管理**
   - 流式处理大文件避免内存溢出
   - 及时释放不再需要的资源
   - 监控备份过程的内存使用

### Testing Strategy

**单元测试：**
- 备份逻辑 (`backup.test.ts`)
- 恢复逻辑 (`restore.test.ts`)
- 加密/解密 (`encrypt.test.ts`)
- 压缩/解压 (`compress.test.ts`)
- 验证逻辑 (`validate.test.ts`)

**集成测试：**
- 完整备份流程 (`backup.integration.test.ts`)
- 恢复流程 (`restore.integration.test.ts`)
- API端点 (`backup-api.test.ts`)

**E2E测试：**
- 从UI触发备份并验证文件
- 执行恢复并验证数据完整性
- 备份策略自动执行验证

### Dependencies to Add

```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.0",
    "archiver": "^7.0.0",      // 文件压缩
    "node-cron": "^3.0.0",     // 定时任务
    "fast-glob": "^3.3.0"      // 文件查找
  },
  "devDependencies": {
    "@types/archiver": "^6.0.0",
    "@types/node-cron": "^3.0.0"
  }
}
```

### References

- [Source: docs/architecture-tinyclaw.md#370-464] - SQLite 数据库设计和表结构
- [Source: tinyclaw/src/lib/db.ts] - 现有数据库操作和 recoverStaleMessages 实现
- [Source: tinyclaw/src/lib/config.ts#31-36] - 配置文件自动修复和备份机制
- [Source: docs/upwork_autopilot_detailed_design.md#341-360] - 数据库表设计和ER关系
- [Source: Epic 2b 规划] - 2b.5 备份与恢复功能需求
- [Source: Epic 2b.8] - 消息队列灾难恢复机制
- [Source: Epic 2b.11-12] - 数据库表设计与索引优化

### Previous Story Intelligence

**相关故事：** 无（这是 Epic 2b 的第一个故事）

### Git Intelligence Summary

**最近提交分析：**
- 飞书集成已完成（commit: `ee7fe81`）
- 国产大模型支持已添加（commit: `c9a703d`）
- 多渠道客户端基础架构已建立

**技术栈趋势：**
- TypeScript 严格模式
- Hono API 框架
- better-sqlite3 数据库
- Next.js 16 + React 19 前端

### Latest Tech Information

**当前技术版本（2026-03）：**
- Node.js: >=20.0.0 (项目要求)
- TypeScript: 最新稳定版
- SQLite: 3.x (通过 better-sqlite3)
- 加密库: Node.js crypto (内置)
- 压缩库: archiver 7.x, zstd 可选

**备份最佳实践（2026）：**
- 使用 AES-256-GCM 进行认证加密
- 采用 3-2-1 备份策略（3份副本，2种介质，1份离线）
- 定期验证备份可恢复性
- 监控备份作业成功/失败
- 自动化备份和恢复流程

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- [ ] 确认备份策略配置与用户需求一致
- [ ] 验证加密方案的安全性和性能
- [ ] 测试大数据量备份的稳定性
- [ ] 确保恢复流程的原子性和一致性
- [ ] 编写完整的用户文档

### File List

#### 后端文件

- `tinyclaw/src/backup/index.ts`
- `tinyclaw/src/backup/scheduler.ts`
- `tinyclaw/src/backup/backup.ts`
- `tinyclaw/src/backup/restore.ts`
- `tinyclaw/src/backup/encrypt.ts`
- `tinyclaw/src/backup/compress.ts`
- `tinyclaw/src/backup/validate.ts`
- `tinyclaw/src/backup/types.ts`
- `tinyclaw/src/server/routes/backup.ts`

#### 前端文件

- `tinyclaw/tinyoffice/app/backups/page.tsx`
- `tinyclaw/tinyoffice/app/backups/components/BackupList.tsx`
- `tinyclaw/tinyoffice/app/backups/components/BackupItem.tsx`
- `tinyclaw/tinyoffice/app/backups/components/RestoreWizard.tsx`
- `tinyclaw/tinyoffice/app/backups/components/BackupForm.tsx`
- `tinyclaw/tinyoffice/app/backups/hooks/useBackups.ts`
- `tinyclaw/tinyoffice/app/settings/components/BackupSettings.tsx`

#### 配置文件

- 更新 `tinyclaw.settings.json` 添加 backup 节

#### 测试文件

- `tinyclaw/src/backup/__tests__/backup.test.ts`
- `tinyclaw/src/backup/__tests__/restore.test.ts`
- `tinyclaw/src/backup/__tests__/encrypt.test.ts`
- `tinyclaw/src/backup/__tests__/compress.test.ts`
- `tinyclaw/src/backup/__tests__/validate.test.ts`
- `tinyclaw/src/backup/__tests__/scheduler.test.ts`
- `tinyclaw/src/server/routes/__tests__/backup-api.test.ts`

#### 文档文件

- `tinyclaw/docs/backup-guide.md` (用户指南)
- `tinyclaw/docs/backup-architecture.md` (架构文档)

---

**Story Completion Status:**
- [x] Story requirements extracted from epics
- [x] Architecture analysis completed
- [x] Technical requirements defined
- [x] File structure planned
- [x] Dev context provided
- [x] Previous story intelligence checked
- [x] Git intelligence analyzed
- [ ] Ready for implementation

**Ultimate context engine analysis completed - comprehensive developer guide created**
