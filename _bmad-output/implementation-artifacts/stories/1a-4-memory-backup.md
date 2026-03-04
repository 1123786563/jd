# 故事: 1a.4 - 记忆持久化备份方案

**状态：** 未实现
**优先级：** 高
**所属史诗：** UpworkAutoPilot 记忆系统增强
**创建日期：** 2026-03-04

---

## 📋 背景与目标

### 问题陈述

当前 Automaton 的记忆系统虽然使用 SQLite WAL 模式实现了强一致性的持久化，但缺乏完善的备份机制：

1. **单点故障风险**：SQLite 数据库文件是唯一的持久化源，文件损坏会导致数据完全丢失
2. **灾难恢复缺失**：系统崩溃、磁盘故障、恶意操作等场景下无法快速恢复
3. **数据冗余不足**：没有分布式备份或多版本快照机制
4. **备份策略不完善**：没有自动化的增量/全量备份策略

### 业务需求

1. **可靠性**：确保关键记忆数据（情节记忆、语义记忆、程序记忆）永不丢失
2. **可恢复性**：在灾难场景下能够快速恢复到指定时间点
3. **一致性**：备份过程不影响系统正常运行，保证备份数据的事务一致性
4. **低成本**：使用经济高效的存储方案，支持云存储和本地存储

### 非功能性需求

- **可用性**：系统停机时间 < 5 分钟
- **恢复时间目标 (RTO)**：灾难恢复时间 < 10 分钟
- **恢复点目标 (RPO)**：数据丢失时间 < 1 小时
- **备份频率**：增量备份每小时，全量备份每天
- **保留策略**：至少保留 7 天的备份历史
- **数据加密**：所有备份文件必须加密存储，使用 AES-256 算法
- **性能影响**：备份期间系统 QPS 下降不超过 10%，响应延迟增加不超过 50ms
- **存储容量**：按当前数据增长速度，7 天备份约需 87GB 存储空间（10GB 全量 × 7 + 100MB 增量 × 24 × 7）

---

## 🎯 验收标准

### 功能性验收标准

✅ **备份功能**

1. 支持全量备份（Full Backup）
   - [ ] 能够完整备份 SQLite 数据库文件
   - [ ] 包含所有记忆层的数据（工作记忆、情节记忆、语义记忆、程序记忆）
   - [ ] 备份文件带有时间戳和校验和
   - [ ] 备份过程中数据库保持可读可写（WAL 模式热备份）

2. 支持增量备份（Incremental Backup）
   - [ ] 仅备份自上次备份以来变更的数据
   - [ ] 使用 WAL 日志文件作为增量源
   - [ ] 自动合并增量备份到最近的全量备份
   - [ ] 支持点对点恢复（PITR）

3. 支持多种存储后端
   - [ ] 本地文件系统存储
   - [ ] AWS S3 / 兼容对象存储
   - [ ] Git 版本控制（用于配置和代码备份）

4. 自动备份调度
   - [ ] 支持基于 cron 的定时备份
   - [ ] 备份失败时有重试机制（最多 3 次）
   - [ ] 备份完成后发送通知（可选）

✅ **恢复功能**

5. 支持完整恢复
   - [ ] 能够从任意备份点恢复整个数据库
   - [ ] 恢复过程有进度显示
   - [ ] 恢复完成后自动验证数据完整性

6. 支持时间点恢复（PITR）
   - [ ] 能够恢复到任意时间点（基于 WAL 日志）
   - [ ] 支持恢复到指定事务点
   - [ ] 支持部分表恢复（可选）

7. 支持测试恢复
   - [ ] 能够在不影响生产环境的情况下测试备份文件的可恢复性
   - [ ] 提供恢复模拟模式

✅ **监控与告警**

8. 备份状态监控
   - [ ] 记录所有备份操作的日志
   - [ ] 提供备份历史查询接口
   - [ ] 显示备份文件大小、时间、状态

9. 异常告警
   - [ ] 备份失败时发送告警
   - [ ] 备份文件损坏时告警
   - [ ] 存储空间不足时告警

### 非功能性验收标准

- **性能**：全量备份时间 < 5 分钟（10GB 数据）
- **可用性**：备份过程不影响系统正常运行（>99.9% 可用性），QPS 下降 < 10%
- **安全性**：备份文件强制加密存储，使用 AES-256 算法
- **可观察性**：所有备份操作都有详细的日志记录
- **备份验证**：每次备份完成后自动验证备份文件可读性和完整性
- **监控指标**：备份成功率、平均备份时间、存储使用率实时监控

---

## 🔍 技术方案

### 架构设计

