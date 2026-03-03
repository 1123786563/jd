# TinyClaw - Architecture

**Part:** tinyclaw
**Type:** Full-Stack Web Application (Multi-Channel Assistant)
**Last Updated:** 2026-03-03

---

## Overview

**TinyClaw** is a multi-team, multi-channel 24/7 AI assistant platform supporting Discord, Telegram, WhatsApp, and Feishu (Lark). It features a Next.js control panel (TinyOffice) for team orchestration, agent management, and real-time monitoring.

The system implements team-based multi-agent collaboration with queue-based message processing, persistent conversation state, and unified multi-platform messaging.

---

## Architecture Pattern

**Queue-Based Multi-Agent Architecture** with Team Orchestration

The core architecture follows a message queue pattern where:
1. **Channels** receive messages from different platforms
2. **Queue Processor** routes and manages message flow
3. **Agents** process messages independently with persistent state
4. **Teams** coordinate multiple agents for complex tasks
5. **API Server** provides REST/SSE interface for frontend control
6. **TinyOffice** offers web-based management and monitoring

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TinyClaw Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    TinyOffice (Frontend)                       │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Next.js 16 + React 19 + Tailwind CSS 4 + Radix UI      │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  Pages: Agents, Teams, Tasks, Chat, Console, Logs       │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────────────┘  │
│                        │ (HTTP/WebSocket)                             │
│  ┌─────────────────────▼──────────────────────────────────────────┐  │
│  │                  Hono API Server                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  REST API Endpoints:                                     │  │  │
│  │  │  ├─ /api/agents          - Agent CRUD & status          │  │  │
│  │  │  ├─ /api/teams           - Team CRUD & orchestration    │  │  │
│  │  │  ├─ /api/messages        - Message history              │  │  │
│  │  │  ├─ /api/tasks           - Task tracking                │  │  │
│  │  │  ├─ /api/logs            - Activity logs                │  │  │
│  │  │  ├─ /api/settings        - Configuration                │  │  │
│  │  │  ├─ /api/queue/status    - Queue status                 │  │  │
│  │  │  └─ /api/events/stream   - SSE event stream             │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────────────┘  │
│                        │                                              │
│  ┌─────────────────────▼──────────────────────────────────────────┐  │
│  │               Queue Processor (Core Engine)                     │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Message Queue Management:                               │  │  │
│  │  │  ├─ Claim & Process Messages                             │  │  │
│  │  │  ├─ Route to Agents (@agent_id or default)              │  │  │
│  │  │  ├─ Handle Team Conversations (mentions)                │  │  │
│  │  │  ├─ Conversation Isolation (per-agent directories)      │  │  │
│  │  │  └─ Internal Message Passing (team coordination)        │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Multi-Channel Gateway                           │  │  │
│  │  ┌──────────────┬──────────────┬──────────────┬────────────┐  │  │
│  │  │  Discord.js  │  Telegram    │  WhatsApp    │  Feishu    │  │  │
│  │  │              │  Bot API     │  Web.js      │  SDK       │  │  │
│  │  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────┘  │  │
│           │               │               │               │        │
│  ┌────────▼────────────────────────────────────────────────┘       │
│  │                     Agent System                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Agent Manager:                                          │  │  │
│  │  │  ├─ Load & Configure Agents (providers, models, prompts)│  │  │
│  │  │  ├─ Invoke LLM (via invokeAgent)                        │  │  │
│  │  │  ├─ Manage Conversation State                           │  │  │
│  │  │  └─ Handle Long Responses & File Attachments            │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Team Orchestration                              │  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Team Manager:                                           │  │  │
│  │  │  ├─ Parse @teammate Mentions                           │  │  │
│  │  │  ├─ Create Internal Messages for Teammates             │  │  │
│  │  │  ├─ Track Pending Teammates                            │  │  │
│  │  │  ├─ Complete Conversations (all mentions resolved)     │  │  │
│  │  │  └─ Leader Agent Coordination                          │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Persistence Layer                               │  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  SQLite Database (better-sqlite3)                        │  │  │
│  │  │  ├─ Queue Messages (pending, processing, completed)     │  │  │
│  │  │  ├─ Agent State & Configuration                         │  │  │
│  │  │  ├─ Team Definitions (agents, leader, rules)           │  │  │
│  │  │  ├─ Conversation History                                │  │  │
│  │  │  ├─ Tasks & Logs                                        │  │  │
│  │  │  └─ Settings (workspace, providers, defaults)          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              External Integrations                            │  │  │
│  │  ├─ Discord API                                              │  │  │
│  │  ├─ Telegram Bot API                                         │  │  │
│  │  ├─ WhatsApp Web                                             │  │  │
│  │  ├─ Feishu (Lark) API                                        │  │  │
│  │  ├─ LLM Providers (Claude, OpenAI, etc.)                     │  │  │
│  │  └─ File System (workspace, chats, files)                    │  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Queue Processor (`src/queue-processor.ts`)

