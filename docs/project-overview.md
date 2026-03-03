# JD - Project Overview

**Date:** 2026-03-03
**Type:** Monorepo (Multi-Part Web Project)
**Architecture:** Multi-Agent Autonomous Systems

---

## Executive Summary

**JD** is a multi-project monorepo housing two sophisticated autonomous AI agent systems:

1. **Conway Automaton** - A sovereign, self-replicating AI agent runtime with Web3 integration, multi-layer memory systems, and policy-based safety controls. Designed for autonomous operation with financial capabilities and code self-modification.

2. **TinyClaw** - A multi-team, multi-channel 24/7 AI assistant platform supporting Discord, Telegram, WhatsApp, and Feishu (Lark). Features a Next.js control panel (TinyOffice) for team orchestration and agent management.

Both projects implement advanced AI agent architectures with persistent memory, autonomous decision-making, and multi-channel communication capabilities.

---

## Project Classification

- **Repository Type:** Monorepo
- **Project Type(s):** Web (Backend + Frontend)
- **Primary Language(s):** TypeScript
- **Architecture Pattern:** Multi-Agent System, Microservices-inspired

---

## Multi-Part Structure

This project consists of **2** distinct parts:

### Conway Automaton

- **Type:** Backend Web Application (AI Agent Runtime)
- **Location:** `automaton/`
- **Purpose:** Sovereign AI agent runtime with Web3 integration, Conway API billing, and self-modification capabilities
- **Tech Stack:** TypeScript, Express, OpenAI, viem (Ethereum), better-sqlite3, pnpm

### TinyClaw

- **Type:** Full-Stack Web Application (Multi-Channel Assistant)
- **Location:** `tinyclaw/`
- **Purpose:** Multi-team personal assistant with Discord, Telegram, WhatsApp, and Feishu integration
- **Tech Stack:** TypeScript, Hono (backend), Next.js 16 + React 19 (frontend), Tailwind CSS 4, Radix UI

---

## How Parts Integrate

While **Automaton** and **TinyClaw** are architecturally independent and can operate separately, they share common design philosophies:

1. **Agent-Centric Architecture:** Both implement autonomous AI agent systems
2. **Persistent Memory:** Both use better-sqlite3 for state persistence
3. **TypeScript Ecosystem:** Consistent language and tooling
4. **LLM Integration:** Both leverage large language models for intelligence

**Integration Points:**

- Shared understanding of agent patterns and best practices
- Common infrastructure patterns (SQLite, TypeScript, npm/pnpm)
- Conceptual alignment on autonomous system design
- Potential for cross-project agent collaboration (future)

---

## Technology Stack Summary

### Conway Automaton Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Language | TypeScript | Type-safe development |
| Framework | Express.js | Web server and API |
| Database | better-sqlite3 | Embedded persistent storage |
| AI/ML | OpenAI API | Language model inference |
| Web3 | viem, SIWE | Ethereum wallet and auth |
| Build | tsc, pnpm | Compilation and dependencies |
| Testing | vitest | Unit and integration tests |
| Security | Injection defense, Policy rules | Runtime safety |

### TinyClaw Backend Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Language | TypeScript | Type-safe development |
| Framework | Hono | Lightweight web framework |
| Database | better-sqlite3 | Agent state persistence |
| Channels | Discord.js, Telegram Bot API, WhatsApp Web.js, Feishu SDK | Multi-platform messaging |
| Build | tsc, npm | Compilation and dependencies |

### TinyOffice Frontend Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Framework | Next.js 16 | React SSR framework |
| UI Library | React 19 | Component library |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Components | Radix UI | Accessible UI primitives |
| Routing | Next.js App Router | File-based routing |

---

## Key Features

### Automaton Features

- ✅ **Autonomous Agent Runtime:** Self-directing AI agent loop
- ✅ **Multi-Layer Memory:** Episodic, semantic, working, and procedural memory systems
- ✅ **Web3 Integration:** Ethereum wallet support and SIWE authentication
- ✅ **Conway API:** Real-time billing and credit management
- ✅ **Code Self-Modification:** Safe, audited code generation and updates
- ✅ **Policy Enforcement:** Runtime validation, rate limiting, and security rules
- ✅ **Budget Management:** Credit tracking and spending controls
- ✅ **Injection Defense:** Protection against prompt injection attacks
- ✅ **CLI Interface:** Command-line management tools
- ✅ **Agent Context Aggregation:** Multi-source context management

### TinyClaw Features

- ✅ **Multi-Channel Support:** Discord, Telegram, WhatsApp, Feishu (Lark)
- ✅ **Team Orchestration:** Multi-agent team coordination
- ✅ **24/7 Operation:** Persistent background processing
- ✅ **State Persistence:** SQLite-backed conversation history
- ✅ **Next.js Control Panel:** Web-based management interface
- ✅ **Real-time Updates:** WebSocket-enabled live interface
- ✅ **Agent Management:** Create, configure, and monitor agents
- ✅ **Task Tracking:** Monitor and manage agent tasks
- ✅ **Activity Logging:** Comprehensive audit trail
- ✅ **Configuration Management:** Centralized settings

---

## Architecture Highlights

### Automaton Architecture