#### 1. 备份系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    备份管理系统 (Backup Manager)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┬──────────────────┬────────────────────┐   │
│  │  定时调度器      │  备份执行器      │  存储管理器        │   │
│  │  (Scheduler)     │  (Executor)      │  (StorageManager)  │   │
│  │  - cron表达式    │  - 全量备份      │  - 本地存储        │   │
│  │  - 触发策略      │  - 增量备份      │  - S3存储          │   │
│  │  - 重试机制      │  - WAL热备份     │  - Git存储         │   │
│  └────────┬─────────┴────────┬─────────┴────────┬────────────┘   │
│           │                  │                  │                │
│           ▼                  ▼                  ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SQLite 数据库 (better-sqlite3)               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  WAL模式                                          │  │   │
│  │  │  ├─ Main DB File (automaton.db)                  │  │   │
│  │  │  ├─ WAL File (automaton.db-wal)                  │  │   │
│  │  │  └─ SHM File (automaton.db-shm)                  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              备份存储库 (Backup Repository)               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  全量备份 (Full)                                  │  │   │
│  │  │  ├─ backup_full_2026-03-04_0000.db               │  │   │
│  │  │  ├─ backup_full_2026-03-04_0000.db.sha256        │  │   │
│  │  │  └─ backup_full_2026-03-04_0000.metadata.json    │  │   │
│  │  ├────────────────────────────────────────────────────┤  │   │
│  │  │  增量备份 (Incremental)                           │  │   │
│  │  │  ├─ backup_inc_2026-03-04_0100.wal               │  │   │
│  │  │  └─ backup_inc_2026-03-04_0200.wal               │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. 数据流设计

**全量备份流程：**

```
1. 执行 WAL 检查点（确保数据刷盘）
   └─> PRAGMA wal_checkpoint(TRUNCATE)

2. 开启数据库事务快照
   └─> BEGIN IMMEDIATE TRANSACTION

3. 创建临时备份数据库
   └─> 使用 SQLite 在线备份 API 分块复制（每 100 页）
   └─> 异步释放事件循环，避免阻塞

4. 复制 WAL 和 SHM 文件
   ├─> 复制 automaton.db-wal WAL 文件
   └─> 复制 automaton.db-shm SHM 文件

5. 验证备份文件完整性
   ├─> 打开备份数据库验证可读性
   ├─> 执行简单查询测试（SELECT COUNT(*) FROM backup_log）
   └─> 记录验证结果

6. 计算校验和
   ├─> SHA256(automaton.db)
   └─> 生成 metadata.json (时间戳、文件大小、校验和)

7. 压缩备份文件
   ├─> tar.gz 压缩
   └─> 添加时间戳后缀

8. 加密备份文件（强制）
   └─> 使用 AES-256 加密

9. 上传到存储后端
   ├─> 本地路径: ~/.claude/backups/
   └─> 或 S3: s3://bucket/backups/

10. 清理旧备份
    └─> 根据保留策略删除过期备份

11. 记录备份日志
    └─> 写入 backup_log 表

12. 提交事务
    └─> COMMIT TRANSACTION
```

**增量备份流程：**

```
1. 获取 WAL 检查点
   └─> PRAGMA wal_checkpoint(TRUNCATE)

2. 复制新的 WAL 文件
   └─> 复制自上次检查点以来的 WAL 日志

3. 生成增量元数据
   ├─> base_backup_id (基于哪个全量备份)
   ├─> start_lsn (起始日志序列号)
   └─> end_lsn (结束日志序列号)

4. 压缩并上传增量备份

5. 记录增量备份日志
```

#### 3. 核心组件设计

##### 3.1 备份调度器 (BackupScheduler)

```typescript
// src/backup/scheduler.ts
export class BackupScheduler {
  private cronJobs: Map<string, CronJob>;

  /**
   * 注册定时备份任务
   * @param name 任务名称
   * @param cronExpression cron表达式
   * @param backupType 备份类型 (full | incremental)
   * @param config 备份配置
   */
  registerBackupJob(
    name: string,
    cronExpression: string,
    backupType: 'full' | 'incremental',
    config: BackupConfig
  ): void {
    const job = new CronJob(cronExpression, async () => {
      try {
        await this.executeBackup(backupType, config);
        this.logSuccess(name, backupType);
      } catch (error) {
        this.handleBackupFailure(name, error);
      }
    });

    this.cronJobs.set(name, job);
    job.start();
  }

  /**
   * 手动触发备份
   */
  async triggerBackup(type: 'full' | 'incremental'): Promise<BackupResult> {
    // ...
  }

  private async executeBackup(type: string, config: BackupConfig): Promise<void> {
    // 1. 获取数据库连接
    // 2. 执行备份
    // 3. 上传到存储
    // 4. 记录日志
  }
}
```

