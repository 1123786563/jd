/**
 * API Server — HTTP endpoints for Mission Control and external integrations.
 *
 * Runs on a configurable port (env TINYCLAW_API_PORT, default 3777) and
 * provides REST + SSE access to agents, teams, settings, queue status,
 * events, logs, and chat histories.
 */

import http from 'http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import { Conversation } from '../lib/types';
import { log } from '../lib/logging';
import { addSSEClient, removeSSEClient } from './sse';

import messagesRoutes from './routes/messages';
import agentsRoutes from './routes/agents';
import teamsRoutes from './routes/teams';
import settingsRoutes from './routes/settings';
import { createQueueRoutes } from './routes/queue';
import tasksRoutes from './routes/tasks';
import logsRoutes from './routes/logs';
import chatsRoutes from './routes/chats';
import { a2aApp } from '../a2a/server';

const API_PORT = parseInt(process.env.TINYCLAW_API_PORT || '3777', 10);
const ALLOWED_API_KEYS = (
    process.env.TINYCLAW_API_KEYS || process.env.TINYCLAW_API_KEY || ''
)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
const ALLOW_UNAUTH = process.env.TINYCLAW_API_ALLOW_UNAUTH === 'true';
const CORS_ORIGINS = process.env.TINYCLAW_CORS_ORIGINS
    ? process.env.TINYCLAW_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

function isLoopbackAddress(addr: string | undefined): boolean {
    if (!addr) return false;
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function hasValidApiKey(c: any): boolean {
    const authHeader = c.req.header('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const queryKey = c.req.query('api_key') || '';
    const key = bearer || queryKey;
    return !!key && ALLOWED_API_KEYS.includes(key);
}

/**
 * Create and start the API server.
 *
 * @param conversations  Live reference to the queue-processor conversation map
 *                       so the /api/queue/status endpoint can report active count.
 * @returns The http.Server instance (for graceful shutdown).
 */
export function startApiServer(
    conversations: Map<string, Conversation>
): http.Server {
    const app = new Hono();

    // CORS middleware
    app.use('/*', cors({
        origin: CORS_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }));

    // API auth middleware:
    // - loopback requests are trusted (local channels/processor)
    // - remote requests require api key unless explicitly disabled
    app.use('/api/*', async (c, next) => {
        if (ALLOW_UNAUTH) {
            await next();
            return;
        }

        const incoming = (c.env as { incoming?: http.IncomingMessage }).incoming;
        const remoteAddr = incoming?.socket?.remoteAddress;
        const isLoopback = isLoopbackAddress(remoteAddr);

        if (isLoopback) {
            await next();
            return;
        }

        if (ALLOWED_API_KEYS.length === 0) {
            return c.json({ error: 'Unauthorized: API key required for non-local requests' }, 401);
        }

        if (!hasValidApiKey(c)) {
            return c.json({ error: 'Unauthorized: invalid API key' }, 401);
        }

        await next();
    });

    // Mount route modules
    app.route('/', messagesRoutes);
    app.route('/', agentsRoutes);
    app.route('/', teamsRoutes);
    app.route('/', settingsRoutes);
    app.route('/', createQueueRoutes(conversations));
    app.route('/', tasksRoutes);
    app.route('/', logsRoutes);
    app.route('/', chatsRoutes);

    // A2A 协议路由（Agent-to-Agent Protocol）
    app.route('/', a2aApp);

    // SSE endpoint — needs raw Node.js response for streaming
    app.get('/api/events/stream', (c) => {
        const nodeRes = (c.env as { outgoing: http.ServerResponse }).outgoing;
        const origin = c.req.header('Origin');
        const allowOrigin = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0] || 'http://localhost:3000';
        nodeRes.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': allowOrigin,
            'Vary': 'Origin',
        });
        nodeRes.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
        addSSEClient(nodeRes);
        nodeRes.on('close', () => removeSSEClient(nodeRes));
        return RESPONSE_ALREADY_SENT;
    });

    // 404 fallback
    app.notFound((c) => {
        return c.json({ error: 'Not found' }, 404);
    });

    // Error handler
    app.onError((err, c) => {
        log('ERROR', `[API] ${err.message}`);
        return c.json({ error: 'Internal server error' }, 500);
    });

    const server = serve({
        fetch: app.fetch,
        port: API_PORT,
    }, () => {
        log('INFO', `API server listening on http://localhost:${API_PORT}`);
    });

    return server as unknown as http.Server;
}