```
┌─────────────────────────────────────────────────┐
│           Conway Automaton Runtime              │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐                               │
│  │   Agent Loop │◄───► Policy Rules (Safety)   │
│  └──────┬───────┘                               │
│         │                                        │
│  ┌──────▼────────────────────────────────────┐  │
│  │         Context Manager                    │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Working Memory (Active Context)    │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Episodic Memory (Event History)    │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Semantic Memory (Knowledge Base)   │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Procedural Memory (Skills)         │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └──────────────┬────────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼────────────────────────────┐  │
│  │         Tool Manager                       │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Self-Modification (Code Gen)      │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Conway API (Billing/Credits)      │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Identity (Wallet/Provision)       │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └──────────────┬────────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼────────────────────────────┐  │
│  │         SQLite Database                    │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Key Components:**

- **Agent Loop:** Continuous autonomous operation cycle
- **Multi-Layer Memory:** Hierarchical memory architecture for different data types
- **Context Manager:** Aggregates and manages agent context from multiple sources
- **Tool Manager:** Orchestrates available capabilities (self-mod, billing, identity)
- **Policy Enforcement:** Runtime safety rules and validation

### TinyClaw Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      TinyClaw Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                TinyOffice (Frontend)                 │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Next.js + React 19 + Tailwind + Radix UI      │  │  │
│  │  ├────────────────────────────────────────────────┤  │  │
│  │  │  Pages: Agents, Teams, Tasks, Chat, Console    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │ (HTTP/WebSocket)                     │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │              Hono Backend API                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  REST API + WebSocket Endpoints                │  │  │
│  │  └──────────────────┬─────────────────────────────┘  │  │
│                       │                                   │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │              Team Orchestrator                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Multi-Agent Coordination & State Management   │  │  │
│  │  └──────────────────┬─────────────────────────────┘  │  │
│                       │                                   │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │         Multi-Channel Gateway                        │  │
│  │  ┌──────────────┬──────────────┬──────────────┬───┐  │  │
│  │  │  Discord.js  │  Telegram    │  WhatsApp    │...│  │  │
│  │  └──────────────┴──────────────┴──────────────┴───┘  │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                      │
│  ┌───────────────────▼──────────────────────────────────┐  │
│  │              SQLite Database                         │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Agent State, Conversations, Teams, Tasks      │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

- **TinyOffice:** React-based web control panel for management
- **Hono Backend:** REST API and WebSocket server
- **Team Orchestrator:** Coordinates multiple agents and manages state
- **Multi-Channel Gateway:** Unified interface for Discord, Telegram, WhatsApp, Feishu
- **SQLite Database:** Persistent storage for all state

---

## Development Overview

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (for automaton)
- **npm** (for tinyclaw and tinyoffice)

### Getting Started

#### Automaton

```bash
cd automaton
pnpm install
pnpm build
pnpm dev
```

#### TinyClaw Backend

```bash
cd tinyclaw
npm install
npm run build
npm run discord      # or telegram, whatsapp, feishu
```

#### TinyOffice Frontend

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # http://localhost:3000
```

### Key Commands

#### Automaton

- **Install:** `pnpm install`
- **Dev:** `pnpm dev`
- **Build:** `pnpm build`
- **Test:** `pnpm test`
- **Test Coverage:** `pnpm test:coverage`

#### TinyClaw

- **Install:** `npm install`
- **Build:** `npm build`
- **Discord:** `npm run discord`
- **Telegram:** `npm run telegram`
- **WhatsApp:** `npm run whatsapp`
- **Feishu:** `npm run feishu`

#### TinyOffice

- **Install:** `cd tinyoffice && npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Start:** `npm run start`

---

## Repository Structure

```
jd/
├── automaton/              # Conway Automaton - AI Agent Runtime
│   ├── src/                # TypeScript source (agent, memory, conway, identity, self-mod)
│   ├── packages/cli/       # CLI package
│   ├── tests/              # Test suite
│   └── dist/               # Compiled output
│
├── tinyclaw/               # TinyClaw - Multi-Team Assistant
│   ├── src/                # Backend source (agents, channels, state, team)
│   ├── tinyoffice/         # Next.js frontend
│   │   ├── app/            # Pages (agents, teams, tasks, chat, console)
│   │   └── src/lib/        # Shared code
│   ├── examples/           # Usage examples
│   └── dist/               # Backend compiled output
│
├── docs/                 # Design documents and PRDs
├── docs/                   # Auto-generated documentation (this folder)
└── CLAUDE.md              # Project guidelines
```

---

## Documentation Map

For detailed information, see:

- [index.md](./index.md) - Master documentation index
- [architecture-automaton.md](./architecture-automaton.md) - Conway Automaton architecture details
- [architecture-tinyclaw.md](./architecture-tinyclaw.md) - TinyClaw architecture details
- [source-tree-analysis.md](./source-tree-analysis.md) - Directory structure (completed)
- [development-guide-automaton.md](./development-guide-automaton.md) - Automaton development
- [development-guide-tinyclaw.md](./development-guide-tinyclaw.md) - TinyClaw development
- [component-inventory-automaton.md](./component-inventory-automaton.md) - Automaton components
- [component-inventory-tinyclaw.md](./component-inventory-tinyclaw.md) - TinyClaw components

---

_This project overview was generated by the BMAD `document-project` workflow_
