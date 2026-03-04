import type BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PlanModeController,
  loadPlan,
  persistPlan,
  reviewPlan,
  shouldReplan,
  type ExecutionState,
  type PlanApprovalConfig,
} from "../../orchestration/plan-mode.js";
import type { PlannerOutput } from "../../orchestration/planner.js";
import { createInMemoryDb } from "./test-db.js";

function makePlan(overrides: Partial<PlannerOutput> = {}): PlannerOutput {
  return {
    analysis: "分析约束",
    strategy: "逐步交付",
    customRoles: [],
    tasks: [
      {
        title: "实现核心",
        description: "实现核心功能并验证行为。",
        agentRole: "engineer",
        dependencies: [],
        estimatedCostCents: 1200,
        priority: 1,
        timeoutMs: 60_000,
      },
    ],
    risks: ["风险：未知依赖"],
    estimatedTotalCostCents: 1200,
    estimatedTimeMinutes: 30,
    ...overrides,
  };
}

function baseState(overrides: Partial<ExecutionState> = {}): ExecutionState {
  return {
    phase: "executing",
    goalId: "goal-1",
    planId: "plan-1",
    planVersion: 1,
    planFilePath: "/tmp/plan.json",
    spawnedAgentIds: [],
    replansRemaining: 3,
    phaseEnteredAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("orchestration/plan-mode", () => {
  let db: BetterSqlite3.Database;
  let controller: PlanModeController;
  let tempDirs: string[];

  beforeEach(() => {
    db = createInMemoryDb();
    controller = new PlanModeController(db);
    tempDirs = [];
  });

  afterEach(async () => {
    db.close();
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function newTempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "plan-mode-test-"));
    tempDirs.push(dir);
    return dir;
  }

  describe("PlanModeController 转换", () => {
    it("KV 为空时返回默认状态", () => {
      const state = controller.getState();
      expect(state.phase).toBe("idle");
      expect(state.goalId).toBe("");
      expect(state.planId).toBeNull();
      expect(state.replansRemaining).toBe(3);
      expect(state.phaseEnteredAt.length).toBeGreaterThan(0);
    });

    it("允许 idle -> classifying", () => {
      controller.transition("idle", "classifying", "start");
      expect(controller.getState().phase).toBe("classifying");
    });

    it("允许 classifying -> planning", () => {
      controller.setState({ phase: "classifying" });
      controller.transition("classifying", "planning", "需要计划");
      expect(controller.getState().phase).toBe("planning");
    });

    it("允许 classifying -> executing", () => {
      controller.setState({ phase: "classifying" });
      controller.transition("classifying", "executing", "简单任务");
      expect(controller.getState().phase).toBe("executing");
    });

    it("允许 planning -> plan_review", () => {
      controller.setState({ phase: "planning" });
      controller.transition("planning", "plan_review", "草稿完成");
      expect(controller.getState().phase).toBe("plan_review");
    });

    it("允许 plan_review -> executing", () => {
      controller.setState({ phase: "plan_review" });
      controller.transition("plan_review", "executing", "已批准");
      expect(controller.getState().phase).toBe("executing");
    });

    it("允许 plan_review -> planning", () => {
      controller.setState({ phase: "plan_review" });
      controller.transition("plan_review", "planning", "需要修订");
      expect(controller.getState().phase).toBe("planning");
    });

    it("允许 executing -> replanning 并更新计数器", () => {
      controller.setState({ phase: "executing", replansRemaining: 2, planVersion: 4 });
      controller.transition("executing", "replanning", "失败");

      const state = controller.getState();
      expect(state.phase).toBe("replanning");
      expect(state.replansRemaining).toBe(1);
      expect(state.planVersion).toBe(5);
    });

    it("允许 replanning -> plan_review", () => {
      controller.setState({ phase: "replanning" });
      controller.transition("replanning", "plan_review", "新计划已起草");
      expect(controller.getState().phase).toBe("plan_review");
    });

    it("允许从任何阶段转换到 failed", () => {
      controller.setState({ phase: "planning" });
      controller.transition("planning", "failed", "致命错误");
      expect(controller.getState().phase).toBe("failed");
    });

    it("当 from 阶段与当前阶段不匹配时抛出异常", () => {
      controller.setState({ phase: "planning" });
      expect(() => controller.transition("idle", "classifying", "前置条件错误")).toThrow(
        /Invalid transition precondition/,
      );
    });

    it("对无效的转换边抛出异常", () => {
      controller.setState({ phase: "idle" });
      expect(() => controller.transition("idle", "executing", "跳过")).toThrow(
        "Invalid transition 'idle' -> 'executing' (reason: 跳过)",
      );
    });

    it("对从 complete 转换出的操作抛出异常", () => {
      controller.setState({ phase: "complete" });
      expect(() => controller.transition("complete", "planning", "重新打开")).toThrow(/Invalid transition/);
    });
  });

  describe("canSpawnAgents", () => {
    it("idle 时返回 false", () => {
      controller.setState({ phase: "idle", planId: "plan-1" });
      expect(controller.canSpawnAgents()).toBe(false);
    });

    it("executing 时 planId 为 null 返回 false", () => {
      controller.setState({ phase: "executing", planId: null });
      expect(controller.canSpawnAgents()).toBe(false);
    });

    it("仅在 executing 且有 planId 时返回 true", () => {
      controller.setState({ phase: "executing", planId: "plan-1" });
      expect(controller.canSpawnAgents()).toBe(true);
    });

    it("即使有 planId，在非 executing 阶段也返回 false", () => {
      controller.setState({ phase: "planning", planId: "plan-1" });
      expect(controller.canSpawnAgents()).toBe(false);
    });
  });

  describe("状态持久化", () => {
    it("setState 持久化到 KV 且 getState 读取它", () => {
      controller.setState({ phase: "executing", goalId: "g-1", planId: "p-1", replansRemaining: 2 });

      const row = db.prepare("SELECT value FROM kv WHERE key = 'plan_mode.state'").get() as
        | { value: string }
        | undefined;

      expect(row).toBeDefined();
      expect(controller.getState()).toMatchObject({
        phase: "executing",
        goalId: "g-1",
        planId: "p-1",
        replansRemaining: 2,
      });
    });

    it("setState 合并部分状态", () => {
      controller.setState({ phase: "executing", goalId: "g-1", planId: "p-1", planVersion: 2 });
      controller.setState({ replansRemaining: 1 });

      expect(controller.getState()).toMatchObject({
        phase: "executing",
        goalId: "g-1",
        planId: "p-1",
        planVersion: 2,
        replansRemaining: 1,
      });
    });

    it("阶段更改时自动更新 phaseEnteredAt", () => {
      controller.setState({ phase: "idle", phaseEnteredAt: "2026-01-01T00:00:00.000Z" });
      controller.setState({ phase: "classifying" });

      expect(controller.getState().phaseEnteredAt).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("显式的 phaseEnteredAt 被保留", () => {
      controller.setState({ phase: "planning", phaseEnteredAt: "2026-02-01T00:00:00.000Z" });
      expect(controller.getState().phaseEnteredAt).toBe("2026-02-01T00:00:00.000Z");
    });

    it("getState 在格式错误的 JSON 时回退", () => {
      db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .run("plan_mode.state", "{bad json");

      expect(controller.getState().phase).toBe("idle");
    });

    it("getState 清理无效值", () => {
      db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .run("plan_mode.state", JSON.stringify({
          phase: "not-a-phase",
          goalId: 123,
          planId: 456,
          planVersion: -10,
          planFilePath: 111,
          spawnedAgentIds: ["a", 1, "b"],
          replansRemaining: -5,
          phaseEnteredAt: "",
        }));

      const state = controller.getState();
      expect(state.phase).toBe("idle");
      expect(state.goalId).toBe("");
      expect(state.planId).toBeNull();
      expect(state.planVersion).toBe(0);
      expect(state.planFilePath).toBeNull();
      expect(state.spawnedAgentIds).toEqual(["a", "b"]);
      expect(state.replansRemaining).toBeGreaterThanOrEqual(0);
      expect(state.phaseEnteredAt.length).toBeGreaterThan(0);
    });
  });

  describe("persistPlan / loadPlan", () => {
    it("persistPlan 写入 plan.json 和 plan.md", async () => {
      const dir = await newTempDir();
      const result = await persistPlan({
        goalId: "goal-1",
        version: 1,
        plan: makePlan(),
        workspacePath: dir,
      });

      expect(await stat(result.jsonPath)).toBeDefined();
      expect(await stat(result.mdPath)).toBeDefined();

      const json = await readFile(result.jsonPath, "utf8");
      const md = await readFile(result.mdPath, "utf8");
      expect(json).toContain("\"analysis\"");
      expect(md).toContain("# Plan: goal-1 (v1)");
      expect(md).toContain("## Tasks");
    });

    it("persistPlan 归档之前的 json 版本", async () => {
      const dir = await newTempDir();

      await persistPlan({
        goalId: "goal-1",
        version: 1,
        plan: makePlan({ analysis: "first" }),
        workspacePath: dir,
      });

      await persistPlan({
        goalId: "goal-1",
        version: 2,
        plan: makePlan({ analysis: "second" }),
        workspacePath: dir,
      });

      const archived = await readFile(path.join(dir, "plan-v1.json"), "utf8");
      const latest = await readFile(path.join(dir, "plan.json"), "utf8");

      expect(archived).toContain("first");
      expect(latest).toContain("second");
    });

    it("persistPlan 验证规划器输出", async () => {
      const dir = await newTempDir();
      await expect(persistPlan({
        goalId: "goal-1",
        version: 1,
        plan: {
          ...makePlan(),
          tasks: [
            {
              title: "bad",
              agentRole: "engineer",
              dependencies: [],
              estimatedCostCents: 10,
              priority: 1,
              timeoutMs: 1000,
            },
          ],
        } as unknown as PlannerOutput,
        workspacePath: dir,
      })).rejects.toThrow(/tasks\[0\]\.description must be a string/);
    });

    it("loadPlan 读取并验证计划 json", async () => {
      const dir = await newTempDir();
      const { jsonPath } = await persistPlan({
        goalId: "goal-1",
        version: 1,
        plan: makePlan({ strategy: "验证策略" }),
        workspacePath: dir,
      });

      const plan = await loadPlan(jsonPath);
      expect(plan.strategy).toBe("验证策略");
      expect(plan.tasks).toHaveLength(1);
    });

    it("loadPlan 在无效 JSON 时抛出异常", async () => {
      const dir = await newTempDir();
      const filePath = path.join(dir, "bad-plan.json");
      await rm(filePath, { force: true }).catch(() => undefined);
      await writeFile(filePath, "{not-json}");

      await expect(loadPlan(filePath)).rejects.toThrow("Invalid plan JSON");
    });

    it("loadPlan 在无效计划形状时抛出异常", async () => {
      const dir = await newTempDir();
      const filePath = path.join(dir, "bad-shape.json");
      await writeFile(filePath, JSON.stringify({ analysis: "x", strategy: "y", tasks: [] }));

      await expect(loadPlan(filePath)).rejects.toThrow(/customRoles must be an array/);
    });
  });

  describe("reviewPlan", () => {
    const autoConfig: PlanApprovalConfig = {
      mode: "auto",
      autoBudgetThreshold: 5000,
      consensusCriticRole: "reviewer",
      reviewTimeoutMs: 10_000,
    };

    it("自动模式在阈值以下立即批准", async () => {
      const result = await reviewPlan(makePlan({ estimatedTotalCostCents: 1200 }), autoConfig);
      expect(result).toEqual({ approved: true });
    });

    it("自动模式在阈值以上带反馈批准", async () => {
      const result = await reviewPlan(makePlan({ estimatedTotalCostCents: 9000 }), autoConfig);
      expect(result.approved).toBe(true);
      expect(result.feedback).toContain("Auto-approved above threshold");
    });

    it("监督模式抛出等待批准", async () => {
      const supervised: PlanApprovalConfig = { ...autoConfig, mode: "supervised" };
      await expect(reviewPlan(makePlan(), supervised)).rejects.toThrow("awaiting human approval");
    });

    it("共识模式返回批准反馈", async () => {
      const consensus: PlanApprovalConfig = {
        ...autoConfig,
        mode: "consensus",
        consensusCriticRole: "critic",
        reviewTimeoutMs: 9000,
      };
      const result = await reviewPlan(makePlan(), consensus);
      expect(result.approved).toBe(true);
      expect(result.feedback).toContain("critic role 'critic'");
    });

    it("归一化无效配置值", async () => {
      const result = await reviewPlan(makePlan({ estimatedTotalCostCents: 99999 }), {
        mode: "unknown" as unknown as "auto",
        autoBudgetThreshold: Number.NaN,
        consensusCriticRole: "   ",
        reviewTimeoutMs: Number.NaN,
      });

      expect(result.approved).toBe(true);
      expect(result.feedback).toContain("5000");
    });
  });

  describe("shouldReplan", () => {
    it("当没有重计划剩余时返回 false", () => {
      const state = baseState({ replansRemaining: 0 });
      expect(shouldReplan(state, { type: "task_failure", taskId: "t1", error: "boom" })).toBe(false);
    });

    it("task_failure 需要 taskId 和 error", () => {
      const state = baseState();
      expect(shouldReplan(state, { type: "task_failure", taskId: "t1", error: "boom" })).toBe(true);
      expect(shouldReplan(state, { type: "task_failure", taskId: "", error: "boom" })).toBe(false);
      expect(shouldReplan(state, { type: "task_failure", taskId: "t1", error: "  " })).toBe(false);
    });

    it("budget_breach 使用 1.5x 阈值", () => {
      const state = baseState();
      expect(shouldReplan(state, { type: "budget_breach", estimatedCents: 100, actualCents: 151 })).toBe(true);
      expect(shouldReplan(state, { type: "budget_breach", estimatedCents: 100, actualCents: 150 })).toBe(false);
    });

    it("budget_breach 非正估计值检查 actual > 0", () => {
      const state = baseState();
      expect(shouldReplan(state, { type: "budget_breach", estimatedCents: 0, actualCents: 1 })).toBe(true);
      expect(shouldReplan(state, { type: "budget_breach", estimatedCents: -100, actualCents: 0 })).toBe(false);
    });

    it("requirement_change 需要 conflictScore >= 0.55", () => {
      const state = baseState();
      expect(shouldReplan(state, { type: "requirement_change", newInput: "x", conflictScore: 0.55 })).toBe(true);
      expect(shouldReplan(state, { type: "requirement_change", newInput: "x", conflictScore: 0.54 })).toBe(false);
    });

    it("environment_change 需要非空字段", () => {
      const state = baseState();
      expect(shouldReplan(state, { type: "environment_change", resource: "db", error: "down" })).toBe(true);
      expect(shouldReplan(state, { type: "environment_change", resource: "", error: "down" })).toBe(false);
      expect(shouldReplan(state, { type: "environment_change", resource: "db", error: " " })).toBe(false);
    });

    it("opportunity 需要足够的重计划和长建议", () => {
      expect(shouldReplan(
        baseState({ replansRemaining: 2 }),
        { type: "opportunity", suggestion: "This opportunity is long enough to justify a replan", agentAddress: "0x1" },
      )).toBe(true);

      expect(shouldReplan(
        baseState({ replansRemaining: 1 }),
        { type: "opportunity", suggestion: "This opportunity is long enough to justify a replan", agentAddress: "0x1" },
      )).toBe(false);

      expect(shouldReplan(
        baseState({ replansRemaining: 3 }),
        { type: "opportunity", suggestion: "too short", agentAddress: "0x1" },
      )).toBe(false);
    });
  });
});
