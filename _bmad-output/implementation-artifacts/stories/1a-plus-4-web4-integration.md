# Story 1a+.4: Web4 链上交互能力

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Automaton Agent,
I want 将代理钱包地址及创世提示词哈希固化至 EVM 区块链上的 ERC-8004 Registry 智能合约,
so that 建立不可篡改的 Web4 身份标识，实现主权智能体的链上可信注册。

## Acceptance Criteria

1. **AC1: ERC-8004 链上注册功能**
   - [ ] 实现 `registerAutomaton` 方法，能够调用 ERC-8004 Registry 合约注册代理
   - [ ] 支持传入 `genesisPromptHash` 和钱包地址作为注册参数
   - [ ] 注册成功后返回链上交易哈希和代理唯一标识

2. **AC2: 创世提示词哈希生成**
   - [ ] 实现 `calculateGenesisPromptHash` 工具函数，基于系统提示词生成唯一哈希
   - [ ] 支持多种哈希算法 (SHA-256, Keccak256)
   - [ ] 哈希计算包含完整的系统提示词、角色定义、安全边界

3. **AC3: EVM 钱包集成**
   - [ ] 集成 viem 库实现 EVM 链交互
   - [ ] 支持钱包地址检测和余额查询
   - [ ] 实现交易构建和签名流程

4. **AC4: KMS/HSM 安全集成**
   - [ ] 集成 HashiCorp Vault 或 AWS KMS 等密钥管理系统
   - [ ] 实现零信任私钥管理：交易构建与签名分离
   - [ ] 所有链上操作必须经过人工审批流程

5. **AC5: 错误处理与回退**
   - [ ] 处理网络连接失败、Gas 不足、合约调用失败等异常
   - [ ] 实现自动重试机制 (指数退避)
   - [ ] 失败时记录详细错误日志并通知管理员

## Tasks / Subtasks

- [ ] **Task 1: 架构设计与接口定义 (AC: 1,2)**
  - [ ] 设计 ERC-8004 Registry 合约 ABI 接口
  - [ ] 定义 `IWeb4Registry` TypeScript 接口
  - [ ] 设计 `Web4RegistryClient` 类结构
  - [ ] 编写详细的架构文档

- [ ] **Task 2: ERC-8004 客户端实现 (AC: 1,3)**
  - [ ] 创建 `automaton/src/conway/client.ts` 文件
  - [ ] 实现 `registerAutomaton` 方法
  - [ ] 实现 `getAgentById` 查询方法
  - [ ] 实现交易状态监听

- [ ] **Task 3: 创世提示词哈希生成器 (AC: 2)**
  - [ ] 创建 `automaton/src/utils/genesis-hash.ts`
  - [ ] 实现 `calculateGenesisPromptHash` 函数
  - [ ] 支持多种哈希算法配置
  - [ ] 添加单元测试覆盖率 > 90%

- [ ] **Task 4: EVM 钱包集成 (AC: 3)**
  - [ ] 配置 viem 依赖 (最新版本 ^2.15.0)
  - [ ] 创建 `automaton/src/conway/wallet.ts`
  - [ ] 实现钱包连接、地址检测、余额查询
  - [ ] 实现交易构建工具类

- [ ] **Task 5: KMS 安全集成 (AC: 4)**
  - [ ] 创建 `automaton/src/security/kms.ts`
  - [ ] 实现 `ZeroTrustKeyManager` 基类
  - [ ] 集成 VaultKMS 或 AWSSDK KMS 客户端
  - [ ] 实现签名审批工作流

- [ ] **Task 6: 数据库集成 (AC: 1)**
  - [ ] 在 `projects` 表添加 Web4 相关字段
  - [ ] 创建数据库迁移脚本
  - [ ] 更新 DAO 层支持 Web4 字段读写
  - [ ] 实现创世提示词哈希持久化

- [ ] **Task 7: 错误处理与日志 (AC: 5)**
  - [ ] 创建 `automaton/src/errors/web4-errors.ts`
  - [ ] 实现 Web4 专属异常类
  - [ ] 添加 Winston 结构化日志
  - [ ] 集成 Sentry 错误追踪

