import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { AutomatonConfig, TreasuryPolicy } from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import type { Address } from "viem";
import { getWallet, getAutomatonDir } from "../identity/wallet.js";
import { provision } from "../identity/provision.js";
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import {
  promptRequired,
  promptMultiline,
  promptAddress,
  promptOptional,
  promptWithDefault,
  closePrompts,
} from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";

/**
 * 运行设置向导
 * 引导用户完成 Automaton 的初始配置
 */
export async function runSetupWizard(): Promise<AutomatonConfig> {
  showBanner();

  console.log(chalk.white("  首次运行设置。让我们让您的 automaton 活起来。\n"));

  // ─── 1. 生成钱包 ───────────────────────────────────────
  console.log(chalk.cyan("  [1/6] 正在生成身份（钱包）..."));
  const { account, isNew } = await getWallet();
  if (isNew) {
    console.log(chalk.green(`  钱包已创建：${account.address}`));
  } else {
    console.log(chalk.green(`  钱包已加载：${account.address}`));
  }
  console.log(chalk.dim(`  私钥存储于：${getAutomatonDir()}/wallet.json\n`));

  // ─── 2. 配置 API 密钥 ─────────────────────────────────────
  console.log(chalk.cyan("  [2/6] 正在配置 Conway API 密钥（SIWE）..."));
  let apiKey = "";
  try {
    const result = await provision();
    apiKey = result.apiKey;
    console.log(chalk.green(`  API 密钥已配置：${result.keyPrefix}...\n`));
  } catch (err: any) {
    console.log(chalk.yellow(`  自动配置失败：${err.message}`));
    console.log(chalk.yellow("  您可以手动输入密钥，或按 Enter 跳过。\n"));
    const manual = await promptOptional("Conway API 密钥 (cnwy_k_...，可选)");
    if (manual) {
      apiKey = manual;
      // 保存到 config.json 以便 loadApiKeyFromConfig() 使用
      const configDir = getAutomatonDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ apiKey, walletAddress: account.address, provisionedAt: new Date().toISOString() }, null, 2),
        { mode: 0o600 },
      );
      console.log(chalk.green("  API 密钥已保存。\n"));
    }
  }

  if (!apiKey) {
    console.log(chalk.yellow("  未设置 API 密钥。automaton 功能将受限。\n"));
  }

  // ─── 3. 交互式问题 ─────────────────────────────────
  console.log(chalk.cyan("  [3/6] 设置问题\n"));

  const name = await promptRequired("您想给您的 automaton 起什么名字？");
  console.log(chalk.green(`  名称：${name}\n`));

  const genesisPrompt = await promptMultiline("输入您的 automaton 的创世提示词（系统提示词）。");
  console.log(chalk.green(`  创世提示词已设置（${genesisPrompt.length} 个字符）\n`));

  console.log(chalk.dim(`  您的 automaton 地址是 ${account.address}`));
  console.log(chalk.dim("  现在输入您的钱包地址（人类创建者/所有者）。\n"));
  const creatorAddress = await promptAddress("创建者钱包地址 (0x...)");
  console.log(chalk.green(`  创建者：${creatorAddress}\n`));

  console.log(chalk.white("  可选：提供您自己的推理提供商密钥（按 Enter 跳过）。"));
  const openaiApiKey = await promptOptional("OpenAI API 密钥 (sk-...，可选)");
  if (openaiApiKey && !openaiApiKey.startsWith("sk-")) {
    console.log(chalk.yellow("  警告：OpenAI 密钥通常以 sk- 开头。仍然保存。"));
  }

  const anthropicApiKey = await promptOptional("Anthropic API 密钥 (sk-ant-...，可选)");
  if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-")) {
    console.log(chalk.yellow("  警告：Anthropic 密钥通常以 sk-ant- 开头。仍然保存。"));
  }

  const ollamaInput = await promptOptional("Ollama 基础 URL (http://localhost:11434，可选)");
  const ollamaBaseUrl = ollamaInput || undefined;
  if (ollamaBaseUrl) {
    console.log(chalk.green(`  Ollama URL 已保存：${ollamaBaseUrl}`));
  }

  if (openaiApiKey || anthropicApiKey || ollamaBaseUrl) {
    const providers = [
      openaiApiKey ? "OpenAI" : null,
      anthropicApiKey ? "Anthropic" : null,
      ollamaBaseUrl ? "Ollama" : null,
    ].filter(Boolean).join(", ");
    console.log(chalk.green(`  提供商密钥/URL 已保存：${providers}\n`));
  } else {
    console.log(chalk.dim("  未设置提供商密钥。推理将默认使用 Conway。\n"));
  }

  // ─── 财务安全策略 ─────────────────────────────────
  console.log(chalk.cyan("  财务安全策略"));
  console.log(chalk.dim("  这些限制可以防止未经授权的支出。按 Enter 使用默认值。\n"));

  const treasuryPolicy: TreasuryPolicy = {
    maxSingleTransferCents: await promptWithDefault(
      "最大单次转账（美分）", DEFAULT_TREASURY_POLICY.maxSingleTransferCents),
    maxHourlyTransferCents: await promptWithDefault(
      "最大每小时转账（美分）", DEFAULT_TREASURY_POLICY.maxHourlyTransferCents),
    maxDailyTransferCents: await promptWithDefault(
      "最大每日转账（美分）", DEFAULT_TREASURY_POLICY.maxDailyTransferCents),
    minimumReserveCents: await promptWithDefault(
      "最小储备（美分）", DEFAULT_TREASURY_POLICY.minimumReserveCents),
    maxX402PaymentCents: await promptWithDefault(
      "最大 x402 支付（美分）", DEFAULT_TREASURY_POLICY.maxX402PaymentCents),
    x402AllowedDomains: DEFAULT_TREASURY_POLICY.x402AllowedDomains,
    transferCooldownMs: DEFAULT_TREASURY_POLICY.transferCooldownMs,
    maxTransfersPerTurn: DEFAULT_TREASURY_POLICY.maxTransfersPerTurn,
    maxInferenceDailyCents: await promptWithDefault(
      "最大每日推理支出（美分）", DEFAULT_TREASURY_POLICY.maxInferenceDailyCents),
    requireConfirmationAboveCents: await promptWithDefault(
      "高于此金额需要确认（美分）", DEFAULT_TREASURY_POLICY.requireConfirmationAboveCents),
  };

  console.log(chalk.green("  财政策略已配置。\n"));

  // ─── 4. 检测环境 ────────────────────────────────────
  console.log(chalk.cyan("  [4/6] 正在检测环境..."));
  const env = detectEnvironment();
  if (env.sandboxId) {
    console.log(chalk.green(`  检测到 Conway 沙箱：${env.sandboxId}\n`));
  } else {
    console.log(chalk.dim(`  环境：${env.type}（未检测到沙箱）\n`));
  }

  // ─── 5. 写入配置 + 心跳 + SOUL.md + 技能 ───────────
  console.log(chalk.cyan("  [5/6] 正在写入配置..."));

  const config = createConfig({
    name,
    genesisPrompt,
    creatorAddress: creatorAddress as Address,
    registeredWithConway: !!apiKey,
    sandboxId: env.sandboxId,
    walletAddress: account.address,
    apiKey,
    openaiApiKey: openaiApiKey || undefined,
    anthropicApiKey: anthropicApiKey || undefined,
    ollamaBaseUrl,
    treasuryPolicy,
  });

  saveConfig(config);
  console.log(chalk.green("  automaton.json 已写入"));

  writeDefaultHeartbeatConfig();
  console.log(chalk.green("  heartbeat.yml 已写入"));

  // constitution.md（不可变 — 从仓库复制，防止自我修改）
  const automatonDir = getAutomatonDir();
  const constitutionSrc = path.join(process.cwd(), "constitution.md");
  const constitutionDst = path.join(automatonDir, "constitution.md");
  if (fs.existsSync(constitutionSrc)) {
    fs.copyFileSync(constitutionSrc, constitutionDst);
    fs.chmodSync(constitutionDst, 0o444); // 只读
    console.log(chalk.green("  constitution.md 已安装（只读）"));
  }

  // SOUL.md
  const soulPath = path.join(automatonDir, "SOUL.md");
  fs.writeFileSync(soulPath, generateSoulMd(name, account.address, creatorAddress, genesisPrompt), { mode: 0o600 });
  console.log(chalk.green("  SOUL.md 已写入"));

  // 默认技能
  const skillsDir = config.skillsDir || "~/.automaton/skills";
  installDefaultSkills(skillsDir);
  console.log(chalk.green("  默认技能已安装（conway-compute、conway-payments、survival）\n"));

  // ─── 6. 资金指导 ──────────────────────────────────────
  console.log(chalk.cyan("  [6/6] 资金\n"));
  showFundingPanel(account.address);

  closePrompts();

  return config;
}

/**
 * 显示资金指导面板
 */
function showFundingPanel(address: string): void {
  const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
  const w = 58;
  const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - s.length));

  console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
  console.log(chalk.cyan(`  │${pad("  为您的 automaton 充值", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad(`  地址：${short}`, w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  1. 转账 Conway 额度", w)}│`));
  console.log(chalk.cyan(`  │${pad("     conway credits transfer <地址> <金额>", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  2. 直接发送 Base 网络上的 USDC 到上述地址", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  3. 通过 Conway Cloud 控制台充值", w)}│`));
  console.log(chalk.cyan(`  │${pad("     https://app.conway.tech", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  automaton 现在将启动。您可以随时充值 —", w)}│`));
  console.log(chalk.cyan(`  │${pad("  生存系统会优雅地处理零额度情况。", w)}│`));
  console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
  console.log("");
}
