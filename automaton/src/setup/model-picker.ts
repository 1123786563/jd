/**
 * 交互式模型选择器
 *
 * 显示可用模型的编号列表，让用户
 * 选择一个作为活动推理模型。
 *
 * 用法：automaton --pick-model
 */

import chalk from "chalk";
import { loadConfig, saveConfig, resolvePath } from "../config.js";
import { createDatabase } from "../state/database.js";
import { ModelRegistry } from "../inference/registry.js";
import { discoverOllamaModels } from "../ollama/discover.js";
import type { ModelEntry } from "../types.js";
import { promptOptional, closePrompts } from "./prompts.js";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  conway: "Conway",
  ollama: "Ollama",
  other: "Other",
};

/**
 * 运行模型选择器
 */
export async function runModelPicker(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log(chalk.red("  Automaton 未配置。运行：automaton --setup"));
    return;
  }

  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  // 从注册表加载静态基线模型 + 发现 Ollama 模型
  const registry = new ModelRegistry(db.raw);
  registry.initialize();

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl;
  if (ollamaBaseUrl) {
    console.log(chalk.dim(`  正在检查 Ollama，地址：${ollamaBaseUrl}...`));
    await discoverOllamaModels(ollamaBaseUrl, db.raw);
  }

  const models = registry.getAll().filter((m) => m.enabled);

  if (models.length === 0) {
    console.log(chalk.yellow("  注册表中没有可用模型。"));
    db.close();
    closePrompts();
    return;
  }

  console.log(chalk.cyan("\n  可用模型\n"));
  printModelTable(models, config.inferenceModel);

  console.log("");
  const input = await promptOptional("输入模型编号（或按 Enter 取消）");
  closePrompts();

  if (!input) {
    console.log(chalk.dim("  已取消。"));
    db.close();
    return;
  }

  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= models.length) {
    console.log(chalk.red(`  无效的选择："${input}"`));
    db.close();
    return;
  }

  const selected = models[idx];
  config.inferenceModel = selected.modelId;
  if (config.modelStrategy) {
    config.modelStrategy.inferenceModel = selected.modelId;
  }
  saveConfig(config);

  console.log(chalk.green(`\n  活动模型已设置为：${selected.modelId} (${selected.displayName})`));
  console.log(chalk.dim("  重启 automaton 以使更改生效。\n"));

  db.close();
}

/**
 * 打印模型表格
 */
function printModelTable(models: ModelEntry[], currentModelId: string): void {
  const numWidth = String(models.length).length;

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    const num = String(i + 1).padStart(numWidth);
    const provider = (PROVIDER_LABEL[m.provider] || m.provider).padEnd(9);
    const cost = m.costPer1kInput === 0
      ? chalk.green("free     ")
      : chalk.dim(`$${(m.costPer1kInput / 100 / 1000 * 1_000_000).toFixed(2)}/M in`);
    const active = m.modelId === currentModelId ? chalk.green(" ◀ 当前") : "";
    const tools = m.supportsTools ? "" : chalk.dim(" (不支持工具)");

    console.log(
      `  ${chalk.white(num + ".")} ${chalk.cyan(m.modelId.padEnd(32))} ${chalk.dim(provider)} ${cost}${tools}${active}`,
    );
  }
}
