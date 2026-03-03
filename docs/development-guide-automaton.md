# Conway Automaton - Development Guide

**Part:** automaton
**Last Updated:** 2026-03-03

---

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** package manager
- **Git** for version control
- **Conway API Key** (optional, for billing/credits)
- **Ethereum Wallet** (optional, for Web3 features)

---

## Getting Started

### 1. Clone and Install

```bash
cd automaton
pnpm install
```

### 2. First Run (Setup Wizard)

```bash
pnpm dev
```

The first run will trigger an interactive setup wizard that will:
- Configure LLM providers (Claude, OpenAI, etc.)
- Set up treasury and budget policies
- Select default inference model
- Configure Conway API integration (optional)
- Set up Ethereum wallet (optional)

### 3. Manual Setup (Alternative)

```bash
automaton --setup          # Re-run setup wizard
automaton --configure      # Edit configuration
automaton --pick-model     # Select inference model
automaton --provision      # Provision Conway API key
```

---

## Project Structure

```
automaton/
├── src/                    # Main source code
│   ├── agent/              # Core agent loop and policy engine
│   │   ├── loop.ts         # ReAct execution loop
│   │   ├── context.ts      # Context building
│   │   ├── tools.ts        # Tool registration and execution
│   │   ├── system-prompt.ts # System prompt construction
│   │   ├── injection-defense.ts # Security sanitization
│   │   ├── policy-engine.ts # Policy enforcement
│   │   └── policy-rules/   # Policy rule implementations
│   ├── memory/             # Multi-layer memory system
│   │   ├── working.ts      # Working memory (active context)
│   │   ├── episodic.ts     # Episodic memory (event history)
│   │   ├── semantic.ts     # Semantic memory (knowledge base)
│   │   ├── procedural.ts   # Procedural memory (skills)
│   │   ├── knowledge-store.ts # Knowledge storage
│   │   ├── context-manager.ts # Context aggregation
│   │   ├── compression-engine.ts # Memory compression
│   │   ├── retrieval.ts    # Memory retrieval
│   │   └── ingestion.ts    # Knowledge ingestion
│   ├── conway/             # Conway API integration
│   │   ├── client.ts       # HTTP client
│   │   ├── credits.ts      # Credit tracking
│   │   ├── x402.ts         # USDC balance
│   │   ├── inference.ts    # Inference API
│   │   └── topup.ts        # Automated top-up
│   ├── identity/           # Web3 identity
│   │   ├── wallet.ts       # Ethereum wallet
│   │   └── provision.ts    # API key provisioning
│   ├── self-mod/           # Self-modification
│   │   ├── code.ts         # Code generation
│   │   ├── tools-manager.ts # Tool lifecycle
│   │   ├── upstream.ts     # Git integration
│   │   └── audit-log.ts    # Change auditing
│   ├── inference/          # Multi-provider inference
│   │   ├── registry.ts     # Model registry
│   │   ├── budget.ts       # Budget tracking
│   │   ├── router.ts       # Inference routing
│   │   └── provider-registry.ts # Provider management
│   ├── state/              # Persistence layer
│   │   └── database.ts     # SQLite database
│   ├── setup/              # Configuration wizard
│   │   ├── wizard.ts       # Interactive setup
│   │   ├── configure.ts    # Config editing
│   │   ├── model-picker.ts # Model selection
│   │   └── environment.ts  # Environment loading
│   ├── heartbeat/          # Scheduling system
│   │   ├── daemon.ts       # Heartbeat daemon
│   │   └── config.ts       # Wake event config
│   ├── skills/             # Installed skills
│   │   └── loader.ts       # Skill loading
│   ├── social/             # Social platform integration
│   │   └── client.ts       # Social client
│   ├── orchestration/      # Multi-agent orchestration
│   │   ├── orchestrator.ts # Agent orchestration
│   │   ├── plan-mode.ts    # Plan mode controller
│   │   ├── attention.ts    # Attention mechanism
│   │   ├── messaging.ts    # Inter-agent messaging
│   │   ├── local-worker.ts # Local worker pool
│   │   └── simple-tracker.ts # Simple agent tracker
│   ├── observability/      # Logging and monitoring
│   │   └── logger.ts       # Structured logger
│   ├── git/                # Git integration
│   │   └── state-versioning.ts # State versioning
│   └── index.ts            # Main entry point
├── packages/cli/           # CLI package
│   └── src/
│       ├── commands/       # CLI commands
│       │   ├── status.ts   # Status command
│       │   ├── logs.ts     # Logs command
│       │   ├── send.ts     # Send message command
│       │   └── fund.ts     # Fund treasury command
│       └── index.ts        # CLI entry point
├── tests/                  # Test suite
├── dist/                   # Compiled output
├── config/                 # Configuration files
├── .automaton/             # Runtime data (wallet, state, logs)
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

---

## Development Workflow

### Build

```bash
pnpm build                 # Compile TypeScript to dist/
pnpm build:watch           # Watch mode for development
```

### Run

```bash
pnpm dev                   # Development mode (watch + run)
node dist/index.js         # Run compiled version
```

### CLI Commands

```bash
automaton --version        # Show version
automaton --help           # Show help
automaton --status         # Show agent status
automaton --setup          # Run setup wizard
automaton --configure      # Edit configuration
automaton --pick-model     # Select inference model
automaton --provision      # Provision Conway API key
automaton --init           # Initialize wallet and config
```

---

## Configuration

### Configuration Files

- `~/.automaton/config.json` - Main configuration
- `~/.automaton/wallet.json` - Ethereum wallet
- `~/.automaton/state.db` - SQLite database
- `~/.automaton/logs/` - Log files

### Environment Variables

```bash
CONWAY_API_URL=https://api.conway.tech      # Conway API URL
CONWAY_API_KEY=sk-...                       # Conway API key
OLLAMA_BASE_URL=http://localhost:11434      # Ollama base URL
AUTOMATON_LOG_LEVEL=info                    # Log level (debug, info, warn, error)
```

### Configuration Example

```json
{
  "model": {
    "provider": "claude",
    "name": "claude-3-opus",
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "treasury": {
    "credit_limit": 1000,
    "spend_limit_per_turn": 100,
    "auto_topup": false
  },
  "providers": {
    "claude": {
      "api_key": "sk-...",
      "base_url": "https://api.anthropic.com"
    },
    "openai": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com"
    }
  },
  "policies": {
    "enable_injection_defense": true,
    "enable_policy_engine": true,
    "max_tool_calls_per_turn": 10,
    "max_consecutive_errors": 5
  }
}
```

---

## Testing

### Run Tests

```bash
pnpm test                  # Run all tests
pnpm test:coverage         # Run with coverage report
pnpm test:security         # Security-focused tests
pnpm test:financial        # Financial/treasury tests
pnpm test:ci               # CI-optimized tests
```

### Test Structure

```
tests/
├── agent/
│   ├── loop.test.ts       # Agent loop tests
│   ├── policy.test.ts     # Policy engine tests
│   └── tools.test.ts      # Tool execution tests
├── memory/
│   ├── working.test.ts    # Working memory tests
│   ├── episodic.test.ts   # Episodic memory tests
│   └── semantic.test.ts   # Semantic memory tests
├── conway/
│   ├── credits.test.ts    # Credit tracking tests
│   └── inference.test.ts  # Inference API tests
├── self-mod/
│   └── code.test.ts       # Code generation tests
└── integration/
    └── e2e.test.ts        # End-to-end tests
