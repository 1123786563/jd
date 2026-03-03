# Conway Automaton - Component Inventory

**Part:** automaton
**Last Updated:** 2026-03-03

---

## Overview

This document catalogs all major components in Conway Automaton, including their purpose, location, dependencies, and key interfaces.

---

## Core Runtime Components

### 1. Agent Loop
**File:** `src/agent/loop.ts`
**Purpose:** Core ReAct execution loop - the agent's consciousness
**Key Functions:**
- `runAgentLoop(options)` - Main execution function
- Manages turn-based conversation flow
- Enforces policy rules and budget limits
**Dependencies:** context.ts, tools.ts, policy-engine.ts, injection-defense.ts
**Interfaces:** AgentLoopOptions, AgentState, AgentTurn

### 2. Context Manager
**File:** `src/memory/context-manager.ts`
**Purpose:** Aggregate and manage context from all memory layers
**Key Functions:**
- `buildContextMessages()` - Build messages array for LLM
- `trimContext()` - Trim context to token limit
- Token counting and budgeting
**Dependencies:** working.ts, episodic.ts, semantic.ts, procedural.ts
**Interfaces:** ContextManager, TokenCounter

### 3. Policy Engine
**File:** `src/agent/policy-engine.ts`
**Purpose:** Runtime safety rule enforcement
**Key Functions:**
- `validate(state)` - Run all policy rules
- `registerRule(rule)` - Add custom rule
- `removeRule(name)` - Remove rule
**Dependencies:** policy-rules/validation.ts, rate-limits.ts, path-protection.ts
**Interfaces:** PolicyEngine, PolicyRule

---

## Memory System Components

### 4. Working Memory
**File:** `src/memory/working.ts`
**Purpose:** Active context for current conversation turn
**Key Functions:**
- Store recent messages and active goals
- Session-scoped (cleared between turns)
- Fast in-memory access
**Dependencies:** None
**Interfaces:** WorkingMemory

### 5. Episodic Memory
**File:** `src/memory/episodic.ts`
**Purpose:** Persistent event history and conversation transcripts
**Key Functions:**
- `storeEvent(event)` - Save event to database
- `retrieveEvents(query)` - Query events by time/type
- `getConversationHistory()` - Get full conversation
**Dependencies:** database.ts
**Interfaces:** EpisodicMemory, MemoryEvent

### 6. Semantic Memory
**File:** `src/memory/semantic.ts`
**Purpose:** Knowledge base with vector similarity search
**Key Functions:**
- `storeKnowledge(knowledge)` - Add knowledge with embeddings
- `searchKnowledge(query)` - Semantic similarity search
- `updateKnowledge(id, data)` - Update existing knowledge
**Dependencies:** knowledge-store.ts, embeddings (via inference)
**Interfaces:** SemanticMemory, KnowledgeBlock

### 7. Procedural Memory
**File:** `src/memory/procedural.ts`
**Purpose:** Skills, tools, and how-to knowledge
**Key Functions:**
- `registerSkill(skill)` - Add new skill
- `getSkill(name)` - Retrieve skill by name
- `listSkills()` - Get all available skills
**Dependencies:** tools.ts
**Interfaces:** ProceduralMemory, Skill

### 8. Knowledge Store
**File:** `src/memory/knowledge-store.ts`
**Purpose:** Unified storage for semantic knowledge
**Key Functions:**
- Persistent storage with SQLite
- Embedding caching
- Deduplication and merging
**Dependencies:** database.ts, inference.ts (for embeddings)
**Interfaces:** KnowledgeStore

### 9. Memory Retriever
**File:** `src/memory/retrieval.ts`
**Purpose:** Intelligent memory retrieval strategies
**Key Functions:**
- `retrieveRelevant(context)` - Get relevant memories
- `hybridSearch(query)` - Combine keyword + semantic search
- Relevance scoring and ranking
**Dependencies:** semantic.ts, episodic.ts
**Interfaces:** MemoryRetriever

### 10. Memory Ingestion Pipeline
**File:** `src/memory/ingestion.ts`
**Purpose:** Process and store new knowledge
**Key Functions:**
- `ingest(text)` - Process and store knowledge
- `extractEntities(text)` - Extract named entities
- `chunkAndEmbed(text)` - Chunk text and generate embeddings
**Dependencies:** knowledge-store.ts, inference.ts
**Interfaces:** MemoryIngestionPipeline

### 11. Compression Engine
**File:** `src/memory/compression-engine.ts`
**Purpose:** Compress long conversations and memories
**Key Functions:**
- `summarizeConversation()` - Summarize long conversation
- `compressMemory()` - Lossy compression of old memories
- Retention policies
**Dependencies:** inference.ts (for summarization)
**Interfaces:** CompressionEngine

### 12. Event Stream
**File:** `src/memory/event-stream.ts`
**Purpose:** Event-based memory updates
**Key Functions:**
- `onEvent(event)` - Handle memory events
- `subscribe(listener)` - Subscribe to events
- Event batching and debouncing
**Dependencies:** None
**Interfaces:** EventStream