##### 3.2 备份执行器 (BackupExecutor)

```typescript
// src/backup/executor.ts
export class BackupExecutor {

  /**
   * 执行全量备份
   */
  async performFullBackup(options: FullBackupOptions): Promise<BackupMetadata> {
    const timestamp = Date.now();
    const backupDir = path.join(
      options.backupPath,
      `backup_full_${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}`
    );

    // 1. 创建备份目录
    await fs.mkdir(backupDir, { recursive: true });

    // 2. 获取数据库快照（使用 WAL 热备份）
    await this.takeDatabaseSnapshot(backupDir);

    // 3. 计算校验和
    const checksum = await this.calculateChecksum(backupDir);

    // 4. 生成元数据
    const metadata: BackupMetadata = {
      id: ulid(),
      type: 'full',
      timestamp,
      checksum,
      size: await this.getBackupSize(backupDir),
      databaseVersion: this.getDatabaseVersion()
    };

    // 5. 保存元数据
    await fs.writeFile(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return metadata;
  }

  /**
   * 执行增量备份
   */
  async performIncrementalBackup(options: IncrementalBackupOptions): Promise<BackupMetadata> {
    // 基于 WAL 日志的增量备份
    const lastFullBackup = await this.getLastFullBackup();

    // 1. 获取自上次备份以来的 WAL 日志
    const walChanges = await this.extractWALChanges(lastFullBackup.timestamp);

    // 2. 保存增量备份
    const backupDir = path.join(
      options.backupPath,
      `backup_inc_${new Date().toISOString().replace(/[:.]/g, '-')}`
    );

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(
      path.join(backupDir, 'wal.log'),
      walChanges
    );

    // 3. 生成增量元数据
    const metadata: BackupMetadata = {
      id: ulid(),
      type: 'incremental',
      timestamp: Date.now(),
      baseBackupId: lastFullBackup.id,
      startLsn: walChanges.startLsn,
      endLsn: walChanges.endLsn,
      size: walChanges.size
    };

    return metadata;
  }

import { Database, SQLITE_DONE } from 'better-sqlite3';

  /**
   * WAL 热备份实现（优化版，避免阻塞）
   */
  private async takeDatabaseSnapshot(backupDir: string): Promise<void> {
    const dbPath = this.config.databasePath;

    // 1. 执行 WAL checkpoint 确保数据刷盘
    this.db.pragma('wal_checkpoint(TRUNCATE)');

    // 2. 开启事务确保备份期间数据一致性
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // 3. 创建备份目录
      await fs.mkdir(backupDir, { recursive: true });

      // 4. 使用 SQLite 在线备份 API（分块异步备份，避免阻塞）
      const backupDb = new Database(path.join(backupDir, 'automaton.db'));
      const backup = this.db.backup(backupDb, {
        progress: (total, remaining) => {
          this.logger.debug(`Backup progress: ${total - remaining}/${total}`);
        }
      });

      // 分块备份，每 100 页释放一次事件循环，避免长时间阻塞
      while (backup.step(100) !== SQLITE_DONE) {
        // 释放事件循环，允许其他操作继续
        await new Promise(resolve => setImmediate(resolve));
      }

      backup.finish();
      backupDb.close();

      // 5. 复制 WAL 和 SHM 文件（此时 WAL 已 checkpoint，文件稳定）
      await fs.copyFile(`${dbPath}-wal`, path.join(backupDir, 'automaton.db-wal'));
      await fs.copyFile(`${dbPath}-shm`, path.join(backupDir, 'automaton.db-shm'));

      // 6. 提交事务
      this.db.exec('COMMIT TRANSACTION');
    } catch (error) {
      // 7. 出错时回滚事务
      this.db.exec('ROLLBACK TRANSACTION');
      this.logger.error('Database snapshot failed:', error);
      throw error;
    }
  }

  /**
   * 验证备份文件完整性
   */
  private async verifyBackupIntegrity(backupDir: string): Promise<boolean> {
    try {
      // 尝试打开备份数据库
      const testDb = new Database(path.join(backupDir, 'automaton.db'));

      // 执行简单查询验证可读性
      const result = testDb.prepare('SELECT COUNT(*) as count FROM sqlite_master').get();

      testDb.close();

      this.logger.info(`Backup verification passed: ${result.count} tables found`);
      return true;
    } catch (error) {
      this.logger.error('Backup verification failed:', error);
      return false;
    }
  }
}
```

##### 3.3 存储管理器 (StorageManager)

