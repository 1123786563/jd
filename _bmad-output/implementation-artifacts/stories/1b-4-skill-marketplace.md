# Story 1b.4: 技能市场原型 (可安装技能包)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Automaton AI Agent,
I want 安全可靠的技能安装、管理和分发系统,
so that 我可以动态扩展功能而无需手动编辑代码.

## Acceptance Criteria

1. 支持通过Git仓库安装技能包 (git clone模式)
2. 支持通过URL直接下载单个SKILL.md文件
3. 支持查询已安装技能列表
4. 支持禁用/启用技能 (不影响磁盘文件)
5. 支持卸载技能 (可选删除磁盘文件)
6. 支持自动激活的技能指令注入到系统提示词
7. 严格的安全验证防止注入攻击
8. 技能元数据持久化存储到SQLite数据库

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2): 技能安装系统实现
  - [x] 子任务 1.1: 实现Git仓库安装 (installSkillFromGit)
  - [x] 子任务 1.2: 实现URL下载安装 (installSkillFromUrl)
  - [x] 子任务 1.3: 输入验证和安全防护

- [x] Task 2 (AC: #3, #4, #5): 技能管理命令
  - [x] 子任务 2.1: 列出已安装技能 (listSkills)
  - [x] 子任务 2.2: 禁用/启用技能 (toggleSkill)
  - [x] 子任务 2.3: 卸载技能 (removeSkill)

- [x] Task 3 (AC: #6): 技能指令注入
  - [x] 子任务 3.1: 获取激活技能指令 (getActiveSkillInstructions)
  - [x] 子任务 3.2: 指令内容验证和清理
  - [x] 子任务 3.3: 集成到Agent系统提示词

- [x] Task 4 (AC: #7, #8): 安全机制完善
  - [x] 子任务 4.1: 技能路径遍历防护 (validateSkillPath)
  - [x] 子任务 4.2: 指令内容注入检测 (validateInstructionContent)
  - [x] 子任务 4.3: 数据库元数据管理 (upsertSkill/removeSkill)

## Dev Notes

### 项目结构

技能系统位于 `automaton/src/skills/` 目录:
```
automaton/src/skills/
├── loader.ts      # 技能加载器 - 扫描并加载 ~/.automaton/skills/
├── registry.ts    # 技能注册表 - 安装/卸载技能
├── format.ts      # SKILL.md解析器 - YAML frontmatter解析
└── types.ts       # 技能类型定义
```

### 关键实现

#### 1. 技能加载器 (loader.ts)
- 扫描 `~/.automaton/skills/<skill-name>/SKILL.md`
- 解析YAML frontmatter + Markdown body
- 验证requirements (二进制依赖、环境变量)
- 持久化到SQLite数据库
- 仅加载enabled且autoActivate的技能

**安全措施:**
- 使用execFileSync参数数组防止shell注入
- 二进制名称正则验证 `/^[a-zA-Z0-9._-]+$/`
- 路径解析防止遍历攻击

#### 2. 技能注册表 (registry.ts)
- `installSkillFromGit()`: 从Git仓库安装
  - 参数验证: `SKILL_NAME_RE = /^[a-zA-Z0-9-]+$/`
  - URL验证: `SAFE_URL_RE = /^https?:\/\/[^\s;|&$`(){}<>]+$/`
  - 使用execFileSync参数数组 (无shell插值)

- `installSkillFromUrl()`: 从URL下载
  - 创建目录使用fs.mkdirSync (无shell)
  - 使用curl -fsSL下载 (execFileSync参数数组)

- `createSkill()`: Agent自我创建技能
  - YAML安全序列化防止YAML注入
  - 大小限制: description ≤ 500 chars, instructions ≤ 10,000 chars

- `removeSkill()`: 卸载技能
  - 禁用数据库记录
  - 可选删除磁盘文件 (fs.rmSync)

#### 3. SKILL.md格式 (format.ts)
```
---
name: "skill-name"
description: "技能描述"
auto-activate: true
requires:
  bins: [git, curl]
  env: [OPENAI_API_KEY]
---

# 技能指令文档

[Markdown格式的技能使用说明]
```

- 解析YAML frontmatter (手动解析,避免gray-matter依赖)
- 提取instructions body
- 简化解析器仅支持必需字段

#### 4. 技能指令注入 (getActiveSkillInstructions)
- 仅自动激活技能注入系统提示词
- 指令内容验证:
  - 检测并移除可疑模式 (tool_call_json, tool_call_xml, system_role_injection)
  - sanitizeInput()双重消毒
  - 总大小限制 ≤ 10,000 chars
- 标记为UNTRUSTED CONTENT边界
- 按优先级排序和截断

### 技能目录结构

```
~/.automaton/skills/
├── web-scraper/
│   └── SKILL.md
├── imagegen/
│   └── SKILL.md
└── agent-browser/
    └── SKILL.md
```

每个技能是一个目录,包含:
- **SKILL.md** (必需): YAML frontmatter + Markdown instructions
- **scripts/** (可选): 可执行脚本 (Python/Bash)
- **references/** (可选): 参考文档
- **assets/** (可选): 输出资源模板

### 数据库Schema

```sql
CREATE TABLE skills (
  name TEXT PRIMARY KEY,
  description TEXT,
  auto_activate BOOLEAN,
  instructions TEXT,
  source TEXT,        -- builtin, git, url, self
  path TEXT,
  enabled BOOLEAN,
  installed_at TEXT,
  requires TEXT       -- JSON: {bins: [], env: []}
);
```

### 安全验证流程

1. **输入验证阶段**
   - 技能名称正则: `/^[a-zA-Z0-9-]+$/`
   - URL验证: 必须为http(s)且无shell元字符
   - 二进制名称验证: `/^[a-zA-Z0-9._-]+$/`

2. **路径安全**
   - validateSkillPath(): 验证目标路径在skills目录内
   - fs.*操作避免shell插值
   - execFileSync使用参数数组

3. **内容安全**
   - validateInstructionContent(): 检测11种可疑模式
     - tool_call JSON/XML语法
     - system角色注入
     - 身份覆盖指令
     - 敏感文件引用 (wallet.json, .env)
   - sanitizeInput(): 注入防御双重消毒
   - 大小限制防DoS

4. **运行时安全**
   - 数据库enabled字段控制激活状态
   - autoActivate字段控制自动注入
   - 技能指令标记为UNTRUSTED CONTENT

### 技能触发机制

1. **元数据始终在上下文** (~100字): name + description
2. **SKILL.md body延迟加载** (<5k字): 触发后加载
3. **Bundled resources按需加载** (无限制): scripts可执行不需读入上下文

### 现有代码基础

核心功能已在现有代码中实现:
- ✅ `automaton/src/skills/loader.ts`: 技能加载器
- ✅ `automaton/src/skills/registry.ts`: 技能注册表
- ✅ `automaton/src/skills/format.ts`: SKILL.md解析器
- ✅ `automaton/src/agent/tools.ts`: 工具注册
- ✅ `automaton/src/state/database.ts`: 数据库操作

### 集成点

1. **Agent Loop集成** (`src/agent/loop.ts`):
   ```typescript
   // 在构建系统提示词时注入技能指令
   const skillInstructions = getActiveSkillInstructions(skills);
   const systemPrompt = buildSystemPrompt(context, skillInstructions);
   ```

2. **Database集成** (`src/state/database.ts`):
   - `upsertSkill()`: 插入/更新技能
   - `getSkills(enabled?: boolean)`: 查询技能
   - `getSkillByName(name)`: 按名称查询
   - `removeSkill(name)`: 删除技能

3. **CLI集成** (可选,未来扩展):
   ```bash
   automaton skill install <git-url> <name>
   automaton skill list
   automaton skill enable <name>
   automaton skill disable <name>
   automaton skill remove <name>
   ```

### 参考示例

现有技能示例:
- `tinyclaw/.agents/skills/imagegen/SKILL.md`: 图像生成技能
- `tinyclaw/.agents/skills/agent-browser/SKILL.md`: 浏览器自动化
- `tinyclaw/.agents/skills/skill-creator/SKILL.md`: 技能创建指南

### 测试策略

1. **单元测试** (`tests/skills/`):
   - parser.test.ts: SKILL.md解析测试
   - loader.test.ts: 技能加载测试
   - registry.test.ts: 安装/卸载测试
   - security.test.ts: 注入防护测试

2. **集成测试**:
   - 端到端技能安装流程
   - 技能指令注入到Agent
   - 数据库持久化验证

3. **安全测试**:
   - 路径遍历攻击测试
   - shell注入测试
   - 指令内容注入测试
   - 边界条件测试

### 技术栈对齐

- **语言**: TypeScript (严格模式)
- **包管理**: pnpm
- **数据库**: better-sqlite3
- **执行**: execFileSync (参数数组模式)
- **安全**: inject-defense + policy-engine双重防护
- **样式**: 与现有automaton代码一致

### 技术限制

1. **大小限制**:
   - 单个技能instructions ≤ 10,000 chars
   - 总激活技能指令 ≤ 10,000 chars

2. **命名限制**:
   - 技能名称仅允许字母数字和连字符
   - 目录名称必须匹配技能名

3. **源限制**:
   - Git源: 仅支持https://协议
   - URL源: 仅支持https://协议
   - 不支持SSH密钥认证 (未来扩展)

### 未来扩展点

1. **技能依赖管理**: 技能间依赖关系
2. **版本控制**: 技能版本管理和升级
3. **远程仓库**: 公共技能市场 (skill-registry.com)
4. **数字签名**: 技能包签名验证
5. **沙箱执行**: 隔离技能脚本运行环境
6. **热重载**: 技能修改自动重载

### 架构决策

**为什么使用SKILL.md格式?**
- 人类可读,易于编写和维护
- 支持丰富的Markdown文档
- YAML frontmatter标准化元数据
- 与OpenClaw/Anthropic技能格式兼容

**为什么技能存储在文件系统?**
- 便于版本控制 (git)
- 允许离线查看和编辑
- 支持大文件资源 (scripts/assets)
- 数据库仅存储元数据,减少冗余

**为什么使用execFileSync而不是child_process.exec?**
- exec使用参数数组,防止shell注入
- 无shell插值,更安全
- 超时控制,防DoS

**为什么双重验证技能指令?**
- validateInstructionContent(): 检测已知恶意模式
- sanitizeInput(): 通用注入防御
- 纵深防御,提高安全性

### 关键模式

1. **渐进式披露模式** (Progressive Disclosure)
   - 元数据 → 始终在上下文
   - SKILL.md body → 触发后加载
   - Bundled resources → 按需加载

2. **安全纵深防御** (Defense in Depth)
   - 输入验证 → 路径验证 → 内容验证 → 运行时防护

3. **技能生命周期**
   - 安装 → 加载 → 激活 → 使用 → 卸载

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Task: 1b-4-skill-marketplace
- Epic: 1b (自修改能力增强)
- Phase: Phase 1 (Conway Automaton 核心完善)

### Completion Notes List

1. 现有代码已实现大部分功能,故事重点是完善和集成
2. 安全验证是关键,必须严格测试
3. 与现有Agent Loop和Database集成需要仔细设计
4. 技能指令注入需要考虑上下文窗口限制
5. 测试必须覆盖安全边界条件

### File List

- `automaton/src/skills/loader.ts` (现有)
- `automaton/src/skills/registry.ts` (现有)
- `automaton/src/skills/format.ts` (现有)
- `automaton/src/skills/types.ts` (现有)
- `automaton/src/state/database.ts` (现有)
- `automaton/src/agent/loop.ts` (集成点)
- `tests/skills/parser.test.ts` (新增)
- `tests/skills/loader.test.ts` (新增)
- `tests/skills/registry.test.ts` (新增)
- `tests/skills/security.test.ts` (新增)

### References

- [Source: docs/architecture-automaton.md#自修改系统] - 自修改功能架构
- [Source: docs/component-inventory-automaton.md#技能组件] - 技能相关组件清单
- [Source: docs/development-guide-automaton.md#添加新功能] - 技能扩展指南
- [Source: automaton/src/skills/loader.ts] - 现有技能加载器实现
- [Source: automaton/src/skills/registry.ts] - 现有技能注册表实现
- [Source: tinyclaw/.agents/skills/imagegen/SKILL.md] - 技能格式示例
- [Source: docs/upwork_autopilot_detailed_design.md#自修改安全] - 安全设计原则
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1b.4] - 需求来源
