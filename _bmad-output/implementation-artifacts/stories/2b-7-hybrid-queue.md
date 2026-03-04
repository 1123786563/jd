# Story 2b.7: Redis+SQLite 混合消息队列 - Redis 实时分发 + SQLite 持久化 (HybridQueueManager)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a TinyClaw system administrator,
I want a hybrid message queue that combines Redis for real-time message distribution with SQLite for reliable persistence,
so that the system can handle high-throughput scenarios while maintaining data durability and disaster recovery capabilities.

## Acceptance Criteria

1. **HybridQueueManager Implementation**
   - [ ] Create `HybridQueueManager` class that integrates both Redis and SQLite backends
   - [ ] Messages are immediately published to Redis Pub/Sub for real-time distribution
   - [ ] All messages are persisted to SQLite for durability and recovery
   - [ ] SQLite serves as the source of truth for message state and history

2. **Message Flow Architecture**
   - [ ] Channel clients (Discord/Telegram/WhatsApp/Feishu) publish to Redis Pub/Sub
   - [ ] Queue processor subscribes to Redis channels for instant message delivery
   - [ ] All messages are atomically written to SQLite with transaction guarantees
   - [ ] Failed messages can be recovered from SQLite after crash

3. **Performance & Reliability**
   - [ ] Redis provides sub-millisecond message delivery latency
   - [ ] SQLite WAL mode ensures ACID compliance for persistence
   - [ ] Automatic recovery of stale messages after crash (from SQLite)
   - [ ] Queue processor can restart and resume from SQLite state

4. **Redis Integration**
   - [ ] Use `ioredis` library for Redis client (production-ready, cluster support)
   - [ ] Redis channel naming convention: `tinyclaw:messages:{agentId}`
   - [ ] Support Redis Pub/Sub pattern matching for wildcard subscriptions
   - [ ] Implement connection pooling and reconnection logic
   - [ ] Graceful fallback to SQLite-only mode when Redis is unavailable

5. **SQLite Persistence Layer**
   - [ ] Maintain existing `messages` and `responses` tables structure
   - [ ] Add `redis_synced` boolean column to track Redis publish status
   - [ ] Implement background sync job to reconcile Redis/SQLite state
   - [ ] Support point-in-time recovery from SQLite backups

6. **Queue Status & Monitoring**
   - [ ] Expose metrics for both Redis and SQLite queue depths
   - [ ] Track message delivery latency (Redis publish to agent receive)
   - [ ] Monitor Redis connection health and failover status
   - [ ] API endpoint `/api/queue/status` shows hybrid queue stats

7. **Disaster Recovery**
   - [ ] Implement `recoverStaleMessages()` that reads from SQLite
   - [ ] Support manual recovery command: `npm run queue:recover`
   - [ ] Log all recovery actions for audit trail
   - [ ] Test recovery scenario with simulated crash

8. **Configuration**
   - [ ] Add Redis configuration section to `tinyclaw.settings.json`:
     ```json
     "queue": {
       "backend": "hybrid",  // "sqlite", "redis", or "hybrid"
       "redis": {
         "enabled": true,
         "host": "localhost",
         "port": 6379,
         "password": "",
         "db": 0,
         "tls": false
       },
       "max_retries": 3,
       "retry_delay": 5000
     }
     ```
   - [ ] Support environment variables for Redis config (`REDIS_HOST`, `REDIS_PORT`, etc.)
   - [ ] Graceful degradation: if Redis disabled/unavailable, use SQLite-only mode

## Tasks / Subtasks

### Task 1: Redis Integration Setup (AC: 4, 8)
- [ ] Install `ioredis` dependency: `npm install ioredis`
- [ ] Create `src/lib/redis.ts` - Redis client wrapper with connection pooling
- [ ] Implement Redis config loader from settings/environment variables
- [ ] Add health check endpoint for Redis connection status
- [ ] Write unit tests for Redis client (connection, pub/sub, error handling)

### Task 2: HybridQueueManager Core (AC: 1, 2, 3, 5)
- [ ] Create `src/lib/hybrid-queue.ts` - `HybridQueueManager` class
- [ ] Implement `enqueueMessage()` - publish to Redis + persist to SQLite atomically
- [ ] Implement `subscribeMessages(agentId)` - subscribe to Redis channel + poll SQLite fallback
- [ ] Implement `claimNextMessage()` - atomic Redis pop with SQLite backup
- [ ] Implement `completeMessage()` - mark as completed in both Redis and SQLite
- [ ] Implement `failMessage()` - handle failures with retry logic
- [ ] Add connection state management (connected/disconnected/reconnecting)
- [ ] Write comprehensive unit tests with mock Redis/SQLite

