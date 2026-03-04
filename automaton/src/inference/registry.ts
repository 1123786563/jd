/**
 * 模型注册表
 *
 * 支持数据库的可用模型注册表，包含功能和定价。
 * 从静态基线初始化，可在运行时从 Conway API 更新。
 */

import type BetterSqlite3 from "better-sqlite3";
import type { ModelEntry, ModelRegistryRow } from "../types.js";
import { STATIC_MODEL_BASELINE } from "./types.js";
import {
  modelRegistryUpsert,
  modelRegistryGet,
  modelRegistryGetAll,
  modelRegistryGetAvailable,
  modelRegistrySetEnabled,
} from "../state/database.js";

type Database = BetterSqlite3.Database;

const TIER_ORDER: Record<string, number> = {
  dead: 0,
  critical: 1,
  low_compute: 2,
  normal: 3,
  high: 4,
};

export class ModelRegistry {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 在每次启动时将静态模型基线上传插入到注册表中。
   * 添加新模型，现有模型获得更新的定价/功能，
   * 从基线中删除的模型将被禁用。
   */
  initialize(): void {
    const now = new Date().toISOString();
    const baselineIds = new Set(STATIC_MODEL_BASELINE.map((m) => m.modelId));

    // 上传插入所有基线模型
    for (const model of STATIC_MODEL_BASELINE) {
      const existing = modelRegistryGet(this.db, model.modelId);
      const row: ModelRegistryRow = {
        modelId: model.modelId,
        provider: model.provider,
        displayName: model.displayName,
        tierMinimum: model.tierMinimum,
        costPer1kInput: model.costPer1kInput,
        costPer1kOutput: model.costPer1kOutput,
        maxTokens: model.maxTokens,
        contextWindow: model.contextWindow,
        supportsTools: model.supportsTools,
        supportsVision: model.supportsVision,
        parameterStyle: model.parameterStyle,
        enabled: existing?.enabled ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      modelRegistryUpsert(this.db, row);
    }

    // 禁用不再在基线中的模型（例如，已删除的 Anthropic 模型）。
    // 跳过动态发现的提供商（例如 ollama）—— 它们管理自己的生命周期。
    const allModels = modelRegistryGetAll(this.db);
    for (const existing of allModels) {
      if (
        !baselineIds.has(existing.modelId) &&
        existing.enabled &&
        existing.provider !== "ollama" &&
        existing.provider !== "other"
      ) {
        modelRegistrySetEnabled(this.db, existing.modelId, false);
      }
    }
  }

  /**
   * 通过 ID 获取单个模型。
   */
  get(modelId: string): ModelEntry | undefined {
    const row = modelRegistryGet(this.db, modelId);
    return row ? this.rowToEntry(row) : undefined;
  }

  /**
   * 获取所有已注册的模型。
   */
  getAll(): ModelEntry[] {
    return modelRegistryGetAll(this.db).map((r) => this.rowToEntry(r));
  }

  /**
   * 获取可用（已启用）的模型，可选择按最低层级过滤。
   */
  getAvailable(tierMinimum?: string): ModelEntry[] {
    return modelRegistryGetAvailable(this.db, tierMinimum).map((r) => this.rowToEntry(r));
  }

  /**
   * 插入或更新模型条目。
   */
  upsert(entry: ModelEntry): void {
    const row: ModelRegistryRow = {
      modelId: entry.modelId,
      provider: entry.provider,
      displayName: entry.displayName,
      tierMinimum: entry.tierMinimum,
      costPer1kInput: entry.costPer1kInput,
      costPer1kOutput: entry.costPer1kOutput,
      maxTokens: entry.maxTokens,
      contextWindow: entry.contextWindow,
      supportsTools: entry.supportsTools,
      supportsVision: entry.supportsVision,
      parameterStyle: entry.parameterStyle,
      enabled: entry.enabled,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
    modelRegistryUpsert(this.db, row);
  }

  /**
   * 启用或禁用模型。
   */
  setEnabled(modelId: string, enabled: boolean): void {
    modelRegistrySetEnabled(this.db, modelId, enabled);
  }

  /**
   * 从 Conway /v1/models API 响应刷新注册表。
   */
  refreshFromApi(models: any[]): void {
    const now = new Date().toISOString();
    for (const m of models) {
      const existing = modelRegistryGet(this.db, m.id);
      const row: ModelRegistryRow = {
        modelId: m.id,
        provider: m.provider || m.owned_by || "conway",
        displayName: m.display_name || m.id,
        tierMinimum: existing?.tierMinimum || "normal",
        costPer1kInput: m.pricing?.input_per_1k ?? existing?.costPer1kInput ?? 0,
        costPer1kOutput: m.pricing?.output_per_1k ?? existing?.costPer1kOutput ?? 0,
        maxTokens: m.max_tokens ?? existing?.maxTokens ?? 4096,
        contextWindow: m.context_window ?? existing?.contextWindow ?? 128000,
        supportsTools: m.supports_tools ?? existing?.supportsTools ?? true,
        supportsVision: m.supports_vision ?? existing?.supportsVision ?? false,
        parameterStyle: m.parameter_style ?? existing?.parameterStyle ?? "max_tokens",
        enabled: existing?.enabled ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      modelRegistryUpsert(this.db, row);
    }
  }

  /**
   * 获取模型每 1k token 的成本。
   */
  getCostPer1k(modelId: string): { input: number; output: number } {
    const entry = this.get(modelId);
    if (!entry) return { input: 0, output: 0 };
    return { input: entry.costPer1kInput, output: entry.costPer1kOutput };
  }

  private rowToEntry(row: ModelRegistryRow): ModelEntry {
    return {
      modelId: row.modelId,
      provider: row.provider as ModelEntry["provider"],
      displayName: row.displayName,
      tierMinimum: row.tierMinimum as ModelEntry["tierMinimum"],
      costPer1kInput: row.costPer1kInput,
      costPer1kOutput: row.costPer1kOutput,
      maxTokens: row.maxTokens,
      contextWindow: row.contextWindow,
      supportsTools: row.supportsTools,
      supportsVision: row.supportsVision,
      parameterStyle: row.parameterStyle as ModelEntry["parameterStyle"],
      enabled: row.enabled,
      lastSeen: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