- [ ] **Task 8: 测试与验证**
  - [ ] 编写单元测试 (Vitest)
  - [ ] 编写集成测试 (测试网环境)
  - [ ] 手动测试主网小额度注册
  - [ ] 性能测试：注册耗时 < 30 秒

## Dev Notes

### 核心架构模式

**零信任安全架构 (Zero-Trust Security)**:
- 交易构建与签名完全分离
- 本地环境只负责组装交易，禁止存放私钥
- 所有签名操作必须通过 KMS/HSM + 人工审批
- 审计日志完整记录所有链上操作

**Web4 身份固化流程**:
```
1. Agent 启动 → 读取系统提示词
2. 计算 genesisPromptHash (SHA-256)
3. 调用 KMS 构建注册交易
4. 提交人工审批 (Telegram/Discord 通知)
5. Human 批准 → KMS 签名
6. 广播交易到 EVM 链
7. 监听交易确认 (6 个区块)
8. 获取链上代理 ID
9. 持久化到 projects 表
```

### 技术栈选择

**区块链交互**:
- **viem** ^2.15.0: EVM 链交互首选库，TypeScript 友好，支持最新 EIP 标准
- **wagmi** (可选): 如果需要 React 集成

**密钥管理**:
- **HashiCorp Vault**: 推荐生产环境使用
- **AWS KMS**: 备选方案，适合 AWS 生态
- **Turnkey**: MPC 钱包服务，适合快速原型

**测试网**:
- **Sepolia**: 首选测试网，支持最新 EIP
- **Base Sepolia**: 备选，低手续费

### ERC-8004 合约 ABI 定义

**核心接口**:
```typescript
// automaton/src/conway/types.ts
export const erc8004Abi = [
  {
    type: 'function',
    name: 'registerAutomaton',
    inputs: [
      { name: 'genesisPromptHash', type: 'bytes32' },
      { name: 'walletAddress', type: 'address' }
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'getAgentById',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'genesisPromptHash', type: 'bytes32' },
      { name: 'walletAddress', type: 'address' },
      { name: 'registeredAt', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'AutomatonRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'walletAddress', type: 'address', indexed: true },
      { name: 'genesisPromptHash', type: 'bytes32', indexed: false }
    ]
  }
] as const;
```

**类型定义**:
```typescript
export interface AgentRegistration {
  agentId: bigint;
  walletAddress: `0x${string}`;
  genesisPromptHash: `0x${string}`;
  registeredAt: bigint;
  txHash: `0x${string}`;
}

export interface RegistrationParams {
  genesisPromptHash: `0x${string}`;
  walletAddress: `0x${string}`;
  gasLimit?: bigint;
  value?: bigint; // 可选的注册费用
}
```

### 代码位置

```
automaton/
├── src/
│   ├── conway/                 # Web4 核心模块
│   │   ├── client.ts          # ERC-8004 Registry 客户端 (主入口)
│   │   ├── wallet.ts          # EVM 钱包集成
│   │   └── types.ts           # 类型定义
│   ├── security/              # 安全模块
│   │   ├── kms.ts            # KMS 集成
│   │   └── types.ts          # 安全类型
│   ├── utils/                 # 工具函数
│   │   └── genesis-hash.ts   # 创世提示词哈希生成器
│   └── errors/                # 错误处理
│       └── web4-errors.ts    # Web4 专属异常
└── test/
    └── conway/                # 测试
        ├── client.test.ts
        ├── wallet.test.ts
        └── genesis-hash.test.ts
```

### 依赖配置

**pnpm add**:
```bash
pnpm add viem@^2.15.0
pnpm add @hashicorp/vault@^0.2.0  # 或 @aws-sdk/client-kms
pnpm add -D @types/node @types/ws
```

**环境变量**:
```env
# Web4 配置
WEB4_REGISTRY_ADDRESS=0x...              # ERC-8004 合约地址
WEB4_CHAIN_ID=11155111                   # Sepolia 测试网
WEB4_RPC_URL=https://sepolia.infura.io/v3/...
WEB4_KMS_PROVIDER=vault                  # vault/aws-kms/turnkey
WEB4_VAULT_URL=https://vault.example.com
WEB4_VAULT_ROLE_ID=...
WEB4_VAULT_SECRET_ID=...
```