### Task 3: Channel Client Integration (AC: 2)
- [ ] Update `src/channels/discord-client.ts` - publish to Redis instead of direct SQLite enqueue
- [ ] Update `src/channels/telegram-client.ts` - same Redis publish pattern
- [ ] Update `src/channels/whatsapp-client.ts` - same Redis publish pattern
- [ ] Update `src/channels/feishu-client.ts` - same Redis publish pattern
- [ ] Add fallback: if Redis publish fails, write directly to SQLite
- [ ] Update logging to show Redis publish status

### Task 4: Queue Processor Integration (AC: 2, 3, 6)
- [ ] Update `src/queue-processor.ts` - subscribe to Redis channels instead of polling SQLite
- [ ] Implement real-time message processing from Redis Pub/Sub
- [ ] Keep SQLite polling as fallback for missed messages
- [ ] Update `processQueue()` to use Redis subscription pattern
- [ ] Add metrics collection for delivery latency
- [ ] Update status reporting to include Redis stats

### Task 5: API & Monitoring Endpoints (AC: 6)
- [ ] Update `src/server/routes/queue.ts` - add hybrid queue status endpoint
- [ ] Expose Redis connection status, queue depths, delivery latency
- [ ] Add recovery status and sync reconciliation info
- [ ] Update SSE events to include Redis events (`redis:connected`, `redis:disconnected`)
- [ ] Add admin endpoint to trigger manual recovery: `POST /api/queue/recover`

### Task 6: Disaster Recovery System (AC: 7)
- [ ] Enhance `recoverStaleMessages()` in `src/lib/db.ts` - read from SQLite for recovery
- [ ] Add recovery command script: `scripts/recover-queue.ts`
- [ ] Add npm script: `"queue:recover": "node dist/scripts/recover-queue.js"`
- [ ] Log all recovery actions with timestamps and message IDs
- [ ] Add recovery test: simulate crash, verify messages recovered

### Task 7: Configuration & Documentation (AC: 8)
- [ ] Update `tinyclaw.settings.json` schema with Redis config section
- [ ] Update TypeScript types in `src/lib/types.ts` for queue config
- [ ] Update `tinyclaw/settings.example.json` with Redis examples
- [ ] Write Redis setup guide in docs/ directory
- [ ] Update README.md with hybrid queue architecture diagram
- [ ] Add troubleshooting section for Redis connection issues

### Task 8: Testing & Validation
- [ ] Write integration tests: Redis + SQLite end-to-end flow
- [ ] Test Redis failure scenario: verify graceful fallback to SQLite
- [ ] Test recovery scenario: simulate crash, verify messages recovered
- [ ] Load test: 1000+ messages/sec through Redis, verify no data loss
- [ ] Test with Redis cluster (if available) for horizontal scaling
- [ ] Verify metrics accuracy and monitoring endpoints

## Dev Notes

### Project Structure Notes

**Alignment with unified project structure:**
- New file: `tinyclaw/src/lib/redis.ts` - Redis client abstraction
- New file: `tinyclaw/src/lib/hybrid-queue.ts` - Hybrid queue manager
- New file: `tinyclaw/scripts/recover-queue.ts` - Recovery CLI tool
- Modified: `tinyclaw/src/lib/db.ts` - Enhanced recovery logic
- Modified: `tinyclaw/src/queue-processor.ts` - Redis subscription integration
- Modified: All channel clients in `tinyclaw/src/channels/` - Redis publish

**Detected conflicts or variances:**
- Current implementation uses pure SQLite polling - this story introduces event-driven Redis layer
- Need to maintain backward compatibility: if Redis disabled, system should work with SQLite-only
- Queue processor currently polls SQLite every message - will change to event-driven subscription
- Must ensure atomicity: if Redis publish succeeds but SQLite write fails (or vice versa), need rollback

### Technical Requirements

#### Redis Architecture Pattern

**Why Redis?**
- Sub-millisecond pub/sub for real-time message distribution
- In-memory performance for high-throughput scenarios
- Built-in pub/sub pattern matching for flexible routing
- Production-ready with cluster support via `ioredis`

