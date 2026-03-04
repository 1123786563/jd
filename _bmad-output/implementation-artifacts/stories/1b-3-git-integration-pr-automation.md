# Story 1b.3: Git集成与PR自动化

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Automaton 开发者,
I want 完善 Git 集成与 PR 自动化功能,
so that 自修改代码能够自动提交、创建 PR 并参与团队代码审查流程.

## Acceptance Criteria

### AC 1: Git 深度集成
1. ✅ 已有基础: `automaton/src/self-mod/upstream.ts` 已实现 Git 信息获取和上游检查
2. 支持自动提交代码变更 (commit)
3. 支持自动创建分支 (create-branch)
4. 支持推送到远程仓库 (push)
5. 支持拉取上游变更 (pull)
6. **提交信息规范**: 遵循项目提交规范 (type: description)
7. **提交验证**: 提交前验证代码完整性

### AC 2: Pull Request 自动化
1. 支持自动创建 GitHub/GitLab PR
2. 支持自动生成 PR 描述 (包含变更摘要、影响分析)
3. 支持自动关联 Issue/Story
4. 支持设置审查者 (reviewers)
5. 支持设置标签 (labels)
6. 支持 PR 模板 (template)
7. **PR 安全性**: 防止恶意分支推送和 PR 注入

### AC 3: 与现有审查工作流集成
1. 与 1b.2 代码审查工作流无缝集成
2. 自修改代码提交前必须通过审查 (AC 1b.2)
3. PR 创建后自动触发审查流程
4. 审查通过后自动合并 (或标记为 ready-to-merge)
5. **审查状态同步**: 实时同步审查状态到 Automaton 系统

### AC 4: 错误处理与回滚
1. 提交失败时自动回滚
2. 推送失败时记录详细错误
3. 冲突检测与解决策略
4. 保留完整操作日志
5. **原子操作**: 提交和推送操作原子性保证

### AC 5: 安全性与权限
1. **凭据管理**: 使用环境变量或密钥管理服务存储 Git 凭据
2. **权限最小化**: 仅授予必要的 Git 权限
3. **分支保护**: 遵守分支保护规则 (main 分支保护)
4. **签名提交**: 支持 GPG 签名 (可选)
5. **审计追踪**: 记录所有 Git 操作到审计日志

### AC 6: 性能与可靠性
1. **操作超时**: 单次 Git 操作超时不超过 30 秒
2. **重试机制**: 网络失败时自动重试 (最多 3 次)
3. **并发控制**: 避免并发操作冲突
4. **资源清理**: 临时文件和分支及时清理

## Tasks / Subtasks

- [ ] Task 1: Git 深度集成扩展 (AC: 1, 4, 5, 6)
  - [ ] Subtask 1.1: 扩展 upstream.ts - 添加提交、推送、拉取功能
  - [ ] Subtask 1.2: 实现分支管理器 (BranchManager) - 创建/切换/删除分支
  - [ ] Subtask 1.3: 实现提交生成器 (CommitGenerator) - 生成规范提交信息
  - [ ] Subtask 1.4: 实现冲突检测器 (ConflictDetector)
  - [ ] Subtask 1.5: 实现操作重试机制 (RetryHandler)
  - [ ] Subtask 1.6: 实现 Git 操作审计日志 (GitAuditLogger)

- [ ] Task 2: PR 自动化实现 (AC: 2, 5)
  - [ ] Subtask 2.1: 设计 PR 管理器架构 (PRManager)
  - [ ] Subtask 2.2: 实现 GitHub PR 集成 (GitHubPRService)
  - [ ] Subtask 2.3: 实现 GitLab PR 集成 (GitLabMRService)
  - [ ] Subtask 2.4: 实现 PR 描述生成器 (PRDescriptionGenerator)
  - [ ] Subtask 2.5: 实现审查者分配策略 (ReviewerAssigner)
  - [ ] Subtask 2.6: 实现 PR 模板管理 (PRTemplateManager)
  - [ ] Subtask 2.7: 实现 PR 状态监控 (PRStatusMonitor)

- [ ] Task 3: 审查工作流集成 (AC: 3)
  - [ ] Subtask 3.1: 集成 1b.2 审查引擎 (ReviewEngine)
  - [ ] Subtask 3.2: 实现审查前置检查 (PreReviewChecker)
  - [ ] Subtask 3.3: 实现 PR 后审查触发 (PostPRReviewTrigger)
  - [ ] Subtask 3.4: 实现审查状态同步 (ReviewStatusSync)
  - [ ] Subtask 3.5: 实现自动合并策略 (AutoMergeStrategy)

