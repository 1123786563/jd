export interface AgentConfig {
    name: string;
    provider: string;       // 'anthropic', 'openai', 'opencode', 'zhipu', 'kimi', 'qwen'
    model: string;           // e.g. 'sonnet', 'opus', 'glm-4', 'kimi-k2.5', 'qwen-max'
    working_directory: string;
    system_prompt?: string;
    prompt_file?: string;
}

export interface TeamConfig {
    name: string;
    agents: string[];
    leader_agent: string;
}

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignee: string;       // agent or team id, empty = unassigned
    assigneeType: 'agent' | 'team' | '';
    createdAt: number;
    updatedAt: number;
}

export interface ChainStep {
    agentId: string;
    response: string;
}

export interface Settings {
    workspace?: {
        path?: string;
        name?: string;
    };
    channels?: {
        enabled?: string[];
        discord?: { bot_token?: string };
        telegram?: { bot_token?: string };
        whatsapp?: {};
        feishu?: { app_id?: string; app_secret?: string; encrypt_key?: string };
    };
    models?: {
        provider?: string; // 'anthropic', 'openai', or 'opencode'
        anthropic?: {
            model?: string;
        };
        openai?: {
            model?: string;
        };
        opencode?: {
            model?: string;
        };
    };
    agents?: Record<string, AgentConfig>;
    teams?: Record<string, TeamConfig>;
    monitoring?: {
        heartbeat_interval?: number;
    };
}

export interface MessageData {
    channel: string;
    sender: string;
    senderId?: string;
    message: string;
    timestamp: number;
    messageId: string;
    agent?: string; // optional: pre-routed agent id from channel client
    files?: string[];
    // Internal message fields (agent-to-agent)
    conversationId?: string; // links to parent conversation
    fromAgent?: string;      // which agent sent this internal message
}

export interface Conversation {
    id: string;
    channel: string;
    sender: string;
    originalMessage: string;
    messageId: string;
    pending: number;
    responses: ChainStep[];
    files: Set<string>;
    totalMessages: number;
    maxMessages: number;
    teamContext: { teamId: string; team: TeamConfig };
    startTime: number;
    // Track how many mentions each agent sent out (for inbox draining)
    outgoingMentions: Map<string, number>;
}

export interface ResponseData {
    channel: string;
    sender: string;
    message: string;
    originalMessage: string;
    timestamp: number;
    messageId: string;
    agent?: string; // which agent handled this
    files?: string[];
    metadata?: Record<string, unknown>;
}

// Model name mapping
export const CLAUDE_MODEL_IDS: Record<string, string> = {
    'sonnet': 'claude-sonnet-4-5',
    'opus': 'claude-opus-4-6',
    'claude-sonnet-4-5': 'claude-sonnet-4-5',
    'claude-opus-4-6': 'claude-opus-4-6'
};

export const CODEX_MODEL_IDS: Record<string, string> = {
    'gpt-5.2': 'gpt-5.2',
    'gpt-5.3-codex': 'gpt-5.3-codex',
};

// OpenCode model IDs in provider/model format (passed via --model / -m flag).
// Falls back to the raw model string from settings if no mapping is found.
export const OPENCODE_MODEL_IDS: Record<string, string> = {
    'opencode/claude-opus-4-6': 'opencode/claude-opus-4-6',
    'opencode/claude-sonnet-4-5': 'opencode/claude-sonnet-4-5',
    'opencode/gemini-3-flash': 'opencode/gemini-3-flash',
    'opencode/gemini-3-pro': 'opencode/gemini-3-pro',
    'opencode/glm-5': 'opencode/glm-5',
    'opencode/kimi-k2.5': 'opencode/kimi-k2.5',
    'opencode/kimi-k2.5-free': 'opencode/kimi-k2.5-free',
    'opencode/minimax-m2.5': 'opencode/minimax-m2.5',
    'opencode/minimax-m2.5-free': 'opencode/minimax-m2.5-free',
    'anthropic/claude-opus-4-6': 'anthropic/claude-opus-4-6',
    'anthropic/claude-sonnet-4-5': 'anthropic/claude-sonnet-4-5',
    'openai/gpt-5.2': 'openai/gpt-5.2',
    'openai/gpt-5.3-codex': 'openai/gpt-5.3-codex',
    'openai/gpt-5.3-codex-spark': 'openai/gpt-5.3-codex-spark',
    // Shorthand aliases
    'sonnet': 'opencode/claude-sonnet-4-5',
    'opus': 'opencode/claude-opus-4-6',
};

// Zhipu (智谱) model IDs
export const ZHIPU_MODEL_IDS: Record<string, string> = {
    'glm-4': 'glm-4',
    'glm-4-plus': 'glm-4-plus',
    'glm-4-air': 'glm-4-air',
    'glm-4-airx': 'glm-4-airx',
    'glm-4-long': 'glm-4-long',
    'glm-4-flash': 'glm-4-flash',
    'glm-4v': 'glm-4v',
    'glm-4v-plus': 'glm-4v-plus',
    'glm-z1-air': 'glm-z1-air',
    'glm-z1-airx': 'glm-z1-airx',
    'glm-z1-flash': 'glm-z1-flash',
    // Aliases
    'glm': 'glm-4',
    'chatglm': 'glm-4',
};

// Kimi (Moonshot) model IDs
export const KIMI_MODEL_IDS: Record<string, string> = {
    'kimi-k2.5': 'kimi-k2.5',
    'kimi-k2.5-free': 'kimi-k2.5-free',
    'moonshot-v1-8k': 'moonshot-v1-8k',
    'moonshot-v1-32k': 'moonshot-v1-32k',
    'moonshot-v1-128k': 'moonshot-v1-128k',
    // Aliases
    'kimi': 'kimi-k2.5',
    'moonshot': 'moonshot-v1-8k',
};

// Qwen (通义千问) model IDs
export const QWEN_MODEL_IDS: Record<string, string> = {
    'qwen-max': 'qwen-max',
    'qwen-max-latest': 'qwen-max-latest',
    'qwen-plus': 'qwen-plus',
    'qwen-plus-latest': 'qwen-plus-latest',
    'qwen-turbo': 'qwen-turbo',
    'qwen-turbo-latest': 'qwen-turbo-latest',
    'qwen-long': 'qwen-long',
    'qwen-vl-max': 'qwen-vl-max',
    'qwen-vl-plus': 'qwen-vl-plus',
    'qwen2.5-72b-instruct': 'qwen2.5-72b-instruct',
    'qwen2.5-32b-instruct': 'qwen2.5-32b-instruct',
    'qwen2.5-14b-instruct': 'qwen2.5-14b-instruct',
    'qwen2.5-7b-instruct': 'qwen2.5-7b-instruct',
    // Aliases
    'qwen': 'qwen-max',
    'tongyi': 'qwen-max',
};
