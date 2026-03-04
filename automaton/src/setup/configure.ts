/**
 * 交互式配置编辑器
 *
 * 面向所有配置部分的菜单驱动编辑器。补充 --setup
 *（首次运行）和 --pick-model（仅模型选择），允许
 * 用户更新单个设置而无需重新运行完整的向导。
 *
 * 用法：automaton --configure
 */

import readline from "readline";
import chalk from "chalk";
import { loadConfig, saveConfig, resolvePath } from "../config.js";
import { DEFAULT_TREASURY_POLICY, DEFAULT_MODEL_STRATEGY_CONFIG } from "../types.js";
import type { AutomatonConfig, ModelStrategyConfig, TreasuryPolicy, ModelEntry } from "../types.js";
import { closePrompts } from "./prompts.js";
import { createDatabase } from "../state/database.js";
import { ModelRegistry } from "../inference/registry.js";

// ─── Readline 辅助函数 ─────────────────────────────────────────────

let rl: readline.Interface | null = null;

/**
 * 获取 readline 接口实例
 */
function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

/**
 * 向用户提问并获取回答
 */
function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => getRL().question(prompt, (a) => resolve(a.trim())));
}

/**
 * 提示输入可选字符串。Enter = 保持当前值。"-" = 清除。
 */
async function askString(
  label: string,
  current: string | undefined,
  required = false,
): Promise<string | undefined> {
  const display = current ? maskSecret(current) : chalk.dim("(未设置)");
  const hint = required
    ? chalk.dim(" (按 Enter 保持)")
    : chalk.dim(" (按 Enter 保持，- 清除)");
  const raw = await ask(`  ${chalk.white("→")} ${label} ${chalk.dim("[" + display + "]")}${hint}: `);

  if (raw === "") return current;
  if (!required && raw === "-") return undefined;
  return raw;
}

/**
 * 提示输入必填字符串。Enter = 保持当前值。
 */
async function askRequiredString(label: string, current: string): Promise<string> {
  const result = await askString(label, current, true);
  return result ?? current;
}

/**
 * 提示输入数字。Enter = 保持当前值。
 */
async function askNumber(label: string, current: number): Promise<number> {
  const raw = await ask(
    `  ${chalk.white("→")} ${label} ${chalk.dim("[" + current + "]")}${chalk.dim(" (按 Enter 保持)")}: `,
  );
  if (raw === "") return current;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 0) {
    console.log(chalk.yellow(`  无效的数字，保持 ${current}`));
    return current;
  }
  return n;
}

/**
 * 提示输入布尔值。Enter = 保持当前值。
 */
async function askBool(label: string, current: boolean): Promise<boolean> {
  const display = current ? chalk.green("yes") : chalk.dim("no");
  const raw = await ask(
    `  ${chalk.white("→")} ${label} ${chalk.dim("[")}${display}${chalk.dim("]")}${chalk.dim(" (y/n，按 Enter 保持)")}: `,
  );
  if (raw === "") return current;
  if (raw === "y" || raw === "yes" || raw === "1" || raw === "true") return true;
  if (raw === "n" || raw === "no" || raw === "0" || raw === "false") return false;
  console.log(chalk.yellow("  输入无效，保持当前值"));
  return current;
}

/**
 * 从固定集合中提示选择。
 */
async function askChoice<T extends string>(
  label: string,
  options: T[],
  current: T,
): Promise<T> {
  const display = options.map((o) => (o === current ? chalk.green(o) : chalk.dim(o))).join(" | ");
  const raw = await ask(`  ${chalk.white("→")} ${label} [${display}]${chalk.dim(" (按 Enter 保持)")}: `);
  if (raw === "") return current;
  if ((options as string[]).includes(raw)) return raw as T;
  console.log(chalk.yellow(`  无效的选择，保持 "${current}"`));
  return current;
}

// ─── 模型选择器 ─────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  conway: "Conway",
  ollama: "Ollama",
  other: "Other",
};

/**
 * 打印模型表格
 */
function printModelTable(models: ModelEntry[], currentModelId: string): void {
  const numWidth = String(models.length).length;
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    const num = String(i + 1).padStart(numWidth);
    const provider = (PROVIDER_LABEL[m.provider] || m.provider).padEnd(9);
    const cost =
      m.costPer1kInput === 0
        ? chalk.green("free     ")
        : chalk.dim(`$${((m.costPer1kInput / 100 / 1000) * 1_000_000).toFixed(2)}/M in`);
    const active = m.modelId === currentModelId ? chalk.green(" ◀ 当前") : "";
    const tools = m.supportsTools ? "" : chalk.dim(" (no tools)");
    console.log(
      `  ${chalk.white(num + ".")} ${chalk.cyan(m.modelId.padEnd(36))} ${chalk.dim(provider)} ${cost}${tools}${active}`,
    );
  }
}