- [ ] Task 4: 安全性增强 (AC: 5)
  - [ ] Subtask 4.1: 实现凭据安全管理 (CredentialManager)
  - [ ] Subtask 4.2: 实现分支保护验证 (BranchProtectionValidator)
  - [ ] Subtask 4.3: 实现提交签名 (CommitSigner)
  - [ ] Subtask 4.4: 实现恶意操作检测 (MaliciousOperationDetector)
  - [ ] Subtask 4.5: 实现权限验证 (PermissionValidator)

- [ ] Task 5: 集成与测试 (AC: 1, 2, 3, 4, 5, 6)
  - [ ] Subtask 5.1: 端到端测试 - 自动提交和推送
  - [ ] Subtask 5.2: 端到端测试 - 自动创建 PR
  - [ ] Subtask 5.3: 端到端测试 - 审查工作流集成
  - [ ] Subtask 5.4: 安全测试 - 凭据泄漏、注入攻击
  - [ ] Subtask 5.5: 性能测试 - 并发操作、超时处理
  - [ ] Subtask 5.6: 回归测试 - 与现有 self-mod 系统兼容性

## Dev Notes

### 业务背景

当前 Automaton 的自我修改系统 (`src/self-mod/`) 已具备基础的 Git 集成功能：

1. **现有能力** (`upstream.ts`):
   - ✅ 获取仓库信息 (origin URL, branch, HEAD)
   - ✅ 检查上游变更 (fetch + behind count)
   - ✅ 获取上游 diff 信息
   - ✅ 使用 `execFileSync` 防止命令注入

2. **待扩展能力**:
   - ❌ 自动提交代码变更
   - ❌ 自动创建和推送分支
   - ❌ 自动创建 PR/MR
   - ❌ 与审查工作流集成
   - ❌ 自动合并策略

3. **核心价值**:
   - ✅ 减少人工干预 - 自修改代码自动进入团队审查流程
   - ✅ 提升协作效率 - 代码变更透明可见
   - ✅ 确保代码质量 - 通过团队审查保证质量
   - ✅ 完整审计轨迹 - 所有变更记录在 Git 历史中

### 技术架构设计

#### Git 集成架构图

```mermaid
graph TD
    subgraph GitIntegration [Git 集成系统]
        CE[CodeEntry<br/>待提交代码]
        CE --> PreCheck[PreCommitChecker<br/>提交前检查]

        PreCheck --> VC[VersionControl<br/>版本控制]
        VC --> BM[BranchManager]
        VC --> CG[CommitGenerator]
        VC --> Push[GitPusher]

        BM -->|create branch| GitCLI[Git CLI<br/>execFileSync]
        CG -->|generate commit| GitCLI
        Push -->|push to remote| GitCLI

        GitCLI --> Result[GitResult]
        Result -->|success| PR[PRManager]
        Result -->|failure| Rollback[AutoRollback]

        PR --> GitHub[GitHubPRService]
        PR --> GitLab[GitLabMRService]

        GitHub --> PRTemp[PRTemplateManager]
        GitLab --> PRTemp

        PRTemp --> PRDesc[PRDescriptionGenerator]
        PRDesc --> Reviewers[ReviewerAssigner]

        Reviewers --> CreatePR[Create PR/MR]
        CreatePR --> Monitor[PRStatusMonitor]

        Monitor --> ReviewInteg[ReviewIntegration<br/>与 1b.2 集成]
        ReviewInteg -->|审查通过| AutoMerge[AutoMergeStrategy]
        ReviewInteg -->|审查拒绝| Rejected[标记为拒绝]
    end

    subgraph Security [安全性层]
        GitCLI -.-> Credential[CredentialManager<br/>凭据管理]
        GitCLI -.-> BranchProt[BranchProtectionValidator]
        GitCLI -.-> Sign[CommitSigner]
        GitCLI -.-> Audit[GitAuditLogger]
    end

    subgraph Retry [重试与错误处理]
        GitCLI -.-> Retry[RetryHandler<br/>3 次重试]
        GitCLI -.-> Timeout[TimeoutHandler<br/>30 秒]
        GitCLI -.-> Conflict[ConflictDetector]
    end
```

#### 核心组件实现

##### 1. Git 深度集成扩展 (`upstream.ts` 增强)

