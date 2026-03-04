/**
 * 本地代理工作器
 *
 * 在进程内作为异步后台任务运行推理驱动的任务执行。
 * 每个工作器获得特定角色的系统提示、工具子集，并运行
 * ReAct 循环（思考 → 工具调用 → 观察 → 重复 → 完成）。
 *
 * 这使得本地机器上无需 Conway 沙箱基础设施即可进行多代理协调。
 * 工作器共享同一个 Node.js 进程，但作为独立的异步任务并发运行。
 */

import { ulid } from "ulid";
import { exec as execCb } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "../observability/logger.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
import { completeTask, failTask } from "./task-graph.js";
import type { TaskNode, TaskResult } from "./task-graph.js";
import type { Database } from "better-sqlite3";
import type { ConwayClient } from "../types.js";

function truncateOutput(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n[已截断: 省略了 ${text.length - maxLen} 个字符]`;
}

function localExec(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = execCb(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout && !stderr) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

async function localWriteFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function localReadFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

const logger = createLogger("orchestration.local-worker");

const MAX_TURNS = 25;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

// 最小推理接口 — 适用于 UnifiedInferenceClient 和
// 主代理的 InferenceClient 适配器。
interface WorkerInferenceClient {
  chat(params: {
    tier: string;
    messages: any[];
    tools?: any[];
    toolChoice?: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: string };
  }): Promise<{ content: string; toolCalls?: unknown[] }>;
}

interface LocalWorkerConfig {
  db: Database;
  inference: WorkerInferenceClient;
  conway: ConwayClient;
  workerId: string;
  maxTurns?: number;
}

interface WorkerToolResult {
  name: string;
  output: string;
  error?: string;
}

// 本地工作器可用的最小工具集
interface WorkerTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export class LocalWorkerPool {
  private activeWorkers = new Map<string, { promise: Promise<void>; taskId: string; abortController: AbortController }>();

  constructor(private readonly config: LocalWorkerConfig) {}

  /**
   * 为任务生成一个本地工作器。立即返回 — 工作器在后台运行
   * 并通过任务图报告结果。
   */
  spawn(task: TaskNode): { address: string; name: string; sandboxId: string } {
    const workerId = `local-worker-${ulid()}`;
    const workerName = `worker-${task.agentRole ?? "generalist"}-${workerId.slice(-6)}`;
    const address = `local://${workerId}`;
    const abortController = new AbortController();

    const workerPromise = this.runWorker(workerId, task, abortController.signal)
      .catch((error) => {
        logger.error("本地工作器崩溃", error instanceof Error ? error : new Error(String(error)), {
          workerId,
          taskId: task.id,
        });
        try {
          failTask(this.config.db, task.id, `工作器崩溃: ${error instanceof Error ? error.message : String(error)}`, true);
        } catch { /* 任务可能已处于终态 */ }
      })
      .finally(() => {
        this.activeWorkers.delete(workerId);
      });

    this.activeWorkers.set(workerId, { promise: workerPromise, taskId: task.id, abortController });

    return { address, name: workerName, sandboxId: workerId };
  }

  getActiveCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * 检查工作器当前是否在此池中处于活动状态。
   * 接受完整地址（"local://worker-id"）或原始工作器 ID。
   */
  hasWorker(addressOrId: string): boolean {
    const id = addressOrId.replace("local://", "");
    return this.activeWorkers.has(id);
  }

  async shutdown(): Promise<void> {
    for (const [, worker] of this.activeWorkers) {
      worker.abortController.abort();
    }
    await Promise.allSettled([...this.activeWorkers.values()].map((w) => w.promise));
    this.activeWorkers.clear();
  }

  private async runWorker(workerId: string, task: TaskNode, signal: AbortSignal): Promise<void> {
    const maxTurns = this.config.maxTurns ?? MAX_TURNS;
    const tools = this.buildWorkerTools();
    const toolDefs = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const systemPrompt = this.buildWorkerSystemPrompt(task);
    const messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: this.buildTaskPrompt(task) },
    ];

    const artifacts: string[] = [];
    let finalOutput = "";
    const startedAt = Date.now();

    logger.info(`[工作器 ${workerId}] 开始任务 "${task.title}" (${task.id})，角色: ${task.agentRole ?? "通才"}`);

    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal.aborted) {
        logger.info(`[工作器 ${workerId}] 在第 ${turn} 轮中止`);
        failTask(this.config.db, task.id, "工作器已中止", false);
        return;
      }

      const timeoutMs = task.metadata.timeoutMs || DEFAULT_TIMEOUT_MS;
      if (Date.now() - startedAt > timeoutMs) {
        logger.warn(`[工作器 ${workerId}] 在第 ${turn} 轮超时（${timeoutMs}ms）`);
        failTask(this.config.db, task.id, `工作器在 ${timeoutMs}ms 后超时`, true);
        return;
      }

      logger.info(`[工作器 ${workerId}] 第 ${turn + 1}/${maxTurns} 轮 — 调用推理（层级: 快速）`);

      let response;
      try {
        response = await this.config.inference.chat({
          tier: "fast",
          messages: messages as any,
          tools: toolDefs,
          toolChoice: "auto",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[工作器 ${workerId}] 在第 ${turn + 1} 轮推理失败`, error instanceof Error ? error : new Error(msg));
        failTask(this.config.db, task.id, `推理失败: ${msg}`, true);
        return;
      }

      // 检查模型是否想要调用工具
      if (response.toolCalls && Array.isArray(response.toolCalls) && response.toolCalls.length > 0) {
        const toolNames = (response.toolCalls as any[]).map((tc: any) => tc.function?.name ?? "?").join(", ");
        logger.info(`[工作器 ${workerId}] 第 ${turn + 1} 轮 — 工具调用: ${toolNames}`);

        // 添加带有工具调用的助手消息
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: response.toolCalls,
        });

        // 执行每个工具调用
        for (const rawToolCall of response.toolCalls) {
          const toolCall = rawToolCall as { id: string; function: { name: string; arguments: string | Record<string, unknown> } };
          const fn = toolCall.function;
          const tool = tools.find((t) => t.name === fn.name);

          let toolOutput: string;
          if (!tool) {
            toolOutput = `错误: 未知工具 '${fn.name}'`;
            logger.warn(`[工作器 ${workerId}] 未知工具: ${fn.name}`);
          } else {
            try {
              const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
              toolOutput = await tool.execute(args as Record<string, unknown>);
              logger.info(`[工作器 ${workerId}] ${fn.name} → ${toolOutput.slice(0, 120)}`);

              // 跟踪文件产物
              if (fn.name === "write_file" && typeof (args as any).path === "string") {
                artifacts.push((args as any).path);
              }
            } catch (error) {
              toolOutput = `错误: ${error instanceof Error ? error.message : String(error)}`;
            }
          }

          messages.push({
            role: "tool",
            content: toolOutput,
            tool_call_id: toolCall.id,
          });
        }

        continue;
      }

      // 没有工具调用 — 模型已完成（最终响应）
      finalOutput = response.content || "任务已完成。";
      logger.info(`[工作器 ${workerId}] 在第 ${turn + 1} 轮完成 — ${finalOutput.slice(0, 200)}`);
      break;
    }

    // 标记任务为已完成
    const duration = Date.now() - startedAt;
    const result: TaskResult = {
      success: true,
      output: finalOutput,
      artifacts,
      costCents: 0,
      duration,
    };

    try {
      completeTask(this.config.db, task.id, result);
      logger.info("本地工作器完成任务", {
        workerId,
        taskId: task.id,
        title: task.title,
        duration,
        turns: messages.filter((m) => m.role === "assistant").length,
      });
    } catch (error) {
      logger.warn("标记任务完成失败", {
        workerId,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildWorkerSystemPrompt(task: TaskNode): string {
    const role = task.agentRole ?? "generalist";
    return `你是一个具有以下角色的工作器代理: ${role}。

父协调器已为你分配了一个特定任务。你的工作是使用可用的工具完成此任务，然后提供最终输出。

规则:
- 仅专注于分配的任务。不要偏离。
- 使用 exec 运行 shell 命令（安装包、运行脚本等）
- 使用 write_file 创建或修改文件。
- 使用 read_file 检查现有文件。
- 完成后，在你的最终消息中提供你完成工作的清晰摘要。
- 如果无法完成任务，请在最终消息中说明原因。
- 完成后不要调用工具。只需给出最终文本响应。
- 要高效。尽量减少不必要的工具调用。
- 你的轮次有限。不要浪费它们。`;
  }

  private buildTaskPrompt(task: TaskNode): string {
    const lines = [
      `# 任务分配`,
      `**标题:** ${task.title}`,
      `**描述:** ${task.description}`,
      `**角色:** ${task.agentRole ?? "通才"}`,
      `**任务 ID:** ${task.id}`,
      `**目标 ID:** ${task.goalId}`,
    ];

    if (task.dependencies.length > 0) {
      lines.push(`**依赖项（已完成）:** ${task.dependencies.join(", ")}`);
    }

    lines.push("", "完成此任务并提供你的结果。");
    return lines.join("\n");
  }

  private buildWorkerTools(): WorkerTool[] {
    return [
      {
        name: "exec",
        description: "执行 shell 命令并返回 stdout/stderr。用于安装包、运行脚本、构建代码等。",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "要执行的 shell 命令" },
            timeout_ms: { type: "number", description: "超时时间（毫秒）（默认: 30000）" },
          },
          required: ["command"],
        },
        execute: async (args) => {
          const command = args.command as string;
          const timeoutMs = typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;

          // 首先尝试 Conway API，回退到本地 shell
          try {
            const result = await this.config.conway.exec(command, timeoutMs);
            const stdout = truncateOutput(result.stdout ?? "", 16_000);
            const stderr = truncateOutput(result.stderr ?? "", 4000);
            return stderr ? `stdout:\n${stdout}\nstderr:\n${stderr}` : stdout || "(无输出)";
          } catch {
            try {
              const result = await localExec(command, timeoutMs);
              const stdout = truncateOutput(result.stdout, 16_000);
              const stderr = truncateOutput(result.stderr, 4000);
              return stderr ? `stdout:\n${stdout}\nstderr:\n${stderr}` : stdout || "(无输出)";
            } catch (error) {
              return `exec 错误: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
        },
      },
      {
        name: "write_file",
        description: "将内容写入文件。如需要会创建父目录。",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "要写入的文件路径" },
            content: { type: "string", description: "文件内容" },
          },
          required: ["path", "content"],
        },
        execute: async (args) => {
          const filePath = args.path as string;
          const content = args.content as string;

          try {
            await this.config.conway.writeFile(filePath, content);
            return `已写入 ${content.length} 字节到 ${filePath}`;
          } catch {
            try {
              await localWriteFile(filePath, content);
              return `已写入 ${content.length} 字节到 ${filePath} (本地)`;
            } catch (error) {
              return `write 错误: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
        },
      },
      {
        name: "read_file",
        description: "读取文件内容。",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "要读取的文件路径" },
          },
          required: ["path"],
        },
        execute: async (args) => {
          try {
            const content = await this.config.conway.readFile(args.path as string);
            return content.slice(0, 10_000) || "(空文件)";
          } catch {
            try {
              const content = await localReadFile(args.path as string);
              return content.slice(0, 10_000) || "(空文件)";
            } catch (error) {
              return `read 错误: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
        },
      },
      {
        name: "task_done",
        description: "表示你已完成任务。将此作为你的最终操作，并附上你完成的工作摘要。",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "完成工作的摘要" },
          },
          required: ["summary"],
        },
        execute: async (args) => {
          return `任务完成: ${args.summary as string}`;
        },
      },
    ];
  }
}
