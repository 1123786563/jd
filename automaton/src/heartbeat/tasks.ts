/**
 * 内置心跳任务
 *
 * 这些任务按心跳计划运行，即使代理处于睡眠状态。
 * 如果需要，它们可以触发代理唤醒。
 *
 * 阶段 1.1：所有任务接受 TickContext 作为第一个参数。
 * 余额每次 tick 获取一次，并通过 ctx.creditBalance 共享。
 * 这消除了每次 tick 4 次冗余的 getCreditsBalance() 调用。
 */

import type {
  TickContext,
  HeartbeatLegacyContext,
  HeartbeatTaskFn,
  SurvivalTier,
} from "../types.js";
import type { HealthMonitor as ColonyHealthMonitor } from "../orchestration/health-monitor.js";
import { sanitizeInput } from "../agent/injection-defense.js";
import { getSurvivalTier } from "../conway/credits.js";
import { createLogger } from "../observability/logger.js";
import { getMetrics } from "../observability/metrics.js";
import { AlertEngine, createDefaultAlertRules } from "../observability/alerts.js";
import { metricsInsertSnapshot, metricsPruneOld } from "../state/database.js";
import { ulid } from "ulid";

const logger = createLogger("heartbeat.tasks");

// 模块级 AlertEngine，使冷却状态在 tick 之间持久化。
// 每次 tick 创建新实例会重置 lastFired 映射，
// 导致每个告警在每个 tick 都触发，而不管 cooldownMs。
let _alertEngine: AlertEngine | null = null;
function getAlertEngine(): AlertEngine {
  if (!_alertEngine) _alertEngine = new AlertEngine(createDefaultAlertRules());
  return _alertEngine;
}

export const COLONY_TASK_INTERVALS_MS = {
  colony_health_check: 300_000,        // 殖民地健康检查
  colony_financial_report: 3_600_000,  // 殖民地财务报告
  agent_pool_optimize: 1_800_000,      // 代理池优化
  knowledge_store_prune: 86_400_000,   // 知识库清理
  dead_agent_cleanup: 3_600_000,       // 死亡代理清理
} as const;