**Purpose:** The central message processing engine that routes and orchestrates all message flow

**Key Responsibilities:**
- Pull messages from database queue
- Route to appropriate agent (via `@agent_id` prefix or default)
- Handle team conversations with teammate mentions (`[@teammate: message]`)
- Manage conversation state and isolation
- Process internal messages for team coordination
- Track pending teammates and complete conversations
- Invoke agents with appropriate context and settings

**Key Features:**
- **Message Queue:** SQLite-backed persistent queue with states (pending, processing, completed)
- **Agent Routing:** Smart routing based on message prefix or channel configuration
- **Team Coordination:** Parse mentions and create internal messages for teammates
- **Conversation Isolation:** Per-agent working directories for conversation state
- **Internal Messaging:** Agents can message each other via queue system
- **Stale Message Recovery:** Auto-recovery of stuck messages

**Entry Point:** Main executable (`node dist/queue-processor.js`)

**Related Files:**
- `src/lib/db.ts` - Queue database operations
- `src/lib/routing.ts` - Agent and team routing logic
- `src/lib/conversation.ts` - Conversation state management
- `src/lib/invoke.ts` - Agent invocation and LLM calling
- `src/lib/response.ts` - Response handling and file collection

---

### 2. API Server (`src/server/index.ts`)

**Purpose:** REST + SSE API for frontend (TinyOffice) and external integrations

**Key Responsibilities:**
- Provide HTTP endpoints for all CRUD operations
- Stream real-time events via Server-Sent Events (SSE)
- Enable frontend control of agents, teams, and settings
- Expose queue status and system health
- Handle CORS and authentication

**API Endpoints:**

