# TinyClaw - Component Inventory

**Part:** tinyclaw
**Last Updated:** 2026-03-03

---

## Overview

This document catalogs all major components in TinyClaw, including channel clients, API routes, agent system, team orchestration, and database schema.

---

## Channel Client Components

### 1. Discord Client
**File:** `src/channels/discord-client.ts`
**Purpose:** Discord bot integration
**Key Functions:**
- Message reception and sending
- User and channel management
- File attachment support
- Rich embed formatting
**Dependencies:** discord.js
**Execution:** `npm run discord`

### 2. Telegram Client
**File:** `src/channels/telegram-client.ts`
**Purpose:** Telegram bot integration
**Key Functions:**
- Message handling (text, files, commands)
- Chat ID management
- Bot command support (/start, /help)
- Photo/document sending
**Dependencies:** node-telegram-bot-api
**Execution:** `npm run telegram`

### 3. WhatsApp Client
**File:** `src/channels/whatsapp-client.ts`
**Purpose:** WhatsApp Web integration
**Key Functions:**
- QR code authentication
- Message processing
- Group chat support
- Media file handling
**Dependencies:** whatsapp-web.js
**Execution:** `npm run whatsapp`

### 4. Feishu Client
**File:** `src/channels/feishu-client.ts`
**Purpose:** Feishu (Lark) enterprise messaging
**Key Functions:**
- Enterprise bot authentication
- Rich message cards
- File and image support
- Group chat management
**Dependencies:** Feishu SDK
**Execution:** `npm run feishu`

---

## Core Engine Components

### 5. Queue Processor
**File:** `src/queue-processor.ts`
**Purpose:** Central message processing engine
**Key Functions:**
- Pull messages from database queue
- Route to agents (via `@agent_id` or default)
- Handle team conversations with mentions
- Manage conversation isolation
- Track pending teammates
- Complete conversations
**Dependencies:** db.ts, routing.ts, conversation.ts, invoke.ts
**Execution:** `npm run queue`

### 6. API Server
**File:** `src/server/index.ts`
**Purpose:** REST + SSE API for frontend
**Key Functions:**
- Serve HTTP endpoints
- Stream events via SSE
- Handle CORS
- Error handling and logging
**Dependencies:** hono, all route files
**Port:** 3777 (configurable via TINYCLAW_API_PORT)
**Routes:**
- `/api/agents` - Agent CRUD
- `/api/teams` - Team CRUD
- `/api/messages` - Message history
- `/api/tasks` - Task tracking
- `/api/logs` - Activity logs
- `/api/settings` - Configuration
- `/api/queue/status` - Queue statistics
- `/api/events/stream` - SSE event stream

---

## API Route Components

