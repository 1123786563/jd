/**
 * 恢复调度器 - 超时任务恢复机制
 */
import { getStaleWorkingTasks, updateTaskStatus, upsertHeartbeat, getHeartbeat } from '../lib/db';

// ============================================
// 配置常量
// ============================================
const TASK_TIMEOUT_MS = 5 * 60 * 1000;    // 5 分钟
const HEARTBEAT_TIMEOUT_MS = 60 * 1000;   // 1 分钟
const INTERVAL_MS = 60 * 1000;            // 每分钟扫描

// ============================================
// 类型定义
// ============================================
interface StaleTask {
  id: string;
  retry_count: number;
  max_retries: number;
  to_agent: string;
}

// ============================================
// 恢复调度器类
// ============================================
export class RecoveryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * 启动恢复调度器
   */
  start(): void {
    if (this.intervalId) return;

    console.log('[RecoveryScheduler] 启动恢复调度器');
    this.intervalId = setInterval(() => this.runRecovery(), INTERVAL_MS);
    this.isRunning = true;
  }

  /**
   * 停止恢复调度器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('[RecoveryScheduler] 停止恢复调度器');
    }
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 执行一次恢复检查
   */
  async runRecovery(): Promise<void> {
    try {
      await this.recoverStaleTasks();
    } catch (error) {
      console.error('[RecoveryScheduler] 恢复检查失败', error);
    }
  }

  /**
   * 恢复超时任务
   */
  private async recoverStaleTasks(): Promise<void> {
    const staleTasks = getStaleWorkingTasks(TASK_TIMEOUT_MS);

    for (const task of staleTasks) {
      await this.checkAndRecoverTask(task as unknown as StaleTask);
    }
  }

  /**
   * 检查并恢复单个任务
   */
  private async checkAndRecoverTask(task: StaleTask): Promise<void> {
    // 检查 Agent 心跳
    const heartbeat = getHeartbeat(task.to_agent);

    const agentAlive = heartbeat &&
      heartbeat.status === 'running' &&
      Date.now() - heartbeat.last_heartbeat < HEARTBEAT_TIMEOUT_MS;

    const agentWorkingOnThisTask = heartbeat?.current_task_id === task.id;

    if (agentAlive && agentWorkingOnThisTask) {
      // Agent 还活着，正在处理这个任务，继续等待
      console.log(`[RecoveryScheduler] Task ${task.id} 仍在处理中，Agent 心跳正常`, {
        agentId: task.to_agent,
        agentStatus: heartbeat?.status,
        lastHeartbeat: heartbeat?.last_heartbeat
      });
      return;
    }

    // 真正超时，执行恢复
    await this.recoverTask(task);
  }

  /**
   * 恢复任务
   */
  private async recoverTask(task: StaleTask): Promise<void> {
    console.log(`[RecoveryScheduler] 恢复超时任务 ${task.id}`, {
      retryCount: task.retry_count,
      maxRetries: task.max_retries
    });

    if (task.retry_count < task.max_retries) {
      // 恢复为 submitted，等待重试
      updateTaskStatus(task.id, 'submitted', 'Recovered after timeout');

      console.log(`[RecoveryScheduler] Task ${task.id} 已恢复为待处理状态，重试次数 ${task.retry_count + 1}`);
    } else {
      // 超过最大重试次数，标记为失败
      updateTaskStatus(task.id, 'failed', 'Exceeded max retries after timeout');

      console.warn(`[RecoveryScheduler] Task ${task.id} 超过最大重试次数，已标记为失败`);
    }
  }
}

// ============================================
// 单例导出
// ============================================
export const recoveryScheduler = new RecoveryScheduler();
