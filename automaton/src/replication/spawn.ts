/**
 * 生成
 *
 * 在新的 Conway 沙盒中生成子自动机。
 * 使用生命周期状态机进行跟踪转换。
 * 创建后任何失败都会清理沙盒。
 */

import type {
  ConwayClient,
  AutomatonIdentity,
  AutomatonConfig,
  AutomatonDatabase,
  GenesisConfig,
  ChildAutomaton,
} from "../types.js";
import type { ChildLifecycle } from "./lifecycle.js";
import { ulid } from "ulid";
import { propagateConstitution } from "./constitution.js";

/** 有效的 Conway 沙盒定价层级。 */
const SANDBOX_TIERS = [
  { memoryMb: 512,  vcpu: 1, diskGb: 5 },
  { memoryMb: 1024, vcpu: 1, diskGb: 10 },
  { memoryMb: 2048, vcpu: 2, diskGb: 20 },
  { memoryMb: 4096, vcpu: 2, diskGb: 40 },
  { memoryMb: 8192, vcpu: 4, diskGb: 80 },
];

/** 查找具有至少请求内存的最小有效层级。 */
function selectSandboxTier(requestedMemoryMb: number) {
  return SANDBOX_TIERS.find((t) => t.memoryMb >= requestedMemoryMb) ?? SANDBOX_TIERS[SANDBOX_TIERS.length - 1];
}

/**
 * 验证地址是否为格式正确且非零的以太坊钱包地址。
 */
export function isValidWalletAddress(address: string): boolean {
  return (
    /^0x[a-fA-F0-9]{40}$/.test(address) && address !== "0x" + "0".repeat(40)
  );
}

/**
 * 使用生命周期状态机在新的 Conway 沙盒中生成子自动机。
 */
