# JD Documentation Index

**Type:** Monorepo with 2 parts
**Primary Language:** TypeScript
**Architecture:** Multi-Agent Autonomous Systems
**Last Updated:** 2026-03-03

---

## Project Overview

**JD** is a multi-project monorepo housing two sophisticated autonomous AI agent systems. This documentation provides comprehensive context for AI-assisted development and understanding of both projects.

The repository contains:

1. **Conway Automaton** - Sovereign AI agent runtime with Web3 and self-modification capabilities
2. **TinyClaw** - Multi-team, multi-channel 24/7 AI assistant platform with web control panel

Both projects implement advanced agent architectures with persistent memory, autonomous decision-making, and multi-channel communication.

---

## Project Structure

This project consists of **2** parts:

### Conway Automaton (automaton)

- **Type:** Backend Web Application (AI Agent Runtime)
- **Location:** `automaton/`
- **Tech Stack:** TypeScript, Express, OpenAI, viem (Ethereum), better-sqlite3, pnpm
- **Entry Point:** `src/index.ts`
- **Purpose:** Sovereign AI agent runtime with Web3 integration, Conway API billing, and self-modification

### TinyClaw (tinyclaw)

- **Type:** Full-Stack Web Application (Multi-Channel Assistant)
- **Location:** `tinyclaw/`
- **Tech Stack:** TypeScript, Hono (backend), Next.js 16 + React 19 (frontend), Tailwind CSS 4, Radix UI
- **Entry Point:** `src/index.ts` (backend), `tinyoffice/app/page.tsx` (frontend)
- **Purpose:** Multi-team personal assistant with Discord, Telegram, WhatsApp, and Feishu integration

---

## Cross-Part Integration

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

## Quick Reference

### Conway Automaton Quick Ref

- **Stack:** TypeScript, Express, OpenAI, viem, better-sqlite3
- **Entry:** `src/index.ts`
- **Pattern:** Autonomous agent runtime with multi-layer memory
- **Database:** SQLite (better-sqlite3)
- **Deployment:** Node.js server

### TinyClaw Quick Ref

- **Stack:** TypeScript, Hono, Discord.js, Telegram API, WhatsApp, Next.js 16, React 19
- **Entry:** Backend: `src/index.ts`, Frontend: `tinyoffice/app/page.tsx`
- **Pattern:** Multi-channel messaging platform with team orchestration
- **Database:** SQLite (better-sqlite3)
- **Deployment:** Node.js backend + Next.js frontend

---

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) - Executive summary and high-level architecture
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory structure

### Part-Specific Documentation

#### Conway Automaton (automaton)

- [Architecture](./architecture-automaton.md) - Technical architecture for Conway Automaton
- [Components](./component-inventory-automaton.md) - Component catalog
- [Development Guide](./development-guide-automaton.md) - Setup and dev workflow

#### TinyClaw (tinyclaw)

- [Architecture](./architecture-tinyclaw.md) - Technical architecture for TinyClaw
- [Components](./component-inventory-tinyclaw.md) - Component catalog
- [Development Guide](./development-guide-tinyclaw.md) - Setup and dev workflow

### Integration

- [Integration Architecture](./integration-architecture.md) - How parts communicate
- [Project Parts Metadata](./project-parts.json) - Machine-readable structure

---

## Existing Documentation

### Conway Automaton

- [automaton/AGENTS.md](../automaton/AGENTS.md) - Agent configuration and system overview
- [automaton/CLAUDE.md](../automaton/CLAUDE.md) - Automaton project guidelines
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Architecture documentation

### TinyClaw

- [tinyclaw/ARCHITECTURE.md](../tinyclaw/ARCHITECTURE.md) - Architecture documentation
- [tinyclaw/DOCUMENTATION.md](../tinyclaw/DOCUMENTATION.md) - Project documentation
- [tinyclaw/CONFIG_GUIDE.md](../tinyclaw/CONFIG_GUIDE.md) - Configuration guide
- [tinyclaw/constitution.md](../tinyclaw/constitution.md) - Agent constitution
- [tinyclaw/CLAUDE.md](../tinyclaw/CLAUDE.md) - TinyClaw project guidelines

### Project-Level

- [CLAUDE.md](../CLAUDE.md) - JD project guidelines
- [docs/](../docs/) - Design documents and PRDs

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (for automaton)
- **npm** (for tinyclaw and tinyoffice)

### Conway Automaton Setup

**Install & Run:**

```bash
cd automaton
pnpm install
pnpm build
pnpm dev
```

**Key Commands:**

- `pnpm dev` - Development mode with hot reload
- `pnpm build` - Compile TypeScript
- `pnpm test` - Run test suite
- `pnpm test:coverage` - Run with coverage report

### TinyClaw Setup

**Backend:**

```bash
cd tinyclaw
npm install
npm run build
npm run discord      # or telegram, whatsapp, feishu
```

**Frontend (TinyOffice):**

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # Starts at http://localhost:3000
```

**Key Commands:**

- `npm run build` - Compile backend
- `npm run discord` - Start Discord client
- `npm run telegram` - Start Telegram client
- `npm run whatsapp` - Start WhatsApp client
- `npm run feishu` - Start Feishu client
- `npm run dev` (in tinyoffice) - Start frontend dev server

---

## For AI-Assisted Development

This documentation was generated specifically to enable AI agents to understand and extend this codebase.

### When Planning New Features

**UI-only features:**
→ Reference: `architecture-tinyclaw.md`, `component-inventory-tinyclaw.md`

**API/Backend features:**
→ Reference: `architecture-automaton.md`, `architecture-tinyclaw.md`

**Full-stack features:**
→ Reference: All architecture docs + `integration-architecture.md`

**Agent system enhancements:**
→ Reference: `architecture-automaton.md` (memory systems, policy rules, self-mod)
→ Reference: `architecture-tinyclaw.md` (team orchestration, channels, state)

**Multi-channel features:**
→ Reference: `architecture-tinyclaw.md`, `component-inventory-tinyclaw.md`

---

## Documentation Status

✅ **Completed:**

- [x] Project Overview
- [x] Source Tree Analysis
- [x] Architecture (automaton)
- [x] Architecture (tinyclaw)
- [x] Component Inventory (automaton)
- [x] Component Inventory (tinyclaw)
- [x] Development Guide (automaton)
- [x] Development Guide (tinyclaw)
- [x] Integration Architecture
- [x] Master Index (this file)

**Scan Level:** Exhaustive
**Workflow Mode:** initial_scan
**Last Updated:** 2026-03-03
**Total Files Generated:** 10
**Total Lines Documented:** 5000+

---

_This index was generated by the BMAD `document-project` workflow_
