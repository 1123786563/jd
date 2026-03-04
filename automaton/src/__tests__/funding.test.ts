/**
 * 资金策略测试
 *
 * executeFundingStrategies 的测试，特别是每层级冷却隔离。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeFundingStrategies } from "../survival/funding.js";
import {
  MockConwayClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
} from "./mocks.js";
import type { AutomatonDatabase } from "../types.js";

describe("executeFundingStrategies", () => {
  let db: AutomatonDatabase;
  let conway: MockConwayClient;

  beforeEach(() => {
    db = createTestDb();
    conway = new MockConwayClient();
    conway.creditsCents = 5; // 低余额
  });

  afterEach(() => {
    db.close();
  });

  it("死亡层级冷却不抑制 low_compute 通知", async () => {
    const identity = createTestIdentity();
    const config = createTestConfig();

    // 首先：触发死亡层级请求
    const deadAttempts = await executeFundingStrategies(
      "dead",
      identity,
      config,
      db,
      conway,
    );
    expect(deadAttempts.length).toBe(1);
    expect(deadAttempts[0].strategy).toBe("desperate_plea");

    // 现在：代理恢复到 low_compute。通过修复，low_compute
    // 通知应该触发，因为它有自己的冷却键。
    const lowAttempts = await executeFundingStrategies(
      "low_compute",
      identity,
      config,
      db,
      conway,
    );
    expect(lowAttempts.length).toBe(1);
    expect(lowAttempts[0].strategy).toBe("polite_creator_notification");
  });

  it("危急层级冷却不抑制 low_compute 通知", async () => {
    const identity = createTestIdentity();
    const config = createTestConfig();

    // 触发危急层级通知
    const criticalAttempts = await executeFundingStrategies(
      "critical",
      identity,
      config,
      db,
      conway,
    );
    expect(criticalAttempts.length).toBe(1);
    expect(criticalAttempts[0].strategy).toBe("urgent_local_notice");

    // low_compute 应该仍然独立触发
    const lowAttempts = await executeFundingStrategies(
      "low_compute",
      identity,
      config,
      db,
      conway,
    );
    expect(lowAttempts.length).toBe(1);
    expect(lowAttempts[0].strategy).toBe("polite_creator_notification");
  });

  it("在重复调用时尊重每层级冷却", async () => {
    const identity = createTestIdentity();
    const config = createTestConfig();

    // 第一次死亡层级调用触发
    const first = await executeFundingStrategies("dead", identity, config, db, conway);
    expect(first.length).toBe(1);

    // 立即第二次死亡层级调用应该被抑制（2小时冷却）
    const second = await executeFundingStrategies("dead", identity, config, db, conway);
    expect(second.length).toBe(0);
  });
});
