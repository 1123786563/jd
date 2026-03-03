# TinyClaw - Development Guide

**Part:** tinyclaw
**Last Updated:** 2026-03-03

---

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** package manager
- **Git** for version control
- **Channel API Keys:**
  - Discord Bot Token (optional)
  - Telegram Bot Token (optional)
  - WhatsApp Web credentials (optional)
  - Feishu Bot credentials (optional)

---

## Getting Started

### 1. Clone and Install

```bash
cd tinyclaw
npm install
```

### 2. Configure Settings

Edit `tinyclaw.settings.json`:

```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"
  },
  "llm": {
    "default_provider": "claude",
    "default_model": "claude-3-opus",
    "providers": {
      "claude": {
        "api_key": "sk-ant-..."
      },
      "openai": {
        "api_key": "sk-..."
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN"
    },
    "telegram": {
      "enabled": true,
      "token": "YOUR_TELEGRAM_BOT_TOKEN"
    },
    "whatsapp": {
      "enabled": false
    },
    "feishu": {
      "enabled": false
    }
  }
}
```

### 3. Configure Agents

Edit `tinyclaw.agents.json`:

```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful AI assistant...",
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

### 4. Configure Teams (Optional)

Edit `tinyclaw.teams.json`:

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

### 5. Build and Run

```bash
npm run build              # Compile TypeScript
npm run queue              # Start queue processor
npm run discord            # Start Discord client
npm run telegram           # Start Telegram client
npm run whatsapp           # Start WhatsApp client
npm run feishu             # Start Feishu client
```

### 6. Start Frontend

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev                # http://localhost:3000
```

---

## Project Structure

```
tinyclaw/
├── src/                    # Backend source code
│   ├── channels/           # Channel integrations
│   │   ├── discord-client.ts
│   │   ├── telegram-client.ts
│   │   ├── whatsapp-client.ts
│   │   └── feishu-client.ts
│   ├── server/             # API server
│   │   ├── index.ts        # Server entry point
│   │   ├── sse.ts          # SSE event streaming
│   │   └── routes/         # API route handlers
│   │       ├── agents.ts
│   │       ├── teams.ts
│   │       ├── messages.ts
│   │       ├── queue.ts
│   │       ├── tasks.ts
│   │       ├── logs.ts
│   │       ├── settings.ts
│   │       └── chats.ts
│   ├── lib/                # Shared libraries
│   │   ├── agent.ts        # Agent management
│   │   ├── config.ts       # Configuration loading
│   │   ├── conversation.ts # Conversation state
│   │   ├── db.ts           # Database operations
│   │   ├── invoke.ts       # Agent invocation
│   │   ├── logging.ts      # Logging system
│   │   ├── pairing.ts      # Agent pairing
│   │   ├── plugins.ts      # Plugin system
│   │   ├── response.ts     # Response handling
│   │   ├── routing.ts      # Message routing
│   │   └── types.ts        # Type definitions
│   ├── queue-processor.ts  # Queue processor (main)
│   └── visualizer/         # Visualizer (optional)
├── tinyoffice/             # Next.js frontend
│   ├── app/                # Next.js app pages
│   │   ├── agents/         # Agents page
│   │   ├── teams/          # Teams page
│   │   ├── tasks/          # Tasks page
│   │   ├── chat/           # Chat pages
│   │   │   ├── agent/[id]/ # Agent chat
│   │   │   └── team/[id]/  # Team chat
│   │   ├── office/         # Dashboard
│   │   ├── console/        # System console
│   │   ├── logs/           # Logs viewer
│   │   ├── settings/       # Settings page
│   │   └── page.tsx        # Homepage
│   ├── src/
│   │   └── lib/            # Shared frontend/backend code
│   ├── public/             # Static assets
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── dist/                   # Compiled backend
├── examples/               # Usage examples
├── lib/                    # Shared libraries
├── tinyclaw.settings.json  # Settings config
├── tinyclaw.agents.json    # Agents config
├── tinyclaw.teams.json     # Teams config
├── package.json
└── tsconfig.json
```

---

## Development Workflow

### Backend Development

```bash
cd tinyclaw
npm install                # Install dependencies
npm run build              # Compile TypeScript
npm run build:watch        # Watch mode
npm run queue              # Run queue processor
npm run discord            # Run Discord client
npm run telegram           # Run Telegram client
npm run whatsapp           # Run WhatsApp client
npm run feishu             # Run Feishu client
npm run visualize          # Run visualizer
```

### Frontend Development

```bash
cd tinyclaw/tinyoffice
npm install                # Install dependencies
npm run dev                # Development server
npm run build              # Production build
npm run start              # Production server
npm run lint               # Lint code
```

### Full Stack Development

Open multiple terminals:

```bash
# Terminal 1: Queue Processor
cd tinyclaw && npm run queue

# Terminal 2: Discord Client
cd tinyclaw && npm run discord

# Terminal 3: Telegram Client
cd tinyclaw && npm run telegram

# Terminal 4: Frontend
cd tinyclaw/tinyoffice && npm run dev
```

---

## Configuration

### Settings File (`tinyclaw.settings.json`)

