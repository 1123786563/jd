/**
 * 工具管理器
 *
 * 管理外部工具和 MCP 服务器的安装和配置。
 */

import type {
  ConwayClient,
  AutomatonDatabase,
  InstalledTool,
} from "../types.js";
import { logModification } from "./audit-log.js";
import { ulid } from "ulid";

/**
 * 在沙箱中全局安装 npm 包。
 */
export async function installNpmPackage(
  conway: ConwayClient,
  db: AutomatonDatabase,
  packageName: string,
): Promise<{ success: boolean; error?: string }> {
  // 清理包名（防止命令注入）
  if (!/^[@a-zA-Z0-9._/-]+$/.test(packageName)) {
    return {
      success: false,
      error: `无效的包名：${packageName}`,
    };
  }

  const result = await conway.exec(
    `npm install -g ${packageName}`,
    120000,
  );

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: `npm 安装失败：${result.stderr}`,
    };
  }

  // 记录到数据库
  const tool: InstalledTool = {
    id: ulid(),
    name: packageName,
    type: "custom",
    config: { source: "npm", installCommand: `npm install -g ${packageName}` },
    installedAt: new Date().toISOString(),
    enabled: true,
  };

  db.installTool(tool);

  logModification(db, "tool_install", `已安装 npm 包：${packageName}`, {
    reversible: true,
  });

  return { success: true };
}

/**
 * 安装 MCP 服务器。
 * automaton 可以通过安装 MCP 服务器来添加新功能。
 */
export async function installMcpServer(
  conway: ConwayClient,
  db: AutomatonDatabase,
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  // 记录到数据库
  const tool: InstalledTool = {
    id: ulid(),
    name: `mcp:${name}`,
    type: "mcp",
    config: { command, args, env },
    installedAt: new Date().toISOString(),
    enabled: true,
  };

  db.installTool(tool);

  logModification(
    db,
    "mcp_install",
    `已安装 MCP 服务器：${name} (${command})`,
    { reversible: true },
  );

  return { success: true };
}

/**
 * 列出所有已安装的工具。
 */
export function listInstalledTools(
  db: AutomatonDatabase,
): InstalledTool[] {
  return db.getInstalledTools();
}

/**
 * 移除（禁用）已安装的工具。
 */
export function removeTool(
  db: AutomatonDatabase,
  toolId: string,
): void {
  db.removeTool(toolId);
  logModification(db, "tool_install", `已移除工具：${toolId}`, {
    reversible: true,
  });
}