---

## Identity & Web3 Components

### 13. Wallet Manager
**File:** `src/identity/wallet.ts`
**Purpose:** Ethereum wallet generation and management
**Key Functions:**
- `getWallet()` - Get or create wallet
- `getAutomatonDir()` - Get config directory path
- `signMessage(message)` - Sign message with wallet
**Dependencies:** viem, siwe
**Interfaces:** AutomatonIdentity

### 14. Provision Manager
**File:** `src/identity/provision.ts`
**Purpose:** Conway API key provisioning via SIWE
**Key Functions:**
- `provision()` - Provision API key via SIWE
- `loadApiKeyFromConfig()` - Load existing key
- Blockchain identity verification
**Dependencies:** wallet.ts, conway/client.ts
**Interfaces:** None

---

## Conway API Components

### 15. Conway Client
**File:** `src/conway/client.ts`
**Purpose:** Conway API HTTP client
**Key Functions:**
- `request(endpoint, data)` - Make authenticated request
- Request signing and retries
- Error handling
**Dependencies:** fetch (or axios)
**Interfaces:** ConwayClient

### 16. Credits Manager
**File:** `src/conway/credits.ts`
**Purpose:** Credit balance tracking
**Key Functions:**
- `getCreditBalance()` - Get current balance
- `getSurvivalTier()` - Determine survival tier
- Budget calculations
**Dependencies:** client.ts
**Interfaces:** None

### 17. X402 Payment Handler
**File:** `src/conway/x402.ts`
**Purpose:** USDC balance and payment processing
**Key Functions:**
- `getUsdcBalance()` - Get USDC balance
- `processInvoice(invoice)` - Process payment
- Payment protocol handling
**Dependencies:** client.ts, viem (for blockchain)
**Interfaces:** None

### 18. Inference Client
**File:** `src/conway/inference.ts`
**Purpose:** Inference API integration
**Key Functions:**
- `createInferenceClient()` - Create client instance
- `inference(model, messages)` - Call LLM
- Cost tracking
**Dependencies:** client.ts, openai SDK
**Interfaces:** InferenceClient

### 19. Top-up Manager
**File:** `src/conway/topup.ts`
**Purpose:** Automated credit top-up
**Key Functions:**
- `bootstrapTopup()` - Initialize top-up
- `monitorBalance()` - Monitor and auto-top-up
- Payment processing
**Dependencies:** credits.ts, x402.ts
**Interfaces:** None

---

## Self-Modification Components

### 20. Code Generator
**File:** `src/self-mod/code.ts`
**Purpose:** Safe code generation and modification
**Key Functions:**
- `generateCode(prompt)` - Generate code from prompt
- `modifyFile(path, changes)` - Modify file safely
- Syntax validation
**Dependencies:** inference.ts, audit-log.ts
**Interfaces:** None

### 21. Tools Manager
**File:** `src/self-mod/tools-manager.ts`
**Purpose:** Dynamic tool registration and lifecycle
**Key Functions:**
- `registerTool(tool)` - Register new tool
- `unregisterTool(name)` - Remove tool
- `listTools()` - Get all tools
**Dependencies:** tools.ts
**Interfaces:** ToolsManager

### 22. Upstream Manager
**File:** `src/self-mod/upstream.ts`
**Purpose:** Git integration for code versioning
**Key Functions:**
- `commitChanges(message)` - Commit changes
- `createPR(branch, title)` - Create pull request
- `pushToRemote()` - Push to remote repo
**Dependencies:** simple-git
**Interfaces:** None

### 23. Audit Logger
**File:** `src/self-mod/audit-log.ts`
**Purpose:** Log all code changes for rollback
**Key Functions:**
- `logChange(change)` - Log change
- `getChangeHistory()` - Get history
- `rollbackTo(version)` - Rollback
**Dependencies:** database.ts
**Interfaces:** AuditLog

---

## Inference Components

### 24. Model Registry
**File:** `src/inference/registry.ts`
**Purpose:** Multi-provider model registration
**Key Functions:**
- `registerProvider(provider)` - Add provider
- `getModel(modelName)` - Get model config
- `listModels()` - List all models
**Dependencies:** provider-registry.ts
**Interfaces:** ModelRegistry

### 25. Budget Tracker
**File:** `src/inference/budget.ts`
**Purpose:** Credit tracking and spend limits
**Key Functions:**
- `trackSpend(amount)` - Track spend
- `checkBudget()` - Check if within limits
- `setLimit(limit)` - Set spend limit
**Dependencies:** conway/credits.ts
**Interfaces:** InferenceBudgetTracker

### 26. Inference Router
**File:** `src/inference/router.ts`
**Purpose:** Intelligent model selection and routing
**Key Functions:**
- `route(model, messages)` - Route to best provider
- Fallback strategies
- Load balancing
**Dependencies:** registry.ts, budget.ts
**Interfaces:** InferenceRouter

