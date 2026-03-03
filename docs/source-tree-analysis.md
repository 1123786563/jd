# Source Tree Analysis

**Generated:** 2026-03-03
**Scan Level:** Exhaustive
**Project Type:** Monorepo (Multi-Part)

---

## Repository Structure

```
jd/
├── automaton/               # Part 1: Conway Automaton - AI Agent Runtime
│   ├── src/                 # TypeScript source code
│   │   ├── agent/           # Core agent logic and policy enforcement
│   │   ├── conway/          # Conway API integration and billing
│   │   ├── identity/        # Wallet and identity management
│   │   ├── memory/          # Memory systems (episodic, semantic, working)
│   │   ├── self-mod/        # Self-modification and code generation
│   │   ├── setup/           # Configuration wizard and defaults
│   │   └── state/           # Database and persistence layer
│   ├── packages/            # Monorepo packages
│   │   └── cli/             # CLI package
│   ├── dist/                # Compiled output
│   ├── tests/               # Test files
│   ├── bin/                 # Executable scripts
│   └── AGENTS.md            # Agent configuration
│
├── tinyclaw/                # Part 2: TinyClaw - Multi-Team Personal Assistant
│   ├── src/                 # TypeScript backend source
│   │   ├── agents/          # Agent implementations
│   │   ├── channels/        # Discord, Telegram, WhatsApp clients
│   │   ├── state/           # Agent state management
│   │   └── team/            # Team orchestration
│   ├── tinyoffice/          # Next.js frontend control panel
│   │   ├── app/             # Next.js app router
│   │   │   ├── agents/      # Agents management UI
│   │   │   ├── teams/       # Teams management UI
│   │   │   ├── tasks/       # Task tracking UI
│   │   │   ├── office/      # Control panel dashboard
│   │   │   └── console/     # System console
│   │   ├── src/             # Frontend source
│   │   │   └── lib/         # Shared frontend/backend code
│   │   └── .next/           # Next.js build output
│   ├── dist/                # Backend compiled output
│   ├── examples/            # Usage examples
│   └── lib/                 # Shared libraries
│
├── docs/                  # Project documentation (design, PRDs, etc.)
└── docs/                    # Auto-generated project documentation (this folder)
```

---

## Part 1: Conway Automaton