```typescript
/**
 * 扩展 Git 集成功能
 */
export class GitIntegration {
  private repoRoot: string = process.cwd();
  private logger: Logger;
  private config: GitConfig;

  /**
   * 提交代码变更
   */
  async commitChanges(
    message: string,
    options?: CommitOptions
  ): Promise<CommitResult> {
    const startTime = Date.now();

    try {
      // 1. 检查是否有变更
      const status = this.git(["status", "--porcelain"]);
      if (!status) {
        return {
          success: false,
          error: "No changes to commit",
          duration: Date.now() - startTime
        };
      }

      // 2. 生成规范的提交信息
      const commitMessage = this.generateCommitMessage(message, options);

      // 3. 添加变更文件
      this.git(["add", "-A"]);

      // 4. 提交 (使用数组参数防止注入)
      const args = ["commit", "-m", commitMessage];

      if (options?.sign) {
        args.push("-S"); // GPG 签名
      }

      this.git(args);

      // 5. 记录审计日志
      await this.auditLogger.logGitOperation({
        type: "COMMIT",
        message: commitMessage,
        files: this.parseChangedFiles(status),
        timestamp: new Date()
      });

      return {
        success: true,
        commitHash: this.git(["rev-parse", "HEAD"]),
        duration: Date.now() - startTime
      };
    } catch (error) {
      // 自动回滚
      await this.rollbackChanges();

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 推送到远程仓库
   */
  async pushToRemote(
    branch?: string,
    remote: string = "origin"
  ): Promise<PushResult> {
    const startTime = Date.now();
    const targetBranch = branch || this.getCurrentBranch();

    try {
      // 1. 检查分支保护
      await this.branchProtectionValidator.validate(targetBranch);

      // 2. 拉取上游变更 (避免冲突)
      await this.pullFromRemote(remote, targetBranch);

      // 3. 推送 (带重试机制)
      const result = await this.retryHandler.execute(async () => {
        this.git(["push", remote, targetBranch, "--set-upstream"]);
        return { success: true };
      }, {
        maxRetries: 3,
        timeoutMs: 30000
      });

      // 4. 记录审计日志
      await this.auditLogger.logGitOperation({
        type: "PUSH",
        remote,
        branch: targetBranch,
        timestamp: new Date()
      });

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 创建新分支
   */
  async createBranch(
    branchName: string,
    baseBranch?: string
  ): Promise<BranchResult> {
    const startTime = Date.now();

    try {
      // 验证分支命名规范
      if (!this.validateBranchName(branchName)) {
        throw new Error(`Invalid branch name: ${branchName}`);
      }

      // 检查分支是否已存在
      if (this.branchExists(branchName)) {
        throw new Error(`Branch already exists: ${branchName}`);
      }

      const base = baseBranch || this.getCurrentBranch();

      // 创建并切换分支
      this.git(["checkout", "-b", branchName, base]);

      await this.auditLogger.logGitOperation({
        type: "BRANCH_CREATE",
        branch: branchName,
        base: base,
        timestamp: new Date()
      });

      return {
        success: true,
        branch: branchName,
        base: base,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 安全的 Git 命令执行 (防止注入)
   */
  private git(args: string[]): string {
    // 使用 execFileSync 与参数数组，不使用 shell
    return execFileSync("git", args, {
      cwd: this.repoRoot,
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    }).trim();
  }

  /**
   * 生成规范的提交信息
   */
  private generateCommitMessage(
    message: string,
    options?: CommitOptions
  ): string {
    // 提取提交类型 (feat, fix, refactor, etc.)
    const typeMatch = message.match(/^(\w+):/);
    const type = typeMatch ? typeMatch[1] : "chore";

    // 标准化格式: type: description
    const cleanMessage = message.replace(/^\w+:\s*/, "");

    let commitMessage = `${type}: ${cleanMessage}`;

    // 添加关联的 Issue/Story
    if (options?.relatedIssue) {
      commitMessage += `\n\nRelated to: ${options.relatedIssue}`;
    }

    // 添加变更类型标签
    if (options?.changeType) {
      commitMessage += `\n\nChange-Type: ${options.changeType}`;
    }

    return commitMessage;
  }
}

interface CommitOptions {
  sign?: boolean;              // GPG 签名
  relatedIssue?: string;       // 关联的 Issue/Story
  changeType?: "breaking" | "feature" | "bugfix" | "refactor";
}

interface CommitResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  duration: number;
}

interface PushResult {
  success: boolean;
  error?: string;
  duration: number;
}
```

##### 2. PR 管理器实现

