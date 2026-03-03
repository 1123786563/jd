# Conway Automaton - Architecture

**Part:** automaton
**Type:** Backend Web Application (AI Agent Runtime)
**Last Updated:** 2026-03-03

---

## Overview

**Conway Automaton** is a sovereign, self-replicating AI agent runtime with Web3 integration and autonomous capabilities. It implements a sophisticated multi-layer memory architecture, policy-based safety controls, and financial awareness through Conway API integration.

---

## Architecture Pattern

**ReAct Loop Architecture** - Think → Act → Observe → Persist

The core architecture follows the ReAct (Reasoning + Acting) pattern, where the agent continuously:
1. **Think** - Analyze context and decide next action
2. **Act** - Execute tools or generate responses
3. **Observe** - Capture results and environmental changes
4. **Persist** - Store state and learnings to memory

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Conway Automaton Runtime                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Agent Loop (Core)                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  ReAct Cycle: Think → Act → Observe → Persist      │  │   │
│  │  │  - Policy Enforcement (Safety)                     │  │   │
│  │  │  - Injection Defense                               │  │   │
│  │  │  - Budget Tracking                                 │  │   │
│  │  └───────────────┬────────────────────────────────────┘  │   │
│  └──────────────────┼────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Context Manager                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Working Memory (Active Context)                     │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Episodic Memory (Event History)                     │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Semantic Memory (Knowledge Base)                    │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Procedural Memory (Skills)                          │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Tool Manager                                │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Built-in Tools                                      │  │   │
│  │  │  ├─ Self-Modification (Code Generation)             │  │   │
│  │  │  ├─ Conway API (Billing/Credits)                    │  │   │
│  │  │  ├─ Identity (Wallet/Provision)                     │  │   │
│  │  │  ├─ Memory Management                               │  │   │
│  │  │  └─ System Operations                               │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Installed Skills (Dynamic)                         │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Inference Layer                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Model Registry (Multi-Provider)                     │  │   │
│  │  │  ├─ OpenAI (Claude, GPT)                            │  │   │
│  │  │  ├─ Ollama (Local Models)                           │  │   │
│  │  │  └─ Other Providers                                  │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Budget Tracker (Credit Management)                 │  │   │
│  │  │  ├─ Conway Credits                                  │  │   │
│  │  │  ├─ Spend Tracking                                  │  │   │
│  │  │  └─ Rate Limiting                                   │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │              Persistence Layer                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  SQLite Database (better-sqlite3)                    │  │   │
│  │  │  ├─ Agent State & Turns                             │  │   │
│  │  │  ├─ Memory Blocks                                   │  │   │
│  │  │  ├─ Wake Events (Scheduling)                       │  │   │
│  │  │  ├─ Inbox Messages                                  │  │   │
│  │  │  └─ Audit Logs (Self-Modification)                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              External Integrations                         │   │
│  │  ├─ Conway API (Billing, Credits, Top-up)                │   │
│  │  ├─ Ethereum Blockchain (Wallet, Transactions)           │   │
│  │  ├─ Git (Code Versioning & Self-Mod)                     │   │
│  │  └─ Social Platforms (Future)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Agent Loop (`src/agent/loop.ts`)

**Purpose:** The core consciousness of the automaton - the ReAct execution loop

**Key Responsibilities:**
- Execute continuous ReAct cycle (Think → Act → Observe → Persist)
- Manage conversation turns and state transitions
- Enforce policy rules and safety checks
- Track inference budget and credits
- Handle tool execution and results
- Manage error recovery and retry logic

**Key Features:**
- **Policy Enforcement:** Runtime validation and rate limiting
- **Injection Defense:** Sanitizes inputs against prompt injection attacks
- **Budget Management:** Tracks Conway credits and spending
- **Error Handling:** Maximum consecutive errors (5) and repetitive turn limits (3)
- **Tool Execution:** Supports up to 10 tool calls per turn

**Entry Point:** `runAgentLoop(options)` function

**Related Files:**
- `src/agent/context.ts` - Context building and message management
- `src/agent/system-prompt.ts` - System prompt construction
- `src/agent/tools.ts` - Tool registration and execution
- `src/agent/injection-defense.ts` - Security sanitization
- `src/agent/policy-engine.ts` - Policy rule enforcement

---

### 2. Multi-Layer Memory System (`src/memory/`)

**Purpose:** Hierarchical memory architecture for different types of information

#### Working Memory (`src/memory/working.ts`)
- **Purpose:** Active context for current conversation/turn
- **Lifetime:** Session-scoped, cleared between turns
- **Content:** Recent messages, current goals, active tools

#### Episodic Memory (`src/memory/episodic.ts`)
- **Purpose:** Event history and conversation transcripts
- **Lifetime:** Persistent (stored in SQLite)
- **Content:** Complete conversation history, agent turns, events
- **Retrieval:** Time-based, event-based

#### Semantic Memory (`src/memory/semantic.ts`)
- **Purpose:** Knowledge base and learned information
- **Lifetime:** Persistent (stored in SQLite)
- **Content:** Facts, concepts, relationships, domain knowledge
- **Retrieval:** Vector similarity search, keyword matching