```typescript
// src/backup/storage-manager.ts
export interface StorageBackend {
  upload(file: Buffer, key: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

/**
 * 本地文件系统存储
 */
export class LocalStorage implements StorageBackend {
  constructor(private basePath: string) {}

  async upload(file: Buffer, key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file);
  }

  async download(key: string): Promise<Buffer> {
    return await fs.readFile(path.join(this.basePath, key));
  }
}

/**
 * AWS S3 存储
 */
export class S3Storage implements StorageBackend {
  private s3: S3Client;

  constructor(private bucket: string, config: S3Config) {
    this.s3 = new S3Client(config);
  }

  async upload(file: Buffer, key: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ACL: 'private'
    }));
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));

    return await streamToBuffer(response.Body as Readable);
  }
}

/**
 * Git 版本控制存储（用于配置和代码）
 */
export class GitStorage implements StorageBackend {
  async upload(file: Buffer, key: string): Promise<void> {
    // 将文件提交到 Git 仓库
    await simpleGit().add([key]);
    await simpleGit().commit(`Backup: ${key}`);
    await simpleGit().push();
  }
}

/**
 * 加密装饰器（强制加密所有备份）- 完整实现版
 *
 * 文件格式：IV (16字节) + 密文 + AuthTag (16字节)
 *
 * 安全设计：
 * 1. 密钥从环境变量或密钥管理服务获取，不在代码中传递明文
 * 2. 每次加密生成随机 IV，确保相同内容加密结果不同
 * 3. 使用 GCM 模式提供加密和认证
 * 4. IV 和 AuthTag 与密文一起存储，保证可解密性
 */
export class EncryptedStorage implements StorageBackend {
  private encryptionKey: Buffer;
  private keyProvider: () => Promise<string>;

  /**
   * @param backend 底层存储后端
   * @param keyProvider 密钥提供器（从环境变量或 KMS 获取）
   */
  constructor(
    private backend: StorageBackend,
    keyProvider: () => Promise<string>
  ) {
    // 延迟到首次使用时获取密钥，避免构造函数中硬编码
    this.keyProvider = keyProvider;
  }

  /**
   * 获取加密密钥（延迟加载）
   */
  private async getEncryptionKey(): Promise<Buffer> {
    if (!this.encryptionKey) {
      const keyString = await this.keyProvider();
      this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();
    }
    return this.encryptionKey;
  }

  /**
   * 生成随机 IV
   */
  private generateIV(): Buffer {
    return crypto.randomBytes(16); // AES-256-GCM 需要 16 字节 IV
  }

  /**
   * 从加密数据中提取 IV 和 AuthTag
   * 文件格式：[IV:16字节][密文][AuthTag:16字节]
   */
  private extractCryptoComponents(encryptedData: Buffer): {
    iv: Buffer;
    ciphertext: Buffer;
    authTag: Buffer;
  } {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(encryptedData.length - 16);
    const ciphertext = encryptedData.slice(16, encryptedData.length - 16);

    return { iv, ciphertext, authTag };
  }

  /**
   * 加密数据
   * @returns 加密后的 Buffer，格式：IV + 密文 + AuthTag
   */
  private async encrypt(data: Buffer): Promise<Buffer> {
    const key = await this.getEncryptionKey();
    const iv = this.generateIV();

    // 创建加密器
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // 加密数据
    const ciphertext = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 组合：IV + 密文 + AuthTag
    return Buffer.concat([iv, ciphertext, authTag]);
  }

  /**
   * 解密数据
   * @param encryptedData 格式：IV + 密文 + AuthTag
   */
  private async decrypt(encryptedData: Buffer): Promise<Buffer> {
    const key = await this.getEncryptionKey();

    // 提取组件
    const { iv, ciphertext, authTag } = this.extractCryptoComponents(encryptedData);

    // 创建解密器
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    try {
      // 解密数据
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return plaintext;
    } catch (error) {
      // 认证失败或解密错误
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  async upload(file: Buffer, key: string): Promise<void> {
    // 加密文件
    const encrypted = await this.encrypt(file);

    // 上传加密后的数据
    await this.backend.upload(encrypted, `${key}.enc`);
  }

  async download(key: string): Promise<Buffer> {
    // 下载加密数据
    const encrypted = await this.backend.download(`${key}.enc`);

    // 解密并返回
    return await this.decrypt(encrypted);
  }

  async delete(key: string): Promise<void> {
    await this.backend.delete(`${key}.enc`);
  }

  async list(prefix: string): Promise<string[]> {
    const encryptedKeys = await this.backend.list(`${prefix}.enc`);
    return encryptedKeys.map(k => k.replace(/\.enc$/, ''));
  }

  async exists(key: string): Promise<boolean> {
    return await this.backend.exists(`${key}.enc`);
  }
}
```