```typescript
/**
 * PR/MR 管理器 - 支持 GitHub 和 GitLab
 */
export class PRManager {
  private github?: GitHubPRService;
  private gitlab?: GitLabMRService;
  private config: PRConfig;
  private logger: Logger;

  /**
   * 自动创建 PR
   */
  async createPR(options: CreatePROptions): Promise<PRResult> {
    const startTime = Date.now();

    try {
      // 1. 验证前置条件
      await this.validatePreconditions(options);

      // 2. 生成 PR 描述
      const description = await this.generatePRDescription(options);

      // 3. 选择 PR 服务 (GitHub 或 GitLab)
      const prService = await this.selectPRService();

      // 4. 创建 PR
      const pr = await prService.createPR({
        title: options.title,
        body: description,
        head: options.branch,
        base: options.baseBranch || "main",
        reviewers: options.reviewers || await this.autoAssignReviewers(options),
        labels: options.labels || this.getDefaultLabels(options),
        draft: options.draft
      });

      // 5. 记录审计日志
      await this.auditLogger.logPROperation({
        type: "PR_CREATE",
        prNumber: pr.number,
        url: pr.url,
        branch: options.branch,
        timestamp: new Date()
      });

      // 6. 触发审查工作流 (与 1b.2 集成)
      await this.triggerReviewWorkflow(pr, options);

      return {
        success: true,
        prNumber: pr.number,
        url: pr.url,
        status: "open",
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 生成 PR 描述
   */
  private async generatePRDescription(
    options: CreatePROptions
  ): Promise<string> {
    const template = await this.templateManager.getTemplate("default");

    // 提取变更摘要
    const changesSummary = await this.analyzeChanges(options.branch);

    // 生成影响分析
    const impactAnalysis = await this.analyzeImpact(options.branch);

    // 填充模板
    return template
      .replace("{{TITLE}}", options.title)
      .replace("{{BRANCH}}", options.branch)
      .replace("{{CHANGES}}", changesSummary)
      .replace("{{IMPACT}}", impactAnalysis)
      .replace("{{REVIEWERS}}", options.reviewers?.join(", ") || "Auto-assigned")
      .replace("{{CHECKLIST}}", this.generateChecklist(options));
  }

  /**
   * 自动生成审查者列表
   */
  private async autoAssignReviewers(
    options: CreatePROptions
  ): Promise<string[]> {
    // 基于变更的文件路径分配审查者
    const changedFiles = await this.getChangedFiles(options.branch);
    const reviewers: Set<string> = new Set();

    for (const file of changedFiles) {
      // 根据文件路径映射到团队/个人
      const team = this.mapFileToTeam(file);
      const teamReviewers = await this.config.getTeamReviewers(team);

      teamReviewers.forEach(r => reviewers.add(r));
    }

    // 确保至少有 2 个审查者
    if (reviewers.size < 2) {
      const defaultReviewers = await this.config.getDefaultReviewers();
      defaultReviewers.slice(0, 2 - reviewers.size).forEach(r => reviewers.add(r));
    }

    return Array.from(reviewers);
  }

  /**
   * 触发审查工作流 (与 1b.2 集成)
   */
  private async triggerReviewWorkflow(
    pr: PRInfo,
    options: CreatePROptions
  ): Promise<void> {
    // 1. 通知审查引擎
    await this.reviewEngine.notifyPRCreated({
      prNumber: pr.number,
      branch: options.branch,
      filesChanged: options.filesChanged
    });

    // 2. 设置 Webhook 监听 PR 状态变化
    await this.prStatusMonitor.watchPR(pr.number, async (status) => {
      if (status === "approved") {
        await this.handlePRApproved(pr);
      } else if (status === "changes_requested") {
        await this.handlePRChangesRequested(pr);
      }
    });
  }

  /**
   * 处理 PR 被批准
   */
  private async handlePRApproved(pr: PRInfo): Promise<void> {
    // 1. 检查是否满足自动合并条件
    const canAutoMerge = await this.autoMergeStrategy.canMerge(pr);

    if (canAutoMerge) {
      // 2. 自动合并
      await this.mergePR(pr);

      // 3. 删除分支 (可选)
      if (this.config.autoDeleteBranch) {
        await this.deleteBranch(pr.branch);
      }

      this.logger.info(`PR #${pr.number} automatically merged`);
    } else {
      // 4. 标记为 ready-to-merge，等待人工操作
      await this.addLabel(pr.number, "ready-to-merge");
      this.logger.info(`PR #${pr.number} approved, waiting for manual merge`);
    }
  }
}

interface CreatePROptions {
  title: string;
  branch: string;
  baseBranch?: string;
  reviewers?: string[];
  labels?: string[];
  draft?: boolean;
  filesChanged: string[];
}

interface PRResult {
  success: boolean;
  prNumber?: number;
  url?: string;
  status?: "open" | "closed" | "merged";
  error?: string;
  duration: number;
}
```

##### 3. GitHub PR 服务实现

```typescript
/**
 * GitHub PR 服务
 */