### 27. Provider Registry
**File:** `src/inference/provider-registry.ts`
**Purpose:** Provider configuration and health monitoring
**Key Functions:**
- `addProvider(config)` - Add provider
- `checkHealth(provider)` - Health check
- Automatic failover
**Dependencies:** None
**Interfaces:** ProviderRegistry

---

## Persistence Components

### 28. Database Manager
**File:** `src/state/database.ts`
**Purpose:** SQLite database layer
**Key Functions:**
- `createDatabase()` - Initialize database
- `query(sql, params)` - Execute query
- Schema migrations
**Dependencies:** better-sqlite3
**Interfaces:** AutomatonDatabase

**Tables:**
- `agent_state` - Current agent state
- `agent_turns` - Conversation history
- `memory_blocks` - Memory storage
- `wake_events` - Scheduled events
- `inbox_messages` - Pending messages
- `audit_log` - Self-mod audit trail
- `spend_tracker` - Financial transactions

---

## Setup & Configuration Components

### 29. Setup Wizard
**File:** `src/setup/wizard.ts`
**Purpose:** Interactive first-run setup
**Key Functions:**
- Interactive CLI prompts
- Provider configuration
- Model selection
- Treasury setup
**Dependencies:** prompts.ts, configure.ts, model-picker.ts
**Interfaces:** None

### 30. Configuration Manager
**File:** `src/setup/configure.ts`
**Purpose:** Configuration editing UI
**Key Functions:**
- `editConfig()` - Interactive config editor
- `saveConfig(config)` - Save config
- `loadConfig()` - Load config
**Dependencies:** environment.ts
**Interfaces:** None

### 31. Model Picker
**File:** `src/setup/model-picker.ts`
**Purpose:** Interactive model selection
**Key Functions:**
- Display available models
- Cost estimation
- Provider comparison
**Dependencies:** registry.ts
**Interfaces:** None

### 32. Environment Loader
**File:** `src/setup/environment.ts`
**Purpose:** Environment variable and config loading
**Key Functions:**
- `loadEnvironment()` - Load env vars
- `parseConfigFile()` - Parse config file
- Default value resolution
**Dependencies:** None
**Interfaces:** None

---

## Orchestration Components

### 33. Orchestrator
**File:** `src/orchestration/orchestrator.ts`
**Purpose:** Multi-agent orchestration
**Key Functions:**
- Coordinate multiple agents
- Resource allocation
- Load balancing
**Dependencies:** None
**Interfaces:** Orchestrator

### 34. Plan Mode Controller
**File:** `src/orchestration/plan-mode.ts`
**Purpose:** Plan-and-execute mode
**Key Functions:**
- Create execution plans
- Step-by-step execution
- Plan validation
**Dependencies:** None
**Interfaces:** PlanModeController

### 35. Attention Manager
**File:** `src/orchestration/attention.ts`
**Purpose:** Attention and TODO management
**Key Functions:**
- `generateTodoMd()` - Generate TODO list
- `injectTodoContext()` - Inject TODOs into context
- Priority management
**Dependencies:** None
**Interfaces:** None

### 36. Messaging System
**File:** `src/orchestration/messaging.ts`
**Purpose:** Inter-agent messaging
**Key Functions:**
- `sendMessage(to, from, message)` - Send message
- Message queue and routing
- Local transport implementation
**Dependencies:** None
**Interfaces:** ColonyMessaging, LocalDBTransport

### 37. Worker Pool
**File:** `src/orchestration/local-worker.ts`
**Purpose:** Local worker thread pool
**Key Functions:**
- `executeTask(task)` - Execute in worker
- Worker lifecycle management
- Task queueing
**Dependencies:** None
**Interfaces:** LocalWorkerPool

### 38. Agent Tracker
**File:** `src/orchestration/simple-tracker.ts`
**Purpose:** Simple agent tracking and funding
**Key Functions:**
- Track agent state
- Manage funding
- Simple protocol implementation
**Dependencies:** None
**Interfaces:** SimpleAgentTracker, SimpleFundingProtocol

---

## Observability Components

### 39. Logger
**File:** `src/observability/logger.ts`
**Purpose:** Structured logging
**Key Functions:**
- `createLogger(name)` - Create named logger
- `setGlobalLogLevel(level)` - Set global level
- Log to file and console
**Dependencies:** fs, path
**Interfaces:** Logger

---

## CLI Components

### 40. CLI Package
**Location:** `packages/cli/src/`
**Purpose:** Command-line interface
**Commands:**
- `status.ts` - Show agent status
- `logs.ts` - View logs
- `send.ts` - Send message to agent
- `fund.ts` - Fund treasury

---

## Key Patterns

### ReAct Loop Pattern
Think → Act → Observe → Persist

### Multi-Layer Memory Pattern
Working + Episodic + Semantic + Procedural

### Policy-Driven Safety Pattern
Validation → Rate Limit → Path Protection → Budget Check

### Self-Modification with Audit Pattern
Generate → Validate → Log → Commit

---

_This component inventory was generated by the BMAD `document-project` workflow_