**Why SQLite?**
- ACID-compliant persistence for durability
- Single-file database for easy backup/restore
- WAL mode for concurrent reads/writes
- No external dependencies for standalone deployments

**Hybrid Pattern:**
```
Channel Client          Queue Processor
     |                        |
     |---[Redis Pub]--------->| (instant, <1ms)
     |                        |
     |---[SQLite Persist]---->| (durable, ~10ms)
     |                        |
     |<--[Redis Ack]----------| (confirmation)
     |                        |
Fallback: Direct SQLite write if Redis unavailable
```

#### Key Implementation Details

**1. Redis Pub/Sub Channels:**
```typescript
// Channel naming convention
const CHANNEL_PREFIX = 'tinyclaw:messages';
const agentChannel = `${CHANNEL_PREFIX}:${agentId}`;  // e.g., "tinyclaw:messages:default"
const wildcardChannel = `${CHANNEL_PREFIX}:*`;        // Subscribe to all agents
```

**2. Atomic Persistence:**
```typescript
async enqueueMessage(data: EnqueueMessageData): Promise<void> {
  const tx = db.transaction(() => {
    // 1. Write to SQLite first (source of truth)
    const rowId = sqliteInsert(data);

    // 2. Publish to Redis
    try {
      await redis.publish(agentChannel, JSON.stringify(data));
      // Mark as synced
      db.prepare('UPDATE messages SET redis_synced = 1 WHERE id = ?').run(rowId);
    } catch (error) {
      // Redis failed, but SQLite succeeded - will retry sync later
      log('WARN', 'Redis publish failed, will retry');
    }

    return rowId;
  });

  return tx.immediate();
}
```

**3. Queue Processor Pattern:**
```typescript
// Subscribe to Redis channels
redis.psubscribe('tinyclaw:messages:*', (err, count) => {
  if (err) {
    log('ERROR', 'Redis subscription failed');
    // Fall back to SQLite polling
    startSqlitePolling();
  }
});

// Handle real-time messages
redis.on('pmessage', (pattern, channel, message) => {
  const agentId = extractAgentIdFromChannel(channel);
  const data = JSON.parse(message);
  processMessage(data);
});

// Background SQLite polling for missed messages
setInterval(() => {
  const missed = findUnsyncedMessages();
  for (const msg of missed) {
    processMessage(msg);
  }
}, 30000); // Every 30 seconds
```

**4. Connection Management:**
```typescript
class RedisClientManager {
  private client: Redis | null = null;
  private isConnected = false;

  async connect(): Promise<boolean> {
    try {
      this.client = new Redis(config);
      await this.client.ping();
      this.isConnected = true;
      this.setupReconnectListeners();
      return true;
    } catch (error) {
      log('ERROR', 'Redis connection failed');
      this.isConnected = false;
      return false;
    }
  }

  private setupReconnectListeners() {
    this.client!.on('error', (err) => {
      log('ERROR', `Redis error: ${err.message}`);
      this.isConnected = false;
    });

    this.client!.on('connect', () => {
      log('INFO', 'Redis reconnected');
      this.isConnected = true;
      // Re-subscribe to channels
      this.resubscribe();
    });
  }
}
```

### Library/Framework Requirements

**Required Dependencies:**
```json
{
  "dependencies": {
    "ioredis": "^5.4.1",  // Production-ready Redis client with cluster support
    "better-sqlite3": "^11.0.0"  // Existing SQLite dependency
  }
}
```

**Why ioredis over node-redis?**
- Better cluster support out of the box
- Connection pooling and auto-reconnection
- TypeScript support
- Active maintenance and community
- Built-in retry strategy and error handling

### File Structure Requirements

**New Files to Create:**
```
tinyclaw/
├── src/
│   ├── lib/
│   │   ├── redis.ts              # Redis client wrapper
│   │   ├── hybrid-queue.ts       # HybridQueueManager class
│   │   └── db.ts                 # Updated with redis_synced column
│   ├── queue-processor.ts        # Updated for Redis subscription
│   └── channels/
│       ├── discord-client.ts     # Updated to publish to Redis
│       ├── telegram-client.ts    # Updated to publish to Redis
│       ├── whatsapp-client.ts    # Updated to publish to Redis
│       └── feishu-client.ts      # Updated to publish to Redis
├── scripts/
│   └── recover-queue.ts          # Manual recovery CLI tool
├── docs/
│   └── hybrid-queue-architecture.md  # Architecture documentation
└── package.json                  # Add ioredis dependency
```