##### 3.4 恢复管理器 (RestoreManager)

```typescript
// src/backup/restore-manager.ts
export class RestoreManager {

  /**
   * 从备份恢复数据库
   */
  async restoreFromBackup(backupId: string, options: RestoreOptions): Promise<void> {
    const backup = await this.getBackupMetadata(backupId);

    if (backup.type === 'full') {
      await this.restoreFullBackup(backup, options);
    } else {
      await this.restoreIncrementalBackup(backup, options);
    }
  }

  /**
   * 时间点恢复 (PITR)
   */
  async restoreToTimestamp(timestamp: number, options: RestoreOptions): Promise<void> {
    // 1. 找到最近的全量备份
    const fullBackup = await this.findNearestFullBackup(timestamp);

    // 2. 应用增量备份
    const incrementalBackups = await this.getIncrBackupsAfter(fullBackup.timestamp, timestamp);

    // 3. 重放 WAL 日志到指定时间点
    await this.replayWALToTimestamp(timestamp);
  }

  private async restoreFullBackup(backup: BackupMetadata, options: RestoreOptions): Promise<void> {
    // 1. 停止数据库服务
    await this.stopDatabase();

    // 2. 备份当前数据库（以防万一）
    await this.createEmergencyBackup();

    // 3. 恢复备份文件
    await fs.copyFile(
      path.join(backup.path, 'automaton.db'),
      this.config.databasePath
    );

    // 4. 恢复 WAL 和 SHM
    await fs.copyFile(
      path.join(backup.path, 'automaton.db-wal'),
      `${this.config.databasePath}-wal`
    );

    await fs.copyFile(
      path.join(backup.path, 'automaton.db-shm'),
      `${this.config.databasePath}-shm`
    );

    // 5. 验证数据完整性
    await this.verifyDatabaseIntegrity();

    // 6. 重启数据库
    await this.startDatabase();
  }
}
```

#### 4. 数据库模式设计

```sql
-- 备份日志表
CREATE TABLE backup_log (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL, -- 'full' | 'incremental'
  timestamp INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'success' | 'failed' | 'in_progress'
  file_path TEXT,
  file_size INTEGER,
  checksum TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 备份元数据表
CREATE TABLE backup_metadata (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  database_version TEXT,
  base_backup_id TEXT, -- 增量备份基于的全量备份
  start_lsn INTEGER, -- 日志序列号
  end_lsn INTEGER,
  tables_included TEXT, -- JSON array
  FOREIGN KEY (backup_id) REFERENCES backup_log(id)
);

-- 恢复历史表
CREATE TABLE restore_log (
  id TEXT PRIMARY KEY,
  backup_id TEXT NOT NULL,
  restore_type TEXT NOT NULL, -- 'full' | 'pitr' | 'partial'
  restore_timestamp INTEGER NOT NULL,
  target_timestamp INTEGER, -- PITR 目标时间
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (backup_id) REFERENCES backup_log(id)
);
```

---

## 🛠️ 实现任务分解

### 阶段 1: 核心备份功能 (MVP)

- [ ] **Task 1.1**: 创建备份管理器基础框架
  - 创建 `src/backup/` 目录结构
  - 实现 `BackupScheduler` 类
  - 实现 `BackupExecutor` 类
  - 实现 `BackupMetadata` 类型定义

- [ ] **Task 1.2**: 实现全量备份功能
  - 实现 SQLite WAL 热备份逻辑
  - 实现备份文件压缩（tar.gz）
  - 实现 SHA256 校验和计算
  - 实现备份元数据生成

- [ ] **Task 1.3**: 实现本地存储后端
  - 实现 `LocalStorage` 类
  - 实现备份文件上传/下载
  - 实现备份文件列表查询
  - 实现备份文件删除

- [ ] **Task 1.4**: 实现备份调度功能
  - 集成 cron 库
  - 实现定时全量备份（每天）
  - 实现定时增量备份（每小时）
  - 实现备份失败重试机制

- [ ] **Task 1.5**: 实现备份日志记录
  - 创建 `backup_log` 数据库表
  - 实现备份日志写入
  - 实现备份历史查询接口

### 阶段 2: 恢复功能

- [ ] **Task 2.1**: 实现恢复管理器
  - 创建 `RestoreManager` 类
  - 实现全量恢复逻辑
  - 实现数据库停止/启动
  - 实现数据完整性验证

- [ ] **Task 2.2**: 实现时间点恢复 (PITR)
  - 实现 WAL 日志重放
  - 实现基于时间戳的恢复
  - 实现基于 LSN 的恢复