### Critical Directories

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/agent/` | Core autonomous agent runtime | `loop.ts`, `context.ts`, `injection-defense.ts`, `policy-rules/` |
| `src/memory/` | Multi-layer memory system | `episodic.ts`, `semantic.ts`, `working.ts`, `knowledge-store.ts` |
| `src/conway/` | Conway API client and billing | `client.ts`, `credits.ts`, `x402.ts`, `topup.ts` |
| `src/identity/` | Web3 wallet and identity | `wallet.ts`, `provision.ts` |
| `src/self-mod/` | Code self-modification | `code.ts`, `tools-manager.ts`, `upstream.ts` |
| `src/state/` | SQLite database layer | `database.ts`, `schema.ts` |
| `packages/cli/` | Command-line interface | `src/commands/*.ts` |
| `tests/` | Unit and integration tests | Test files for all modules |

### Entry Points

- **Main Runtime:** `src/index.ts` (compiled to `dist/index.js`)
- **CLI Tool:** `packages/cli/src/index.ts`
- **Express Server:** `src/server.ts` (inferred from package.json exports)

### Technology Stack

- **Language:** TypeScript
- **Runtime:** Node.js (Express framework)
- **Database:** better-sqlite3 (embedded SQLite)
- **AI:** OpenAI API integration
- **Web3:** viem (Ethereum), SIWE (Sign-In with Ethereum)
- **Package Manager:** pnpm
- **Build Tool:** TypeScript compiler (tsc)
- **Testing:** vitest

---

## Part 2: TinyClaw

### Critical Directories

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/agents/` | AI agent implementations | Various agent files |
| `src/channels/` | Multi-platform messaging | `discord-client.ts`, `telegram-client.ts`, `whatsapp-client.ts`, `feishu-client.ts` |
| `src/state/` | Agent conversation state | State management files |
| `src/team/` | Multi-agent team orchestration | Team coordination logic |
| `tinyoffice/app/` | Next.js frontend pages | React components and pages |
| `tinyoffice/src/lib/` | Shared utilities | Common code |
| `examples/` | Usage examples | Demo files |

### Entry Points

- **Backend Main:** `src/index.ts` (compiled to `dist/index.js`)
- **Frontend:** `tinyoffice/app/page.tsx` (Next.js app entry)
- **Channel Clients:** Individual channel entry points in `dist/channels/`

### Technology Stack

- **Backend Language:** TypeScript
- **Backend Framework:** Hono (web framework)
- **Frontend Framework:** Next.js 16 + React 19
- **Styling:** Tailwind CSS 4, Radix UI
- **Channels:** Discord.js, Telegram Bot API, WhatsApp Web.js, Feishu SDK
- **Database:** better-sqlite3
- **Package Manager:** npm
- **Build Tool:** TypeScript compiler (tsc)

### Frontend Pages

- `/` - Dashboard/Office homepage
- `/agents` - Agent management
- `/teams` - Team configuration
- `/tasks` - Task tracking
- `/chat/agent/[id]` - Individual agent chat
- `/chat/team/[id]` - Team chat interface
- `/console` - System console
- `/logs` - Activity logs
- `/settings` - Configuration settings

---

## Integration Points

### Between Automaton and TinyClaw

While both are independent projects in the monorepo, they share conceptual architecture:

1. **Shared Patterns:** Both use better-sqlite3 for persistence
2. **Agent Philosophy:** Both implement autonomous agent concepts
3. **TypeScript:** Consistent language and tooling
4. **AI Integration:** Both leverage LLM capabilities

### External Integrations

**Automaton:**

- Conway API (billing, credits)
- OpenAI (inference)
- Ethereum blockchain (wallet, transactions)
- Git (code self-modification)

**TinyClaw:**

- Discord API
- Telegram Bot API
- WhatsApp Web
- Feishu (Lark) API

---

## Build and Output Structure

### Automaton

```
automaton/
├── dist/                    # TypeScript output
│   ├── index.js             # Main runtime
│   ├── index.d.ts           # TypeScript definitions
│   ├── agent/
│   ├── memory/
│   ├── conway/
│   ├── identity/
│   ├── self-mod/
│   └── state/
└── node_modules/            # Dependencies (excluded from scan)
```

### TinyClaw

```
tinyclaw/
├── dist/                    # Backend compiled output
│   ├── index.js
│   ├── agents/
│   ├── channels/
│   ├── state/
│   └── team/
└── tinyoffice/.next/        # Next.js compiled output (excluded from scan)
```

---

## Configuration Files

### Automaton

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template
- `AGENTS.md` - Agent system configuration
- `pnpm-workspace.yaml` (inferred) - Monorepo workspace config

### TinyClaw

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `ARCHITECTURE.md` - Architecture documentation
- `DOCUMENTATION.md` - Project documentation
- `CONFIG_GUIDE.md` - Configuration guide
- `constitution.md` - Agent constitution

### TinyOffice (Frontend)

- `package.json` - Next.js dependencies
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS config
- `tsconfig.json` - TypeScript config

---

## Test Coverage

### Automaton

- Vitest test runner
- Coverage reports available
- Specialized test suites:
  - `test:security` - Security and injection tests
  - `test:financial` - Financial/treasury logic tests
  - `test:ci` - CI/CD optimized tests

### TinyClaw

- Test files in `src/` and subdirectories
- TypeScript-based testing

---

## Key Patterns and Architectures

### Automaton Patterns

1. **Multi-Layer Memory:** Episodic + Semantic + Working + Procedural
2. **Policy Enforcement:** Runtime validation and rate limiting
3. **Self-Modification:** Code generation and auditing
4. **Injection Defense:** Security layer for LLM interactions
5. **Budget Management:** Credit tracking and spending control

### TinyClaw Patterns

1. **Multi-Channel Architecture:** Unified interface for Discord/Telegram/WhatsApp/Feishu
2. **Team Orchestration:** Multi-agent coordination
3. **State Persistence:** SQLite-backed conversation state
4. **Next.js SSR:** Server-side rendering for frontend
5. **Real-time Communication:** WebSocket/long-polling for updates

---

## Development Workflow

### Automaton

```bash
cd automaton
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm dev              # Development watch mode
pnpm test             # Run tests
pnpm test:coverage    # Coverage report
```

### TinyClaw Backend

```bash
cd tinyclaw
npm install
npm run build
npm run whatsapp      # Start WhatsApp client
npm run discord       # Start Discord client
npm run telegram      # Start Telegram client
npm run feishu        # Start Feishu client
```

### TinyOffice Frontend

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev           # Development server
npm run build         # Production build
npm run start         # Production start
```

---

## Asset Locations

### Automaton

- No significant static assets (backend-only)
- Configuration templates in `.agents/`

### TinyClaw

- Frontend assets in `tinyoffice/public/`
- Images, icons, and static files
- Next.js optimized asset pipeline

---

## Notes

- **Exhaustive Scan:** This analysis includes all source directories
- **Node Modules:** Excluded from analysis (standard dependency folders)
- **Build Outputs:** Excluded from analysis (compiled files)
- **Monorepo Structure:** Two independent but related projects
- **Shared Philosophy:** Both implement autonomous AI agent systems

---

_This source tree analysis was generated by the BMAD `document-project` workflow_