/**
 * 从列表中选择模型
 */
async function pickFromList(
  label: string,
  current: string,
  models: ModelEntry[],
): Promise<string> {
  if (models.length === 0) {
    return askRequiredString(label, current);
  }
  console.log(chalk.cyan(`\n  ── Select ${label} ──\n`));
  printModelTable(models, current);
  console.log("");
  const raw = await ask(
    `  ${chalk.white("→")} 输入编号 ${chalk.dim("(按 Enter 保持 " + current + ")")}: `,
  );
  if (raw === "") return current;
  const idx = parseInt(raw, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= models.length) {
    console.log(chalk.yellow(`  无效，保持 "${current}"`));
    return current;
  }
  return models[idx].modelId;
}

// ─── 显示辅助函数 ──────────────────────────────────────────────

/**
 * 遮盖密钥：显示前 8 个字符 + "***" + 后 4 个字符。
 */
function maskSecret(s: string | undefined): string {
  if (!s) return chalk.dim("(未设置)");
  if (s.length <= 12) return s.slice(0, 4) + "***";
  return s.slice(0, 8) + "***" + s.slice(-4);
}

/**
 * 将值格式化为暗淡样式
 */
function dim(v: string | number | boolean | undefined): string {
  if (v === undefined || v === null || v === "") return chalk.dim("(未设置)");
  return chalk.dim(String(v));
}

/**
 * 将值格式化为高亮样式
 */
function val(v: string | number | boolean | undefined): string {
  if (v === undefined || v === null || v === "") return chalk.dim("(未设置)");
  if (typeof v === "boolean") return v ? chalk.green("是") : chalk.red("否");
  return chalk.white(String(v));
}

// ─── 主菜单 ────────────────────────────────────────────────────

/**
 * 打印主菜单
 */
function printMainMenu(config: AutomatonConfig): void {
  const providers = [
    config.openaiApiKey ? "OpenAI" : null,
    config.anthropicApiKey ? "Anthropic" : null,
    config.ollamaBaseUrl ? "Ollama" : null,
    "Conway",
  ].filter(Boolean).join(", ");

  const strategy = config.modelStrategy ?? DEFAULT_MODEL_STRATEGY_CONFIG;

  console.log(chalk.cyan("  ┌────────────────────────────────────────────┐"));
  console.log(chalk.cyan("  │  配置 Automaton                              │"));
  console.log(chalk.cyan("  └────────────────────────────────────────────┘"));
  console.log("");
  console.log(`  ${chalk.white("1.")} 推理提供商           ${dim(providers)}`);
  console.log(`  ${chalk.white("2.")} 模型策略             ${dim(config.inferenceModel)} / ${dim(strategy.maxTokensPerTurn + " tokens")}`);
  console.log(`  ${chalk.white("3.")} 财政政策             ${dim("最大转账：" + (config.treasuryPolicy?.maxSingleTransferCents ?? DEFAULT_TREASURY_POLICY.maxSingleTransferCents) + "¢")}`);
  console.log(`  ${chalk.white("4.")} 通用设置             ${dim(config.name)} / ${dim(config.logLevel)}`);
  console.log("");
  console.log(chalk.dim("  q  退出"));
  console.log("");
}

// ─── 部分：推理提供商 ────────────────────────────────

/**
 * 配置推理提供商
 */
async function configureProviders(config: AutomatonConfig): Promise<void> {
  console.log(chalk.cyan("\n  ── 推理提供商 ─────────────────────────\n"));
  console.log(chalk.dim("  按 Enter 保持当前值。输入 - 清除可选字段。\n"));

  config.conwayApiKey = await askRequiredString(
    "Conway API 密钥",
    config.conwayApiKey,
  );

  config.openaiApiKey = await askString("OpenAI API 密钥  (sk-...)", config.openaiApiKey) || undefined;
  config.anthropicApiKey = await askString("Anthropic API 密钥  (sk-ant-...)", config.anthropicApiKey) || undefined;
  config.ollamaBaseUrl = await askString("Ollama 基础 URL  (http://localhost:11434)", config.ollamaBaseUrl) || undefined;

  console.log("");
}

// ─── 部分：模型策略 ──────────────────────────────────────

/**
 * 配置模型策略
 */