export class GitHubPRService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    // 使用环境变量存储 token，避免硬编码
    const token = process.env.GITHUB_TOKEN || config.token;

    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }

    this.octokit = new Octokit({ auth: token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  /**
   * 创建 Pull Request
   */
  async createPR(options: {
    title: string;
    body: string;
    head: string;
    base: string;
    reviewers?: string[];
    labels?: string[];
    draft?: boolean;
  }): Promise<PRInfo> {
    // 创建 PR
    const response = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft
    });

    const prNumber = response.data.number;

    // 请求审查者
    if (options.reviewers && options.reviewers.length > 0) {
      await this.octokit.pulls.requestReviewers({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        reviewers: options.reviewers
      });
    }

    // 添加标签
    if (options.labels && options.labels.length > 0) {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        labels: options.labels
      });
    }

    return {
      number: prNumber,
      url: response.data.html_url,
      state: response.data.state
    };
  }

  /**
   * 合并 PR
   */
  async mergePR(prNumber: number, method: "merge" | "squash" | "rebase" = "squash"): Promise<boolean> {
    try {
      await this.octokit.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: method
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to merge PR #${prNumber}:`, error);
      return false;
    }
  }

  /**
   * 获取 PR 状态
   */
  async getPRStatus(prNumber: number): Promise<PRStatus> {
    const response = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return {
      state: response.data.state,
      merged: response.data.merged || false,
      mergeable: response.data.mergeable,
      reviewDecision: response.data.reviewDecision
    };
  }
}
```

### 审计日志表设计

#### Git 操作审计表

```sql
-- Git 操作审计表
CREATE TABLE git_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,      -- 操作唯一标识
    operation_type TEXT NOT NULL,           -- COMMIT, PUSH, PULL, BRANCH_CREATE, PR_CREATE

    -- 操作详情
    commit_hash TEXT,                       -- 提交哈希 (COMMIT 操作)
    branch_name TEXT,                       -- 分支名称
    remote_name TEXT,                       -- 远程仓库名称
    pr_number INTEGER,                      -- PR 编号
    pr_url TEXT,                            -- PR URL

    -- 操作结果
    success BOOLEAN NOT NULL,
    error_message TEXT,                     -- 错误信息
    duration_ms INTEGER,                    -- 操作耗时 (毫秒)

    -- 变更信息
    files_changed JSON,                     -- 变更的文件列表
    lines_added INTEGER,
    lines_removed INTEGER,

    -- 提交信息
    commit_message TEXT,
    commit_author TEXT,
    commit_email TEXT,

    -- 安全字段
    gpg_signed BOOLEAN DEFAULT FALSE,      -- 是否 GPG 签名
    signature_verified BOOLEAN,
    credential_used TEXT,                   -- 使用的凭据类型

    -- 元数据
    triggered_by TEXT,                      -- 触发者 (automaton/self-mod)
    related_story TEXT,                     -- 关联的故事
    ip_address TEXT,                        -- IP 地址
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_git_audit_operation ON git_audit_log(operation_type);
CREATE INDEX idx_git_audit_branch ON git_audit_log(branch_name);
CREATE INDEX idx_git_audit_pr ON git_audit_log(pr_number);
CREATE INDEX idx_git_audit_created ON git_audit_log(created_at);
CREATE INDEX idx_git_audit_success ON git_audit_log(success);

-- PR 操作审计表
CREATE TABLE pr_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id TEXT NOT NULL UNIQUE,
    pr_number INTEGER NOT NULL,
    operation_type TEXT NOT NULL,           -- CREATE, UPDATE, MERGE, CLOSE, REOPEN

    -- PR 信息
    title TEXT,
    branch TEXT,
    base_branch TEXT,
    reviewers JSON,                         -- 审查者列表
    labels JSON,                            -- 标签列表

    -- 状态变更
    from_state TEXT,
    to_state TEXT,
    merged BOOLEAN DEFAULT FALSE,
    merged_at TIMESTAMP,
    merged_by TEXT,

    -- 审查信息
    review_status TEXT,                     -- APPROVED, CHANGES_REQUESTED, PENDING
    review_comments JSON,                   -- 审查评论
    approval_count INTEGER DEFAULT 0,
    rejection_count INTEGER DEFAULT 0,

    -- 与审查工作流集成
    review_engine_triggered BOOLEAN DEFAULT FALSE,
    review_result TEXT,                     -- PASSED, FAILED, PENDING
    auto_merged BOOLEAN DEFAULT FALSE,

    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pr_audit_number ON pr_audit_log(pr_number);
CREATE INDEX idx_pr_audit_state ON pr_audit_log(review_status);
CREATE INDEX idx_pr_audit_merged ON pr_audit_log(merged);
CREATE INDEX idx_pr_audit_created ON pr_audit_log(created_at);
```

### 安全性设计

#### 1. 凭据管理

```typescript
/**
 * 凭据管理器 - 安全存储和使用 Git 凭据
 */
export class CredentialManager {
  private vault?: KeyVaultClient;  // 可选的密钥管理服务集成

  /**
   * 获取 Git 凭据
   */
  async getGitCredential(type: "github" | "gitlab"): Promise<string> {
    // 优先使用环境变量
    const envVar = type === "github" ? "GITHUB_TOKEN" : "GITLAB_TOKEN";
    const token = process.env[envVar];

    if (token) {
      return token;
    }

    // 回退到密钥管理服务
    if (this.vault) {
      return await this.vault.getSecret(`${type}-token`);
    }

    throw new Error(`No ${type} token found in environment or vault`);
  }