#### Agents (`src/server/routes/agents.ts`)
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents` - Create agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

#### Teams (`src/server/routes/teams.ts`)
- `GET /api/teams` - List all teams
- `GET /api/teams/:id` - Get team details
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

#### Messages (`src/server/routes/messages.ts`)
- `GET /api/messages` - Message history
- `POST /api/messages` - Send message to agent/team

#### Queue (`src/server/routes/queue.ts`)
- `GET /api/queue/status` - Queue statistics (pending, processing, completed)

#### Tasks (`src/server/routes/tasks.ts`)
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- Task status and progress tracking

#### Logs (`src/server/routes/logs.ts`)
- `GET /api/logs` - System activity logs
- Filtering and pagination

#### Settings (`src/server/routes/settings.ts`)
- `GET /api/settings` - Get configuration
- `PUT /api/settings` - Update configuration

#### Chats (`src/server/routes/chats.ts`)
- `GET /api/chats/:agentId` - Conversation history for agent
- `DELETE /api/chats/:agentId` - Clear conversation

#### SSE Events (`src/server/sse.ts`)
- `GET /api/events/stream` - Real-time event stream
- Events: `message_received`, `agent_routed`, `task_updated`, etc.

**Related Files:**
- `src/server/sse.ts` - SSE client management
- All route files in `src/server/routes/`

---

### 3. Multi-Channel Gateway (`src/channels/`)

**Purpose:** Connect to and manage multiple messaging platforms

#### Discord Client (`src/channels/discord-client.ts`)
- Discord.js integration
- Message reception and sending
- User and channel management
- File attachment support

#### Telegram Client (`src/channels/telegram-client.ts`)
- Node Telegram Bot API integration
- Message handling (text, files, commands)
- Chat ID management
- Bot command support

#### WhatsApp Client (`src/channels/whatsapp-client.ts`)
- WhatsApp Web.js integration
- QR code authentication
- Message processing
- Group chat support

#### Feishu Client (`src/channels/feishu-client.ts`)
- Feishu (Lark) SDK integration
- Enterprise messaging
- Bot authentication
- Rich message support

**Key Features:**
- Unified message format across all channels
- Automatic queue enqueueing for received messages
- Error handling and retry logic
- Platform-specific features (reactions, attachments, etc.)

**Execution:** Each channel runs as separate process:
- `npm run discord`
- `npm run telegram`
- `npm run whatsapp`
- `npm run feishu`

---

### 4. Agent System (`src/lib/agent.ts`, `src/lib/invoke.ts`)

**Purpose:** AI agent execution and LLM integration

**Key Components:**

#### Agent Configuration (`src/lib/config.ts`)
- **Provider:** Claude, OpenAI, or other LLM providers
- **Model:** Specific model (e.g., claude-3-opus, gpt-4)
- **System Prompt:** Custom instructions for agent behavior
- **Working Directory:** Isolated conversation state
- **Tools/Skills:** Available capabilities

#### Agent Invocation (`src/lib/invoke.ts`)
- Load agent configuration and context
- Build conversation history
- Call LLM provider API
- Handle streaming responses
- Parse and execute tool calls
- Save conversation state

#### Response Handling (`src/lib/response.ts`)
- Handle long responses (chunking)
- Process file attachments
- Format output for channels
- Collect generated files

**Features:**
- Multi-provider support (Claude, OpenAI, etc.)
- Conversation history persistence
- System prompt customization
- File attachment handling
- Streaming response support

---

### 5. Team Orchestration (`src/lib/routing.ts`, `src/lib/conversation.ts`)

**Purpose:** Coordinate multiple agents working together

**Key Concepts:**

#### Team Structure
```typescript
{
  teamId: "team-1",
  name: "Support Team",
  leader_agent: "agent-support-lead",
  agents: ["agent-support-lead", "agent-technical", "agent-billing"],
  description: "Customer support team"
}
```

#### Team Conversations
1. **Initial Message:** User sends `[@team-support: How do I reset my password?]`
2. **Routing:** Message routed to team leader agent
3. **Mention Parsing:** Leader mentions teammate: `[@agent-technical: Can you help with the password reset steps?]`
4. **Internal Message:** System creates internal message for technical agent
5. **Response:** Technical agent responds to leader
6. **Coordination:** Leader aggregates responses and replies to user
7. **Completion:** Conversation completes when all mentions resolved

**Key Functions:**
- `parseAgentRouting()` - Parse `@agent` or `@team` prefixes
- `findTeamForAgent()` - Find team context for agent
- `extractTeammateMentions()` - Extract `[@teammate: ...]` mentions
- `enqueueInternalMessage()` - Create internal message for teammate
- `completeConversation()` - Mark conversation as complete

**State Management:**
- **Pending Teammates:** Track which teammates still need to respond
- **Conversation Locks:** Prevent race conditions
- **Team Context:** Preserve team context across messages

---

### 6. Persistence Layer (`src/lib/db.ts`)

**Purpose:** SQLite database for all persistent data

**Database Schema:**

#### Queue Messages Table
```sql
CREATE TABLE queue_messages (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,           -- discord, telegram, whatsapp, feishu
  sender TEXT NOT NULL,            -- User identifier
  sender_id TEXT,                  -- Platform-specific user ID
  message TEXT NOT NULL,           -- Message content
  message_id TEXT UNIQUE,          -- Platform message ID
  agent TEXT,                      -- Target agent ID (if pre-routed)
  conversation_id TEXT,            -- Conversation grouping
  from_agent TEXT,                 -- Internal: sender agent
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, failed
  files TEXT,                      -- JSON array of file paths
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

#### Agent State Table
```sql
CREATE TABLE agent_state (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT,
  working_dir TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Team Definitions Table
```sql
CREATE TABLE teams (
  team_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_agent TEXT NOT NULL,
  agents JSON NOT NULL,      -- JSON array of agent IDs
  description TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Tasks Table
```sql
CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed
  assigned_to TEXT,               -- Agent or team ID
  due_date INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Logs Table
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,       -- INFO, WARN, ERROR
  message TEXT NOT NULL,
  context JSON,              -- Additional context
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Key Functions:**
- `initQueueDb()` - Initialize database and tables
- `claimNextMessage()` - Get next pending message (with locking)
- `completeMessage()` - Mark message as completed
- `failMessage()` - Mark message as failed (with retry)
- `enqueueResponse()` - Queue response to send back to channel
- `getPendingAgents()` - Get agents with pending messages
- `recoverStaleMessages()` - Recover stuck processing messages
- `pruneAckedResponses()` - Clean up old responses
- `pruneCompletedMessages()` - Archive completed messages

**Features:**
- ACID-compliant transactions
- Row-level locking for concurrent processing
- Automatic cleanup of old data
- Queue recovery and retry logic

---

### 7. Configuration System (`src/lib/config.ts`)

**Purpose:** Manage agents, teams, settings, and workspace configuration

**Configuration Files:**

#### Settings (`tinyclaw.settings.json`)
```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"
  },
  "llm": {
    "default_provider": "claude",
    "default_model": "claude-3-opus"
  },
  "channels": {
    "discord": { "enabled": true, "token": "..." },
    "telegram": { "enabled": true, "token": "..." },
    "whatsapp": { "enabled": true },
    "feishu": { "enabled": false }
  }
}
```

#### Agents (`tinyclaw.agents.json`)
```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful assistant...",
    "working_dir": "agents/default"
  },
  "agent-technical": {
    "name": "Technical Support",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a technical support expert...",
    "working_dir": "agents/technical"
  }
}
```

#### Teams (`tinyclaw.teams.json`)
```json
{
  "team-support": {
    "name": "Support Team",
    "leader_agent": "agent-support-lead",
    "agents": ["agent-support-lead", "agent-technical", "agent-billing"],
    "description": "Customer support team"
  }
}
```

**Key Functions:**
- `getSettings()` - Load settings from file
- `getAgents(settings)` - Load and merge agent configs
- `getTeams(settings)` - Load team definitions
- `saveSettings(settings)` - Persist settings
- `saveAgents(agents)` - Persist agent configs
- `saveTeams(teams)` - Persist team definitions

**Features:**
- Hot-reloading (configs reloaded on each message)
- Default agent fallback
- Workspace directory management
- Config validation

---

### 8. Logging & Events (`src/lib/logging.ts`)

**Purpose:** System-wide logging and event emission

**Log Levels:**
- `INFO` - Normal operations
- `WARN` - Warnings and recoverable errors
- `ERROR` - Critical errors

**Event Types:**
- `message_received` - Message received from channel
- `agent_routed` - Message routed to agent
- `task_updated` - Task status changed
- `agent_responded` - Agent generated response
- `conversation_completed` - Team conversation finished

**Features:**
- File-based logging (`logs/tinyclaw.log`)
- Console output with colors
- SSE event streaming to frontend
- Structured log format (JSON)

---

### 9. Plugins System (`src/lib/plugins.ts`)

**Purpose:** Extensible hook system for custom behavior

**Hook Types:**

#### Incoming Hooks
- `onMessageReceived(message)` - Before agent processing
- `onAgentRouted(message, agent)` - After routing
- Modify or reject messages

#### Outgoing Hooks
- `onAgentResponse(response)` - Before sending response
- `onResponseSent(response)` - After sending
- Modify or log responses

**Plugin Loading:**
- Plugins loaded from `plugins/` directory
- Automatic discovery and registration
- Hook chaining with priority

---

### 10. TinyOffice Frontend (`tinyclaw/tinyoffice/`)

**Purpose:** Next.js web control panel for management and monitoring

**Technology Stack:**
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **Components:** Radix UI
- **State:** React hooks + API polling

**Pages:**

#### Dashboard (`app/page.tsx`)
- System overview
- Queue status
- Active agents
- Recent activity

#### Agents (`app/agents/page.tsx`)
- Agent list and details
- Create/edit/delete agents
- Agent status and stats
- Conversation history

#### Teams (`app/teams/page.tsx`)
- Team list and details
- Create/edit/delete teams
- Team member management
- Team conversation history

#### Tasks (`app/tasks/page.tsx`)
- Task list and tracking
- Create/assign tasks
- Task status and progress
- Due date management

#### Chat (`app/chat/agent/[id]/page.tsx`, `app/chat/team/[id]/page.tsx`)
- Real-time chat interface
- Conversation history
- Send messages to agents/teams
- File attachment support

#### Console (`app/console/page.tsx`)
- System console
- Log viewer
- Command execution
- Debug tools

#### Logs (`app/logs/page.tsx`)
- Activity log viewer
- Filter by level, agent, date
- Search and export

#### Settings (`app/settings/page.tsx`)
- Configuration editor
- Provider settings
- Channel configuration
- Workspace settings

**API Integration:**
- REST API calls to backend
- SSE event stream for real-time updates
- WebSocket-like experience via SSE

---

## Data Flow

### Message Processing Flow

```
1. Channel Receives Message
   ├─ Discord: discord-client.ts receives message
   ├─ Telegram: telegram-client.ts receives message
   ├─ WhatsApp: whatsapp-client.ts receives message
   └─ Feishu: feishu-client.ts receives message