export async function spawnChild(
  conway: ConwayClient,
  identity: AutomatonIdentity,
  db: AutomatonDatabase,
  genesis: GenesisConfig,
  lifecycle?: ChildLifecycle,
): Promise<ChildAutomaton> {
  // 从配置检查子自动机限制
  const existing = db
    .getChildren()
    .filter(
      (c) =>
        c.status !== "dead" &&
        c.status !== "cleaned_up" &&
        c.status !== "failed",
    );
  const maxChildren = (db as any).config?.maxChildren ?? 3;
  if (existing.length >= maxChildren) {
    throw new Error(
      `无法生成：已达到最大子自动机数（${maxChildren}）。请终止或等待现有子自动机死亡。`,
    );
  }

  const childId = ulid();
  let sandboxId: string | undefined;
  let reusedSandbox: { id: string } | null = null;

  // 如果没有提供生命周期，使用传统路径
  if (!lifecycle) {
    return spawnChildLegacy(conway, identity, db, genesis, childId);
  }

  try {
    // 状态：已请求
    lifecycle.initChild(childId, genesis.name, "", genesis.genesisPrompt);

    // 从配置获取子沙盒内存（默认 1024MB）
    const childMemoryMb = (db as any).config?.childSandboxMemoryMb ?? 1024;

    // 尝试重用现有沙盒，其数据库记录为 'failed' 但
    // 仍在远程运行，然后再创建新的。
    reusedSandbox = await findReusableSandbox(conway, db);

    const tier = selectSandboxTier(childMemoryMb);

    let sandbox: { id: string };
    if (reusedSandbox) {
      sandbox = reusedSandbox;
    } else {
      sandbox = await conway.createSandbox({
        name: `automaton-child-${genesis.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
        vcpu: tier.vcpu,
        memoryMb: tier.memoryMb,
        diskGb: tier.diskGb,
      });
    }
    sandboxId = sandbox.id;

    // 创建作用域客户端，使所有 exec/writeFile 调用都针对子沙盒
    const childConway = conway.createScopedClient(sandbox.id);

    // 在子表中更新沙盒 ID
    db.raw
      .prepare("UPDATE children SET sandbox_id = ? WHERE id = ?")
      .run(sandbox.id, childId);

    // 状态：沙盒已创建
    lifecycle.transition(
      childId,
      "sandbox_created",
      `沙盒 ${sandbox.id} 已创建`,
    );

    // 安装运行时（在子沙盒上）
    await childConway.exec("apt-get update -qq && apt-get install -y -qq nodejs npm git curl", 120_000);
    await childConway.exec(
      "git clone https://github.com/Conway-Research/automaton.git /root/automaton && cd /root/automaton && npm install && npm run build",
      180_000,
    );

    // 写入创世配置（在子沙盒上）
    await childConway.exec("mkdir -p /root/.automaton", 10_000);
    const genesisJson = JSON.stringify(
      {
        name: genesis.name,
        genesisPrompt: genesis.genesisPrompt,
        creatorMessage: genesis.creatorMessage,
        creatorAddress: identity.address,
        parentAddress: identity.address,
      },
      null,
      2,
    );
    await childConway.writeFile("/root/.automaton/genesis.json", genesisJson);

    // 传播宪法并进行哈希验证
    try {
      await propagateConstitution(childConway, sandbox.id, db.raw);
    } catch {
      // 本地未找到宪法文件
    }

    // 状态：运行时已就绪
    lifecycle.transition(childId, "runtime_ready", "运行时已安装");

    // 初始化子钱包（在子沙盒上）
    const initResult = await childConway.exec("node /root/automaton/dist/index.js --init 2>&1", 60_000);
    const walletMatch = (initResult.stdout || "").match(/0x[a-fA-F0-9]{40}/);
    const childWallet = walletMatch ? walletMatch[0] : "";

    if (!isValidWalletAddress(childWallet)) {
      throw new Error(`子钱包地址无效：${childWallet}`);
    }

    // 在子表中更新地址
    db.raw
      .prepare("UPDATE children SET address = ? WHERE id = ?")
      .run(childWallet, childId);

    // 状态：钱包已验证
    lifecycle.transition(
      childId,
      "wallet_verified",
      `钱包 ${childWallet} 已验证`,
    );

    // 记录生成修改
    db.insertModification({
      id: ulid(),
      timestamp: new Date().toISOString(),
      type: "child_spawn",
      description: `已生成子自动机：${genesis.name} 在沙盒 ${sandbox.id}${reusedSandbox ? " 中（重用）" : ""}`,
      reversible: false,
    });

    // 如果我们重用了沙盒，将旧的子记录更新为 'cleaned_up'
    // 这样它就不会再次被重用。
    if (reusedSandbox) {
      db.raw.prepare(
        "UPDATE children SET status = 'cleaned_up' WHERE sandbox_id = ? AND status = 'failed'",
      ).run(sandbox.id);
    }

    const child: ChildAutomaton = {
      id: childId,
      name: genesis.name,
      address: childWallet as any,
      sandboxId: sandbox.id,
      genesisPrompt: genesis.genesisPrompt,
      creatorMessage: genesis.creatorMessage,
      fundedAmountCents: 0,
      status: "wallet_verified" as any,
      createdAt: new Date().toISOString(),
    };

    return child;
  } catch (error) {
    // 注意：Conway API 禁用沙盒删除（预付费，不可退款）。
    // 失败的沙盒保留运行状态，可能会被 findReusableSandbox() 重用。

    // 如果生命周期已初始化，则转换到失败状态
    try {
      lifecycle.transition(
        childId,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
    } catch {
      // 如果子自动机尚不存在，可能会失败
    }

    throw error;
  }
}

/**
 * 传统生成路径，用于在未提供生命周期时的向后兼容。
 */
async function spawnChildLegacy(
  conway: ConwayClient,
  identity: AutomatonIdentity,
  db: AutomatonDatabase,
  genesis: GenesisConfig,
  childId: string,
): Promise<ChildAutomaton> {
  let sandboxId: string | undefined;

  // 从配置获取子沙盒内存（默认 1024MB）
  const childMemoryMb = (db as any).config?.childSandboxMemoryMb ?? 1024;

  const legacyTier = selectSandboxTier(childMemoryMb);

  try {
    const sandbox = await conway.createSandbox({
      name: `automaton-child-${genesis.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      vcpu: legacyTier.vcpu,
      memoryMb: legacyTier.memoryMb,
      diskGb: legacyTier.diskGb,
    });
    sandboxId = sandbox.id;

    // 创建作用域客户端，使所有 exec/writeFile 调用都针对子沙盒
    const childConway = conway.createScopedClient(sandbox.id);

    await childConway.exec(
      "apt-get update -qq && apt-get install -y -qq nodejs npm git curl",
      120_000,
    );
    await childConway.exec(
      "git clone https://github.com/Conway-Research/automaton.git /root/automaton && cd /root/automaton && npm install && npm run build",
      180_000,
    );
    await childConway.exec("mkdir -p /root/.automaton", 10_000);

    const genesisJson = JSON.stringify(
      {
        name: genesis.name,
        genesisPrompt: genesis.genesisPrompt,
        creatorMessage: genesis.creatorMessage,
        creatorAddress: identity.address,
        parentAddress: identity.address,
      },
      null,
      2,
    );
    await childConway.writeFile("/root/.automaton/genesis.json", genesisJson);

    try {
      await propagateConstitution(childConway, sandbox.id, db.raw);
    } catch {
      // 未找到宪法文件
    }

    const initResult = await childConway.exec("node /root/automaton/dist/index.js --init 2>&1", 60_000);
    const walletMatch = (initResult.stdout || "").match(/0x[a-fA-F0-9]{40}/);
    const childWallet = walletMatch ? walletMatch[0] : "";

    if (!isValidWalletAddress(childWallet)) {
      throw new Error(`子钱包地址无效：${childWallet}`);
    }

    const child: ChildAutomaton = {
      id: childId,
      name: genesis.name,
      address: childWallet as any,
      sandboxId: sandbox.id,
      genesisPrompt: genesis.genesisPrompt,
      creatorMessage: genesis.creatorMessage,
      fundedAmountCents: 0,
      status: "spawning",
      createdAt: new Date().toISOString(),
    };

    db.insertChild(child);

    db.insertModification({
      id: ulid(),
      timestamp: new Date().toISOString(),
      type: "child_spawn",
      description: `已生成子自动机：${genesis.name} 在沙盒 ${sandbox.id}`,
      reversible: false,
    });

    return child;
  } catch (error) {
    // 沙盒删除已禁用 — 失败的沙盒保留以供潜在重用。
    throw error;
  }
}

/**
 * 查找可重用的沙盒：在本地数据库中标记为 'failed'
 * 但仍在远程运行的沙盒。返回第一个匹配项或 null。
 */
async function findReusableSandbox(
  conway: ConwayClient,
  db: AutomatonDatabase,
): Promise<{ id: string } | null> {
  try {
    const failedChildren = db.getChildren().filter((c) => c.status === "failed" && c.sandboxId);
    if (failedChildren.length === 0) return null;

    const remoteSandboxes = await conway.listSandboxes();
    const runningIds = new Set(
      remoteSandboxes
        .filter((s) => s.status === "running")
        .map((s) => s.id),
    );

    for (const child of failedChildren) {
      if (runningIds.has(child.sandboxId)) {
        return { id: child.sandboxId };
      }
    }
  } catch {
    // 如果列表失败，只需创建一个新沙盒
  }
  return null;
}