```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"        # Working directory
  },
  "llm": {
    "default_provider": "claude",         # Default LLM provider
    "default_model": "claude-3-opus",     # Default model
    "providers": {
      "claude": {
        "api_key": "sk-ant-...",          # Claude API key
        "base_url": "https://api.anthropic.com"
      },
      "openai": {
        "api_key": "sk-...",              # OpenAI API key
        "base_url": "https://api.openai.com"
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,                    # Enable Discord
      "token": "BOT_TOKEN"                # Discord bot token
    },
    "telegram": {
      "enabled": true,                    # Enable Telegram
      "token": "BOT_TOKEN"                # Telegram bot token
    },
    "whatsapp": {
      "enabled": false                    # Enable WhatsApp
    },
    "feishu": {
      "enabled": false                    # Enable Feishu
    }
  },
  "queue": {
    "max_retries": 3,                     # Max retry attempts
    "retry_delay": 5000                   # Retry delay in ms
  }
}
```

### Agents File (`tinyclaw.agents.json`)

```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful AI assistant...",
    "working_dir": "agents/default",
    "temperature": 0.7,
    "max_tokens": 4096,
    "tools": []                           # Available tools
  },
  "agent-technical": {
    "name": "Technical Support",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a technical support expert...",
    "working_dir": "agents/technical",
    "temperature": 0.3,
    "tools": ["search_docs", "run_command"]
  }
}
```

### Teams File (`tinyclaw.teams.json`)

```json
{
  "team-support": {
    "name": "Support Team",
    "leader_agent": "agent-support-lead",
    "agents": [
      "agent-support-lead",
      "agent-technical",
      "agent-billing"
    ],
    "description": "Customer support team",
    "rules": {
      "timeout": 300,                     # Timeout in seconds
      "max_mentions": 5                   # Max teammate mentions
    }
  }
}
```

---

## Adding New Features

### 1. Add a New Agent

Edit `tinyclaw.agents.json`:

```json
{
  "my-agent": {
    "name": "My Custom Agent",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are specialized in...",
    "working_dir": "agents/my-agent",
    "temperature": 0.7
  }
}
```

Test by sending message: `@my-agent Hello!`

### 2. Add a New Team

Edit `tinyclaw.teams.json`:

```json
{
  "my-team": {
    "name": "My Team",
    "leader_agent": "agent-lead",
    "agents": ["agent-lead", "agent-member1", "agent-member2"],
    "description": "My custom team"
  }
}
```

Test by sending message: `@my-team Help me with...`

### 3. Add a New Channel

Create channel client in `src/channels/my-channel.ts`:

```typescript
import { MessageData } from '../lib/types';
import { log } from '../lib/logging';

export class MyChannelClient {
  async start(): Promise<void> {
    // Connect to channel
    log('INFO', 'MyChannel connected');

    // Listen for messages
    this.onMessage((message: MessageData) => {
      // Process message
      log('INFO', `Received: ${message.message}`);
    });
  }

  async sendMessage(recipient: string, message: string): Promise<void> {
    // Send message to channel
  }

  private onMessage(callback: (msg: MessageData) => void): void {
    // Message handler
  }
}
```

Add startup script in `package.json`:

```json
{
  "scripts": {
    "my-channel": "node dist/channels/my-channel.js"
  }
}
```

### 4. Add a Plugin/Hook

Create plugin in `plugins/my-plugin.ts`:

```typescript
import { Plugin } from '../lib/plugins';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  onMessageReceived: async (message) => {
    // Modify or reject message
    if (message.message.includes('badword')) {
      return null; // Reject message
    }
    return message; // Accept message
  },
  onAgentResponse: async (response) => {
    // Modify response before sending
    response.message += '\n\n— My Plugin';
    return response;
  }
};
```

Register in `src/lib/plugins.ts`:

```typescript
export function loadPlugins() {
  return [
    // ... existing plugins
    myPlugin,
  ];
}
```

---

## Debugging

### Log Levels

Logs are written to `logs/tinyclaw.log`:

```bash
tail -f logs/tinyclaw.log              # View logs
grep "ERROR" logs/tinyclaw.log         # View errors
grep "agent-technical" logs/tinyclaw.log # Filter by agent
```

### Debug Queue

```bash
sqlite3 tinyclaw.db
.tables                                # List tables
SELECT * FROM queue_messages WHERE status='pending';  # Pending messages
SELECT * FROM queue_messages WHERE status='failed';   # Failed messages
SELECT COUNT(*) FROM queue_messages;   # Total messages
```

### Debug API

```bash
# Get queue status
curl http://localhost:3777/api/queue/status

# List agents
curl http://localhost:3777/api/agents

# List teams
curl http://localhost:3777/api/teams

# Send test message
curl -X POST http://localhost:3777/api/messages \
  -H "Content-Type: application/json" \
  -d '{"agent": "default", "message": "Hello"}'
```

### Frontend Debug

Open browser DevTools (F12):

- Console: View JavaScript logs
- Network: Inspect API calls
- Application: View local storage

---

## Common Tasks

### Reset All Data

```bash
rm -rf tinyclaw.db
rm -rf tinyclaw-workspace/
rm -rf logs/
npm run queue  # Recreate database
```