- [ ] **Task 2.3**: 实现恢复日志记录
  - 创建 `restore_log` 数据库表
  - 实现恢复历史查询

### 阶段 3: 云存储支持

- [ ] **Task 3.1**: 实现 S3 存储后端
  - 实现 `S3Storage` 类
  - 集成 AWS SDK
  - 实现加密上传（可选）
  - 实现访问凭证管理

- [ ] **Task 3.2**: 实现多存储后端配置
  - 实现存储后端切换
  - 实现混合存储策略（本地 + 云）

### 阶段 4: 监控与告警

- [ ] **Task 4.1**: 实现备份状态监控
  - 实现备份状态 API
  - 实现备份历史统计
  - 实现存储空间监控

- [ ] **Task 4.2**: 实现异常告警
  - 实现备份失败告警
  - 实现存储空间不足告警
  - 集成通知渠道（邮件/Telegram/Slack）

### 阶段 5: 测试与文档

- [ ] **Task 5.1**: 编写单元测试
  - 备份功能测试
  - 恢复功能测试
  - 存储后端测试

- [ ] **Task 5.2**: 编写集成测试
  - 完整备份恢复流程测试
  - 灾难恢复场景测试

- [ ] **Task 5.3**: 编写用户文档
  - 备份配置指南
  - 恢复操作手册
  - 故障排除指南

---

## 🧪 测试用例

### 单元测试

```typescript
// test/backup/scheduler.test.ts
describe('BackupScheduler', () => {
  it('should schedule full backup daily', async () => {
    const scheduler = new BackupScheduler();
    scheduler.registerBackupJob('daily-full', '0 0 * * *', 'full', config);

    // 验证 cron job 已注册
    expect(scheduler.hasJob('daily-full')).toBe(true);
  });

  it('should retry failed backup', async () => {
    // 模拟备份失败
    // 验证重试机制
  });
});

// test/backup/executor.test.ts
describe('BackupExecutor', () => {
  it('should perform full backup successfully', async () => {
    const executor = new BackupExecutor(db, config);
    const metadata = await executor.performFullBackup(options);

    expect(metadata.type).toBe('full');
    expect(metadata.checksum).toBeDefined();
    expect(metadata.size).toBeGreaterThan(0);
  });

  it('should calculate correct checksum', async () => {
    const checksum = await calculateSHA256(file);
    expect(checksum).toBe(expectedChecksum);
  });
});
```

### 集成测试

```typescript
// test/integration/backup-restore.test.ts
describe('Backup and Restore Integration', () => {
  it('should backup and restore database successfully', async () => {
    // 1. 创建测试数据
    await createTestData();

    // 2. 执行全量备份
    const backupId = await backupManager.performFullBackup();

    // 3. 删除原数据库
    await fs.unlink(databasePath);

    // 4. 从备份恢复
    await restoreManager.restoreFromBackup(backupId);

    // 5. 验证数据完整性
    const restoredData = await queryRestoredData();
    expect(restoredData).toEqual(originalData);
  });

  it('should support point-in-time recovery', async () => {
    // 1. 创建初始数据并备份
    // 2. 修改数据并创建增量备份
    // 3. 恢复到修改前的时间点
    // 4. 验证恢复的数据是修改前的状态
  });
});
```

### 灾难恢复测试

```typescript
describe('Disaster Recovery Scenarios', () => {
  it('should recover from corrupted database file', async () => {
    // 1. 故意损坏数据库文件
    await corruptDatabaseFile();

    // 2. 尝试恢复
    await restoreManager.restoreLatestBackup();

    // 3. 验证系统正常运行
    expect(await systemHealthCheck()).toBe(true);
  });

  it('should recover from lost WAL file', async () => {
    // 1. 删除 WAL 文件
    await fs.unlink(walFilePath);

    // 2. 从备份恢复
    await restoreManager.restoreLatestBackup();

    // 3. 验证事务一致性
    expect(await checkTransactionConsistency()).toBe(true);
  });
});
```

---

## 📊 性能指标

### 备份性能

| 备份类型 | 数据库大小 | 预期时间 | 压缩率 |
|---------|-----------|---------|--------|
| 全量备份 | 100 MB | < 1 min | ~70% |
| 全量备份 | 1 GB | < 5 min | ~70% |
| 全量备份 | 10 GB | < 30 min | ~70% |
| 增量备份 | 100 MB | < 10 sec | ~50% |

### 恢复性能

| 恢复类型 | 数据库大小 | 预期时间 |
|---------|-----------|---------|
| 全量恢复 | 100 MB | < 1 min |
| 全量恢复 | 1 GB | < 5 min |
| 全量恢复 | 10 GB | < 30 min |
| PITR 恢复 | 1 GB | < 10 min |