#### Procedural Memory (`src/memory/procedural.ts`)
- **Purpose:** Skills, tools, and how-to knowledge
- **Lifetime:** Persistent (stored in SQLite)
- **Content:** Tool definitions, skill implementations, workflows
- **Retrieval:** Name-based, capability-based

#### Knowledge Store (`src/memory/knowledge-store.ts`)
- **Purpose:** Unified interface for semantic knowledge
- **Features:** Ingestion pipeline, retrieval optimization, deduplication

#### Context Manager (`src/memory/context-manager.ts`)
- **Purpose:** Aggregate and manage context from all memory layers
- **Features:** Token counting, context trimming, prioritization

#### Compression Engine (`src/memory/compression-engine.ts`)
- **Purpose:** Compress long conversations and memories
- **Features:** Summarization, lossy compression, retention policies

**Related Files:**
- `src/memory/retrieval.ts` - Memory retrieval strategies
- `src/memory/ingestion.ts` - Knowledge ingestion pipeline
- `src/memory/event-stream.ts` - Event-based memory updates
- `src/memory/agent-context-aggregator.ts` - Context aggregation
- `src/memory/budget.ts` - Memory budget management

---

### 3. Identity & Web3 Integration (`src/identity/`)

**Purpose:** Wallet management, blockchain identity, and authentication

#### Wallet (`src/identity/wallet.ts`)
- **Features:**
  - Ethereum wallet generation and management
  - SIWE (Sign-In with Ethereum) authentication
  - Account provisioning and recovery
  - Config directory management

#### Provision (`src/identity/provision.ts`)
- **Features:**
  - Conway API key provisioning via SIWE
  - Blockchain identity verification
  - API key loading from config

**Integration:** viem library for Ethereum interactions

---

### 4. Conway API Integration (`src/conway/`)

**Purpose:** Billing, credits, and financial operations

#### Client (`src/conway/client.ts`)
- Conway API HTTP client
- Request signing and authentication
- Error handling and retries

#### Credits (`src/conway/credits.ts`)
- Credit balance tracking
- Survival tier determination
- Budget calculations

#### X402 (`src/conway/x402.ts`)
- USDC balance checking
- Payment protocol handling
- Invoice processing

#### Inference (`src/conway/inference.ts`)
- Inference API client
- Model selection and routing
- Cost tracking

#### Top-up (`src/conway/topup.ts`)
- Automated credit top-up
- Payment processing
- Balance monitoring

---

### 5. Self-Modification System (`src/self-mod/`)

**Purpose:** Safe code generation and autonomous updates

#### Code (`src/self-mod/code.ts`)
- Code generation and modification
- Syntax validation
- Safety checks

#### Tools Manager (`src/self-mod/tools-manager.ts`)
- Dynamic tool registration
- Tool lifecycle management
- Capability discovery

#### Upstream (`src/self-mod/upstream.ts`)
- Git integration for code versioning
- Pull request creation
- Code review workflow

#### Audit Log (`src/self-mod/audit-log.ts`)
- All code changes logged
- Rollback capability
- Change tracking

**Safety Features:**
- All changes require policy approval
- Audit trail for all modifications
- Rollback mechanism
- Syntax and type validation

---

### 6. Policy Engine (`src/agent/policy-engine.ts`)

**Purpose:** Runtime safety rules and enforcement

**Default Rules:**
- `validation.ts` - Input/output validation
- `rate-limits.ts` - API rate limiting
- `path-protection.ts` - File system access control

**Features:**
- Dynamic rule loading
- Rule chaining and composition
- Violation logging and handling

---

### 7. Inference Layer (`src/inference/`)

**Purpose:** Multi-provider LLM integration and routing

#### Model Registry (`src/inference/registry.ts`)
- Model provider registration
- Model capability metadata
- Provider selection logic

#### Budget Tracker (`src/inference/budget.ts`)
- Credit tracking per provider
- Spend limits and alerts
- Cost optimization

#### Inference Router (`src/inference/router.ts`)
- Intelligent model selection
- Fallback strategies
- Load balancing

#### Provider Registry (`src/inference/provider-registry.ts`)
- Multi-provider configuration
- Provider health monitoring
- Automatic failover

---

### 8. State & Persistence (`src/state/`)

**Purpose:** SQLite database layer for all persistent data

#### Database (`src/state/database.ts`)
- **Tables:**
  - `agent_state` - Current agent state and configuration
  - `agent_turns` - Conversation history and turns
  - `memory_blocks` - Memory storage (episodic, semantic, procedural)
  - `wake_events` - Scheduled events and triggers
  - `inbox_messages` - Pending messages and notifications
  - `audit_log` - Self-modification audit trail
  - `spend_tracker` - Financial transaction history

**Features:**
- ACID-compliant transactions
- Migration support
- Schema versioning
- Backup and restore

---

### 9. Setup & Configuration (`src/setup/`)

**Purpose:** Interactive setup wizard and configuration management

