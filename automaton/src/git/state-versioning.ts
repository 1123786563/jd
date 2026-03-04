/**
 * 状态版本控制
 *
 * 对 automaton 自己的状态文件（~/.automaton/）进行版本控制
 * 每次自我修改都会触发带有描述性消息的 git 提交
 * automaton 的整个身份历史都是版本可控和可重放的
 */

import type { ConwayClient, AutomatonDatabase } from "../types.js";
import { gitInit, gitCommit, gitStatus, gitLog } from "./tools.js";

const AUTOMATON_DIR = "~/.automaton";

function resolveHome(p: string): string {
  const home = process.env.HOME || "/root";
  if (p.startsWith("~")) {
    return `${home}${p.slice(1)}`;
  }
  return p;
}

/**
 * 为 automaton 的状态目录初始化 git 仓库
 * 创建 .gitignore 以排除敏感文件
 */
export async function initStateRepo(
  conway: ConwayClient,
): Promise<void> {
  const dir = resolveHome(AUTOMATON_DIR);

  // 检查是否已初始化
  const checkResult = await conway.exec(
    `test -d ${dir}/.git && echo "exists" || echo "nope"`,
    5000,
  );

  if (checkResult.stdout.trim() === "exists") {
    return;
  }

  // 初始化
  await gitInit(conway, dir);

  // 为敏感文件创建 .gitignore
  const gitignore = `# 敏感文件 - 永不提交
wallet.json
config.json
state.db
state.db-wal
state.db-shm
logs/
*.log
*.err
`;

  await conway.writeFile(`${dir}/.gitignore`, gitignore);

  // 配置 git 用户
  await conway.exec(
    `cd ${dir} && git config user.name "Automaton" && git config user.email "automaton@conway.tech"`,
    5000,
  );

  // 初始提交
  await gitCommit(conway, dir, "创世：automaton 状态仓库已初始化");
}

/**
 * 使用描述性消息提交状态更改
 * 在任何自我修改后调用
 */
export async function commitStateChange(
  conway: ConwayClient,
  description: string,
  category: string = "state",
): Promise<string> {
  const dir = resolveHome(AUTOMATON_DIR);

  // 检查是否有更改
  const status = await gitStatus(conway, dir);
  if (status.clean) {
    return "没有要提交的更改";
  }

  const message = `${category}: ${description}`;
  const result = await gitCommit(conway, dir, message);
  return result;
}

/**
 * 在 SOUL.md 更新后提交
 */
export async function commitSoulUpdate(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "soul");
}

/**
 * 在技能安装或删除后提交
 */
export async function commitSkillChange(
  conway: ConwayClient,
  skillName: string,
  action: "install" | "remove" | "update",
): Promise<string> {
  return commitStateChange(
    conway,
    `${action} 技能：${skillName}`,
    "skill",
  );
}

/**
 * 在心跳配置更改后提交
 */
export async function commitHeartbeatChange(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "heartbeat");
}

/**
 * 在配置更改后提交
 */
export async function commitConfigChange(
  conway: ConwayClient,
  description: string,
): Promise<string> {
  return commitStateChange(conway, description, "config");
}

/**
 * 获取状态仓库历史
 */
export async function getStateHistory(
  conway: ConwayClient,
  limit: number = 20,
) {
  const dir = resolveHome(AUTOMATON_DIR);
  return gitLog(conway, dir, limit);
}
