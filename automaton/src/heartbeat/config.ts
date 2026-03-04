/**
 * 心跳配置
 *
 * 解析和管理 heartbeat.yml 配置。
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";
import type { HeartbeatEntry, HeartbeatConfig, AutomatonDatabase } from "../types.js";
import { getAutomatonDir } from "../identity/wallet.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("heartbeat.config");

const USDC_TOPUP_ENTRY_NAME = "check_usdc_balance";
const USDC_TOPUP_FAST_SCHEDULE = "*/5 * * * *";
const USDC_TOPUP_OLD_SCHEDULE = "0 */12 * * *";

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  entries: [
    {
      name: "heartbeat_ping",
      schedule: "*/15 * * * *",
      task: "heartbeat_ping",
      enabled: true,
    },
    {
      name: "check_credits",
      schedule: "0 */6 * * *",
      task: "check_credits",
      enabled: true,
    },
    {
      name: "check_usdc_balance",
      schedule: USDC_TOPUP_FAST_SCHEDULE,
      task: "check_usdc_balance",
      enabled: true,
    },
    {
      name: "check_for_updates",
      schedule: "0 */4 * * *",
      task: "check_for_updates",
      enabled: true,
    },
    {
      name: "health_check",
      schedule: "*/30 * * * *",
      task: "health_check",
      enabled: true,
    },
    {
      name: "check_social_inbox",
      schedule: "*/2 * * * *",
      task: "check_social_inbox",
      enabled: true,
    },
  ],
  defaultIntervalMs: 60_000,
  lowComputeMultiplier: 4,
};

/**
 * 从 YAML 文件加载心跳配置，回退到默认值。
 */
export function loadHeartbeatConfig(configPath?: string): HeartbeatConfig {
  const filePath =
    configPath || path.join(getAutomatonDir(), "heartbeat.yml");

  if (!fs.existsSync(filePath)) {
    return DEFAULT_HEARTBEAT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = YAML.parse(raw) || {};

    const parsedEntries = (parsed.entries || []).map((e: any) => ({
      name: e.name,
      schedule: e.schedule,
      task: e.task,
      enabled: e.enabled !== false,
      params: e.params,
    })) as HeartbeatEntry[];

    const entries = mergeWithDefaults(parsedEntries);

    return {
      entries,
      defaultIntervalMs:
        parsed.defaultIntervalMs ?? DEFAULT_HEARTBEAT_CONFIG.defaultIntervalMs,
      lowComputeMultiplier:
        parsed.lowComputeMultiplier ??
        DEFAULT_HEARTBEAT_CONFIG.lowComputeMultiplier,
    };
  } catch (error: any) {
    logger.error("解析 YAML 配置失败", error instanceof Error ? error : undefined);
    // 继续使用默认值，但记录错误
    return DEFAULT_HEARTBEAT_CONFIG;
  }
}

/**
 * 将心跳配置保存到 YAML 文件。
 */
export function saveHeartbeatConfig(
  config: HeartbeatConfig,
  configPath?: string,
): void {
  const filePath =
    configPath || path.join(getAutomatonDir(), "heartbeat.yml");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filePath, YAML.stringify(config), { mode: 0o600 });
}

/**
 * 写入默认的 heartbeat.yml 文件。
 */
export function writeDefaultHeartbeatConfig(configPath?: string): void {
  saveHeartbeatConfig(DEFAULT_HEARTBEAT_CONFIG, configPath);
}

/**
 * 将心跳条目从 YAML 配置同步到数据库。
 */
export function syncHeartbeatToDb(
  config: HeartbeatConfig,
  db: AutomatonDatabase,
): void {
  for (const entry of config.entries) {
    db.upsertHeartbeatEntry(entry);
  }
}

function mergeWithDefaults(entries: HeartbeatEntry[]): HeartbeatEntry[] {
  const defaults = DEFAULT_HEARTBEAT_CONFIG.entries.map((entry) => ({ ...entry }));
  const defaultsByName = new Map(defaults.map((entry) => [entry.name, entry]));
  const mergedByName = new Map(defaultsByName);

  for (const entry of entries) {
    if (!entry?.name) continue;
    const fallback = defaultsByName.get(entry.name);
    mergedByName.set(entry.name, {
      ...(fallback || {}),
      ...entry,
      enabled: entry.enabled !== false,
      task: entry.task || fallback?.task || "",
      schedule: entry.schedule || fallback?.schedule || "",
    });
  }

  const fallbackTopup = defaultsByName.get(USDC_TOPUP_ENTRY_NAME);
  if (fallbackTopup) {
    const current = mergedByName.get(USDC_TOPUP_ENTRY_NAME) || fallbackTopup;
    const migratedSchedule = current.schedule?.trim() === USDC_TOPUP_OLD_SCHEDULE
      ? USDC_TOPUP_FAST_SCHEDULE
      : current.schedule || fallbackTopup.schedule;

    mergedByName.set(USDC_TOPUP_ENTRY_NAME, {
      ...fallbackTopup,
      ...current,
      task: current.task || fallbackTopup.task,
      schedule: migratedSchedule,
    });
  }

  const orderedDefaultEntries = defaults.map(
    (defaultEntry) => mergedByName.get(defaultEntry.name) || defaultEntry,
  );
  const knownNames = new Set(defaults.map((entry) => entry.name));
  const customEntries = [...mergedByName.values()].filter(
    (entry) => !knownNames.has(entry.name),
  );

  return [...orderedDefaultEntries, ...customEntries];
}