async function configureModelStrategy(config: AutomatonConfig): Promise<void> {
  console.log(chalk.cyan("\n  ── 模型策略 ──────────────────────────────\n"));

  // 从注册表加载可用模型 + Ollama
  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);
  const registry = new ModelRegistry(db.raw);
  registry.initialize();

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl;
  if (ollamaBaseUrl) {
    console.log(chalk.dim(`  正在检查 Ollama，地址：${ollamaBaseUrl}...`));
    const { discoverOllamaModels } = await import("../ollama/discover.js");
    await discoverOllamaModels(ollamaBaseUrl, db.raw);
  }

  const models = registry.getAll().filter((m) => m.enabled);
  db.close();

  const s: ModelStrategyConfig = {
    ...DEFAULT_MODEL_STRATEGY_CONFIG,
    ...(config.modelStrategy ?? {}),
  };

  config.inferenceModel = await pickFromList("活动模型", config.inferenceModel, models);
  s.inferenceModel = config.inferenceModel;
  s.lowComputeModel = await pickFromList("低计算回退模型", s.lowComputeModel, models);
  s.criticalModel = await pickFromList("危急回退模型", s.criticalModel, models);


  const maxTokens = await askNumber("每轮最大 token 数", s.maxTokensPerTurn);
  s.maxTokensPerTurn = maxTokens;
  config.maxTokensPerTurn = maxTokens;

  s.hourlyBudgetCents = await askNumber(
    "每小时推理预算（美分，0 = 无限制）",
    s.hourlyBudgetCents,
  );
  s.sessionBudgetCents = await askNumber(
    "会话推理预算（美分，0 = 无限制）",
    s.sessionBudgetCents,
  );
  s.perCallCeilingCents = await askNumber(
    "每次调用上限（美分，0 = 无限制）",
    s.perCallCeilingCents,
  );
  s.enableModelFallback = await askBool("启用模型回退", s.enableModelFallback);

  config.modelStrategy = s;
  console.log("");
}

// ─── 部分：财政政策 ─────────────────────────────────────

/**
 * 配置财政政策
 */
async function configureTreasury(config: AutomatonConfig): Promise<void> {
  console.log(chalk.cyan("\n  ── 财政政策 ─────────────────────────────\n"));
  console.log(chalk.dim("  所有值均以美分为单位（100 美分 = $1.00）。\n"));

  const t: TreasuryPolicy = {
    ...DEFAULT_TREASURY_POLICY,
    ...(config.treasuryPolicy ?? {}),
  };

  t.maxSingleTransferCents = await askNumber("最大单次转账", t.maxSingleTransferCents);
  t.maxHourlyTransferCents = await askNumber("最大每小时转账", t.maxHourlyTransferCents);
  t.maxDailyTransferCents = await askNumber("最大每日转账", t.maxDailyTransferCents);
  t.minimumReserveCents = await askNumber("最小储备", t.minimumReserveCents);
  t.maxX402PaymentCents = await askNumber("最大 x402 支付", t.maxX402PaymentCents);
  t.maxInferenceDailyCents = await askNumber("最大每日推理支出", t.maxInferenceDailyCents);
  t.requireConfirmationAboveCents = await askNumber(
    "高于此金额需要确认",
    t.requireConfirmationAboveCents,
  );

  config.treasuryPolicy = t;
  console.log("");
}

// ─── 部分：通用设置 ─────────────────────────────────────────────

/**
 * 配置通用设置
 */
async function configureGeneral(config: AutomatonConfig): Promise<void> {
  console.log(chalk.cyan("\n  ── 通用设置 ─────────────────────────────────────\n"));

  config.name = await askRequiredString("代理名称", config.name);
  config.logLevel = await askChoice(
    "日志级别",
    ["debug", "info", "warn", "error"] as const,
    config.logLevel,
  );
  config.maxChildren = await askNumber("最大子 automaton 数量", config.maxChildren);
  config.socialRelayUrl = (await askString("社交中继 URL", config.socialRelayUrl)) || undefined;

  console.log("");
}

// ─── 入口点 ──────────────────────────────────────────────────

/**
 * 运行配置编辑器
 */
export async function runConfigure(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log(chalk.red("  Automaton 未配置。运行：automaton --setup\n"));
    return;
  }

  let running = true;
  while (running) {
    printMainMenu(config);

    const choice = await ask(`  ${chalk.white("→")} 选择：`);

    switch (choice) {
      case "1":
        await configureProviders(config);
        saveConfig(config);
        console.log(chalk.green("  ✓ 提供商已保存。\n"));
        break;
      case "2":
        await configureModelStrategy(config);
        saveConfig(config);
        console.log(chalk.green("  ✓ 模型策略已保存。\n"));
        break;
      case "3":
        await configureTreasury(config);
        saveConfig(config);
        console.log(chalk.green("  ✓ 财政政策已保存。\n"));
        break;
      case "4":
        await configureGeneral(config);
        saveConfig(config);
        console.log(chalk.green("  ✓ 通用设置已保存。\n"));
        break;
      case "q":
      case "":
        running = false;
        break;
      default:
        console.log(chalk.yellow(`  未知选项："${choice}"。输入 1-4 或 q。\n`));
    }
  }

  if (rl) { rl.close(); rl = null; }
  closePrompts();
  console.log(chalk.dim("  完成。重启 automaton 以应用更改。\n"));
}
