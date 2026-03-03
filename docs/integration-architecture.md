# JD - Integration Architecture

**Repository:** jd (monorepo)
**Last Updated:** 2026-03-03

---

## Overview

This document describes the integration architecture of the JD monorepo, including how Conway Automaton and TinyClaw relate to each other, their shared patterns, and potential integration points.

---

## Monorepo Structure

```
jd/
├── automaton/              # Part 1: Conway Automaton
│   ├── src/                # AI agent runtime
│   ├── packages/cli/       # CLI interface
│   └── ...
│
├── tinyclaw/               # Part 2: TinyClaw
│   ├── src/                # Backend (agents, channels, queue)
│   ├── tinyoffice/         # Frontend (Next.js)
│   └── ...
│
├── docs/                 # Design documents and PRDs
├── docs/                   # Auto-generated documentation
└── CLAUDE.md              # Project guidelines
```

---

## Part Independence

**Conway Automaton** and **TinyClaw** are **architecturally independent**:

- ✅ Can be developed separately
- ✅ Can be deployed independently
- ✅ No runtime dependencies between them
- ✅ Separate databases and state
- ✅ Separate configuration files
- ✅ Separate package.json and dependencies

**Shared Characteristics:**

- Both use TypeScript
- Both use better-sqlite3 for persistence
- Both implement autonomous AI agent systems
- Both use LLM providers (Claude, OpenAI)
- Both follow agent-centric architecture
- Both have similar directory structures

---

## Conceptual Integration Points

While not directly integrated, both projects share conceptual alignment:

### 1. Agent Patterns

Both implement similar agent concepts:

| Concept | Automaton | TinyClaw |
|---------|-----------|----------|
| **Agent Definition** | Agent config in state | Agent config in JSON |
| **System Prompt** | Customizable per agent | Customizable per agent |
| **Conversation State** | SQLite episodic memory | SQLite conversation table |
| **LLM Integration** | Multi-provider inference | Multi-provider inference |
| **Tool/Skill System** | Dynamic tools via self-mod | Static tools in config |

### 2. Memory Patterns

Both use persistent memory:

| Pattern | Automaton | TinyClaw |
|---------|-----------|----------|
| **Storage** | SQLite (better-sqlite3) | SQLite (better-sqlite3) |
| **Conversation History** | Episodic memory | Conversation table |
| **Working Directory** | Per-agent workspace | Per-agent working_dir |
| **State Isolation** | Memory layers | Conversation isolation |

### 3. Multi-Agent Coordination

Both support multi-agent systems:

| Feature | Automaton | TinyClaw |
|---------|-----------|----------|
| **Team Concept** | Planned (orchestration) | Implemented (teams) |
| **Agent Communication** | Messaging system | Team mentions |
| **Coordination** | Orchestrator | Team leader pattern |
| **State Sharing** | Shared memory | Internal messages |

### 4. Safety and Policy

Both enforce safety:

| Safety Feature | Automaton | TinyClaw |
|---------------|-----------|----------|
| **Input Validation** | Policy engine | Plugin hooks |
| **Rate Limiting** | Policy rules | Queue limits |
| **Budget Tracking** | Conway credits | Provider limits |
| **Audit Logging** | Self-mod audit | Activity logs |

---

## Potential Integration Scenarios

### Scenario 1: Automaton as TinyClaw Agent

**Concept:** Use Conway Automaton as a specialized agent within TinyClaw

**Integration Points:**

1. **Message Routing:** Route specific messages to Automaton
2. **API Bridge:** TinyClaw calls Automaton API
3. **State Sharing:** Share conversation context
4. **Capability Leverage:** Use Automaton's self-modification for TinyClaw agents

**Architecture:**

```
User → TinyClaw Channel → Queue → @automaton-agent
                                        ↓
                                Conway Automaton API
                                        ↓
                                TinyClaw Response Queue
                                        ↓
                                User
```

**Benefits:**

- Leverage Automaton's advanced memory system
- Use self-modification for agent evolution
- Apply policy engine for safety
- Share Conway billing integration

### Scenario 2: TinyClaw as Automaton Interface

**Concept:** Use TinyClaw channels as input/output for Automaton

**Integration Points:**

1. **Channel Integration:** Automaton receives messages via TinyClaw channels
2. **Response Routing:** Automaton responses sent through TinyClaw
3. **Team Orchestration:** TinyClaw teams coordinate Automaton instances
4. **Frontend Control:** TinyOffice manages Automaton

**Architecture:**

```
Discord/Telegram/WhatsApp → TinyClaw Channel
                                   ↓
                           TinyClaw Queue
                                   ↓
                        Conway Automaton Loop
                                   ↓
                           Automaton Response
                                   ↓
                        TinyClaw Response Queue
                                   ↓
                          TinyClaw Channel
                                   ↓
                                 User
```