### 资源消耗

| 资源类型 | 全量备份 | 增量备份 |
|---------|---------|---------|
| CPU 使用率 | < 50% | < 20% |
| 内存使用 | < 200 MB | < 50 MB |
| 磁盘 I/O | 中等 | 低 |

---

## ⚠️ 风险与注意事项

### 技术风险

1. **数据库锁定风险**
   - 风险：备份过程中数据库被长时间锁定
   - 缓解：使用 WAL 模式的热备份，避免阻塞写操作

2. **备份数据一致性**
   - 风险：备份过程中数据变更导致不一致
   - 缓解：使用 SQLite 在线备份 API，确保事务一致性

3. **存储空间不足**
   - 风险：备份文件占用过多磁盘空间
   - 缓解：实现自动清理策略，保留最近 7 天的备份

4. **网络传输失败**
   - 风险：上传到 S3 时网络中断
   - 缓解：实现断点续传和重试机制

### 运维风险

1. **备份失败未被发现**
   - 风险：备份任务失败但没有告警
   - 缓解：实现备份状态监控和告警机制

2. **恢复流程复杂**
   - 风险：灾难发生时无法快速恢复
   - 缓解：编写详细的操作手册，定期演练恢复流程

3. **备份文件损坏**
   - 风险：备份文件本身损坏无法恢复
   - 缓解：实现备份文件校验和验证

### 安全风险

1. **备份数据泄露**
   - 风险：包含敏感信息的备份文件被未授权访问
   - 缓解：实现备份文件强制加密存储（AES-256-GCM），加密密钥使用 KMS 或 Vault 管理

2. **存储凭证泄露**
   - 风险：S3 访问密钥被泄露
   - 缓解：使用临时凭证和最小权限原则，定期轮换密钥

---

## 🔄 回滚计划

### 回滚触发条件

- 备份系统导致生产系统性能下降超过 20%
- 备份失败率连续 3 次超过 50%
- 恢复操作失败或数据丢失
- 严重安全漏洞（如加密密钥泄露）

### 回滚步骤

1. **立即停止备份调度器**
   ```bash
   pnpm run backup:stop
   ```

2. **禁用备份功能**
   - 注释掉 `backup-scheduler` 的初始化代码
   - 或将配置中的 `enabled` 设置为 `false`

3. **恢复到上一个稳定版本**
   ```bash
   git checkout HEAD~1
   pnpm install
   pnpm build
   pm2 restart automaton
   ```

4. **验证系统正常运行**
   - 检查日志：`pm2 logs automaton`
   - 执行健康检查：`curl http://localhost:3000/health`

5. **通知利益相关者**
   - 通过 Slack/Telegram 通知团队
   - 记录回滚原因和时间

---

## 🚨 灾难恢复演练

### 演练频率

- **每月**：执行一次完整的备份恢复演练
- **每季度**：模拟真实灾难场景（如磁盘故障、数据损坏）
- **每年**：执行跨数据中心恢复演练

### 演练场景

1. **数据库文件损坏**
   - 模拟：删除或损坏 `automaton.db`
   - 目标：在 10 分钟内从备份恢复

2. **WAL 日志丢失**
   - 模拟：删除 `automaton.db-wal`
   - 目标：验证备份包含完整的 WAL 文件

3. **存储后端故障**
   - 模拟：断开 S3 连接或删除本地备份
   - 目标：验证多存储后端冗余

4. **数据一致性问题**
   - 模拟：手动修改数据库导致事务不一致
   - 目标：恢复到最近的一致性检查点

### 演练记录

- 记录每次演练的时间、参与人员、发现的问题
- 更新恢复操作手册
- 优化备份策略

---

## 📊 监控与告警（增强版）

### 关键监控指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| 备份成功率 | < 95% | 高 |
| 平均备份时间 | > 10 分钟（全量） | 中 |
| 存储使用率 | > 80% | 高 |
| 备份文件大小异常 | ±50% 波动 | 中 |
| 最近备份时间 | > 2 小时（增量） | 高 |

### 告警渠道

- **高优先级**：短信 + 电话 + Slack/Telegram
- **中优先级**：Slack/Telegram + 邮件
- **低优先级**：邮件

### 自愈机制

- 备份失败自动重试（最多 3 次）
- 存储空间不足时自动清理过期备份
- 网络故障时切换到备用存储后端

---

## ⚙️ 配置管理

### 加密密钥管理

- 使用环境变量或密钥管理服务（KMS、Vault）
- 密钥定期轮换（每 90 天）
- 密钥访问审计日志

### 配置文件示例