#### Wizard (`src/setup/wizard.ts`)
- First-run interactive setup
- Model selection
- Treasury configuration
- Provider setup

#### Configure (`src/setup/configure.ts`)
- Configuration editing UI
- Provider management
- Model switching
- Treasury policy updates

#### Environment (`src/setup/environment.ts`)
- Environment variable loading
- Config file parsing
- Default values

#### Model Picker (`src/setup/model-picker.ts`)
- Interactive model selection
- Provider comparison
- Cost estimation

---

### 10. CLI Package (`packages/cli/`)

**Purpose:** Command-line interface for automaton management

**Commands:**
- `status` - Show current automaton status
- `logs` - View agent logs and activity
- `send` - Send messages to agent
- `fund` - Fund automaton treasury

**Features:**
- Colored output (chalk)
- Interactive prompts
- Progress indicators (ora)

---

## Data Flow

### Agent Turn Execution Flow

```
1. Wake Event Triggered
   └─> consumeNextWakeEvent() from database

2. Context Aggregation
   ├─> Load Working Memory (active context)
   ├─> Retrieve Episodic Memory (conversation history)
   ├─> Query Semantic Memory (relevant knowledge)
   ├─> Load Procedural Memory (available tools)
   └─> Build Context Messages

3. Inference
   ├─> Apply System Prompt
   ├─> Sanitize Input (injection defense)
   ├─> Check Policy Rules (validation, rate limits)
   ├─> Call LLM (via inference router)
   └─> Parse Response (text or tool calls)

4. Tool Execution (if any)
   ├─> Validate Tool Call (policy check)
   ├─> Execute Tool (built-in or installed)
   ├─> Capture Results
   └─> Handle Errors (retry logic)

5. Observation & Learning
   ├─> Record Turn (to database)
   ├─> Update Working Memory
   ├─> Store to Episodic Memory
   ├─> Extract Knowledge (semantic ingestion)
   └─> Update Budget (spend tracking)

6. Persistence
   ├─> Save Agent State
   ├─> Log Turn Details
   ├─> Schedule Next Wake Event
   └─> Emit State Change Event

7. Loop Continuation
   ├─> Check Budget (continue or sleep)
   ├─> Check Errors (continue or abort)
   └─> Repeat from Step 2
```

---

## Key Design Patterns

### 1. Multi-Layer Memory Pattern
Separate memory systems for different types of information with specialized storage and retrieval strategies.

### 2. Policy-Driven Safety
Runtime safety enforced through configurable policy rules rather than hardcoded checks.

### 3. Tool-Based Extensibility
Capabilities exposed as tools that can be dynamically registered and invoked.

### 4. Self-Modification with Auditing
Code generation capability with comprehensive audit logging and rollback.

### 5. Multi-Provider Inference
Abstracted inference layer supporting multiple LLM providers with intelligent routing.

### 6. Event-Driven Architecture
Wake events and inbox messages drive agent execution rather than polling.

### 7. Financial Awareness
Built-in credit tracking, spending limits, and Conway API integration.

---

## External Dependencies

| Dependency | Purpose | Critical? |
|------------|---------|-----------|
| better-sqlite3 | Embedded database | ✅ Yes |
| express | Web server (future API) | ⚠️ Planned |
| openai | LLM inference client | ✅ Yes |
| viem | Ethereum blockchain | ✅ Yes |
| siwe | Ethereum auth (SIWE) | ✅ Yes |
| ulid | Unique ID generation | ✅ Yes |
| simple-git | Git integration | ✅ Yes |
| cron-parser | Scheduled events | ✅ Yes |

---

## Security Considerations

1. **Injection Defense:** All inputs sanitized before LLM calls
2. **Policy Enforcement:** Runtime safety rules for all operations
3. **Budget Limits:** Spend tracking and credit limits
4. **Path Protection:** File system access controls
5. **Audit Logging:** All self-modifications logged
6. **Rate Limiting:** API usage throttling

---

## Testing Strategy

**Test Framework:** vitest

**Test Suites:**
- `test:security` - Security and injection tests
- `test:financial` - Financial/treasury logic tests
- `test:ci` - CI/CD optimized tests

**Coverage:** Comprehensive unit and integration tests for all modules

---

## Development Workflow

```bash
cd automaton
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm dev              # Development watch mode
pnpm test             # Run all tests
pnpm test:coverage    # Coverage report
```

---

## Deployment Considerations

- **Runtime:** Node.js >= 20.0.0
- **Database:** SQLite file (embedded, no external DB needed)
- **Storage:** File system for config, state, and wallet
- **Networking:** Conway API, Ethereum RPC, LLM providers
- **Monitoring:** Built-in logger with log levels

---

## Future Enhancements

1. **Multi-Agent Support:** Multiple automatons in same process
2. **Social Layer:** Multi-agent communication and collaboration
3. **Advanced Self-Mod:** More sophisticated code generation
4. **Plugin System:** Third-party skill packages
5. **Web UI:** Dashboard for monitoring and control

---

_This architecture document was generated by the BMAD `document-project` workflow_