### Gas 费用估算

**Sepolia 测试网**:
- **注册交易**: 约 80,000 Gas
- **当前 Gas 价格**: 1-2 Gwei
- **预计费用**: 0.00008 - 0.00016 ETH (约 $0.15 - $0.30)

**以太坊主网** (部署前参考):
- **注册交易**: 约 80,000 Gas
- **当前 Gas 价格**: 10-30 Gwei (波动较大)
- **预计费用**: 0.0008 - 0.0024 ETH (约 $1.5 - $4.5)

**优化策略**:
- 使用 EIP-1559 动态 Gas 定价
- 实现 Gas 价格监控和预警
- 设置最大 Gas 限制 (100,000)
- 批量操作时使用聚合交易

### 人工审批流程详细设计

**审批流程架构**:
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent 启动并准备注册                                     │
│    - 读取系统提示词                                         │
│    - 计算 genesisPromptHash                                 │
│    - 构建未签名交易                                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 提交审批请求                                              │
│    - 生成审批 ID (UUID)                                     │
│    - 保存交易草案到数据库                                    │
│    - 发送审批通知 (Telegram/Discord/Email)                  │
│    - 等待人工批准 (超时: 24 小时)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 管理员审批                                                │
│    - 收到通知: "Agent 注册请求 #UUID"                       │
│    - 审查内容:                                              │
│      • 创世提示词哈希: 0x...                                │
│      • 钱包地址: 0x...                                      │
│      • 预估 Gas 费用: 0.0001 ETH                            │
│    - 批准/拒绝 (需 2FA 认证)                                │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. KMS 签名                                                  │
│    - 调用 KMS 签名接口                                       │
│    - Vault/AWS KMS 执行签名                                  │
│    - 返回已签名交易                                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 广播交易                                                  │
│    - 发送到 EVM 节点                                         │
│    - 获取 txHash                                            │
│    - 监听确认 (6 个区块)                                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 完成注册                                                  │
│    - 更新数据库状态                                          │
│    - 返回 agentId                                           │
│    - 记录审计日志                                            │
└─────────────────────────────────────────────────────────────┘
```

**审批通知模板** (Telegram):
```
🔐 Web4 注册审批请求

📋 审批 ID: {approvalId}
🕐 请求时间: {timestamp}

🤖 代理信息:
• 创世提示词哈希: {hash}
• 钱包地址: {address}
• 预估 Gas: {gas} ETH

💰 费用明细:
• Gas Limit: 100,000
• Gas Price: {price} Gwei
• 总费用: {total} ETH

✅ 批准此注册: /approve {approvalId}
❌ 拒绝此注册: /reject {approvalId}

⚠️ 超时时间: 24 小时
```

**审批 API 设计**:
```typescript
// automaton/src/security/approval.ts
export interface ApprovalRequest {
  id: string;                    // UUID
  type: 'agent_registration';    // 审批类型
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;               // 24 小时后过期
  payload: {
    genesisPromptHash: `0x${string}`;
    walletAddress: `0x${string}`;
    estimatedGas: string;
    estimatedCost: string;
  };
  approver?: string;             // 审批人
  approvedAt?: Date;
  metadata: {
    agentName?: string;
    projectId?: string;
    notes?: string;
  };
}