**Modified Files:**
- `tinyclaw/src/lib/db.ts` - Add `redis_synced` column, enhance recovery
- `tinyclaw/src/queue-processor.ts` - Redis subscription instead of polling
- All channel clients - Redis publish instead of direct SQLite enqueue
- `tinyclaw/src/server/routes/queue.ts` - Add hybrid status endpoint
- `tinyclaw/src/lib/types.ts` - Add Redis config types
- `tinyclaw/tinyclaw.settings.json` - Add Redis configuration section

### Testing Requirements

**Unit Tests:**
- Test Redis client connection and error handling
- Test Redis pub/sub message flow
- Test atomic SQLite + Redis persistence
- Test fallback to SQLite-only mode
- Test connection reconnection logic

**Integration Tests:**
- End-to-end message flow: Channel → Redis → Processor → Agent
- Redis failure scenario: verify fallback works
- Recovery scenario: crash → restart → verify messages recovered
- Load test: 1000+ messages/sec through Redis
- Concurrent processing test: multiple agents, parallel messages

**Test Files:**
```
tinyclaw/src/__tests__/
├── lib/
│   ├── redis.test.ts
│   ├── hybrid-queue.test.ts
│   └── db.test.ts (updated)
├── queue-processor.test.ts (updated)
└── integration/
    ├── redis-fallback.test.ts
    ├── recovery.test.ts
    └── load-test.test.ts
```

### Performance Considerations

**Redis Performance:**
- Pub/Sub latency: <1ms for local Redis
- Throughput: 100K+ messages/sec (single Redis instance)
- Memory: ~100 bytes per message in memory
- Connection pooling: reuse connections to avoid overhead

**SQLite Performance:**
- WAL mode: allows concurrent reads/writes
- Transaction batching: group multiple inserts in single transaction
- Index optimization: maintain indexes on `status`, `agent`, `created_at`
- Vacuum periodically to reclaim space

**Hybrid Performance:**
- Best case (Redis available): <1ms delivery + ~10ms persistence
- Fallback case (Redis down): ~10ms SQLite-only delivery
- Recovery time: depends on queue size, typically <1min for 10K messages

### Security Considerations

**Redis Security:**
- Support password authentication
- Support TLS/SSL for encrypted connections
- Default to localhost only (no external exposure)
- Add firewall rules if Redis exposed externally
- Use separate Redis DB index for TinyClaw (default: 0)

**Data Security:**
- Messages encrypted at rest in SQLite (optional)
- Redis does not persist messages (ephemeral pub/sub)
- SQLite file permissions: 600 (owner read/write only)
- Backup SQLite regularly for disaster recovery

### Configuration Examples

**Full Hybrid Mode:**
```json
{
  "queue": {
    "backend": "hybrid",
    "redis": {
      "enabled": true,
      "host": "localhost",
      "port": 6379,
      "password": "your-redis-password",
      "db": 0,
      "tls": false,
      "connectionTimeout": 10000,
      "maxRetriesPerRequest": 3
    },
    "max_retries": 3,
    "retry_delay": 5000
  }
}
```

**Redis-Only Mode (for testing):**
```json
{
  "queue": {
    "backend": "redis",
    "redis": {
      "enabled": true,
      "host": "localhost",
      "port": 6379
    }
  }
}
```

**SQLite-Only Mode (fallback):**
```json
{
  "queue": {
    "backend": "sqlite",
    "redis": {
      "enabled": false
    }
  }
}
```

### Migration Path

**Phase 1: Add Redis support (this story)**
- Implement hybrid queue manager
- Update channel clients to publish to Redis
- Update queue processor to subscribe to Redis
- Maintain SQLite as source of truth

**Phase 2: Enable by default**
- Set `backend: "hybrid"` as default in new installations
- Document migration steps for existing deployments
- Provide Redis setup guide

**Phase 3: Optimize and scale**
- Add Redis cluster support for horizontal scaling
- Implement message batching for high-throughput scenarios
- Add Redis persistence options (AOF/RDB) for durability

### References

