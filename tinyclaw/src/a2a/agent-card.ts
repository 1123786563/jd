/**
 * TinyClaw Agent Card - A2A 协议能力声明
 */
import type { AgentCard, Skill } from './types';

// ============================================
// TinyClaw 技能定义
// ============================================
const ROUTE_MESSAGE_SKILL: Skill = {
  id: 'route-message',
  name: '消息路由',
  description: '将消息路由到指定的 Agent',
  inputSchema: {
    type: 'object',
    properties: {
      toAgent: { type: 'string', description: '目标 Agent ID' },
      content: { type: 'string', description: '消息内容' },
      priority: { type: 'integer', default: 0, description: '优先级 (0=最高)' }
    },
    required: ['toAgent', 'content']
  }
};

const CLAIM_TASK_SKILL: Skill = {
  id: 'claim-task',
  name: '任务认领',
  description: '认领待处理的消息任务',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: '认领者 Agent ID' }
    },
    required: ['agentId']
  }
};

const COMPLETE_TASK_SKILL: Skill = {
  id: 'complete-task',
  name: '完成任务',
  description: '标记任务完成并提交结果',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '任务 ID' },
      output: { type: 'string', description: '输出内容' }
    },
    required: ['taskId']
  }
};

const SEND_HEARTBEAT_SKILL: Skill = {
  id: 'send-heartbeat',
  name: '心跳上报',
  description: 'Agent 心跳状态上报',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      status: { type: 'string', enum: ['waking', 'running', 'sleeping', 'critical', 'dead'] },
      currentTaskId: { type: 'string', nullable: true }
    },
    required: ['agentId', 'status']
  }
};

// ============================================
// Agent Card 生成
// ============================================
export function getTinyClawAgentCard(): AgentCard {
  const baseUrl = process.env.TINYCLAW_URL || 'http://localhost:3000';

  return {
    name: 'TinyClaw Message Router',
    description: '多智能体消息路由系统，支持消息队列、@mention 路由和 Task 生命周期管理',
    url: `${baseUrl}/a2a`,
    version: '1.0.0',

    capabilities: {
      streaming: true,           // 支持 SSE 流式输出
      pushNotifications: true    // 支持 Webhook 推送
    },

    authentication: {
      schemes: ['bearer', 'api-key']
    },

    skills: [
      ROUTE_MESSAGE_SKILL,
      CLAIM_TASK_SKILL,
      COMPLETE_TASK_SKILL,
      SEND_HEARTBEAT_SKILL
    ],

    defaultInputModes: ['text'],
    defaultOutputModes: ['text']
  };
}

// 导出常量供直接使用
export const TINYCLAW_AGENT_CARD = getTinyClawAgentCard();