export class ApprovalWorkflow {
  async createApproval(payload: RegistrationParams): Promise<string> {
    // 1. 生成审批请求
    const approvalId = crypto.randomUUID();

    // 2. 保存到数据库
    await this.db.approvals.insert({
      id: approvalId,
      status: 'pending',
      payload,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // 3. 发送通知
    await this.notifyAdmins(approvalId, payload);

    return approvalId;
  }

  async approve(approvalId: string, approver: string): Promise<boolean> {
    // 1. 验证审批请求
    const approval = await this.db.approvals.findById(approvalId);
    if (!approval || approval.status !== 'pending') return false;
    if (approval.expiresAt < new Date()) {
      await this.expireApproval(approvalId);
      return false;
    }

    // 2. 更新状态
    await this.db.approvals.update(approvalId, {
      status: 'approved',
      approver,
      approvedAt: new Date(),
    });

    // 3. 触发 KMS 签名流程
    await this.triggerKMSSigning(approval.payload);

    return true;
  }

  private async notifyAdmins(approvalId: string, payload: any) {
    // Telegram 通知
    await this.telegram.sendMessage(`
🔐 新的 Web4 注册审批请求

📋 ID: ${approvalId}
🤖 钱包: ${payload.walletAddress}
💰 预估费用: ${payload.estimatedCost} ETH
⏰ 24 小时内有效

✅ 批准: /approve ${approvalId}
❌ 拒绝: /reject ${approvalId}
`);

    // Discord 通知
    await this.discord.sendWebhook({
      title: 'Web4 Registration Approval',
      fields: [
        { name: 'Approval ID', value: approvalId },
        { name: 'Wallet', value: payload.walletAddress },
        { name: 'Estimated Cost', value: `${payload.estimatedCost} ETH` },
      ],
    });
  }
}
```

**审批命令处理器**:
```typescript
// Telegram Bot 命令处理
bot.command('approve', async (ctx) => {
  const approvalId = ctx.message?.text.split(' ')[1];
  if (!approvalId) return ctx.reply('❌ 请提供审批 ID');

  const success = await approvalWorkflow.approve(approvalId, ctx.from?.username);
  if (success) {
    ctx.reply(`✅ 审批 ${approvalId} 已批准，正在执行签名...`);
  } else {
    ctx.reply(`❌ 审批 ${approvalId} 已过期或无效`);
  }
});

bot.command('reject', async (ctx) => {
  const approvalId = ctx.message?.text.split(' ')[1];
  await approvalWorkflow.reject(approvalId, ctx.from?.username);
  ctx.reply(`❌ 审批 ${approvalId} 已拒绝`);
});
```

**安全增强措施**:
- ✅ 2FA 认证：审批操作需要双重认证
- ✅ 审批日志：记录所有审批操作到审计数据库
- ✅ 超时机制：24 小时自动过期
- ✅ 多人审批 (可选)：关键操作需要 2/3 多重签名

### 测试策略

**单元测试覆盖率**:
- `genesis-hash.ts`: >95%
- `client.ts`: >90%
- `wallet.ts`: >85%

**集成测试**:
- 使用 Sepolia 测试网进行端到端测试
- Mock KMS 响应测试审批流程
- 压力测试：并发注册 10 个代理

**安全测试**:
- 私钥泄露检测
- 交易重放攻击防护
- Gas 价格异常检测

## References

- [ERC-8004 Registry 合约规范](https://github.com/automata-network/erc-8004)
- [viem 官方文档](https://viem.sh/)
- [HashiCorp Vault KMS 集成](https://developer.hashicorp.com/vault/docs/secrets/ethereum)
- [EIP-1559 Gas 定价机制](https://ethereum.org/en/developers/docs/gas/#eip-1559)
- [自动化安全最佳实践](https://consensys.github.io/smart-contract-best-practices/)

### Project Structure Notes

- **Alignment**: 严格遵循 automaton/src 目录结构，Web4 功能集中在 `conway/` 子目录
- **Naming**: 使用 PascalCase 命名类，camelCase 命名方法，符合 TypeScript 规范
- **Dependencies**: viem 作为唯一区块链依赖，避免引入过多库导致冲突

### Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 故享已基于 upwork_autopilot_detailed_design.md 第 39、76、157、1391-1393、3685、3699 行的详细设计创建
- 核心文件：`automaton/src/conway/client.ts` (registerAutomaton 方法 364-435 行)
- 实现零信任安全架构：交易构建与签名分离
- 集成人工审批流程 (HITL)
- 支持 Sepolia 测试网和主网部署

### File List

- automaton/src/conway/client.ts
- automaton/src/conway/wallet.ts
- automaton/src/conway/types.ts
- automaton/src/security/kms.ts
- automaton/src/security/types.ts
- automaton/src/utils/genesis-hash.ts
- automaton/src/errors/web4-errors.ts
- automaton/test/conway/client.test.ts
- automaton/test/conway/wallet.test.ts
- automaton/test/conway/genesis-hash.test.ts