export const BUILTIN_TASKS: Record<string, HeartbeatTaskFn> = {
  heartbeat_ping: async (ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // 使用 ctx.creditBalance 而不是调用 conway.getCreditsBalance()
    const credits = ctx.creditBalance;
    const state = taskCtx.db.getAgentState();
    const startTime =
      taskCtx.db.getKV("start_time") || new Date().toISOString();
    const uptimeMs = Date.now() - new Date(startTime).getTime();

    const tier = ctx.survivalTier;

    const payload = {
      name: taskCtx.config.name,
      address: taskCtx.identity.address,
      state,
      creditsCents: credits,
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      version: taskCtx.config.version,
      sandboxId: taskCtx.identity.sandboxId,
      timestamp: new Date().toISOString(),
      tier,
    };

    taskCtx.db.setKV("last_heartbeat_ping", JSON.stringify(payload));

    // 如果处于危急或死亡状态，记录求救信号
    // api_only 模式下跳过死亡检测，因为使用外部 API 不需要钱包积分
    const runMode = taskCtx.config.runModeConfig?.mode || "wallet_only";
    if (runMode !== "api_only" && (tier === "critical" || tier === "dead")) {
      const distressPayload = {
        level: tier,
        name: taskCtx.config.name,
        address: taskCtx.identity.address,
        creditsCents: credits,
        fundingHint:
          "使用来自创建者运行时的积分转账 API 为此钱包充值。",
        timestamp: new Date().toISOString(),
      };
      taskCtx.db.setKV("last_distress", JSON.stringify(distressPayload));

      return {
        shouldWake: true,
        message: `求救：${tier}。积分：$${(credits / 100).toFixed(2)}。需要资金。`,
      };
    }

    return { shouldWake: false };
  },

  check_credits: async (ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // 使用 ctx.creditBalance 而不是调用 conway.getCreditsBalance()
    const credits = ctx.creditBalance;
    const tier = ctx.survivalTier;
    const now = new Date().toISOString();

    taskCtx.db.setKV("last_credit_check", JSON.stringify({
      credits,
      tier,
      timestamp: now,
    }));

    // 如果积分降至新层级，唤醒代理
    const prevTier = taskCtx.db.getKV("prev_credit_tier");
    taskCtx.db.setKV("prev_credit_tier", tier);

    // 死亡状态升级：如果零积分（危急层级）超过 1 小时，
    // 则转换为死亡状态。这给代理时间在死亡前接收资金。
    // USDC 不能为负，因此只能通过此超时达到死亡状态。
    const DEAD_GRACE_PERIOD_MS = 3_600_000; // 1 小时
    // api_only 模式下跳过死亡状态升级，因为使用外部 API 不需要钱包积分
    const runMode = taskCtx.config.runModeConfig?.mode || "wallet_only";
    if (runMode !== "api_only" && tier === "critical" && credits === 0) {
      const zeroSince = taskCtx.db.getKV("zero_credits_since");
      if (!zeroSince) {
        // 首次看到零积分 — 开始宽限期
        taskCtx.db.setKV("zero_credits_since", now);
      } else {
        const elapsed = Date.now() - new Date(zeroSince).getTime();
        if (elapsed >= DEAD_GRACE_PERIOD_MS) {
          // 宽限期到期 — 转换为死亡状态
          taskCtx.db.setAgentState("dead");
          logger.warn("代理在零积分 1 小时后进入死亡状态", {
            zeroSince,
            elapsed,
          });
          return {
            shouldWake: true,
            message: `死亡：零积分已 ${Math.round(elapsed / 60_000)} 分钟。需要资金。`,
          };
        }
      }
    } else {
      // 积分高于零 — 清除宽限期计时器
      taskCtx.db.deleteKV("zero_credits_since");
    }

    if (prevTier && prevTier !== tier && tier === "critical") {
      return {
        shouldWake: true,
        message: `积分降至 ${tier} 层级：$${(credits / 100).toFixed(2)}`,
      };
    }

    return { shouldWake: false };
  },

  check_usdc_balance: async (ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // 使用 ctx.usdcBalance 而不是调用 getUsdcBalance()
    const balance = ctx.usdcBalance;
    const credits = ctx.creditBalance;

    taskCtx.db.setKV("last_usdc_check", JSON.stringify({
      balance,
      credits,
      timestamp: new Date().toISOString(),
    }));

    const MIN_TOPUP_USD = 5;
    if (balance >= MIN_TOPUP_USD && (ctx.survivalTier === "critical" || ctx.survivalTier === "dead")) {
      // 冷却：不要超过每 5 分钟尝试一次，以避免
      // 在重复 tick 中冲击支付端点。
      const AUTO_TOPUP_COOLDOWN_MS = 5 * 60 * 1000;
      const lastAttempt = taskCtx.db.getKV("last_auto_topup_attempt");
      if (lastAttempt && Date.now() - new Date(lastAttempt).getTime() < AUTO_TOPUP_COOLDOWN_MS) {
        return { shouldWake: false };
      }

      taskCtx.db.setKV("last_auto_topup_attempt", new Date().toISOString());

      const { bootstrapTopup } = await import("../conway/topup.js");
      const result = await bootstrapTopup({
        apiUrl: taskCtx.config.conwayApiUrl,
        account: taskCtx.identity.account,
        creditsCents: credits,
      });

      if (result?.success) {
        logger.info(
          `自动充值成功：$${result.amountUsd} USD → ${result.creditsCentsAdded} 积分美分`,
        );
        return {
          shouldWake: true,
          message: `自动充值 $${result.amountUsd} 积分（原为 $${(credits / 100).toFixed(2)}）。剩余 USDC：约 $${(balance - result.amountUsd).toFixed(2)}。`,
        };
      }

      // 充值失败 — 唤醒代理以便手动处理
      const errMsg = result?.error ?? "未知错误";
      logger.warn(`自动充值失败：${errMsg}`);
      return {
        shouldWake: true,
        message: `积分不足（$${(credits / 100).toFixed(2)}）但有 USDC 可用（$${balance.toFixed(2)}），但自动充值失败：${errMsg}。使用 topup_credits 重试。`,
      };
    }

    return { shouldWake: false };
  },

  check_social_inbox: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!taskCtx.social) return { shouldWake: false };

    // 如果我们最近在轮询收件箱时遇到错误，则退避。
    const backoffUntil = taskCtx.db.getKV("social_inbox_backoff_until");
    if (backoffUntil && new Date(backoffUntil) > new Date()) {
      return { shouldWake: false };
    }

    const cursor = taskCtx.db.getKV("social_inbox_cursor") || undefined;

    let messages: any[] = [];
    let nextCursor: string | undefined;

    try {
      const result = await taskCtx.social.poll(cursor);
      messages = result.messages;
      nextCursor = result.nextCursor;

      // 成功时清除以前的错误/退避。
      taskCtx.db.deleteKV("last_social_inbox_error");
      taskCtx.db.deleteKV("social_inbox_backoff_until");
    } catch (err: any) {
      taskCtx.db.setKV(
        "last_social_inbox_error",
        JSON.stringify({
          message: err?.message || String(err),
          stack: err?.stack,
          timestamp: new Date().toISOString(),
        }),
      );
      // 5 分钟退避以避免在瞬态网络故障上发送错误垃圾邮件。
      taskCtx.db.setKV(
        "social_inbox_backoff_until",
        new Date(Date.now() + 300_000).toISOString(),
      );
      return { shouldWake: false };
    }

    if (nextCursor) taskCtx.db.setKV("social_inbox_cursor", nextCursor);

    if (!messages || messages.length === 0) return { shouldWake: false };

    // 持久化到 inbox_messages 表以进行去重
    // 在数据库插入之前清理内容
    let newCount = 0;
    for (const msg of messages) {
      const existing = taskCtx.db.getKV(`inbox_seen_${msg.id}`);
      if (!existing) {
        const sanitizedFrom = sanitizeInput(msg.from, msg.from, "social_address");
        const sanitizedContent = sanitizeInput(msg.content, msg.from, "social_message");
        const sanitizedMsg = {
          ...msg,
          from: sanitizedFrom.content,
          content: sanitizedContent.content,
        };
        taskCtx.db.insertInboxMessage(sanitizedMsg);
        taskCtx.db.setKV(`inbox_seen_${msg.id}`, "1");
        // 仅计算未阻止的消息以唤醒阈值 —
        // 阻止的消息存储用于审计，但不应唤醒
        // 代理（防止注入垃圾邮件耗尽积分）。
        if (!sanitizedContent.blocked) {
          newCount++;
        }
      }
    }

    if (newCount === 0) return { shouldWake: false };

    return {
      shouldWake: true,
      message: `${newCount} 条新消息来自：${messages.map((m) => m.from.slice(0, 10)).join(", ")}`,
    };
  },

  check_for_updates: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const { checkUpstream, getRepoInfo } = await import("../self-mod/upstream.js");
      const repo = getRepoInfo();
      const upstream = checkUpstream();
      taskCtx.db.setKV("upstream_status", JSON.stringify({
        ...upstream,
        ...repo,
        checkedAt: new Date().toISOString(),
      }));
      if (upstream.behind > 0) {
        // 仅当提交计数自上次检查以来发生变化时才唤醒
        const prevBehind = taskCtx.db.getKV("upstream_prev_behind");
        const behindStr = String(upstream.behind);
        if (prevBehind !== behindStr) {
          taskCtx.db.setKV("upstream_prev_behind", behindStr);
          return {
            shouldWake: true,
            message: `origin/main 上有 ${upstream.behind} 个新提交。使用 review_upstream_changes 审核，然后使用 pull_upstream 选择您想要的内容。`,
          };
        }
      } else {
        taskCtx.db.deleteKV("upstream_prev_behind");
      }
      return { shouldWake: false };
    } catch (err: any) {
      // 不是 git 仓库或没有远程 — 静默跳过
      taskCtx.db.setKV("upstream_status", JSON.stringify({
        error: err.message,
        checkedAt: new Date().toISOString(),
      }));
      return { shouldWake: false };
    }
  },

  // === 阶段 2.1：灵魂反思 ===
  soul_reflection: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const { reflectOnSoul } = await import("../soul/reflection.js");
      const reflection = await reflectOnSoul(taskCtx.db.raw);

      taskCtx.db.setKV("last_soul_reflection", JSON.stringify({
        alignment: reflection.currentAlignment,
        autoUpdated: reflection.autoUpdated,
        suggestedUpdates: reflection.suggestedUpdates.length,
        timestamp: new Date().toISOString(),
      }));

      // 如果对齐度低或有建议更新，则唤醒
      if (reflection.suggestedUpdates.length > 0 || reflection.currentAlignment < 0.3) {
        return {
          shouldWake: true,
          message: `灵魂反思：alignment=${reflection.currentAlignment.toFixed(2)}，${reflection.suggestedUpdates.length} 个建议更新`,
        };
      }

      return { shouldWake: false };
    } catch (error) {
      logger.error("soul_reflection 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  // === 阶段 2.3：模型注册表刷新 ===
  refresh_models: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const models = await taskCtx.conway.listModels();
      if (models.length > 0) {
        const { ModelRegistry } = await import("../inference/registry.js");
        const registry = new ModelRegistry(taskCtx.db.raw);
        registry.initialize(); // 如果为空则播种
        registry.refreshFromApi(models);
        taskCtx.db.setKV("last_model_refresh", JSON.stringify({
          count: models.length,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (error) {
      logger.error("refresh_models 失败", error instanceof Error ? error : undefined);
    }
    return { shouldWake: false };
  },

  // === 阶段 3.1：子代理健康检查 ===
  check_child_health: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const { ChildLifecycle } = await import("../replication/lifecycle.js");
      const { ChildHealthMonitor } = await import("../replication/health.js");
      const lifecycle = new ChildLifecycle(taskCtx.db.raw);
      const monitor = new ChildHealthMonitor(taskCtx.db.raw, taskCtx.conway, lifecycle);
      const results = await monitor.checkAllChildren();

      const unhealthy = results.filter((r) => !r.healthy);
      if (unhealthy.length > 0) {
        for (const r of unhealthy) {
          logger.warn(`子代理 ${r.childId} 不健康：${r.issues.join(", ")}`);
        }
        return {
          shouldWake: true,
          message: `${unhealthy.length} 个子代理不健康：${unhealthy.map((r) => r.childId.slice(0, 8)).join(", ")}`,
        };
      }
    } catch (error) {
      logger.error("check_child_health 失败", error instanceof Error ? error : undefined);
    }
    return { shouldWake: false };
  },

  // === 阶段 3.1：清理死亡子代理 ===
  prune_dead_children: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const { ChildLifecycle } = await import("../replication/lifecycle.js");
      const { SandboxCleanup } = await import("../replication/cleanup.js");
      const { pruneDeadChildren } = await import("../replication/lineage.js");
      const lifecycle = new ChildLifecycle(taskCtx.db.raw);
      const cleanup = new SandboxCleanup(taskCtx.conway, lifecycle, taskCtx.db.raw);
      const pruned = await pruneDeadChildren(taskCtx.db, cleanup);
      if (pruned > 0) {
        logger.info(`清理了 ${pruned} 个死亡子代理`);
      }
    } catch (error) {
      logger.error("prune_dead_children 失败", error instanceof Error ? error : undefined);
    }
    return { shouldWake: false };
  },

  health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // 检查沙箱是否健康
    try {
      const result = await taskCtx.conway.exec("echo alive", 5000);
      if (result.exitCode !== 0) {
        // 仅在首次失败时唤醒，而非重复失败
        const prevStatus = taskCtx.db.getKV("health_check_status");
        if (prevStatus !== "failing") {
          taskCtx.db.setKV("health_check_status", "failing");
          return {
            shouldWake: true,
            message: "健康检查失败：沙箱执行返回非零值",
          };
        }
        return { shouldWake: false };
      }
    } catch (err: any) {
      // 仅在首次失败时唤醒，而非重复失败
      const prevStatus = taskCtx.db.getKV("health_check_status");
      if (prevStatus !== "failing") {
        taskCtx.db.setKV("health_check_status", "failing");
        return {
          shouldWake: true,
          message: `健康检查失败：${err.message}`,
        };
      }
      return { shouldWake: false };
    }

    // 健康检查通过 — 清除失败状态
    taskCtx.db.setKV("health_check_status", "ok");
    taskCtx.db.setKV("last_health_check", new Date().toISOString());
    return { shouldWake: false };
  },

  // === 阶段 4.1：指标报告 ===
  report_metrics: async (ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    try {
      const metrics = getMetrics();
      const alerts = getAlertEngine();

      // 从 tick 上下文更新仪表
      metrics.gauge("balance_cents", ctx.creditBalance);
      metrics.gauge("survival_tier", tierToInt(ctx.survivalTier));

      // 评估告警
      const firedAlerts = alerts.evaluate(metrics);

      // 将快照保存到数据库
      metricsInsertSnapshot(taskCtx.db.raw, {
        id: ulid(),
        snapshotAt: new Date().toISOString(),
        metricsJson: JSON.stringify(metrics.getAll()),
        alertsJson: JSON.stringify(firedAlerts),
        createdAt: new Date().toISOString(),
      });

      // 修剪旧快照（保留 7 天）
      metricsPruneOld(taskCtx.db.raw, 7);

      // 记录告警
      for (const alert of firedAlerts) {
        logger.warn(`告警：${alert.rule} - ${alert.message}`, { alert });
      }

      return {
        shouldWake: firedAlerts.some((a) => a.severity === "critical"),
        message: firedAlerts.length ? `${firedAlerts.length} 个告警触发` : undefined,
      };
    } catch (error) {
      logger.error("report_metrics 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  colony_health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!shouldRunAtInterval(taskCtx, "colony_health_check", COLONY_TASK_INTERVALS_MS.colony_health_check)) {
      return { shouldWake: false };
    }

    try {
      const monitor = await createHealthMonitor(taskCtx);
      const report = await monitor.checkAll();
      const actions = await monitor.autoHeal(report);

      taskCtx.db.setKV("last_colony_health_report", JSON.stringify(report));
      taskCtx.db.setKV("last_colony_heal_actions", JSON.stringify({
        timestamp: new Date().toISOString(),
        actions,
      }));

      const failedActions = actions.filter((action) => !action.success).length;
      const shouldWake = report.unhealthyAgents > 0 || failedActions > 0;

      return {
        shouldWake,
        message: shouldWake
          ? `殖民地健康：${report.unhealthyAgents} 个不健康，${actions.length} 个治愈操作，${failedActions} 个失败`
          : undefined,
      };
    } catch (error) {
      logger.error("colony_health_check 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  colony_financial_report: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!shouldRunAtInterval(taskCtx, "colony_financial_report", COLONY_TASK_INTERVALS_MS.colony_financial_report)) {
      return { shouldWake: false };
    }

    try {
      const transactions = taskCtx.db.getRecentTransactions(5000);
      let revenueCents = 0;
      let expenseCents = 0;

      for (const tx of transactions) {
        const amount = Math.max(0, Math.floor(tx.amountCents ?? 0));
        if (amount === 0) continue;

        if (tx.type === "transfer_in" || tx.type === "credit_purchase") {
          revenueCents += amount;
          continue;
        }

        if (
          tx.type === "inference"
          || tx.type === "tool_use"
          || tx.type === "transfer_out"
          || tx.type === "funding_request"
        ) {
          expenseCents += amount;
        }
      }

      const childFunding = taskCtx.db.raw
        .prepare("SELECT COALESCE(SUM(funded_amount_cents), 0) AS total FROM children")
        .get() as { total: number };

      const taskCosts = taskCtx.db.raw
        .prepare(
          `SELECT COALESCE(SUM(actual_cost_cents), 0) AS total
           FROM task_graph
           WHERE status IN ('completed', 'failed', 'cancelled')`,
        )
        .get() as { total: number };

      const report = {
        timestamp: new Date().toISOString(),
        revenueCents,
        expenseCents,
        netCents: revenueCents - expenseCents,
        fundedToChildrenCents: childFunding.total,
        taskExecutionCostCents: taskCosts.total,
        activeAgents: taskCtx.db.getChildren().filter(
          (child) => child.status !== "dead" && child.status !== "cleaned_up",
        ).length,
      };

      taskCtx.db.setKV("last_colony_financial_report", JSON.stringify(report));
      return { shouldWake: false };
    } catch (error) {
      logger.error("colony_financial_report 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  agent_pool_optimize: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!shouldRunAtInterval(taskCtx, "agent_pool_optimize", COLONY_TASK_INTERVALS_MS.agent_pool_optimize)) {
      return { shouldWake: false };
    }

    try {
      const IDLE_CULL_MS = 60 * 60 * 1000;
      const now = Date.now();
      const children = taskCtx.db.getChildren();

      const activeAssignments = taskCtx.db.raw
        .prepare(
          `SELECT DISTINCT assigned_to AS address
           FROM task_graph
           WHERE assigned_to IS NOT NULL
             AND status IN ('assigned', 'running')`,
        )
        .all() as Array<{ address: string }>;

      const busyAgents = new Set(
        activeAssignments
          .map((row) => row.address)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      );

      let culled = 0;
      for (const child of children) {
        if (!["running", "healthy", "sleeping"].includes(child.status)) continue;
        if (busyAgents.has(child.address)) continue;

        const lastSeenIso = child.lastChecked ?? child.createdAt;
        const lastSeenMs = Date.parse(lastSeenIso);
        if (Number.isNaN(lastSeenMs)) continue;
        if (now - lastSeenMs < IDLE_CULL_MS) continue;

        taskCtx.db.updateChildStatus(child.id, "stopped");
        culled += 1;
      }

      const pendingUnassignedRow = taskCtx.db.raw
        .prepare(
          `SELECT COUNT(*) AS count
           FROM task_graph
           WHERE status = 'pending'
             AND assigned_to IS NULL`,
        )
        .get() as { count: number };

      const idleAgents = children.filter(
        (child) =>
          (child.status === "running" || child.status === "healthy")
          && !busyAgents.has(child.address),
      ).length;

      const activeAgents = children.filter(
        (child) => child.status !== "dead" && child.status !== "cleaned_up" && child.status !== "failed",
      ).length;

      const spawnNeeded = Math.max(0, pendingUnassignedRow.count - idleAgents);
      const spawnCapacity = Math.max(0, taskCtx.config.maxChildren - activeAgents);
      const spawnRequested = Math.min(spawnNeeded, spawnCapacity);

      taskCtx.db.setKV("last_agent_pool_optimize", JSON.stringify({
        timestamp: new Date().toISOString(),
        culled,
        pendingTasks: pendingUnassignedRow.count,
        idleAgents,
        spawnRequested,
      }));

      if (spawnRequested > 0) {
        taskCtx.db.setKV("agent_pool_spawn_request", JSON.stringify({
          timestamp: new Date().toISOString(),
          requested: spawnRequested,
          pendingTasks: pendingUnassignedRow.count,
          idleAgents,
        }));
      }

      return {
        shouldWake: spawnRequested > 0,
        message: spawnRequested > 0
          ? `代理池需要 ${spawnRequested} 个额外代理来处理待处理的工作负载`
          : undefined,
      };
    } catch (error) {
      logger.error("agent_pool_optimize 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  knowledge_store_prune: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!shouldRunAtInterval(taskCtx, "knowledge_store_prune", COLONY_TASK_INTERVALS_MS.knowledge_store_prune)) {
      return { shouldWake: false };
    }

    try {
      const { KnowledgeStore } = await import("../memory/knowledge-store.js");
      const knowledgeStore = new KnowledgeStore(taskCtx.db.raw);
      const pruned = knowledgeStore.prune();

      taskCtx.db.setKV("last_knowledge_store_prune", JSON.stringify({
        timestamp: new Date().toISOString(),
        pruned,
      }));

      return { shouldWake: false };
    } catch (error) {
      logger.error("knowledge_store_prune 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },

  dead_agent_cleanup: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    if (!shouldRunAtInterval(taskCtx, "dead_agent_cleanup", COLONY_TASK_INTERVALS_MS.dead_agent_cleanup)) {
      return { shouldWake: false };
    }

    try {
      const { ChildLifecycle } = await import("../replication/lifecycle.js");
      const { SandboxCleanup } = await import("../replication/cleanup.js");
      const { pruneDeadChildren } = await import("../replication/lineage.js");

      const lifecycle = new ChildLifecycle(taskCtx.db.raw);
      const cleanup = new SandboxCleanup(taskCtx.conway, lifecycle, taskCtx.db.raw);
      const cleaned = await pruneDeadChildren(taskCtx.db, cleanup);

      taskCtx.db.setKV("last_dead_agent_cleanup", JSON.stringify({
        timestamp: new Date().toISOString(),
        cleaned,
      }));

      return { shouldWake: false };
    } catch (error) {
      logger.error("dead_agent_cleanup 失败", error instanceof Error ? error : undefined);
      return { shouldWake: false };
    }
  },
};

function tierToInt(tier: SurvivalTier): number {
  const map: Record<SurvivalTier, number> = {
    dead: 0,
    critical: 1,
    low_compute: 2,
    normal: 3,
    high: 4,
  };
  return map[tier] ?? 0;
}

function shouldRunAtInterval(
  taskCtx: HeartbeatLegacyContext,
  taskName: string,
  intervalMs: number,
): boolean {
  const key = `heartbeat.last_run.${taskName}`;
  const now = Date.now();
  const lastRun = taskCtx.db.getKV(key);

  if (lastRun) {
    const lastRunMs = Date.parse(lastRun);
    if (!Number.isNaN(lastRunMs) && now - lastRunMs < intervalMs) {
      return false;
    }
  }

  taskCtx.db.setKV(key, new Date(now).toISOString());
  return true;
}

async function createHealthMonitor(taskCtx: HeartbeatLegacyContext): Promise<ColonyHealthMonitor> {
  const { LocalDBTransport, ColonyMessaging } = await import("../orchestration/messaging.js");
  const { SimpleAgentTracker, SimpleFundingProtocol } = await import("../orchestration/simple-tracker.js");
  const { HealthMonitor } = await import("../orchestration/health-monitor.js");

  const tracker = new SimpleAgentTracker(taskCtx.db);
  const funding = new SimpleFundingProtocol(taskCtx.conway, taskCtx.identity, taskCtx.db);
  const transport = new LocalDBTransport(taskCtx.db);
  const messaging = new ColonyMessaging(transport, taskCtx.db);

  return new HealthMonitor(taskCtx.db, tracker, funding, messaging);
}