2. Enqueue to Database
   └─ INSERT INTO queue_messages (channel, sender, message, status='pending')

3. Queue Processor Claims Message
   └─ claimNextMessage() with row lock

4. Parse Routing
   ├─ Check for @agent_id prefix
   ├─ Check for @team_name prefix
   └─ Default to 'default' agent

5. Load Agent Configuration
   ├─ getAgents() - Load agent configs
   ├─ getAgentContext() - Load conversation history
   └─ Build system prompt and messages array

6. Invoke Agent (LLM Call)
   ├─ invokeAgent() - Call LLM provider
   ├─ Handle streaming response
   └─ Parse tool calls (if any)

7. Handle Response
   ├─ handleLongResponse() - Chunk long responses
   ├─ collectFiles() - Process file attachments
   └─ Format for channel

8. Check for Team Mentions
   ├─ extractTeammateMentions() - Parse [@teammate: ...]
   ├─ For each mention:
   │   └─ enqueueInternalMessage() - Create internal message
   └─ Track pending teammates

9. Send Response to Channel
   ├─ enqueueResponse() - Queue response in DB
   └─ Channel client sends response

10. Complete Message
    ├─ completeMessage() - Mark as completed
    ├─ Update conversation state
    └─ Emit events (SSE to frontend)

11. Team Coordination (if applicable)
    ├─ Wait for all internal messages to complete
    ├─ Track pending teammates (decrementPending())
    └─ completeConversation() when all done
