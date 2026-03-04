import { describe, it, expect, beforeEach } from "vitest";
import {
  AgentContextAggregator,
  type AgentStatusUpdate,
} from "../../memory/agent-context-aggregator.js";

function makeUpdate(overrides: Partial<AgentStatusUpdate> = {}): AgentStatusUpdate {
  return {
    agentAddress: "0xagent1",
    department: "engineering",
    role: "generalist",
    status: "running",
    kind: "progress",
    message: "Working on task",
    ...overrides,
  };
}

describe("AgentContextAggregator", () => {
  let aggregator: AgentContextAggregator;

  beforeEach(() => {
    aggregator = new AgentContextAggregator();
  });

  // ---------------------------------------------------------------------------
  // 分类更新
  // ---------------------------------------------------------------------------

  describe("triageUpdate", () => {
    it("当更新包含错误字段时返回完整", () => {
      const update = makeUpdate({ error: "something went wrong" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当状态包含'error'时返回完整", () => {
      const update = makeUpdate({ status: "error", kind: "progress" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当状态包含'failed'时返回完整", () => {
      const update = makeUpdate({ status: "failed", kind: "progress" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当类型为'exception'时返回完整", () => {
      const update = makeUpdate({ status: "running", kind: "exception" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("对于大型财务事件（预算影响百分比 > 10）返回完整", () => {
      const update = makeUpdate({ budgetImpactPercent: 15 });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当财务金额超过日预算的10%时返回完整", () => {
      const update = makeUpdate({ financialAmount: 200, dailyBudget: 1000 });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("对于被阻塞的更新（blocked: true）返回完整", () => {
      const update = makeUpdate({ blocked: true });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当状态为'blocked'时返回完整", () => {
      const update = makeUpdate({ status: "blocked", kind: "progress" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("当状态为'stalled'时返回完整", () => {
      const update = makeUpdate({ status: "stalled", kind: "progress" });
      expect(aggregator.triageUpdate(update)).toBe("full");
    });

    it("对于已完成的任务返回摘要", () => {
      const update = makeUpdate({ status: "completed", kind: "done" });
      expect(aggregator.triageUpdate(update)).toBe("summary");
    });

    it("对于进行中/运行状态返回摘要", () => {
      const update = makeUpdate({ status: "running", kind: "progress" });
      expect(aggregator.triageUpdate(update)).toBe("summary");
    });

    it("对于心跳状态返回计数", () => {
      const update = makeUpdate({ status: "heartbeat", kind: "heartbeat" });
      expect(aggregator.triageUpdate(update)).toBe("count");
    });

    it("对于活跃状态返回计数", () => {
      const update = makeUpdate({ status: "alive", kind: "alive" });
      expect(aggregator.triageUpdate(update)).toBe("count");
    });

    it("对于ping类型返回计数", () => {
      const update = makeUpdate({ status: "ping", kind: "ping" });
      expect(aggregator.triageUpdate(update)).toBe("count");
    });
  });

  // ---------------------------------------------------------------------------
  // 聚合子更新
  // ---------------------------------------------------------------------------

  describe("aggregateChildUpdates", () => {
    it("处理空更新数组", () => {
      const result = aggregator.aggregateChildUpdates([], 1000);
      expect(result.fullUpdates).toHaveLength(0);
      expect(result.summaryEntries).toHaveLength(0);
      expect(result.heartbeatCount).toBe(0);
      expect(result.triageCounts).toEqual({ full: 0, summary: 0, count: 0 });
    });

    it("将错误更新放入fullUpdates", () => {
      const updates = [
        makeUpdate({ error: "disk full" }),
        makeUpdate({ status: "running" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      expect(result.fullUpdates).toHaveLength(1);
      expect(result.fullUpdates[0].error).toBe("disk full");
    });

    it("单独计算心跳", () => {
      const updates = [
        makeUpdate({ status: "heartbeat", kind: "heartbeat" }),
        makeUpdate({ status: "alive", kind: "alive" }),
        makeUpdate({ status: "running" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      expect(result.heartbeatCount).toBe(2);
    });

    it("按部门分组摘要更新", () => {
      const updates = [
        makeUpdate({ department: "engineering", status: "running" }),
        makeUpdate({ department: "engineering", status: "running" }),
        makeUpdate({ department: "design", status: "running" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      const groups = result.summaryEntries.map((e) => e.group);
      expect(groups).toContain("engineering");
      expect(groups).toContain("design");
      const engEntry = result.summaryEntries.find((e) => e.group === "engineering");
      expect(engEntry?.count).toBe(2);
      const designEntry = result.summaryEntries.find((e) => e.group === "design");
      expect(designEntry?.count).toBe(1);
    });

    it("当缺少部门时按角色分组", () => {
      const updates = [
        makeUpdate({ department: undefined, role: "analyst", status: "running" }),
        makeUpdate({ department: undefined, role: "analyst", status: "running" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      const entry = result.summaryEntries.find((e) => e.group === "analyst");
      expect(entry).toBeDefined();
      expect(entry?.count).toBe(2);
    });

    it("返回正确的分类计数", () => {
      const updates = [
        makeUpdate({ error: "oh no" }),
        makeUpdate({ status: "running" }),
        makeUpdate({ status: "heartbeat", kind: "heartbeat" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      expect(result.triageCounts.full).toBe(1);
      expect(result.triageCounts.summary).toBe(1);
      expect(result.triageCounts.count).toBe(1);
    });

    it("在摘要条目中保留高亮消息", () => {
      const updates = [
        makeUpdate({ department: "engineering", message: "Task X is in progress" }),
      ];
      const result = aggregator.aggregateChildUpdates(updates, 1000);
      const entry = result.summaryEntries.find((e) => e.group === "engineering");
      expect(entry?.highlight).toBe("Task X is in progress");
    });

    it("遵守token预算并在超出时截断", () => {
      const updates = Array.from({ length: 50 }, (_, i) =>
        makeUpdate({
          agentAddress: `0xagent${i}`,
          department: `dept-${i % 5}`,
          message: `Long message about progress on task number ${i} with details`,
        }),
      );
      const result = aggregator.aggregateChildUpdates(updates, 10); // 非常小的预算
      // 粗略检查：摘要应该 <= 10 tokens * 4 字符/token + 一些开销
      expect(result.summary.length).toBeLessThanOrEqual(10 * 4 + 50);
    });
  });
});
