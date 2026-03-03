# JD Project Context

---
created: 2026-03-03
sections_completed:
  - technology-stack
  - language-rules
  - framework-rules
  - testing-rules
  - code-quality-rules
  - workflow-rules
  - critical-rules
status: complete
---

## Technology Stack & Versions

### Automaton (Sovereign AI Agent Runtime)
| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.9.3 | Primary language |
| Node.js | >= 20.0.0 | Runtime |
| Module System | ESM (NodeNext) | Module resolution |
| pnpm | 10.28.1 | Package manager |
| Express | 5.2.1 | HTTP server |
| OpenAI SDK | 6.24.0 | LLM integration |
| viem | 2.44.2 | Ethereum client |
| better-sqlite3 | 11.0.0 | Database |
| Vitest | 2.0.0 | Testing |

### TinyClaw (Multi-team Assistant)
| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.9.3 | Primary language |
| Module System | CommonJS | Module resolution |
| npm | - | Package manager |
| Hono | 4.12.1 | HTTP framework |
| Discord.js | 14.16.0 | Discord integration |
| Telegram Bot API | 0.67.0 | Telegram integration |
| WhatsApp Web.js | 1.34.6 | WhatsApp integration |

### TinyOffice (Frontend)
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | React framework |
| React | 19.2.3 | UI library |
| Tailwind CSS | 4 | Styling |
| Radix UI | 1.4.3 | Component primitives |

### Critical Version Constraints
- Node.js 20+ required for all projects
- TypeScript strict mode enabled across all projects
- Different module systems: Automaton uses ESM, TinyClaw uses CommonJS

## Language-Specific Rules

### TypeScript Configuration
- **strict: true** enabled in all projects
- **declaration: true** - generates .d.ts files
- **declarationMap: true** - enables go-to-definition
- **sourceMap: true** - enables debugging

### Import/Export Patterns (CRITICAL)

**Automaton (ESM/NodeNext):**
```typescript
// MUST use .js extensions in imports (even for .ts files)
import { foo } from "./bar.js";  // Correct
import { foo } from "./bar";      // Wrong - will fail at runtime
```

**TinyClaw (CommonJS):**
```typescript
// NO extensions in imports
import { foo } from "./bar";      // Correct
```

### Error Handling
- All async operations wrapped in try/catch
- Use StructuredLogger for error logging with context
- Database errors logged with query context

### Async/Await Conventions
- Prefer async/await over Promise chains
- All agent loop functions are async
- Heartbeat tasks use async execution with lease management

## Framework-Specific Rules

### Express (Automaton)
- Routes defined with async handlers
- Error middleware catches async errors
- All responses use JSON format

### Hono (TinyClaw)
- Lightweight HTTP framework
- Routes: `app.get('/path', handler)`
- Context passed through `c` parameter

### Next.js (TinyOffice)
- App Router (Next.js 16)
- Server Components by default
- Client Components marked with `'use client'`

### React 19 Patterns
- Hooks for state management
- `useFormStatus`, `useFormState` for forms
- Radix UI primitives for accessibility

### Agent Architecture (Automaton)
```
ReAct Loop: Think -> Act -> Observe -> Persist
- 57 tools in 10 categories
- Policy engine validates every tool call
- 5-tier memory system
- Heartbeat daemon for background tasks
```

### Multi-Channel Messaging (TinyClaw)
- Discord, Telegram, WhatsApp, Feishu clients
- Shared message queue processor
- Team-based agent routing

## Testing Rules

### Test Organization
- Tests in `src/__tests__/` directories
- Test files named `*.test.ts`
- Integration tests in `src/__tests__/integration/`

### Vitest Configuration
```typescript
testTimeout: 30_000      // 30 seconds
teardownTimeout: 5_000   // 5 seconds
include: ["src/__tests__/**/*.test.ts"]
```

### Coverage Thresholds
| Metric | Threshold |
|--------|-----------|
| Statements | 60% |
| Branches | 50% |
| Functions | 55% |
| Lines | 60% |

### Test Patterns
- Unit tests: individual functions/modules
- Integration tests: multi-module interactions
- Mocks: `src/__tests__/mocks.ts`
- In-memory SQLite for database tests

### Test Structure
```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do something', async () => {
      // Arrange, Act, Assert
    });
  });
});
```

### Critical Test Rules
- All tests async when testing async code
- `beforeEach` for setup, `afterEach` for cleanup
- In-memory SQLite, not file-based

## Code Quality & Style Rules

### File Naming
| Type | Pattern | Example |
|------|---------|---------|
| Source files | kebab-case | `agent-loop.ts` |
| Test files | `*.test.ts` | `loop.test.ts` |
| Directories | lowercase | `src/memory/` |
| React components | PascalCase | `Button.tsx` |

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `AgentLoop` |
| Functions | camelCase | `runAgentLoop` |
| Constants | SCREAMING_SNAKE | `MAX_TOOL_CALLS` |
| Interfaces | PascalCase (no I prefix) | `AgentConfig` |
| Types | PascalCase | `AgentState` |

### Code Organization
```
src/
  module-name/           # Feature directory
    index.ts            # Public exports
    types.ts            # Type definitions
    main-logic.ts       # Implementation
```

### Logging Standards
- Use `StructuredLogger` with module namespace
- Log levels: `debug`, `info`, `warn`, `error`, `fatal`
- Always include context object

## Development Workflow Rules

### Branch Naming
```
feature/description    # New features
fix/description        # Bug fixes
refactor/description   # Code refactoring
docs/description       # Documentation updates
```

### Commit Message Format
```
type: brief description

# Types: feat, fix, refactor, docs, test, chore
# Examples:
feat: add memory compression engine
fix: handle timeout in http client
```

### Package Manager Commands

**Automaton:**
```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm test             # Run Vitest tests
pnpm typecheck        # Type check without emit
```

**TinyClaw:**
```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript
npm run whatsapp      # Start WhatsApp client
npm run discord       # Start Discord client
npm run feishu        # Start Feishu client
```

**TinyOffice:**
```bash
npm run dev           # Development server
npm run build         # Production build
```

## Critical Don't-Miss Rules

### Module System Mistakes (CRITICAL)
```typescript
// WRONG - Will fail at runtime in ESM
import { foo } from "./bar";

// CORRECT in Automaton (ESM)
import { foo } from "./bar.js";

// CORRECT in TinyClaw (CommonJS)
import { foo } from "./bar";
```

### Database Rules
- NEVER use file-based SQLite in tests
- ALWAYS use prepared statements for user input
- Use transaction boundaries for multi-step operations

### Security Rules
- All external input sanitized through `injection-defense.ts`
- Policy engine validates EVERY tool call
- Protected files: constitution, wallet, DB, config
- NEVER expose private keys in logs

### Agent Loop Limits
| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_TOOL_CALLS_PER_TURN` | 10 | Truncate execution |
| `MAX_CONSECUTIVE_ERRORS` | 5 | Force sleep threshold |
| `MAX_REPETITIVE_TURNS` | 3 | Loop detection |

### Performance Rules
- Cache credit/USDC balances (avoid false dead-state)
- Truncate tool results to `MAX_TOOL_RESULT_SIZE`
- Use connection pooling for database operations

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

**Last Updated:** 2026-03-03