```yaml
backup:
  enabled: true
  retention_days: 7
  encryption:
    enabled: true
    algorithm: aes-256-gcm
    key_source: vault  # vault, env, kms
  schedules:
    full: '0 0 * * *'  # 每天午夜
    incremental: '0 * * * *'  # 每小时
  storage:
    primary: s3
    secondary: local
    local_path: '~/.claude/backups'
    s3:
      bucket: 'automaton-backups'
      region: 'us-east-1'
  monitoring:
    enabled: true
    alert_channels: ['slack', 'telegram']
```

---

## 📈 容量规划

### 存储需求计算

- **初始数据**：10 GB
- **日增长**：100 MB
- **7 天全量备份**：10 GB × 7 = 70 GB
- **7 天增量备份**：100 MB × 24 × 7 = 16.8 GB
- **总计**：86.8 GB
- **预留 20% 缓冲**：104.16 GB

### 性能基线

- **备份期间 CPU 使用**：< 50%
- **备份期间内存使用**：< 200 MB
- **备份期间 QPS 影响**：< 10% 下降
- **备份期间延迟增加**：< 50ms

---

## ✅ 审批记录

**审批状态：** ✅ 已修复待审批
**修复日期：** 2026-03-04
**审批人：** [待填写]
**预计工时：** 5-7 人天（调整后）

### 修复摘要

#### 第一次修复（基于初次审核）
1. ✅ **高优先级**：优化数据库锁机制，分块异步备份
2. ✅ **高优先级**：增加 WAL checkpoint，确保数据一致性
3. ✅ **高优先级**：强制加密所有备份文件（AES-256）
4. ✅ **高优先级**：增加备份后自动验证机制
5. ✅ **中优先级**：添加存储容量规划和性能指标
6. ✅ **中优先级**：增加回滚计划和灾难恢复演练流程
7. ✅ **中优先级**：增强监控告警和自愈机制
8. ✅ **依赖更新**：升级到最新版 SDK

#### 第二次修复（基于二次审核 - 紧急修复）

⚠️ **修复严重缺陷**：
9. 🔴 **加密实现缺陷修复**：重写 `EncryptedStorage` 完整实现
   - 实现完整的加密/解密逻辑（IV + 密文 + AuthTag）
   - 修复 IV 管理问题（每次加密生成随机 IV）
   - 修复密钥硬编码风险（使用密钥提供器回调）
   - 确保备份文件 100% 可解密

10. 🔴 **数据库事务修复**：添加事务包裹和回滚机制
    - 备份开始：`BEGIN IMMEDIATE TRANSACTION`
    - 备份成功：`COMMIT TRANSACTION`
    - 备份失败：`ROLLBACK TRANSACTION`
    - 确保数据一致性

11. 🔴 **SQLITE_DONE 常量修复**：添加导入语句
    - `import { Database, SQLITE_DONE } from 'better-sqlite3';`

12. 🔴 **WAL 文件复制错误处理**：从警告改为强制失败
    - 如果 WAL 文件复制失败，抛出错误而不是记录警告
    - 确保备份完整性

**预计工时**：7-9 人天（原 5-7 人天，因加密实现复杂度增加）

---

**审批状态：** ✅ 二次修复完成，待最终审批
**审批人：** [待填写]
**预计工时：** 7-9 人天

---

## 📦 依赖项

### 外部依赖

```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.0",  // 升级到最新版
    "cron": "^3.1.0",
    "tar": "^6.2.0",
    "@aws-sdk/client-s3": "^3.500.0",  // 升级到最新版
    "crypto": "^1.0.1"  // 加密支持
  },
  "devDependencies": {
    "@types/cron": "^3.0.0",
    "@types/tar": "^6.0.0"
  }
}
```

### 内部依赖

- `src/state/database.ts` - 数据库访问层
- `src/memory/` - 记忆系统
- `src/agent/loop.ts` - Agent 循环
- `src/inference/budget.ts` - 预算追踪

---

## 📝 相关文档

- [automaton/ARCHITECTURE.md](../automaton/ARCHITECTURE.md) - Automaton 架构文档
- [docs/upwork_autopilot_detailed_design.md](./upwork_autopilot_detailed_design.md) - UpworkAutoPilot 详细设计
- [automaton/CLAUDE.md](../automaton/CLAUDE.md) - Automaton 开发指南

---

## 🎓 学习资源

- SQLite WAL 模式：https://www.sqlite.org/wal.html
- SQLite 在线备份：https://www.sqlite.org/backup.html
- AWS S3 最佳实践：https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html

---

**审批状态：** ⏳ 待审批
**审批人：** [待填写]
**预计工时：** 3-5 人天

---

_本故事文档由 BMAD `create-story` 工作流生成_