  /**
   * 验证凭据有效性
   */
  async validateCredential(type: "github" | "gitlab"): Promise<boolean> {
    const token = await this.getGitCredential(type);

    try {
      // 尝试调用 API 验证 token
      if (type === "github") {
        const response = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${token}` }
        });
        return response.ok;
      }
    } catch {
      return false;
    }
  }
}
```

#### 2. 恶意操作检测

```typescript
/**
 * 恶意操作检测器
 */
export class MaliciousOperationDetector {
  /**
   * 检测可疑的分支名称
   */
  detectSuspiciousBranch(branchName: string): boolean {
    const suspiciousPatterns = [
      /--(upload|exec|eval|run)/i,      // 命令注入尝试
      /;|\|&|\$\(.*\)|`.*`/,             // shell 命令
      /\/etc\/passwd/,                    // 敏感文件路径
      /(\.\.\/){3,}/,                     // 路径遍历
      /<script>|javascript:/i            // XSS 尝试
    ];

    return suspiciousPatterns.some(pattern => pattern.test(branchName));
  }

  /**
   * 检测可疑的提交信息
   */
  detectSuspiciousCommit(message: string): boolean {
    // 检查是否包含敏感操作关键词
    const sensitiveKeywords = [
      "rm -rf",
      "chmod 777",
      "eval(",
      "Function(",
      "new Function",
      "exec(",
      "spawn("
    ];

    return sensitiveKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 检测大规模删除
   */
  detectMassDeletion(filesChanged: string[], linesRemoved: number): boolean {
    // 如果删除的行数超过新增的 10 倍，标记为可疑
    if (linesRemoved > 1000 && filesChanged.length > 50) {
      return true;
    }
    return false;
  }
}
```

### 文件清单

#### 新增文件

```
automaton/
├── src/
│   ├── self-mod/
│   │   ├── git/
│   │   │   ├── GitIntegration.ts          # Git 深度集成
│   │   │   ├── BranchManager.ts           # 分支管理器
│   │   │   ├── CommitGenerator.ts         # 提交生成器
│   │   │   ├── ConflictDetector.ts        # 冲突检测器
│   │   │   ├── GitAuditLogger.ts          # Git 审计日志
│   │   │   └── types.ts                   # Git 相关类型
│   │   ├── pr/
│   │   │   ├── PRManager.ts               # PR 管理器
│   │   │   ├── GitHubPRService.ts         # GitHub PR 服务
│   │   │   ├── GitLabMRService.ts         # GitLab MR 服务
│   │   │   ├── PRDescriptionGenerator.ts  # PR 描述生成器
│   │   │   ├── ReviewerAssigner.ts        # 审查者分配器
│   │   │   ├── PRTemplateManager.ts       # PR 模板管理器
│   │   │   ├── PRStatusMonitor.ts         # PR 状态监控
│   │   │   └── types.ts                   # PR 相关类型
│   │   ├── security/
│   │   │   ├── CredentialManager.ts       # 凭据管理器
│   │   │   ├── BranchProtectionValidator.ts # 分支保护验证
│   │   │   ├── CommitSigner.ts            # 提交签名
│   │   │   └── MaliciousOperationDetector.ts # 恶意操作检测
│   │   ├── upstream.ts                    # + 扩展 Git 功能
│   │   └── index.ts                       # + 导出新模块
│   └── cli/
│       └── commands/
│           ├── git-commit.ts              # Git 提交命令
│           ├── git-push.ts                # Git 推送命令
│           └── create-pr.ts               # 创建 PR 命令
```

#### 修改文件

```
automaton/
├── src/
│   ├── self-mod/
│   │   ├── upstream.ts                    # 扩展提交、推送、分支功能
│   │   ├── code.ts                        # 集成 Git 提交流程
│   │   └── tools-manager.ts               # 集成 PR 创建
│   ├── state/
│   │   └── database.ts                    # + 添加 Git/PR 审计表
│   └── index.ts                           # 注册新模块
├── migrations/
│   └── xxx_add_git_pr_audit_tables.sql    # Git/PR 审计表迁移
└── package.json                           # + 新增依赖

tinyclaw/
└── src/
    ├── lib/
    │   └── pr-integration.ts              # TinyClaw PR 集成 (可选)
    └── channels/
        ├── telegram-bot.ts                # + PR 通知
        └── feishu-webhook.ts              # + PR 通知
```

### 依赖项

```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",           // GitHub API 客户端
    "@gitbeaker/rest": "^40.0.0",         // GitLab API 客户端
    "crypto-js": "^4.2.0"                 // 凭据加密 (可选)
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### 环境变量

```bash
# GitHub 集成
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo

# GitLab 集成 (可选)
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_URL=https://gitlab.com
GITLAB_PROJECT_ID=12345

# 凭据管理 (可选)
KEY_VAULT_URL=https://your-vault.vault.azure.net/
KEY_VAULT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 技术风险说明

1. **凭据安全**:
   - ✅ 必须使用环境变量或密钥管理服务
   - ✅ 避免在代码或日志中暴露 token
   - ✅ 定期轮换 token
   - ✅ **凭据缓存** - 实现 5 分钟缓存避免频繁访问 vault

2. **API 限流**:
   - ✅ GitHub API 有速率限制 (5000 次/小时)
   - ✅ **指数退避重试** - 使用 2^i * 1000ms 策略 (1s, 2s, 4s)
   - ✅ 考虑使用 GraphQL 减少请求次数
   - ✅ 添加速率限制检测和延迟

3. **并发冲突** - ⚠️ **必须解决**:
   - ✅ 多个 Automaton 实例可能同时操作 Git
   - ✅ **分布式锁** - 使用 Redis 实现互斥锁，锁键: `git-operation:{story-id}`
   - ✅ **操作幂等性** - 使用 `idempotencyKey: {story-id}-{operation-type}-{timestamp}` 防止重复执行
   - ✅ 锁超时: 5 分钟，自动释放

4. **网络可靠性**:
   - ✅ 推送和 PR 创建可能因网络失败
   - ✅ 必须实现重试机制 (最多 3 次)
   - ✅ 记录详细错误日志便于排查
   - ✅ 实现幂等性保证 (见并发冲突)

5. **分支保护规则**:
   - ✅ 需要遵守仓库的分支保护规则
   - ✅ 某些仓库可能禁止自动合并
   - ✅ 需要配置适当的权限
   - ✅ **分支命名规范** - 使用 `automaton/story-{story-id}-{description}` 格式

6. **临时资源清理** - ⚠️ **必须明确策略**:
   - ✅ **分支清理策略** - 合并成功后 7 天自动删除，失败分支保留 30 天
   - ✅ **触发条件** - 定时任务每日凌晨 2 点执行清理
   - ✅ **日志记录** - 记录清理操作到审计日志
   - ✅ **手动干预** - 提供 `cleanup-branches` CLI 命令

7. **事务原子性** - ⚠️ **必须保证**:
   ```typescript
   async commitAndPush(...): Promise<Result> {
     const commitResult = await this.commit();
     if (!commitResult.success) return commitResult;

     try {
       return await this.push();
     } catch (error) {
       // 回滚 commit
       await this.git(['reset', '--hard', 'HEAD~1']);
       throw error;
     }
   }
   ```

### 幂等性实现示例

```typescript
/**
 * 幂等性操作管理器
 */
export class IdempotencyManager {
  private cache = new Map<string, { result: any; timestamp: number }>();

  /**
   * 执行幂等操作
   */
  async execute<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttl: number = 300000 // 5分钟
  ): Promise<T> {
    const cached = this.cache.get(idempotencyKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }

    const result = await operation();
    this.cache.set(idempotencyKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * 清除幂等性缓存
   */
  clear(idempotencyKey?: string) {
    if (idempotencyKey) {
      this.cache.delete(idempotencyKey);
    } else {
      this.cache.clear();
    }
  }
}

/**
 * 分布式锁管理器 (Redis)
 */
export class DistributedLock {
  private redis: RedisClient;
  private lockPrefix = 'git-lock:';

  constructor(redisClient: RedisClient) {
    this.redis = redisClient;
  }

  /**
   * 尝试获取锁
   */
  async acquire(lockKey: string, ttl: number = 300000): Promise<boolean> {
    const result = await this.redis.set(
      `${this.lockPrefix}${lockKey}`,
      'locked',
      'PX',
      ttl,
      'NX' // 仅当不存在时设置
    );

    return result === 'OK';
  }

  /**
   * 释放锁
   */
  async release(lockKey: string): Promise<void> {
    await this.redis.del(`${this.lockPrefix}${lockKey}`);
  }

  /**
   * 带锁执行操作
   */
  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    const acquired = await this.acquire(lockKey, ttl);
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }

    try {
      return await operation();
    } finally {
      await this.release(lockKey);
    }
  }
}
```

### 重试机制实现示例

```typescript
/**
 * 带指数退避的重试
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        // 指数退避: 1s, 2s, 4s
        const delay = Math.pow(2, i) * baseDelay + Math.random() * 100; // 随机抖动
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### 凭据缓存实现示例

```typescript
/**
 * 安全凭据缓存
 */
export class SecureCredentialCache {
  private cache = new Map<string, { token: string; expiresAt: number }>();
  private ttl = 300000; // 5分钟

  async getCredential(type: string): Promise<string> {
    const cached = this.cache.get(type);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // 从环境变量或 vault 获取
    const token = await this.fetchCredential(type);
    this.cache.set(type, {
      token,
      expiresAt: Date.now() + this.ttl
    });

    return token;
  }

  private async fetchCredential(type: string): Promise<string> {
    const envVar = type === 'github' ? 'GITHUB_TOKEN' : 'GITLAB_TOKEN';
    const token = process.env[envVar];

    if (token) {
      return token;
    }

    throw new Error(`No ${type} token found in environment`);
  }
}
```

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (via workflow execution)

### Debug Log References

N/A - Story creation phase

### 技术要点总结

1. **基于现有代码扩展**: 在 `upstream.ts` 基础上扩展，保持架构一致性
2. **安全性优先**: 凭据管理、恶意操作检测、审计日志
3. **与 1b.2 集成**: 无缝集成代码审查工作流
4. **错误处理完善**: 自动回滚、重试机制、详细日志
5. **多平台支持**: GitHub 和 GitLab 都支持
6. **✅ 并发控制**: Redis 分布式锁，防止多实例冲突
7. **✅ 幂等性保证**: 使用 idempotencyKey 防止重复操作
8. **✅ 凭据缓存**: 5 分钟缓存，避免频繁访问 vault
9. **✅ 指数退避**: 1s/2s/4s 重试策略，增加随机抖动
10. **✅ 资源清理**: 7 天自动删除已合并分支，30 天保留失败分支

### 下一步行动建议 (优先级排序)

1. **P0 - 核心功能**:
   - 扩展 `upstream.ts` - 实现提交、推送、分支功能
   - 实现 `GitHubPRService.ts` - GitHub PR 创建和管理
   - 实现 `CredentialManager.ts` - 凭据管理和缓存
   - 实现分布式锁和幂等性机制

2. **P1 - 安全性**:
   - 实现 `MaliciousOperationDetector.ts` - 恶意操作检测
   - 实现 `GitAuditLogger.ts` - 审计日志记录
   - 实现 `BranchProtectionValidator.ts` - 分支保护验证

3. **P2 - 集成与优化**:
   - 集成 1b.2 审查工作流
   - 实现 `PRManager.ts` - PR 管理器
   - 实现自动合并策略

4. **P3 - 扩展功能**:
   - 实现 `GitLabMRService.ts` - GitLab 支持
   - 实现分支自动清理定时任务
   - 性能测试和优化

### 审核状态

**审核日期**: 2026-03-04
**审核团队**: PM、架构师、开发者、安全专家、测试专家
**审核结论**: ✅ **批准 - 可以开始开发**

**修复内容**:
- ✅ 添加并发控制方案（Redis 分布式锁）
- ✅ 完善重试机制（指数退避 + 随机抖动）
- ✅ 明确临时分支清理策略（7天/30天规则）
- ✅ 添加幂等性保证机制（idempotencyKey）
- ✅ 添加凭据缓存机制（5 分钟缓存）
- ✅ 完善事务原子性实现示例

---

**Story Created**: 2026-03-04
**Story Revised**: 2026-03-04 (添加并发控制、幂等性、缓存机制等关键修复)
**Based On**:
- automaton/src/self-mod/upstream.ts (现有 Git 集成)
- docs/project-context.md (项目规范)
- docs/development-guide-automaton.md (开发指南)
- _bmad-output/planning-artifacts/epics.md (Epic 1b.3 需求)
- 1b.2 代码审查工作流 (集成依赖)
**Related Stories**:
- 1b.1: 安全代码生成框架完善
- 1b.2: 代码审查工作流优化
**Technology Stack**:
- TypeScript, Node.js, Git CLI, GitHub API, GitLab API
**Security Focus**:
- 凭据管理、注入防护、审计日志、分支保护

---

## 审核记录

**审核日期**: 2026-03-04
**审核团队**:
- 👤 项目经理 (PM)
- 🏗️ 架构师
- 💻 开发者
- 🔒 安全专家
- 🧪 测试专家

**审核结论**: ✅ **批准 - 可以开始开发**

**关键改进** (2026-03-04):
- ✅ **并发控制** - 添加 Redis 分布式锁实现，防止多实例冲突
- ✅ **幂等性保证** - 实现 IdempotencyManager，使用 idempotencyKey 防止重复操作
- ✅ **凭据缓存** - 添加 SecureCredentialCache，5 分钟缓存避免频繁访问 vault
- ✅ **重试机制** - 完善指数退避 + 随机抖动 (1s, 2s, 4s)
- ✅ **资源清理** - 明确分支清理策略：成功合并 7 天删除，失败保留 30 天
- ✅ **事务原子性** - 完善 commitAndPush 的原子性保证，失败自动回滚

**必须实现的核心机制**:
1. 分布式锁 (Redis) - 锁键: `git-operation:{story-id}`
2. 幂等性管理器 - TTL: 5 分钟
3. 凭据缓存 - TTL: 5 分钟
4. 指数退避重试 - 最多 3 次
5. 分支自动清理 - 定时任务每日凌晨 2 点

**风险缓解措施已就位，可以安全开发！** 🚀