### Add Channel Bot

**Discord:**
1. Go to https://discord.com/developers/applications
2. Create new application
3. Add bot and copy token
4. Update `tinyclaw.settings.json` with token

**Telegram:**
1. Talk to @BotFather on Telegram
2. Create new bot with `/newbot`
3. Copy token
4. Update `tinyclaw.settings.json` with token

### Test Team Conversation

Send message to team:

```
@team-support I need help with my account
```

Leader agent receives message and can mention teammates:

```
[@agent-technical: Can you check the account status?]
[@agent-billing: Can you verify the payment?]
```

### Monitor Queue

Via API:

```bash
curl http://localhost:3777/api/queue/status | jq
```

Via Frontend:
1. Open http://localhost:3000
2. Go to Dashboard
3. View queue statistics

### Export Data

```bash
sqlite3 tinyclaw.db .dump > backup.sql           # Export database
cp -r tinyclaw-workspace/ backup-workspace/      # Export workspace
cp logs/tinyclaw.log backup-log.txt              # Export logs
```

---

## Testing

### Manual Testing

1. Start queue processor: `npm run queue`
2. Start channel client: `npm run discord`
3. Send message from Discord/Telegram
4. Observe logs: `tail -f logs/tinyclaw.log`
5. Check database: `sqlite3 tinyclaw.db`

### Frontend Testing

1. Start frontend: `cd tinyoffice && npm run dev`
2. Open http://localhost:3000
3. Test all pages and features
4. Check browser console for errors

### API Testing

```bash
# Test agents endpoint
curl http://localhost:3777/api/agents

# Test teams endpoint
curl http://localhost:3777/api/teams

# Test messages endpoint
curl -X POST http://localhost:3777/api/messages \
  -H "Content-Type: application/json" \
  -d '{"agent": "default", "message": "test"}'

# Test SSE stream
curl http://localhost:3777/api/events/stream
```

---

## Architecture Patterns

### Queue-Based Processing

All messages go through SQLite queue:

```
Channel → Queue (pending) → Processor → Agent → Response → Channel
```

Benefits:
- Reliability (persistent queue)
- Retry logic (failed messages)
- Load balancing (multiple processors)
- Recovery (stale message detection)

### Team Orchestration via Mentions

Team collaboration via natural mentions:

```
User: @team-support Help me
Leader: [@agent-technical: Check this]
Technical: [@agent-billing: Verify payment]
Billing: Payment confirmed
Leader: User, everything is OK!
```

Benefits:
- Natural language interface
- Flexible team structures
- Async coordination
- Conversation tracking

### Hot-Reloadable Configuration

Configs reloaded on each message:

```typescript
// On each message
const settings = getSettings();  // Fresh from file
const agents = getAgents(settings);  // Fresh from file
```

Benefits:
- No restart needed for config changes
- Dynamic agent/team updates
- Runtime flexibility

---

## Best Practices

1. **Type Safety:** Use TypeScript strictly
2. **Error Handling:** Catch and log all errors
3. **Idempotency:** Queue messages should be idempotent
4. **Testing:** Test each channel separately
5. **Monitoring:** Watch queue and logs
6. **Security:** Keep API keys in environment variables
7. **Documentation:** Document custom agents and teams

---

## Troubleshooting

### Queue Processor Not Starting

```bash
# Check logs
tail -f logs/tinyclaw.log

# Check database
sqlite3 tinyclaw.db ".tables"

# Reset database
rm tinyclaw.db
npm run queue
```

### Channel Client Not Connecting

```bash
# Check token in settings
cat tinyclaw.settings.json | grep token

# Check logs
tail -f logs/tinyclaw.log | grep "ERROR"

# Test token manually
curl https://discord.com/api/v10/users/@me \
  -H "Authorization: Bot YOUR_TOKEN"
```

### Agent Not Responding

1. Check agent config exists in `tinyclaw.agents.json`
2. Check provider API key is valid
3. Check model name is correct
4. Check logs for LLM errors
5. Test with simple message

### Team Mentions Not Working

1. Check team exists in `tinyclaw.teams.json`
2. Check teammates are in team agents array
3. Check mention format: `[@agent-id: message]`
4. Check internal messages in queue
5. Check conversation state in database

### Frontend Not Loading

```bash
# Check if running
curl http://localhost:3000

# Check logs
cd tinyoffice && npm run dev

# Clear cache
rm -rf .next/
npm run dev
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and test
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open pull request

---

## Resources

- [Architecture Documentation](./architecture-tinyclaw.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Project Overview](./project-overview.md)
- [tinyclaw/ARCHITECTURE.md](../tinyclaw/ARCHITECTURE.md) - Detailed architecture
- [tinyclaw/DOCUMENTATION.md](../tinyclaw/DOCUMENTATION.md) - Project docs
- [tinyclaw/CONFIG_GUIDE.md](../tinyclaw/CONFIG_GUIDE.md) - Config guide
- [tinyclaw/CLAUDE.md](../tinyclaw/CLAUDE.md) - Project guidelines

---

_This development guide was generated by the BMAD `document-project` workflow_
