#!/usr/bin/env node
/**
 * Feishu (Lark) Client for TinyClaw
 * Writes messages to queue and reads responses
 * Does NOT call Claude directly - that's handled by queue-processor
 *
 * Setup:
 * 1. Create a Feishu app at https://open.feishu.cn/app
 * 2. Enable Bot capability in the app
 * 3. Configure event subscriptions (im.message.receive_v1)
 * 4. Get App ID and App Secret from Credentials page
 * 5. Publish the app and add bot to group/private chat
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { log } from '../lib/logging';
import { SETTINGS_FILE, FILES_DIR, TINYCLAW_HOME } from '../lib/config';
import { ensureSenderPaired } from '../lib/pairing';

const API_PORT = parseInt(process.env.TINYCLAW_API_PORT || '3777', 10);
const API_BASE = process.env.TINYCLAW_API_BASE || `http://localhost:${API_PORT}`;
const API_KEY = process.env.TINYCLAW_API_KEY || '';
const API_AUTH_HEADERS: Record<string, string> = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, {
        ...init,
        headers: {
            ...API_AUTH_HEADERS,
            ...(init.headers || {}),
        },
    });
}

const SCRIPT_DIR = path.resolve(__dirname, '..', '..');
const _localTinyclaw = path.join(SCRIPT_DIR, '.tinyclaw');
const LOG_FILE = path.join(TINYCLAW_HOME, 'logs/feishu.log');
const PAIRING_FILE = path.join(TINYCLAW_HOME, 'pairing.json');

// Ensure directories exist
[path.dirname(LOG_FILE), FILES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Validate credentials
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_ENCRYPT_KEY = process.env.FEISHU_ENCRYPT_KEY;

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    console.error('ERROR: FEISHU_APP_ID and FEISHU_APP_SECRET must be set');
    process.exit(1);
}

if (!FEISHU_ENCRYPT_KEY) {
    console.warn('WARN: FEISHU_ENCRYPT_KEY is not set. Webhook signature verification will be disabled.');
}

interface PendingMessage {
    openChatId: string;
    openMessageId: string;
    timestamp: number;
}

interface FeishuAccessToken {
    token: string;
    expiresAt: number;
}

interface FeishuEvent {
    header: {
        event_id: string;
        event_type: string;
        create_time: string;
        token: string;
        app_id: string;
    };
    event: {
        sender: {
            sender_id: {
                union_id: string;
                user_id: string;
                open_id: string;
            };
            sender_type: string;
            tenant_key: string;
        };
        message: {
            message_id: string;
            root_id: string;
            parent_id: string;
            create_time: string;
            chat_id: string;
            open_chat_id: string;
            chat_type: string;
            message_type: string;
            content: string;
            mentions?: Array<{
                key: string;
                id: {
                    union_id: string;
                    user_id: string;
                    open_id: string;
                };
                name: string;
                tenant_key: string;
            }>;
        };
    };
}

// Track pending messages (waiting for response)
const pendingMessages = new Map<string, PendingMessage>();
let processingOutgoingQueue = false;
let accessToken: FeishuAccessToken | null = null;

// Load teams from settings for /team command
function getTeamListText(): string {
    try {
        const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(settingsData);
        const teams = settings.teams;
        if (!teams || Object.keys(teams).length === 0) {
            return 'No teams configured.\n\nCreate a team with: tinyclaw team add';
        }
        let text = 'Available Teams:\n';
        for (const [id, team] of Object.entries(teams) as [string, any][]) {
            text += `\n@${id} - ${team.name}`;
            text += `\n  Agents: ${team.agents.join(', ')}`;
            text += `\n  Leader: @${team.leader_agent}`;
        }
        text += '\n\nUsage: Start your message with @team_id to route to a team.';
        return text;
    } catch {
        return 'Could not load team configuration.';
    }
}

// Load agents from settings for /agent command
function getAgentListText(): string {
    try {
        const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(settingsData);
        const agents = settings.agents;
        if (!agents || Object.keys(agents).length === 0) {
            return 'No agents configured. Using default single-agent mode.\n\nConfigure agents in .tinyclaw/settings.json or run: tinyclaw agent add';
        }
        let text = 'Available Agents:\n';
        for (const [id, agent] of Object.entries(agents) as [string, any][]) {
            text += `\n@${id} - ${agent.name}`;
            text += `\n  Provider: ${agent.provider}/${agent.model}`;
            text += `\n  Directory: ${agent.working_directory}`;
            if (agent.system_prompt) text += `\n  Has custom system prompt`;
            if (agent.prompt_file) text += `\n  Prompt file: ${agent.prompt_file}`;
        }
        text += '\n\nUsage: Start your message with @agent_id to route to a specific agent.';
        return text;
    } catch {
        return 'Could not load agent configuration.';
    }
}

function pairingMessage(code: string): string {
    return [
        'This sender is not paired yet.',
        `Your pairing code: ${code}`,
        'Ask the TinyClaw owner to approve you with:',
        `tinyclaw pairing approve ${code}`,
    ].join('\n');
}

// Get Feishu access token
async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (accessToken && accessToken.expiresAt > Date.now() + 5 * 60 * 1000) {
        return accessToken.token;
    }

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            app_id: FEISHU_APP_ID,
            app_secret: FEISHU_APP_SECRET,
        }),
    });

    const data = await response.json() as any;
    if (data.code !== 0) {
        throw new Error(`Failed to get access token: ${data.msg}`);
    }

    accessToken = {
        token: data.tenant_access_token,
        expiresAt: Date.now() + data.expire * 1000,
    };

    log('INFO', 'Obtained new Feishu access token');
    return accessToken.token;
}

// Send message via Feishu API
async function sendFeishuMessage(openChatId: string, content: string, replyToMessageId?: string): Promise<void> {
    const token = await getAccessToken();

    const body: any = {
        receive_id_type: 'open_chat_id',
        content: JSON.stringify({ text: content }),
        msg_type: 'text',
    };

    const url = replyToMessageId
        ? `https://open.feishu.cn/open-apis/im/v1/messages/${replyToMessageId}/reply`
        : `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_chat_id`;

    if (!replyToMessageId) {
        body.receive_id = openChatId;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    const data = await response.json() as any;
    if (data.code !== 0) {
        throw new Error(`Failed to send message: ${data.msg}`);
    }
}

// Get user info from Feishu
async function getFeishuUser(openId: string): Promise<{ name: string }> {
    try {
        const token = await getAccessToken();
        const response = await fetch(`https://open.feishu.cn/open-apis/contact/v3/users/${openId}?user_id_type=open_id`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json() as any;
        if (data.code === 0 && data.data?.user) {
            return { name: data.data.user.name || openId };
        }
    } catch (error) {
        log('WARN', `Failed to get user info: ${(error as Error).message}`);
    }
    return { name: openId };
}

// Parse message content based on type
function parseMessageContent(messageType: string, content: string): string {
    if (messageType === 'text') {
        try {
            const parsed = JSON.parse(content);
            return parsed.text || '';
        } catch {
            return content;
        }
    }
    // For other message types, return a placeholder
    return `[${messageType}]`;
}

// Verify Feishu request signature
function verifySignature(timestamp: string, nonce: string, body: string, signature: string): boolean {
    if (!FEISHU_ENCRYPT_KEY) {
        log('WARN', 'Webhook signature verification skipped: FEISHU_ENCRYPT_KEY not configured');
        return true; // Skip verification in development mode
    }
    const token = FEISHU_ENCRYPT_KEY;
    const str = timestamp + nonce + token + body;
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return hash === signature;
}

// Handle Feishu webhook events
async function handleEvent(event: FeishuEvent): Promise<void> {
    const { sender, message } = event.event;

    // Only handle private chat messages
    if (message.chat_type !== 'p2p') {
        return;
    }

    // Skip non-text messages for now
    if (message.message_type !== 'text') {
        return;
    }

    const messageText = parseMessageContent(message.message_type, message.content);
    if (!messageText || messageText.trim().length === 0) {
        return;
    }

    const senderOpenId = sender.sender_id.open_id;
    const senderName = (await getFeishuUser(senderOpenId)).name;

    log('INFO', `Message from ${senderName}: ${messageText.substring(0, 50)}...`);

    // Generate unique message ID
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check pairing
    const pairing = ensureSenderPaired(PAIRING_FILE, 'feishu', senderOpenId, senderName);
    if (!pairing.approved && pairing.code) {
        if (pairing.isNewPending) {
            log('INFO', `Blocked unpaired Feishu sender ${senderName} (${senderOpenId}) with code ${pairing.code}`);
            await sendFeishuMessage(message.open_chat_id, pairingMessage(pairing.code), message.message_id);
        } else {
            log('INFO', `Blocked pending Feishu sender ${senderName} (${senderOpenId}) without re-sending pairing message`);
        }
        return;
    }

    // Check for agent list command
    if (messageText.trim().match(/^[!/]agent$/i)) {
        log('INFO', 'Agent list command received');
        await sendFeishuMessage(message.open_chat_id, getAgentListText(), message.message_id);
        return;
    }

    // Check for team list command
    if (messageText.trim().match(/^[!/]team$/i)) {
        log('INFO', 'Team list command received');
        await sendFeishuMessage(message.open_chat_id, getTeamListText(), message.message_id);
        return;
    }

    // Check for reset command
    const resetMatch = messageText.trim().match(/^[!/]reset\s+(.+)$/i);
    if (messageText.trim().match(/^[!/]reset$/i)) {
        await sendFeishuMessage(message.open_chat_id, 'Usage: /reset @agent_id [@agent_id2 ...]\nSpecify which agent(s) to reset.', message.message_id);
        return;
    }
    if (resetMatch) {
        log('INFO', 'Per-agent reset command received');
        const agentArgs = resetMatch[1].split(/\s+/).map(a => a.replace(/^@/, '').toLowerCase());
        try {
            const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(settingsData);
            const agents = settings.agents || {};
            const workspacePath = settings?.workspace?.path || path.join(require('os').homedir(), 'tinyclaw-workspace');
            const resetResults: string[] = [];
            for (const agentId of agentArgs) {
                if (!agents[agentId]) {
                    resetResults.push(`Agent '${agentId}' not found.`);
                    continue;
                }
                const flagDir = path.join(workspacePath, agentId);
                if (!fs.existsSync(flagDir)) fs.mkdirSync(flagDir, { recursive: true });
                fs.writeFileSync(path.join(flagDir, 'reset_flag'), 'reset');
                resetResults.push(`Reset @${agentId} (${agents[agentId].name}).`);
            }
            await sendFeishuMessage(message.open_chat_id, resetResults.join('\n'), message.message_id);
        } catch {
            await sendFeishuMessage(message.open_chat_id, 'Could not process reset command. Check settings.', message.message_id);
        }
        return;
    }

    // Write to queue via API
    await apiFetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            channel: 'feishu',
            sender: senderName,
            senderId: senderOpenId,
            message: messageText,
            messageId,
        }),
    });

    log('INFO', `Queued message ${messageId}`);

    // Store pending message for response
    pendingMessages.set(messageId, {
        openChatId: message.open_chat_id,
        openMessageId: message.message_id,  // Changed from open_message_id to message_id
        timestamp: Date.now(),
    });

    // Clean up old pending messages (older than 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    for (const [id, data] of pendingMessages.entries()) {
        if (data.timestamp < tenMinutesAgo) {
            pendingMessages.delete(id);
        }
    }
}

// Watch for responses via API
async function checkOutgoingQueue(): Promise<void> {
    if (processingOutgoingQueue) {
        return;
    }

    processingOutgoingQueue = true;

    try {
        const res = await apiFetch(`${API_BASE}/api/responses/pending?channel=feishu`);
        if (!res.ok) return;
        const responses = await res.json() as any[];

        for (const resp of responses) {
            try {
                const responseText = resp.message;
                const messageId = resp.messageId;
                const sender = resp.sender;
                const senderId = resp.senderId;

                // Find pending message, or fall back to senderId for proactive messages
                const pending = pendingMessages.get(messageId);

                if (pending) {
                    await sendFeishuMessage(pending.openChatId, responseText, pending.openMessageId);
                    log('INFO', `Sent response to ${sender} (${responseText.length} chars)`);
                    pendingMessages.delete(messageId);
                } else if (senderId) {
                    // For proactive messages, send directly using the user's open_id
                    // Feishu allows sending messages directly to a user via open_id
                    try {
                        const token = await getAccessToken();
                        const msgRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                receive_id: senderId,
                                msg_type: 'text',
                                content: JSON.stringify({ text: responseText }),
                            }),
                        });
                        const msgData = await msgRes.json() as any;
                        if (msgData.code === 0) {
                            log('INFO', `Sent proactive message to ${sender} (${responseText.length} chars)`);
                        } else {
                            log('WARN', `Failed to send proactive message: ${msgData.msg || 'Unknown error'}`);
                        }
                    } catch (err) {
                        log('WARN', `Could not send proactive message: ${(err as Error).message}`);
                    }
                }

                await apiFetch(`${API_BASE}/api/responses/${resp.id}/ack`, { method: 'POST' });
            } catch (error) {
                log('ERROR', `Error processing response ${resp.id}: ${(error as Error).message}`);
            }
        }
    } catch (error) {
        log('ERROR', `Outgoing queue error: ${(error as Error).message}`);
    } finally {
        processingOutgoingQueue = false;
    }
}

// Check outgoing queue every second
setInterval(checkOutgoingQueue, 1000);

// Create HTTP server for webhook
const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                // Verify signature
                const timestamp = req.headers['x-lark-request-timestamp'] as string || '';
                const nonce = req.headers['x-lark-request-nonce'] as string || '';
                const signature = req.headers['x-lark-signature'] as string || '';

                if (!verifySignature(timestamp, nonce, body, signature)) {
                    log('WARN', 'Invalid signature, rejecting request');
                    res.statusCode = 401;
                    res.end('Invalid signature');
                    return;
                }

                const payload = JSON.parse(body);

                // Handle URL verification challenge
                if (payload.type === 'url_verification') {
                    log('INFO', 'URL verification challenge received');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ challenge: payload.challenge }));
                    return;
                }

                // Handle event callback
                if (payload.header?.event_type === 'im.message.receive_v1') {
                    await handleEvent(payload as FeishuEvent);
                }

                res.statusCode = 200;
                res.end('OK');
            } catch (error) {
                log('ERROR', `Webhook error: ${(error as Error).message}`);
                res.statusCode = 500;
                res.end('Internal error');
            }
        });
    } else {
        res.statusCode = 404;
        res.end('Not found');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    log('INFO', 'Shutting down Feishu client...');
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('INFO', 'Shutting down Feishu client...');
    server.close();
    process.exit(0);
});

// Start server
const PORT = parseInt(process.env.FEISHU_WEBHOOK_PORT || '8080', 10);
server.listen(PORT, () => {
    log('INFO', `Feishu webhook server listening on port ${PORT}`);
    log('INFO', 'Configure your Feishu app to send events to: http://your-server:8080/webhook');
});
