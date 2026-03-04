/**
 * 告警引擎
 *
 * 根据指标快照评估告警规则。
 * 跟踪每个规则的冷却时间以避免告警风暴。
 * 永不抛出异常 — 评估所有规则并静默收集错误。
 */

import type { AlertRule, AlertEvent, AlertSeverity, MetricSnapshot } from "../types.js";

export function createDefaultAlertRules(): AlertRule[] {
  return [
    {
      name: "balance_below_reserve",
      severity: "critical",
      message: "余额低于最低储备金（1000 美分）",
      cooldownMs: 5 * 60 * 1000, // 5 min
      condition: (metrics: MetricSnapshot) => {
        const balance = metrics.gauges.get("balance_cents") ?? Infinity;
        return balance < 1000;
      },
    },
    {
      name: "heartbeat_high_failure_rate",
      severity: "warning",
      message: "心跳任务失败率超过 20%",
      cooldownMs: 15 * 60 * 1000, // 15 min
      condition: (metrics: MetricSnapshot) => {
        const failures = metrics.counters.get("heartbeat_task_failures_total") ?? 0;
        const successes = metrics.counters.get("heartbeat_task_successes_total") ?? 0;
        const total = failures + successes;
        if (total === 0) return false;
        return failures / total > 0.2;
      },
    },
    {
      name: "policy_high_deny_rate",
      severity: "warning",
      message: "策略拒绝率超过 50%",
      cooldownMs: 15 * 60 * 1000, // 15 min
      condition: (metrics: MetricSnapshot) => {
        const denies = metrics.counters.get("policy_denies_total") ?? 0;
        const total = metrics.counters.get("policy_decisions_total") ?? 0;
        if (total < 10) return false; // 需要最小样本量
        return denies / total > 0.5;
      },
    },
    {
      name: "context_near_capacity",
      severity: "warning",
      message: "上下文令牌使用量超过预算的 90%",
      cooldownMs: 10 * 60 * 1000, // 10 min
      condition: (metrics: MetricSnapshot) => {
        const tokens = metrics.gauges.get("context_tokens_total") ?? 0;
        // 100k 默认预算
        return tokens > 90_000;
      },
    },
    {
      name: "inference_budget_warning",
      severity: "warning",
      message: "每日推理成本超过上限的 80%",
      cooldownMs: 30 * 60 * 1000, // 30 min
      condition: (metrics: MetricSnapshot) => {
        const cost = metrics.counters.get("inference_cost_cents") ?? 0;
        // 500 美分（5 美元）每日默认上限
        return cost > 400;
      },
    },
    {
      name: "child_unhealthy_extended",
      severity: "warning",
      message: "子代理长时间处于不健康状态",
      cooldownMs: 30 * 60 * 1000, // 30 min
      condition: (metrics: MetricSnapshot) => {
        const unhealthy = metrics.gauges.get("unhealthy_child_count") ?? 0;
        return unhealthy > 0;
      },
    },
    {
      name: "zero_turns_last_hour",
      severity: "critical",
      message: "过去一小时内没有成功的对话轮次",
      cooldownMs: 60 * 60 * 1000, // 60 min
      condition: (metrics: MetricSnapshot) => {
        const turnsLastHour = metrics.gauges.get("turns_last_hour") ?? -1;
        // 如果可用，使用窗口化仪表盘；仅在仪表盘尚未设置时
        // 回退到累积计数器（-1 哨兵值）。
        if (turnsLastHour >= 0) return turnsLastHour === 0;
        const turnsTotal = metrics.counters.get("turns_total") ?? -1;
        // 如果 turns_total 从未设置，假设我们刚刚启动 — 不告警
        if (turnsTotal < 0) return false;
        return turnsTotal === 0;
      },
    },
  ];
}

export class AlertEngine {
  private rules: AlertRule[];
  private lastFired = new Map<string, number>();
  private activeAlerts: AlertEvent[] = [];

  constructor(rules?: AlertRule[]) {
    this.rules = rules ?? createDefaultAlertRules();
  }

  addRule(rule: AlertRule): void {
    try {
      this.rules.push(rule);
    } catch { /* never throw */ }
  }

  evaluate(metrics: MetricsCollector | MetricSnapshot): AlertEvent[] {
    const snapshot: MetricSnapshot = "getSnapshot" in metrics
      ? (metrics as any).getSnapshot()
      : metrics as MetricSnapshot;

    const now = Date.now();
    const fired: AlertEvent[] = [];

    for (const rule of this.rules) {
      try {
        const lastTime = this.lastFired.get(rule.name) ?? 0;
        if (now - lastTime < rule.cooldownMs) continue;

        if (rule.condition(snapshot)) {
          const event: AlertEvent = {
            rule: rule.name,
            severity: rule.severity,
            message: rule.message,
            firedAt: new Date().toISOString(),
            metricValues: this.extractMetricValues(snapshot),
          };
          fired.push(event);
          this.lastFired.set(rule.name, now);

          // 更新活动告警（替换相同规则的现有告警）
          this.activeAlerts = this.activeAlerts.filter((a) => a.rule !== rule.name);
          this.activeAlerts.push(event);
        }
      } catch { /* 永不抛出 — 跳过此规则 */ }
    }

    return fired;
  }

  getActiveAlerts(): AlertEvent[] {
    return [...this.activeAlerts];
  }

  clearAlert(ruleName: string): void {
    try {
      this.activeAlerts = this.activeAlerts.filter((a) => a.rule !== ruleName);
      this.lastFired.delete(ruleName);
    } catch { /* never throw */ }
  }

  private extractMetricValues(snapshot: MetricSnapshot): Record<string, number> {
    const values: Record<string, number> = {};
    try {
      for (const [key, value] of snapshot.gauges) {
        values[key] = value;
      }
      for (const [key, value] of snapshot.counters) {
        values[key] = value;
      }
    } catch { /* never throw */ }
    return values;
  }
}

// evaluate() 重载兼容性的类型导入
import type { MetricsCollector } from "./metrics.js";