- [Source: tinyclaw/src/lib/db.ts] - Current SQLite queue implementation
- [Source: tinyclaw/src/queue-processor.ts] - Current queue processor logic
- [Source: tinyclaw/src/lib/types.ts] - Message and config types
- [Source: docs/development-guide-tinyclaw.md#601] - Current queue architecture pattern
- [Source: docs/project-context.md#172] - Multi-channel message push system
- [Source: _bmad-output/planning-artifacts/epics.md#110] - Story requirement in Epic 2b
- [Source: _bmad-output/planning-artifacts/epics.md#255] - Transaction consistency requirement
- [Source: _bmad-output/planning-artifacts/epics.md#344] - Database table design

### Architecture Diagram

```
┌─────────────────┐
│  Channel Client │ (Discord/Telegram/WhatsApp/Feishu)
└────────┬────────┘
         │
         │ 1. Receive message from user
         ▼
┌─────────────────────────────────────┐
│   HybridQueueManager.enqueue()      │
├─────────────────────────────────────┤
│   1. Write to SQLite (ACID)         │
│   2. Publish to Redis Pub/Sub       │
│   3. Mark redis_synced = true       │
└────────┬────────────────────────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐
   │ SQLite  │   │  Redis   │   │  Backup  │
   │(persist)│   │ (pub/sub)│   │  (WAL)   │
   └─────────┘   └────┬─────┘   └──────────┘
                      │
                      │ 2. Instant delivery (<1ms)
                      ▼
         ┌─────────────────────────────┐
         │ QueueProcessor.subscribe()  │
         ├─────────────────────────────┤
         │   - Listen to Redis channel │
         │   - Fallback: poll SQLite   │
         │   - Process message         │
         └────────┬────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Invoke Agent   │
         └─────────────────┘

Disaster Recovery:
┌─────────────────────────────────────┐
│   recoverStaleMessages()            │
├─────────────────────────────────────┤
│   - Read from SQLite                │
│   - Reset status to 'pending'       │
│   - Re-queue for processing         │
└─────────────────────────────────────┘
```

## Dev Agent Record

### Agent Model Used

Claude 3.6 (Opus) - Advanced code generation and architecture design

### Debug Log References

- Redis client connection debugging: `log('DEBUG', 'Redis connected')`
- Message flow tracing: `log('TRACE', 'Message published to Redis')`
- Fallback detection: `log('WARN', 'Redis unavailable, using SQLite fallback')`
- Recovery actions: `log('INFO', 'Recovered N stale messages')`

### Completion Notes List

- [ ] Verify Redis pub/sub works with multiple queue processors (horizontal scaling)
- [ ] Test Redis cluster mode if available
- [ ] Add Redis connection pooling for high-throughput scenarios
- [ ] Implement message batching for bulk operations
- [ ] Add Redis persistence options (AOF/RDB) for message durability
- [ ] Consider Redis Streams as alternative to Pub/Sub for ordered delivery
- [ ] Add circuit breaker pattern for Redis failures
- [ ] Implement dead letter queue for failed messages
- [ ] Add message TTL (time-to-live) for automatic expiration
- [ ] Consider Redis Lua scripts for atomic operations

### File List

**New Files:**
- `tinyclaw/src/lib/redis.ts`
- `tinyclaw/src/lib/hybrid-queue.ts`
- `tinyclaw/scripts/recover-queue.ts`
- `tinyclaw/docs/hybrid-queue-architecture.md`

**Modified Files:**
- `tinyclaw/src/lib/db.ts`
- `tinyclaw/src/queue-processor.ts`
- `tinyclaw/src/channels/discord-client.ts`
- `tinyclaw/src/channels/telegram-client.ts`
- `tinyclaw/src/channels/whatsapp-client.ts`
- `tinyclaw/src/channels/feishu-client.ts`
- `tinyclaw/src/server/routes/queue.ts`
- `tinyclaw/src/lib/types.ts`
- `tinyclaw/package.json`
- `tinyclaw/tinyclaw.settings.json`
- `tinyclaw/tinyclaw.settings.example.json`

**Test Files:**
- `tinyclaw/src/__tests__/lib/redis.test.ts`
- `tinyclaw/src/__tests__/lib/hybrid-queue.test.ts`
- `tinyclaw/src/__tests__/integration/redis-fallback.test.ts`
- `tinyclaw/src/__tests__/integration/recovery.test.ts`

---

**Story Created:** 2026-03-04
**Based On:** Epic 2b - 后端API与插件系统
**Priority:** ⭐⭐⭐⭐ (High - Performance & Reliability)
**Estimated Effort:** 3-5 days
**Dependencies:** None (standalone story)
**Blocks:** 2b.8 (Disaster Recovery), 2b.12 (Index Optimization)
