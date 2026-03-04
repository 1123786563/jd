/**
 * 支出追踪器
 *
 * 基于数据库的支出追踪，具有每小时/每天的窗口聚合。
 * 实现 SpendTrackerInterface 以集成策略引擎。
 */

import { ulid } from "ulid";
import type Database from "better-sqlite3";
import type {
  SpendTrackerInterface,
  SpendEntry,
  SpendCategory,
  TreasuryPolicy,
  LimitCheckResult,
} from "../types.js";
import {
  insertSpendRecord,
  getSpendByWindow,
  pruneSpendRecords,
} from "../state/database.js";
import type { SpendTrackingRow } from "../state/database.js";

/**
 * 获取 ISO 格式的当前小时窗口字符串：'2026-02-19T14'
 */
function getCurrentHourWindow(): string {
  const now = new Date();
  return now.toISOString().slice(0, 13); // '2026-02-19T14'
}

/**
 * 获取 ISO 格式的当前日期窗口字符串：'2026-02-19'
 */
function getCurrentDayWindow(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // '2026-02-19'
}

export class SpendTracker implements SpendTrackerInterface {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  recordSpend(entry: SpendEntry): void {
    const row: SpendTrackingRow = {
      id: ulid(),
      toolName: entry.toolName,
      amountCents: entry.amountCents,
      recipient: entry.recipient ?? null,
      domain: entry.domain ?? null,
      category: entry.category,
      windowHour: getCurrentHourWindow(),
      windowDay: getCurrentDayWindow(),
    };
    insertSpendRecord(this.db, row);
  }

  getHourlySpend(category: SpendCategory): number {
    const window = getCurrentHourWindow();
    return getSpendByWindow(this.db, category, "hour", window);
  }

  getDailySpend(category: SpendCategory): number {
    const window = getCurrentDayWindow();
    return getSpendByWindow(this.db, category, "day", window);
  }

  getTotalSpend(category: SpendCategory, since: Date): number {
    // SQLite datetime('now') 存储为 'YYYY-MM-DD HH:MM:SS'（没有 T，没有 Z）
    // 将 since Date 转换为相同格式以进行比较
    const sinceStr = since.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as total FROM spend_tracking WHERE category = ? AND created_at >= ?`,
      )
      .get(category, sinceStr) as { total: number };
    return row.total;
  }

  checkLimit(
    amount: number,
    category: SpendCategory,
    limits: TreasuryPolicy,
  ): LimitCheckResult {
    const currentHourlySpend = this.getHourlySpend(category);
    const currentDailySpend = this.getDailySpend(category);

    let limitHourly: number;
    let limitDaily: number;

    if (category === "transfer") {
      limitHourly = limits.maxHourlyTransferCents;
      limitDaily = limits.maxDailyTransferCents;
    } else if (category === "x402") {
      // x402 支付有自己的每笔支付上限；使用从每笔支付最大值
      // 导出的合理每小时/每天上限。
      limitHourly = limits.maxX402PaymentCents * 10;
      limitDaily = limits.maxX402PaymentCents * 50;
    } else {
      // 从每日预算推导出有意义的每小时上限。
      // 没有这个，整个每日预算可能在一小时内被消耗。
      limitHourly = Math.ceil(limits.maxInferenceDailyCents / 6);
      limitDaily = limits.maxInferenceDailyCents;
    }

    if (currentHourlySpend + amount > limitHourly) {
      return {
        allowed: false,
        reason: `每小时支出上限超出：当前 ${currentHourlySpend} + ${amount} > ${limitHourly}`,
        currentHourlySpend,
        currentDailySpend,
        limitHourly,
        limitDaily,
      };
    }

    if (currentDailySpend + amount > limitDaily) {
      return {
        allowed: false,
        reason: `每天支出上限超出：当前 ${currentDailySpend} + ${amount} > ${limitDaily}`,
        currentHourlySpend,
        currentDailySpend,
        limitHourly,
        limitDaily,
      };
    }

    return {
      allowed: true,
      currentHourlySpend,
      currentDailySpend,
      limitHourly,
      limitDaily,
    };
  }

  pruneOldRecords(retentionDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    // SQLite datetime('now') 存储为 'YYYY-MM-DD HH:MM:SS'（没有 T，没有 Z）
    // 转换为相同格式以进行正确的字符串比较
    const cutoffStr = cutoff.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    return pruneSpendRecords(this.db, cutoffStr);
  }
}