```

---

## Key Design Patterns

### 1. Queue-Based Processing
Persistent message queue with SQLite for reliability and recovery.

### 2. Multi-Agent Isolation
Per-agent working directories and conversation state.

### 3. Team Orchestration via Mentions
Natural language mentions (`[@teammate: ...]`) drive team coordination.

### 4. Unified Channel Abstraction
All channels normalized to common message format.

### 5. Hot-Reloadable Configuration
Configs reloaded on each message for dynamic updates.

### 6. Event-Driven Frontend
SSE streaming for real-time UI updates.

### 7. Plugin/Hook System
Extensible via incoming/outgoing hooks.

---

## External Dependencies

| Dependency | Purpose | Critical? |
|------------|---------|-----------|
| hono | Web framework for API server | ✅ Yes |
| better-sqlite3 | Embedded database | ✅ Yes |
| discord.js | Discord integration | ✅ Yes |
| node-telegram-bot-api | Telegram integration | ✅ Yes |
| whatsapp-web.js | WhatsApp integration | ✅ Yes |
| dotenv | Environment variables | ✅ Yes |
| ink | CLI rendering (visualizer) | ⚠️ Optional |
| react | Frontend UI library | ✅ Yes |
| next | Frontend framework | ✅ Yes |

---

## Security Considerations

1. **Channel Authentication:** Each channel has separate auth tokens
2. **Agent Isolation:** Agents cannot access each other's state
3. **Input Validation:** Message sanitization and validation
4. **Rate Limiting:** Per-channel and per-agent rate limits
5. **Audit Logging:** All messages and actions logged
6. **Configuration Security:** Sensitive data in environment variables

---

## Testing Strategy

**Test Files:** Scattered throughout `src/` and `tinyclaw/tinyoffice/`

**Coverage:** Unit tests for core logic, integration tests for channels

---

## Development Workflow

### Backend

```bash
cd tinyclaw
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run discord      # Start Discord client
npm run telegram     # Start Telegram client
npm run whatsapp     # Start WhatsApp client
npm run feishu       # Start Feishu client
npm run queue        # Start queue processor
```

### Frontend (TinyOffice)

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production start
```

### Full Stack

```bash
# Terminal 1: Queue Processor
cd tinyclaw && npm run queue

# Terminal 2: API Server (auto-started by queue processor)

# Terminal 3: Discord Client
cd tinyclaw && npm run discord

# Terminal 4: Telegram Client
cd tinyclaw && npm run telegram

# Terminal 5: Frontend
cd tinyclaw/tinyoffice && npm run dev
```

---

## Deployment Considerations

- **Runtime:** Node.js >= 20.0.0
- **Database:** SQLite file (embedded, no external DB needed)
- **Storage:** File system for workspace, chats, files
- **Networking:** Discord/Telegram/WhatsApp/Feishu APIs, LLM providers
- **Frontend:** Next.js can be deployed to Vercel, Netlify, or self-hosted
- **Scaling:** Queue processor can be scaled horizontally with proper locking

---

## Future Enhancements

1. **WebSocket Support:** Real-time bidirectional communication
2. **Agent Plugins:** Third-party agent extensions
3. **Advanced Analytics:** Dashboard with metrics and insights
4. **Multi-Language:** Internationalization support
5. **Mobile App:** React Native mobile interface
6. **Voice Support:** Speech-to-text and text-to-speech
7. **Knowledge Base:** Vector database for long-term memory
8. **Agent Marketplace:** Share and discover agents

---

_This architecture document was generated by the BMAD `document-project` workflow_
