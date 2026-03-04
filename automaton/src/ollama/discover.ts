/**
 * Ollama 模型发现
 *
 * 从本地 Ollama 实例获取可用模型并将其注册到模型注册表中，
 * 以便它们可用于推理。
 */

import type BetterSqlite3 from "better-sqlite3";
import { modelRegistryUpsert, modelRegistryGet } from "../state/database.js";
import type { ModelRegistryRow } from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("ollama");

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * 从 Ollama 的 /api/tags 端点获取所有可用模型
 * 并将它们插入或更新到模型注册表中。
 *
 * 返回发现的模型 ID 列表，如果 Ollama 无法访问则返回空数组
 * （被视为软故障）。
 */
export async function discoverOllamaModels(
  baseUrl: string,
  db: BetterSqlite3.Database,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;

  let data: OllamaTagsResponse;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!resp.ok) {
      logger.warn(`Ollama /api/tags 返回 ${resp.status} — 跳过发现`);
      return [];
    }
    data = await resp.json() as OllamaTagsResponse;
  } catch (err: any) {
    logger.warn(`Ollama 在 ${baseUrl} 无法访问：${err.message}`);
    return [];
  }

  if (!Array.isArray(data.models)) {
    logger.warn("Ollama /api/tags 响应没有模型数组");
    return [];
  }

  const now = new Date().toISOString();
  const registered: string[] = [];

  for (const m of data.models) {
    const modelId = m.name || m.model;
    if (!modelId) continue;

    const existing = modelRegistryGet(db, modelId);
    const row: ModelRegistryRow = {
      modelId,
      provider: "ollama",
      displayName: formatDisplayName(modelId),
      // Ollama 模型是本地的 — 无成本
      tierMinimum: existing?.tierMinimum ?? "critical",
      costPer1kInput: 0,
      costPer1kOutput: 0,
      maxTokens: existing?.maxTokens ?? 4096,
      contextWindow: existing?.contextWindow ?? 8192,
      // 大多数现代 Ollama 模型支持工具；默认为 true
      supportsTools: existing?.supportsTools ?? true,
      supportsVision: existing?.supportsVision ?? false,
      parameterStyle: "max_tokens",
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    modelRegistryUpsert(db, row);
    registered.push(modelId);
  }

  if (registered.length > 0) {
    logger.info(`Ollama: 已注册 ${registered.length} 个模型：${registered.join(", ")}`);
  }

  return registered;
}

function formatDisplayName(modelId: string): string {
  // "llama3.2:latest" → "Llama 3.2 (latest)"
  const [name, tag] = modelId.split(":");
  const pretty = name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return tag && tag !== "latest" ? `${pretty} (${tag})` : pretty;
}
