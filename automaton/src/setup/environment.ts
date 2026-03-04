import fs from "fs";

export interface EnvironmentInfo {
  type: string;
  sandboxId: string;
}

/**
 * 检测 Automaton 运行环境
 *
 * 按优先级检测：
 * 1. 环境变量 CONWAY_SANDBOX_ID
 * 2. 沙箱配置文件 /etc/conway/sandbox.json
 * 3. Docker 环境
 * 4. 本地平台
 */
export function detectEnvironment(): EnvironmentInfo {
  // 1. 检查环境变量
  if (process.env.CONWAY_SANDBOX_ID) {
    return { type: "conway-sandbox", sandboxId: process.env.CONWAY_SANDBOX_ID };
  }

  // 2. 检查沙箱配置文件
  try {
    if (fs.existsSync("/etc/conway/sandbox.json")) {
      const data = JSON.parse(fs.readFileSync("/etc/conway/sandbox.json", "utf-8"));
      if (data.id) {
        return { type: "conway-sandbox", sandboxId: data.id };
      }
    }
  } catch {}

  // 3. 检查 Docker
  if (fs.existsSync("/.dockerenv")) {
    return { type: "docker", sandboxId: "" };
  }

  // 4. 回退到平台
  return { type: process.platform, sandboxId: "" };
}
