import type Database from "better-sqlite3";
import type { ChatMessage } from "../types.js";
import {
  getActiveGoals,
  getTasksByGoal,
  type GoalRow,
  type TaskGraphRow,
} from "../state/database.js";

const MAX_TODO_TOKENS = 2000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function assignee(assignedTo: string | null): string {
  return assignedTo ?? "未分配";
}

function formatTaskLine(task: TaskGraphRow): string {
  if (task.status === "completed") {
    return `- [x] ${task.title} (由 ${assignee(task.assignedTo)} 完成)`;
  }

  if (task.status === "running") {
    return `- [~] ${task.title} (运行中 — ${assignee(task.assignedTo)})`;
  }

  const status = task.status === "blocked" ? "阻塞" : "待处理";
  return `- [ ] ${task.title} (${status})`;
}

function formatGoalSection(goal: GoalRow, tasks: TaskGraphRow[]): string {
  const estimatedBudgetCents = tasks.reduce((sum, task) => sum + task.estimatedCostCents, 0);
  const actualSpentCents = tasks.reduce((sum, task) => sum + task.actualCostCents, 0);
  const budget = `${formatDollars(estimatedBudgetCents)} 预算，${formatDollars(actualSpentCents)} 已花费`;

  const lines = tasks.map(formatTaskLine);
  return [`## 目标：${goal.title} [${budget}]`, ...lines].join("\n");
}

export function generateTodoMd(db: Database.Database): string {
  const activeGoals = getActiveGoals(db);
  if (activeGoals.length === 0) {
    return "";
  }

  const header = "# 活跃目标";
  const sections = activeGoals.map((goal) => {
    const tasks = getTasksByGoal(db, goal.id);
    return formatGoalSection(goal, tasks);
  });

  let keptSections = sections;
  let todoMd = `${header}\n\n${keptSections.join("\n\n")}`;

  // 首先移除最旧的目标，保留最新的目标。
  while (estimateTokens(todoMd) > MAX_TODO_TOKENS && keptSections.length > 1) {
    keptSections = keptSections.slice(1);
    todoMd = `${header}\n\n${keptSections.join("\n\n")}`;
  }

  return todoMd;
}

export function injectTodoContext(messages: ChatMessage[], todoMd: string): ChatMessage[] {
  if (todoMd.trim().length === 0) {
    return messages;
  }

  const todoMessage: ChatMessage = {
    role: "system",
    content: `## 当前目标与任务\n\n${todoMd}`,
  };

  return [...messages, todoMessage];
}