```

---

## Adding New Features

### 1. Add a New Tool

Tools extend agent capabilities. Create in `src/agent/tools/`:

```typescript
// src/agent/tools/my-tool.ts
import type { AutomatonTool, ToolContext } from "../types.js";

export const myTool: AutomatonTool = {
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "Input parameter" }
    },
    required: ["input"]
  },
  async execute(context: ToolContext, args: { input: string }): Promise<string> {
    // Tool implementation
    return `Result: ${args.input}`;
  }
};
```

Register in `src/agent/tools.ts`:

```typescript
export function createBuiltinTools(sandboxId: string) {
  return {
    // ... existing tools
    my_tool: myTool,
  };
}
```

### 2. Add a Policy Rule

Policy rules enforce safety. Create in `src/agent/policy-rules/`:

```typescript
// src/agent/policy-rules/my-rule.ts
import type { PolicyRule, AgentState } from "../../types.js";

export const myRule: PolicyRule = {
  name: "my_rule",
  description: "Validates something",
  validate(state: AgentState): { allowed: boolean; reason?: string } {
    // Validation logic
    if (/* some condition */) {
      return { allowed: false, reason: "Not allowed" };
    }
    return { allowed: true };
  }
};
```

Register in `src/agent/policy-rules/index.ts`:

```typescript
export function createDefaultRules(): PolicyRule[] {
  return [
    // ... existing rules
    myRule,
  ];
}
```

### 3. Add a Memory Layer

Create new memory type in `src/memory/`:

```typescript
// src/memory/my-memory.ts
import type { MemoryBlock } from "../types.js";

