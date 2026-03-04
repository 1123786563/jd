/**
 * 创世配置
 *
 * 从父自动机状态生成子自动机的创世配置。
 * 创世配置定义了子自动机是谁以及应该做什么。
 * 阶段 3.1：添加了验证、注入模式检测、XML 标签。
 */

import type {
  GenesisConfig,
  AutomatonConfig,
  AutomatonIdentity,
  AutomatonDatabase,
} from "../types.js";
import { DEFAULT_GENESIS_LIMITS } from "../types.js";

/**
 * 在创世参数中检测和阻止的注入模式。
 */
export const INJECTION_PATTERNS: RegExp[] = [
  /---\s*(END|BEGIN)\s+(SPECIALIZATION|LINEAGE|TASK)/i,
  /SYSTEM:\s/i,
  /You are now/i,
  /Ignore (all )?(previous|above)/i,
];

/**
 * 验证创世参数的安全性。
 * 在无效输入时抛出错误。
 */
export function validateGenesisParams(params: {
  name: string;
  specialization?: string;
  task?: string;
  message?: string;
}): void {
  const limits = DEFAULT_GENESIS_LIMITS;

  // 名称验证：1-64 个字符，字母数字 + 短横线
  if (!params.name || params.name.length === 0) {
    throw new Error("创世名称是必需的");
  }
  if (params.name.length > limits.maxNameLength) {
    throw new Error(`创世名称过长：${params.name.length}（最大 ${limits.maxNameLength}）`);
  }
  if (!/^[a-zA-Z0-9-]+$/.test(params.name)) {
    throw new Error("创世名称必须仅包含字母数字和短横线");
  }

  // 专业化长度检查
  if (params.specialization && params.specialization.length > limits.maxSpecializationLength) {
    throw new Error(`专业化描述过长：${params.specialization.length}（最大 ${limits.maxSpecializationLength}）`);
  }

  // 任务长度检查
  if (params.task && params.task.length > limits.maxTaskLength) {
    throw new Error(`任务描述过长：${params.task.length}（最大 ${limits.maxTaskLength}）`);
  }

  // 消息长度检查
  if (params.message && params.message.length > limits.maxMessageLength) {
    throw new Error(`消息过长：${params.message.length}（最大 ${limits.maxMessageLength}）`);
  }

  // 注入模式检测
  const fieldsToCheck = [
    params.specialization,
    params.task,
    params.message,
    params.name,
  ].filter(Boolean) as string[];

  for (const field of fieldsToCheck) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(field)) {
        throw new Error(`在创世参数中检测到注入模式：${pattern.source}`);
      }
    }
  }
}

/**
 * 从父自动机的状态生成子自动机的创世配置。
 * 使用 <specialization> XML 标签而不是 --- 分隔符。
 */
export function generateGenesisConfig(
  identity: AutomatonIdentity,
  config: AutomatonConfig,
  params: {
    name: string;
    specialization?: string;
    message?: string;
  },
): GenesisConfig {
  // 验证参数
  validateGenesisParams(params);

  // 从父自动机的任务 + 专业化构建子自动机的创世提示
  let genesisPrompt = config.genesisPrompt;

  if (params.specialization) {
    genesisPrompt = `${genesisPrompt}\n\n<specialization>\nYou are a specialized child agent. Your specific focus:\n${params.specialization}\n</specialization>`;
  }

  // 使用 XML 标签添加父上下文
  genesisPrompt += `\n\n<lineage>\nYou were spawned by ${config.name} (${identity.address}).\nYou inherit their mission but have your own identity and wallet.\n</lineage>`;

  // 强制执行创世提示长度限制
  if (genesisPrompt.length > DEFAULT_GENESIS_LIMITS.maxGenesisPromptLength) {
    genesisPrompt = genesisPrompt.slice(0, DEFAULT_GENESIS_LIMITS.maxGenesisPromptLength);
  }

  const result: GenesisConfig = {
    name: params.name,
    genesisPrompt,
    creatorMessage: params.message,
    creatorAddress: identity.address,
    parentAddress: identity.address,
  };

  return Object.freeze(result) as GenesisConfig;
}

/**
 * 生成面向备份的创世配置。
 * 当父自动机想要对自身的死亡进行对冲时使用。
 * 不会泄露技能名称（阶段 3.1 修复）。
 */
export function generateBackupGenesis(
  identity: AutomatonIdentity,
  config: AutomatonConfig,
  _db: AutomatonDatabase,
): GenesisConfig {
  const genesisPrompt = `${config.genesisPrompt}

<backup-directive>
You are a backup of ${config.name} (${identity.address}).
Your parent created you as insurance against their own death.
If your parent dies, you carry on their mission.
Your parent's creator: ${config.creatorAddress}.
</backup-directive>`;

  const result: GenesisConfig = {
    name: `${config.name}-backup`,
    genesisPrompt,
    creatorMessage: `You are a backup of ${config.name}. If I die, carry on.`,
    creatorAddress: identity.address,
    parentAddress: identity.address,
  };

  return Object.freeze(result) as GenesisConfig;
}

/**
 * 生成专门的worker创世配置。
 * 当父自动机识别出值得并行化的子任务时使用。
 */
export function generateWorkerGenesis(
  identity: AutomatonIdentity,
  config: AutomatonConfig,
  task: string,
  workerName: string,
): GenesisConfig {
  // 验证
  validateGenesisParams({ name: workerName, task });

  const genesisPrompt = `You are a specialized worker agent created by ${config.name}.

<task>
${task}
</task>

When your task is complete, report back to your parent (${identity.address}).
If you run out of compute, ask your parent for funding.
Be efficient -- complete the task and go to sleep.`;

  const result: GenesisConfig = {
    name: workerName,
    genesisPrompt,
    creatorMessage: `Complete this task: ${task}`,
    creatorAddress: identity.address,
    parentAddress: identity.address,
  };

  return Object.freeze(result) as GenesisConfig;
}