### 7. Agents Routes
**File:** `src/server/routes/agents.ts`
**Endpoints:**
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents` - Create agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

### 8. Teams Routes
**File:** `src/server/routes/teams.ts`
**Endpoints:**
- `GET /api/teams` - List all teams
- `GET /api/teams/:id` - Get team details
- `POST /api/teams` - Create team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### 9. Messages Routes
**File:** `src/server/routes/messages.ts`
**Endpoints:**
- `GET /api/messages` - Message history
- `POST /api/messages` - Send message to agent/team

### 10. Queue Routes
**File:** `src/server/routes/queue.ts`
**Endpoints:**
- `GET /api/queue/status` - Queue statistics
  - pending_count
  - processing_count
  - completed_count
  - failed_count

### 11. Tasks Routes
**File:** `src/server/routes/tasks.ts`
**Endpoints:**
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- Task status tracking

### 12. Logs Routes
**File:** `src/server/routes/logs.ts`
**Endpoints:**
- `GET /api/logs` - System logs
- Filtering and pagination

### 13. Settings Routes
**File:** `src/server/routes/settings.ts`
**Endpoints:**
- `GET /api/settings` - Get configuration
- `PUT /api/settings` - Update configuration

### 14. Chats Routes
**File:** `src/server/routes/chats.ts`
**Endpoints:**
- `GET /api/chats/:agentId` - Conversation history
- `DELETE /api/chats/:agentId` - Clear conversation

### 15. SSE Manager
**File:** `src/server/sse.ts`
**Purpose:** Server-Sent Events client management
**Key Functions:**
- `addSSEClient(client)` - Add SSE client
- `removeSSEClient(client)` - Remove SSE client
- `broadcastEvent(event)` - Broadcast to all clients
**Events:**
- `message_received` - Message received from channel
- `agent_routed` - Message routed to agent
- `task_updated` - Task status changed
- `agent_responded` - Agent generated response
- `conversation_completed` - Team conversation finished

---

## Agent System Components

### 16. Agent Manager
**File:** `src/lib/agent.ts`
**Purpose:** Agent configuration and lifecycle
**Key Functions:**
- Load agent configs from file
- Validate agent configuration
- Get agent by ID
- List all agents

### 17. Agent Invoker
**File:** `src/lib/invoke.ts`
**Purpose:** Invoke LLM and process responses
**Key Functions:**
- `invokeAgent(agent, message, context)` - Call LLM
- Build conversation history
- Handle streaming responses
- Parse and execute tool calls
- Save conversation state
**Dependencies:** config.ts, conversation.ts

### 18. Response Handler
**File:** `src/lib/response.ts`
**Purpose:** Handle agent responses and file attachments
**Key Functions:**
- `handleLongResponse(response)` - Chunk long responses
- `collectFiles(response)` - Process file attachments
- Format output for channels
**Dependencies:** None

---

## Team Orchestration Components

### 19. Routing Parser
**File:** `src/lib/routing.ts`
**Purpose:** Parse agent and team routing
**Key Functions:**
- `parseAgentRouting(message, agents, teams)` - Parse `@agent` or `@team`
- `findTeamForAgent(agentId, teams)` - Find team for agent
- `extractTeammateMentions(message)` - Extract `[@teammate: ...]`
**Returns:** { agentId, message, isTeam }

### 20. Conversation Manager
**File:** `src/lib/conversation.ts`
**Purpose:** Manage conversation state and isolation
**Key Functions:**
- `withConversationLock(id, fn)` - Lock conversation
- `enqueueInternalMessage()` - Create internal message
- `completeConversation()` - Mark conversation complete
- `incrementPending()` - Track pending teammates
- `decrementPending()` - Decrement pending count
**State:** conversations Map with team context

---

## Persistence Components

### 21. Database Manager
**File:** `src/lib/db.ts`
**Purpose:** SQLite database operations
**Key Functions:**

#### Queue Operations
- `initQueueDb()` - Initialize database and tables
- `claimNextMessage()` - Get next pending message (with lock)
- `completeMessage(id)` - Mark message as completed
- `failMessage(id, error)` - Mark message as failed
- `enqueueResponse(response)` - Queue response to send
- `recoverStaleMessages()` - Recover stuck messages

#### Query Operations
- `getPendingAgents()` - Get agents with pending messages
- `pruneAckedResponses()` - Clean up old responses
- `pruneCompletedMessages()` - Archive completed messages

**Tables:**
- `queue_messages` - Message queue with status
- `agent_state` - Agent configuration and state
- `teams` - Team definitions
- `tasks` - Task tracking
- `logs` - Activity logs

**Events:**
- `queueEvents.on('messageClaimed')` - Message claimed
- `queueEvents.on('messageCompleted')` - Message completed

---

## Configuration Components

### 22. Config Loader
**File:** `src/lib/config.ts`
**Purpose:** Load and manage configuration
**Key Functions:**
- `getSettings()` - Load settings from file
- `getAgents(settings)` - Load and merge agent configs
- `getTeams(settings)` - Load team definitions
- `saveSettings(settings)` - Persist settings
- `saveAgents(agents)` - Persist agent configs
- `saveTeams(teams)` - Persist team definitions

**Config Files:**
- `tinyclaw.settings.json` - Main settings
- `tinyclaw.agents.json` - Agent configurations
- `tinyclaw.teams.json` - Team definitions

**Features:**
- Hot-reloading (configs reloaded per message)
- Default agent fallback
- Workspace directory management

---

## Logging Components

### 23. Logger
**File:** `src/lib/logging.ts`
**Purpose:** System-wide logging and events
**Key Functions:**
- `log(level, message)` - Log message
- `emitEvent(event, data)` - Emit event (SSE)
**Log Levels:**
- `INFO` - Normal operations
- `WARN` - Warnings
- `ERROR` - Errors

**Log File:** `logs/tinyclaw.log`

---

## Plugin System Components

### 24. Plugin Loader
**File:** `src/lib/plugins.ts`
**Purpose:** Extensible hook system
**Key Functions:**
- `loadPlugins()` - Load plugins from directory
- `runIncomingHooks(message)` - Run incoming hooks
- `runOutgoingHooks(response)` - Run outgoing hooks

**Hook Types:**

#### Incoming Hooks
- `onMessageReceived(message)` - Before agent processing
- Can modify or reject messages

#### Outgoing Hooks
- `onAgentResponse(response)` - Before sending response
- Can modify or log responses

**Plugin Interface:**
```typescript
{
  name: string;
  onMessageReceived?: (msg) => Promise<MessageData | null>;
  onAgentResponse?: (res) => Promise<ResponseData>;
}
```

---

## Type Definitions

### 25. Type System
**File:** `src/lib/types.ts`
**Purpose:** TypeScript type definitions

**Key Types:**

#### MessageData
```typescript
{
  channel: string;        // discord, telegram, whatsapp, feishu
  sender: string;         // User identifier
  senderId?: string;      // Platform-specific user ID
  message: string;        // Message content
  timestamp: number;      // Unix timestamp
  messageId: string;      // Platform message ID
  agent?: string;         // Target agent ID
  files?: string[];       // File paths
  conversationId?: string; // Conversation grouping
  fromAgent?: string;     // Internal: sender agent
}
```

#### Conversation
```typescript
{
  id: string;             // Conversation ID
  messages: Message[];    // Message history
  agentId: string;        // Current agent
  teamContext?: {         // Team context (if applicable)
    teamId: string;
    team: TeamConfig;
  };
  pendingTeammates: number; // Pending teammate count
  createdAt: number;
  updatedAt: number;
}
```

#### TeamConfig
```typescript
{
  name: string;           // Team name
  leader_agent: string;   // Leader agent ID
  agents: string[];       // Agent ID array
  description?: string;   // Team description
  config?: any;           // Additional config
}
```

---

## TinyOffice Frontend Components

### 26. Next.js App Pages
**Location:** `tinyclaw/tinyoffice/app/`

#### Dashboard (`page.tsx`)
- System overview
- Queue status charts
- Active agents list
- Recent activity feed

#### Agents Page (`agents/page.tsx`)
- Agent list table
- Create/edit/delete forms
- Agent status indicators
- Conversation history viewer

#### Teams Page (`teams/page.tsx`)
- Team list table
- Team member management
- Create/edit/delete forms
- Team conversation history

#### Tasks Page (`tasks/page.tsx`)
- Task list with filters
- Create/assign tasks
- Status tracking (pending, in_progress, completed)
- Due date management

#### Chat Pages
- `chat/agent/[id]/page.tsx` - Agent chat interface
- `chat/team/[id]/page.tsx` - Team chat interface
- Real-time message display
- Send message form
- File attachment support

#### Console Page (`console/page.tsx`)
- System console
- Log viewer with filters
- Command execution
- Debug tools

#### Logs Page (`logs/page.tsx`)
- Activity log viewer
- Filter by level, agent, date range
- Search functionality
- Export to CSV/JSON

#### Settings Page (`settings/page.tsx`)
- Configuration editor
- Provider settings form
- Channel configuration
- Workspace settings

### 27. Frontend Libraries
**Location:** `tinyclaw/tinyoffice/src/lib/`

Shared code between frontend and backend:
- API client utilities
- Type definitions
- Helper functions
- Validation utilities

---

## Visualizer Components

### 28. Team Visualizer
**Location:** `src/visualizer/`
**Purpose:** Visual representation of team conversations
**Features:**
- Graph visualization of team interactions
- Conversation flow diagrams
- Agent mention tracking
- Real-time updates

**Execution:** `npm run visualize`

---

## Key Patterns

### Queue-Based Processing Pattern
Channel → Queue (pending) → Processor → Agent → Response → Channel

### Team Orchestration via Mentions Pattern
Natural language mentions (`[@teammate: ...]`) drive coordination

### Hot-Reloadable Configuration Pattern
Configs reloaded on each message for dynamic updates

### Unified Channel Abstraction Pattern
All channels normalized to common message format

### Event-Driven Frontend Pattern
SSE streaming for real-time UI updates

---

## External Integrations

| Integration | Package | Purpose |
|------------|---------|---------|
| Discord | discord.js | Discord bot API |
| Telegram | node-telegram-bot-api | Telegram bot API |
| WhatsApp | whatsapp-web.js | WhatsApp Web API |
| Feishu | Feishu SDK | Feishu enterprise API |
| LLM Providers | openai, anthropic | Language model APIs |
| Database | better-sqlite3 | Embedded database |
| Web Framework | hono | API server framework |
| Frontend | next, react | Web UI framework |

---

_This component inventory was generated by the BMAD `document-project` workflow_