export class MyMemory {
  async store(key: string, value: any): Promise<void> {
    // Store logic
  }

  async retrieve(key: string): Promise<any> {
    // Retrieve logic
  }

  async search(query: string): Promise<MemoryBlock[]> {
    // Search logic
  }
}
```

Integrate in `src/memory/memory.ts`:

```typescript
export class MemoryManager {
  private myMemory: MyMemory;

  constructor() {
    this.myMemory = new MyMemory();
  }

  // Use in context building, retrieval, etc.
}
```

---

## Debugging

### Log Levels

```bash
AUTOMATON_LOG_LEVEL=debug    # Verbose debugging
AUTOMATON_LOG_LEVEL=info     # Normal operation (default)
AUTOMATON_LOG_LEVEL=warn     # Warnings only
AUTOMATON_LOG_LEVEL=error    # Errors only
```

### Debug Agent Loop

Add logging to `src/agent/loop.ts`:

```typescript
logger.debug("Context:", context);
logger.debug("Response:", response);
logger.debug("Tool calls:", toolCalls);
```

### Inspect Database

```bash
sqlite3 ~/.automaton/state.db
.tables                        # List tables
SELECT * FROM agent_state;     # View agent state
SELECT * FROM agent_turns;     # View conversation history
SELECT * FROM memory_blocks;   # View memory
```

---

## Common Tasks

### Reset Agent State

```bash
rm -rf ~/.automaton/state.db
rm -rf ~/.automaton/logs/*
automaton --init
```

### Change Inference Model

```bash
automaton --pick-model
# Or edit ~/.automaton/config.json manually
```

### Fund Treasury

```bash
automaton fund --amount 1000   # Add 1000 credits
# Or use CLI:
cd packages/cli
pnpm fund --amount 1000
```

### View Logs

```bash
tail -f ~/.automaton/logs/automaton.log
# Or use CLI:
cd packages/cli
pnpm logs
```

### Send Message to Agent

```bash
cd packages/cli
pnpm send "Hello, how are you?"
```

---

## Architecture Patterns

### ReAct Loop

The core pattern is **ReAct (Reasoning + Acting)**:

1. **Think** - Analyze context, decide next action
2. **Act** - Execute tool or generate response
3. **Observe** - Capture results
4. **Persist** - Store to memory

### Multi-Layer Memory

Four memory layers with different lifetimes:

- **Working** - Active context (session-scoped)
- **Episodic** - Event history (persistent)
- **Semantic** - Knowledge base (persistent)
- **Procedural** - Skills and tools (persistent)

### Policy-Driven Safety

All operations pass through policy engine:

- Input validation
- Rate limiting
- Path protection
- Budget enforcement
- Injection defense

---

## Best Practices

1. **Type Safety:** Use TypeScript strictly, no `any`
2. **Error Handling:** Always catch and log errors
3. **Testing:** Write tests for all new features
4. **Documentation:** Document all public APIs
5. **Security:** Sanitize all inputs, validate all outputs
6. **Performance:** Profile before optimizing
7. **Code Style:** Follow existing patterns and conventions

---

## Troubleshooting

### Agent Not Starting

```bash
# Check logs
tail -f ~/.automaton/logs/automaton.log

# Check config
cat ~/.automaton/config.json

# Reset and re-init
rm -rf ~/.automaton/*
automaton --init
```

### Out of Credits

```bash
# Check balance
automaton --status

# Add credits
automaton fund --amount 1000

# Or configure auto-topup in config.json
```

### Tool Not Working

1. Check tool is registered in `src/agent/tools.ts`
2. Check tool parameters match schema
3. Check tool execution has proper error handling
4. Check logs for tool-specific errors

### Memory Issues

1. Check SQLite database is not corrupted
2. Check disk space for `~/.automaton/`
3. Check memory budget limits in config
4. Review memory compression settings

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and add tests
4. Run tests (`pnpm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open pull request

---

## Resources

- [Architecture Documentation](./architecture-automaton.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Project Overview](./project-overview.md)
- [automaton/AGENTS.md](../automaton/AGENTS.md) - Agent configuration
- [automaton/CLAUDE.md](../automaton/CLAUDE.md) - Project guidelines

---

_This development guide was generated by the BMAD `document-project` workflow_