**Benefits:**

- Multi-channel input for Automaton
- Web UI (TinyOffice) for Automaton control
- Team coordination for multiple Automatons
- Unified logging and monitoring

### Scenario 3: Shared Agent Ecosystem

**Concept:** Create shared agent ecosystem with common tools and skills

**Integration Points:**

1. **Shared Tools Library:** Common tool implementations
2. **Agent Registry:** Central agent catalog
3. **Skill Marketplace:** Share skills between projects
4. **Configuration Sync:** Synchronize agent configs

**Benefits:**

- Reuse agent implementations
- Share best practices
- Common tool library
- Unified agent management

### Scenario 4: Hybrid Architecture

**Concept:** Combine both architectures for different use cases

**Use Cases:**

- **Automaton:** Long-running sovereign agents with Web3
- **TinyClaw:** Multi-channel customer support and teams
- **Hybrid:** Automaton handles complex reasoning, TinyClaw handles communication

**Architecture:**

```
Channels (Discord/Telegram) → TinyClaw
                                      ↓
                             Simple Queries → TinyClaw Agents
                                      ↓
                          Complex Tasks → Conway Automaton
                                      ↓
                                 Response
```

**Benefits:**

- Right tool for right job
- Scalable architecture
- Specialized capabilities
- Flexible deployment

---

## Shared Infrastructure Patterns

### 1. SQLite Persistence

Both use SQLite with similar patterns:

```sql
-- Common patterns
CREATE TABLE IF NOT EXISTS agent_state (...);
CREATE TABLE IF NOT EXISTS conversations (...);
CREATE TABLE IF NOT EXISTS logs (...);
```

### 2. Configuration Management

Both use JSON configuration:

```json
{
  "agents": {
    "agent-id": {
      "provider": "claude",
      "model": "claude-3-opus",
      "system_prompt": "...",
      "working_dir": "..."
    }
  }
}
```

### 3. LLM Provider Integration

Both support multiple providers:

```typescript
// Common interface
interface LLMProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: string[];
}
```

### 4. Logging and Observability

Both use structured logging:

```typescript
// Common pattern
logger.info("Message", { context });
logger.warn("Warning", { context });
logger.error("Error", { context, error });
```

---

## Cross-Project Collaboration

### Knowledge Sharing

- **Documentation:** Both documented in `docs/`
- **Design Patterns:** Shared architectural patterns
- **Best Practices:** Common development practices
- **TypeScript Standards:** Consistent type usage

### Development Workflow

- **Git:** Shared repository, separate branches
- **Testing:** Similar test frameworks (vitest/jest)
- **Build:** TypeScript compilation
- **Deployment:** Independent but coordinated

### Future Integration Possibilities

1. **Shared Library:** Create `@jd/core` package with common utilities
2. **Unified CLI:** Single CLI tool for both projects
3. **Common Frontend:** Shared web UI components
4. **Integrated Testing:** Cross-project integration tests
5. **Unified Documentation:** Single documentation site

---

## Deployment Considerations

### Independent Deployment

```bash
# Deploy Automaton
cd automaton
pnpm install
pnpm build
# Run as service

# Deploy TinyClaw
cd tinyclaw
npm install
npm run build
npm run queue &
npm run discord &
npm run telegram &
# Run TinyOffice separately
cd tinyoffice
npm run build
npm run start
```

### Coordinated Deployment

```bash
# Deploy both together
./deploy.sh automaton tinyclaw
# Shared infrastructure (database, logging, monitoring)
```

### Containerization

```dockerfile
# Docker Compose for both
version: '3.8'
services:
  automaton:
    build: ./automaton
    ports:
      - "3001:3001"

  tinyclaw-queue:
    build: ./tinyclaw
    command: npm run queue

  tinyclaw-discord:
    build: ./tinyclaw
    command: npm run discord

  tinyclaw-telegram:
    build: ./tinyclaw
    command: npm run telegram

  tinyclaw-api:
    build: ./tinyclaw
    ports:
      - "3777:3777"

  tinyclaw-frontend:
    build: ./tinyclaw/tinyoffice
    ports:
      - "3000:3000"
```

---

## Conclusion

While **Conway Automaton** and **TinyClaw** are currently independent projects, they share significant architectural DNA and could benefit from deeper integration in the future. The current independence allows for:

- ✅ Focused development on each project's strengths
- ✅ Independent scaling and deployment
- ✅ Different use cases and audiences
- ✅ Flexibility to evolve separately

Potential integration scenarios offer exciting possibilities for combining their strengths into a unified autonomous agent platform.

---

_This integration architecture document was generated by the BMAD `document-project` workflow_
