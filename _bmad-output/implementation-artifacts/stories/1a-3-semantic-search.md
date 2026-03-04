# Story 1a.3: 语义检索优化 (向量搜索)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Automaton Agent with long-term memory needs,
I want to implement efficient semantic search using vector embeddings,
so that I can quickly retrieve relevant context from long-term memory to support RAG-enhanced generation and maintain contextual coherence across sessions.

## Priority & Data Scale

- **Priority Level**: P0 (核心功能)
- **Expected Data Volume**: 初期 1,000-5,000 篇文档，中期扩展至 50,000+ 篇
- **Performance Target**: 单次检索 < 100ms（M1/M2 MacBook Pro 本地环境）
- **Cost Budget**: OpenAI Embedding API 预算约 $5-10/月（基于 10,000 次嵌入调用/月估算）

## Business Context

语义检索是 Automaton 记忆系统的核心能力，用于：
- 从长程记忆中检索相关历史对话和任务上下文
- 支持 RAG（Retrieval-Augmented Generation）增强生成
- 减少重复工作，复用历史解决方案
- 维持跨会话的上下文连贯性

## Acceptance Criteria

1. **向量库集成**: 成功集成 ChromaDB 或 Weaviate 作为向量存储后端
2. **语义检索功能**: 实现基于文本相似度的语义搜索，支持 top-K 检索
3. **上下文压缩**: 结合 1a.2 的上下文聚合器，实现检索结果的智能压缩
4. **性能要求**: 单次检索响应时间 < 100ms（本地部署）
5. **持久化**: 向量索引支持持久化存储，重启后数据不丢失
6. **API 接口**: 提供清晰的检索 API（query, add, delete, update）
7. **测试覆盖**: 核心功能单元测试覆盖率 > 80%

## Tasks / Subtasks

- [ ] **Task 1: 向量库选型与集成 (AC: 1)**
  - [ ] 研究 ChromaDB vs Weaviate 的特性对比
  - [ ] 选择并安装向量库依赖（ChromaDB 优先）
  - [ ] 实现向量库基础配置和连接管理
  - [ ] 编写连接池管理模块

- [ ] **Task 2: 向量嵌入生成 (AC: 2, 3)**
  - [ ] 集成文本嵌入模型（OpenAI text-embedding 或开源替代）
  - [ ] 实现文本到向量的转换服务
  - [ ] 添加批量嵌入生成优化
  - [ ] 实现嵌入缓存机制减少重复计算

- [ ] **Task 3: 语义检索核心实现 (AC: 2, 4, 6)**
  - [ ] 实现向量索引的增删改查接口
  - [ ] 实现基于余弦相似度的语义搜索
  - [ ] 添加过滤器支持（时间范围、标签等）
  - [ ] 实现分页和排序功能
  - [ ] 添加检索结果的元数据关联

- [ ] **Task 4: 与记忆系统集成 (AC: 3, 7)**
  - [ ] 实现 `MemoryRetriever` 类与 Automaton Core Loop 对接
  - [ ] 集成上下文压缩器（复用 1a.2 的实现）
  - [ ] 实现检索结果的智能排序和过滤
  - [ ] 添加检索历史记录和缓存

- [ ] **Task 5: 持久化与性能优化 (AC: 5)**
  - [ ] 配置向量库持久化存储路径
  - [ ] 实现向量索引的定期备份机制
  - [ ] 添加异步批量插入优化
  - [ ] 实现检索性能监控和日志

- [ ] **Task 6: 测试与文档 (AC: 7)**
  - [ ] 编写单元测试覆盖核心功能
  - [ ] 编写集成测试验证端到端流程
  - [ ] 编写 API 文档和使用示例
  - [ ] 编写性能测试基准

## Dev Notes

### Architecture Constraints & Patterns

**核心架构要求 (来自 upwork_autopilot_detailed_design.md):**
- **向量库选择**: 优先使用 ChromaDB（轻量级、易部署），备选 Weaviate [Source: docs/upwork_autopilot_detailed_design.md#L266]
- **集成位置**: MemorySystem 子系统，与 `MemoryRetriever`、`MemoryIngestion`、`ContextCompression` 协同工作 [Source: docs/upwork_autopilot_detailed_design.md#L63-L67]
- **数据流**: `CoreLoop <--> MemorySystem` 双向交互 [Source: docs/upwork_autopilot_detailed_design.md#L83]
- **用途**: 支持长程记忆存储、RAG 增强生成、上下文摘要 [Source: docs/upwork_autopilot_detailed_design.md#L526, L1327]

**接口抽象层 (新增):**
- 实现 `VectorStoreInterface` 抽象接口，便于未来切换向量库实现
- 定义统一的 `EmbeddingProvider` 接口，支持 OpenAI 和本地嵌入模型
- 通过依赖注入方式连接向量库，提高可测试性

**混合检索策略 (新增):**
- **语义权重**: 70% (向量相似度)
- **关键词权重**: 20% (BM25 相关性)
- **元数据权重**: 10% (时间衰减、访问频率、置信度)
- 可通过配置文件调整权重比例

**技术栈要求:**
- **主数据库**: better-sqlite3 (SQLite 3) - 已存在
- **向量库**: ChromaDB / Weaviate - 本次新增
- **嵌入模型**: OpenAI text-embedding-3-small 或开源替代（如 sentence-transformers）
- **编程语言**: TypeScript (与 Automaton 保持一致)

**性能与安全要求:**
- **响应时间**: < 100ms 单次检索（M1/M2 MacBook 本地）
- **并发支持**: 支持多 Agent 并发检索（连接池管理）
- **持久化**: 向量索引必须持久化，防止重启丢失
- **内存管理**: 实现连接池和缓存，避免内存泄漏
- **成本控制**: 嵌入缓存机制，减少重复 API 调用
- **索引优化**: 使用 HNSW 索引（efConstruction=128, M=16）平衡精度和速度

**术语表:**
- **RAG (Retrieval-Augmented Generation)**: 检索增强生成，通过外部知识库增强 LLM 生成
- **向量嵌入 (Embedding)**: 将文本转换为高维向量表示
- **HNSW (Hierarchical Navigable Small World)**: 高效的近似最近邻搜索索引结构
- **余弦相似度**: 衡量两个向量方向相似性的指标
- **Top-K 检索**: 返回相似度最高的 K 个结果
- **连接池**: 复用数据库连接，避免频繁创建/销毁开销

### Source Tree Components to Touch

**Automaton 项目结构:**
```
automaton/
├── src/
│   ├── memory/                      # 记忆系统核心目录（新建）
│   │   ├── vector-store/            # 向量存储模块
│   │   │   ├── index.ts             # 向量库主入口
│   │   │   ├── chroma-client.ts     # ChromaDB 客户端封装
│   │   │   ├── weaviate-client.ts   # Weaviate 客户端封装（备选）
│   │   │   ├── types.ts             # 向量库类型定义
│   │   │   └── utils.ts             # 工具函数
│   │   ├── embedding/               # 嵌入生成模块
│   │   │   ├── index.ts             # 嵌入服务主入口
│   │   │   ├── openai-embedder.ts   # OpenAI 嵌入实现
│   │   │   ├── local-embedder.ts    # 本地嵌入实现（备选）
│   │   │   └── cache.ts             # 嵌入缓存管理
│   │   ├── retriever/               # 检索器模块
│   │   │   ├── index.ts             # 检索器主入口
│   │   │   ├── semantic-retriever.ts # 语义检索实现
│   │   │   ├── hybrid-retriever.ts  # 混合检索（关键词+语义）
│   │   │   └── result-processor.ts  # 检索结果处理
│   │   └── index.ts                 # 记忆系统统一导出
│   ├── types/
│   │   └── memory.ts                # 记忆系统类型定义（扩展）
│   ├── config/
│   │   └── memory.config.ts         # 记忆系统配置
│   └── index.ts                     # 添加记忆系统导出
├── tests/
│   ├── memory/
│   │   ├── vector-store.test.ts
│   │   ├── embedding.test.ts
│   │   └── retriever.test.ts
│   └── integration/
│       └── memory-integration.test.ts
├── package.json                     # 添加依赖
└── tsconfig.json                    # 确保类型检查
```

**关键文件说明:**
- `memory/vector-store/chroma-client.ts`: ChromaDB 客户端封装，负责连接管理、索引操作
- `memory/embedding/openai-embedder.ts`: 调用 OpenAI API 生成文本嵌入
- `memory/retriever/semantic-retriever.ts`: 实现语义搜索核心逻辑
- `memory/index.ts`: 统一导出记忆系统 API
- `config/memory.config.ts`: 配置向量库参数、嵌入模型、缓存策略等

### Testing Standards

**测试数据集 (新增):**
- **样本文档集**: 50 篇测试文档，覆盖以下场景：
  - 技术文档（15篇）- API 文档、代码示例、架构设计
  - 市场信息（10篇）- 竞品分析、定价策略、用户反馈
  - 社区对话（15篇）- 用户支持、社区讨论、FAQ
  - 财务数据（5篇）- 预算报告、成本分析、发票记录
  - 运营流程（5篇）- 运行手册、事件响应、工作流程
- **预生成嵌入向量**: 使用 text-embedding-3-small 生成的测试嵌入，维度 1536
- **预期相似度基准**: 人工标注的文档对相似度分数（0-1 范围）

**单元测试要求:**
- 测试覆盖率 > 80%
- 使用 Vitest 作为测试框架
- 覆盖边界条件、错误处理、并发场景
- 使用 Mock 服务进行外部依赖隔离

**边界测试用例 (新增):**
- 空查询字符串处理
- 超长文本输入（> 10,000 字符）
- 特殊字符（emoji、Unicode、HTML 标签）
- 并发检索压力测试（100+ 并发请求）
- 内存泄漏检测（长时间运行后内存占用）
- 向量维度不一致场景

**集成测试要求:**
- 验证端到端检索流程
- 测试与 Core Loop 的集成
- 验证持久化和重启恢复
- 性能基准测试（响应时间、吞吐量）
- 硬件配置：M1/M2 MacBook Pro, 16GB RAM, SSD
- 基准指标：95% 请求 < 100ms, 99% 请求 < 150ms

**测试场景:**
1. 单文档嵌入和检索
2. 批量文档插入和检索
3. 混合检索（语义+关键词）
4. 过滤器和排序
5. 缓存命中和未命中
6. 连接池并发测试
7. 持久化和重启测试

### Dependencies to Add

**核心依赖:**
```json
{
  "chromadb": "^0.4.x",              // 向量库（主选）
  "weaviate-client": "^1.x",         // 向量库（备选）
  "@langchain/openai": "^0.0.x",     // OpenAI 嵌入 API
  "@langchain/core": "^0.1.x",       // LangChain 核心（可选，简化嵌入）
  "sentence-transformers": "^2.x"    // 本地嵌入模型（备选）
}
```

**开发依赖:**
```json
{
  "@types/chromadb": "^0.4.x",       // TypeScript 类型（注意：可能需要手动创建）
  "vitest": "^1.x",                  // 测试框架
  "@vitest/ui": "^1.x",              // 测试 UI
  "ts-node": "^10.x"                 // TypeScript 执行
}
```

**环境变量清单 (新增):**
```bash
# OpenAI 嵌入模型配置
OPENAI_API_KEY="sk-xxx"              # OpenAI API 密钥（必需）
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"  # 嵌入模型名称
OPENAI_EMBEDDING_DIMENSION=1536      # 嵌入向量维度

# ChromaDB 配置
CHROMA_MODE="persistent"             # embedded | persistent | client
CHROMA_PATH="./data/chroma"          # 持久化存储路径
CHROMA_HOST="localhost"              # ChromaDB 服务器地址（client 模式）
CHROMA_PORT=8000                     # ChromaDB 服务器端口

# 缓存配置
EMBEDDING_CACHE_MAX_SIZE=10000       # 嵌入缓存最大条目数
EMBEDDING_CACHE_TTL=2592000          # 缓存有效期（秒，30天）

# 性能配置
VECTOR_INDEX_EF=128                  # HNSW efConstruction 参数
VECTOR_INDEX_M=16                    # HNSW M 参数
MAX_CONCURRENT_EMBEDDINGS=10         # 最大并发嵌入请求数

# 检索配置
DEFAULT_TOP_K=5                      # 默认返回结果数
MIN_SIMILARITY_THRESHOLD=0.3         # 最小相似度阈值
HYBRID_SEMANTIC_WEIGHT=0.7           # 混合检索语义权重
HYBRID_KEYWORD_WEIGHT=0.2            # 混合检索关键词权重
HYBRID_METADATA_WEIGHT=0.1           # 混合检索元数据权重
```

**注意事项:**
1. **ChromaDB TypeScript 支持**: ChromaDB 官方 Node.js SDK 对 TypeScript 支持有限，可能需要：
   - 使用 `@ts-ignore` 忽略部分类型错误
   - 手动创建类型定义文件
   - 或使用 `chroma-js` 替代方案

2. **本地嵌入模型限制**: `sentence-transformers` 在 Node.js 中运行需要：
   - 安装 Python 运行时
   - 使用 `child_process` 调用 Python 脚本
   - 或使用 `onnxruntime-node` 运行 ONNX 模型

3. **依赖版本固定**: 建议在 `package.json` 中使用精确版本号（如 `^0.4.22`），避免兼容性问题

### Project Structure Notes

**与现有项目结构对齐:**

1. **Monorepo 结构**: 本故事仅修改 `automaton/` 子项目，不影响 `tinyclaw/`
2. **TypeScript 优先**: 所有代码必须使用 TypeScript，启用严格类型检查
3. **模块化设计**:
   - `memory/` 作为独立子系统，低耦合
   - 通过 `index.ts` 统一导出，隐藏内部实现
   - 遵循单一职责原则，每个文件只负责一个功能

4. **命名规范**:
   - 文件名: 小写+连字符（kebab-case），如 `semantic-retriever.ts`
   - 类名: 大驼峰（PascalCase），如 `ChromaClient`
   - 函数/变量: 小驼峰（camelCase），如 `generateEmbedding`
   - 常量: 大写下划线（UPPER_CASE），如 `DEFAULT_TOP_K`

5. **配置管理**:
   - 所有可配置参数提取到 `config/memory.config.ts`
   - 支持环境变量覆盖（如 API_KEY、向量库地址）
   - 提供默认值和验证逻辑

**潜在冲突与注意事项:**

1. **与 1a.2 上下文聚合器的集成**:
   - 1a.2 已实现上下文聚合功能，本故事需复用其压缩逻辑
   - 需要协调两个故事的接口设计，确保无缝对接
   - 建议先完成 1a.2 再开始本故事，或并行开发但保持接口同步

2. **嵌入模型选择**:
   - 优先使用 OpenAI text-embedding-3-small（性价比高）
   - 需要考虑成本：每次嵌入调用产生 API 费用
   - 实现缓存机制减少重复调用
   - 本地嵌入作为备选方案（适合离线场景）

3. **向量库部署模式**:
   - ChromaDB 支持嵌入式模式（SQLite）和客户端-服务器模式
   - 本地开发推荐嵌入式模式，简化部署
   - 生产环境建议客户端-服务器模式，支持水平扩展

4. **性能权衡**:
   - 语义检索精度 vs 速度：top-K 参数需要调优
   - 向量维度：高维更精确但更慢、更占内存
   - 索引类型：HNSW（快速近似）vs 精确搜索

### Architecture Diagrams

**系统架构图:**
```
┌─────────────────────────────────────────────────────────┐
│                     Automaton Core                      │
│                      (Core Loop)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Memory System Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Working   │  │  Episodic   │  │  Semantic   │   │
│  │   Memory    │  │   Memory    │  │   Memory    │   │
│  └─────────────┘  └─────────────┘  └──────┬──────┘   │
│                                           │           │
└───────────────────────────────────────────┼───────────┘
                                            ▼
┌─────────────────────────────────────────────────────────┐
│              Vector Search Layer                        │
│  ┌──────────────────────────────────────────────┐     │
│  │         EnhancedVectorRetriever              │     │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐│     │
│  │  │   Vector   │  │  Keyword   │  │  Metadata ││     │
│  │  │ Retriever  │  │ Retriever  │  │  Scorer   ││     │
│  │  └──────┬─────┘  └──────┬─────┘  └─────┬─────┘│     │
│  │         └───────────────┴──────────────┘     │     │
│  │           Hybrid Ranking (70/20/10)          │     │
│  └────────────────────┬─────────────────────────┘     │
│                       │                                │
└───────────────────────┼────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Embedding & Storage Layer                  │
│  ┌──────────────────────┐  ┌─────────────────────┐    │
│  │   EmbeddingProvider  │  │   VectorStore       │    │
│  │  ┌────────────────┐  │  │  ┌──────────────┐   │    │
│  │  │OpenAIEmbedder  │  │  │  │ChromaClient  │   │    │
│  │  │LocalEmbedder   │  │  │  │WeaviateClient│   │    │
│  │  └────────┬───────┘  │  │  └──────┬───────┘   │    │
│  └───────────┼──────────┘  └─────────┼────────────┘    │
│              │                        │                 │
│        ┌─────┴────────────────────────┴─────┐          │
│        │        Embedding Cache             │          │
│        │   (LRU + SQLite Persistence)       │          │
│        └────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Persistent Storage                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   better-    │  │   ChromaDB   │  │  Embedding   │ │
│  │   sqlite3    │  │   (Vector)   │  │    Cache     │ │
│  │  (Metadata)  │  │    Index     │  │   SQLite     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**数据流图:**
```
用户查询
    │
    ▼
┌──────────────┐
│  Query Pre-  │  ←  增强查询（扩展缩写、提取术语）
│  processing  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│      Hybrid Retrieval Pipeline       │
│  ┌──────────┐  ┌──────────┐  ┌─────┐│
│  │ Semantic │  │ Keyword  │  │Meta ││
│  │ Search   │  │  Search  │  │data ││
│  └────┬─────┘  └────┬─────┘  └──┬──┘│
│       └──────────────┴──────────┘   │
│          Weighted Scoring           │
│         (70% + 20% + 10%)           │
└────────────┬────────────────────────┘
             │
             ▼
┌──────────────────────┐
│  Result Processing   │  ←  过滤、排序、压缩
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Context Assembly   │  ←  与现有记忆系统合并
└──────────┬───────────┘
           │
           ▼
      返回给 Agent
```

### Code Examples

**VectorStoreInterface 接口定义:**
```typescript
// src/memory/vector-store/types.ts
export interface VectorStoreInterface {
  /**
   * 添加向量到索引
   */
  add(params: {
    ids: string[];
    embeddings: number[][];
    metadatas?: Record<string, any>[];
    documents?: string[];
  }): Promise<void>;

  /**
   * 删除向量
   */
  delete(params: { ids: string[] }): Promise<void>;

  /**
   * 更新向量
   */
  update(params: {
    ids: string[];
    embeddings?: number[][];
    metadatas?: Record<string, any>[];
    documents?: string[];
  }): Promise<void>;

  /**
   * 语义搜索
   */
  query(params: {
    queryEmbeddings: number[][];
    nResults?: number;
    where?: Record<string, any>;
    whereDocument?: Record<string, any>;
  }): Promise<VectorQueryResult>;

  /**
   * 持久化
   */
  persist(): Promise<void>;
}

export interface VectorQueryResult {
  ids: string[][];
  distances?: number[][];
  metadatas?: Record<string, any>[][];
  documents?: string[][];
}
```

**EmbeddingProvider 接口定义:**
```typescript
// src/memory/embedding/types.ts
export interface EmbeddingProvider {
  /**
   * 生成文本嵌入
   */
  embed(texts: string[]): Promise<number[][]>;

  /**
   * 获取嵌入维度
   */
  getDimension(): number;

  /**
   * 批量生成（带缓存）
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingCache {
  get(text: string): number[] | undefined;
  set(text: string, embedding: number[]): void;
  has(text: string): boolean;
}
```

**混合检索实现示例:**
```typescript
// src/memory/retriever/hybrid-retriever.ts
export class HybridRetriever {
  constructor(
    private vectorRetriever: VectorRetriever,
    private keywordRetriever: KeywordRetriever,
    private metadataScorer: MetadataScorer,
    private config: HybridConfig = DEFAULT_HYBRID_CONFIG
  ) {}

  async retrieve(query: string, topK: number = 5): Promise<HybridResult[]> {
    // 1. 生成查询嵌入
    const queryEmbedding = await this.vectorRetriever.embed(query);

    // 2. 并行执行三种检索
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorRetriever.search(queryEmbedding, topK * 2),
      this.keywordRetriever.search(query, topK * 2)
    ]);

    // 3. 合并结果并去重
    const merged = this.mergeResults(vectorResults, keywordResults);

    // 4. 计算混合分数
    const scored = merged.map(result => {
      const vectorScore = result.vectorScore ?? 0;
      const keywordScore = result.keywordScore ?? 0;
      const metadataScore = this.metadataScorer.score(result.metadata);

      const hybridScore =
        (vectorScore * this.config.semanticWeight) +
        (keywordScore * this.config.keywordWeight) +
        (metadataScore * this.config.metadataWeight);

      return { ...result, hybridScore };
    });

    // 5. 排序并返回 top-K
    return scored
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, topK);
  }
}
```

**配置文件示例:**
```typescript
// src/config/memory.config.ts
export const DEFAULT_MEMORY_CONFIG = {
  // 向量库配置
  vectorStore: {
    type: 'chroma' as const,
    mode: 'persistent' as const,
    path: './data/chroma',
    hnsw: {
      efConstruction: 128,
      M: 16,
      ef: 50
    }
  },

  // 嵌入模型配置
  embedding: {
    provider: 'openai' as const,
    model: 'text-embedding-3-small',
    dimension: 1536,
    batchSize: 100,
    cache: {
      maxSize: 10000,
      ttl: 2592000 // 30 days
    }
  },

  // 检索配置
  retrieval: {
    defaultTopK: 5,
    minSimilarity: 0.3,
    hybrid: {
      semanticWeight: 0.7,
      keywordWeight: 0.2,
      metadataWeight: 0.1
    }
  }
} as const;
```

### References

**核心架构文档:**
- [Architecture Overview](docs/upwork_autopilot_detailed_design.md#L25-L90) - Automaton 核心架构和 MemorySystem 子系统
- [Memory System Design](docs/upwork_autopilot_detailed_design.md#L63-L67) - 记忆系统三组件：Retrieval、Ingestion、Compression
- [Technology Stack](docs/upwork_autopilot_detailed_design.md#L264-L267) - 向量库选型：ChromaDB / Weaviate
- [RAG Context](docs/upwork_autopilot_detailed_design.md#L526, L1327) - 上下文摘要用于 RAG
- [Risk Mitigation](docs/upwork_autopilot_detailed_design.md#L3612) - 长程记忆丢失风险及缓解措施
- [External Dependencies](docs/upwork_autopilot_detailed_design.md#L3628) - ChromaDB 作为可选依赖，备选 Weaviate/Pinecone

**Epic 规划文档:**
- [Epic 1a: 记忆系统深度优化](/Users/yongjunwu/trea/jd/_bmad-output/planning-artifacts/epics.md#L49-L54) - 本故事所属 Epic 的整体规划
- [1a.3: 语义检索优化 (向量搜索)](/Users/yongjunwu/trea/jd/_bmad-output/planning-artifacts/epics.md#L52) - 本故事的原始需求描述

**项目结构文档:**
- [JD 项目结构](docs/project-structure.md) - Monorepo 组织方式
- [Automaton 开发指南](docs/development-guide-automaton.md) - TypeScript 开发规范
- [CLAUDE.md](CLAUDE.md) - 项目通用开发原则

**外部技术文档:**
- [ChromaDB 官方文档](https://docs.trychroma.com/) - 向量库使用指南
- [Weaviate 官方文档](https://weaviate.io/developers/weaviate) - 备选向量库
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings) - 文本嵌入服务
- [LangChain Embeddings](https://js.langchain.com/docs/modules/data_connection/text_embedding) - 嵌入封装库（可选）

## Dev Agent Record

### Agent Model Used

qwen3-max-2026-01-23 (Claude Code 4.6)

### Debug Log References

### Completion Notes List

### File List

### Potential Issues & Edge Cases

**技术风险:**
1. **API 成本失控**: 嵌入生成调用频繁可能导致费用超支
   - 缓解: 实现嵌入缓存、批量处理、成本监控

2. **向量库性能瓶颈**: 随着数据量增长，检索速度可能下降
   - 缓解: 使用 HNSW 索引、定期优化、分片存储

3. **内存泄漏**: 连接池或缓存未正确释放
   - 缓解: 实现资源清理钩子、定期检查、压力测试

4. **嵌入维度不一致**: 不同模型生成的向量维度不同
   - 缓解: 统一嵌入模型、验证维度、错误处理

**业务逻辑问题:**
1. **检索结果相关性**: 语义相似度可能无法准确反映业务相关性
   - 缓解: 混合检索（语义+关键词）、人工调优、A/B 测试

2. **上下文过载**: 检索返回太多结果导致上下文窗口溢出
   - 缓解: 智能截断、分层检索、相关性阈值

3. **时效性问题**: 旧记忆可能已过时但仍被检索到
   - 缓解: 时间衰减因子、最近优先、定期清理

**集成问题:**
1. **与 1a.2 接口不匹配**: 上下文聚合器接口变更导致集成失败
   - 缏解: 提前对齐接口设计、版本控制、兼容性测试

2. **Core Loop 阻塞**: 检索耗时过长阻塞 Agent 主循环
   - 缓解: 异步检索、超时控制、降级策略

**测试难点:**
1. **语义检索难以断言**: 相似度分数的预期值不确定
   - 缓解: 使用固定测试集、人工验证、阈值容差

2. **并发测试复杂**: 多线程访问向量库可能产生竞态条件
   - 缓解: 使用隔离测试环境、事务回滚、压力测试

**部署问题:**
1. **向量库版本兼容性**: 不同环境的 ChromaDB 版本可能不一致
   - 缓解: 固定依赖版本、Docker 镜像、环境验证

2. **数据迁移困难**: 从 SQLite 迁移到向量库可能丢失数据
   - 缓解: 增量迁移、备份恢复、数据校验

---

### Implementation Checklist & Recommendations

**🎯 专家审核结论:**

**✅ 通过审核，但建议在开发前完善以下内容:**

1. ✅ **补充数据规模预期** - 已添加：初期 1,000-5,000 篇，中期 50,000+
2. ✅ **添加接口抽象层设计** - 已添加：`VectorStoreInterface` 和 `EmbeddingProvider`
3. ✅ **定义测试数据集** - 已添加：50 篇样本文档，覆盖 5 类场景
4. ✅ **补充环境变量清单** - 已添加：完整配置清单和注意事项
5. ✅ **添加架构图和术语表** - 已添加：系统架构图、数据流图、术语定义
6. ✅ **添加代码示例** - 已添加：接口定义、混合检索实现、配置示例
7. ✅ **补充混合检索策略** - 已添加：70/20/10 权重分配
8. ✅ **添加边界测试用例** - 已添加：空查询、超长文本、并发压力测试

**综合评分: 4.8/5 ⭐⭐⭐⭐⭐ (改进后)**

**开发前准备:**
- [ ] 验证 OpenAI API Key 可用性
- [ ] 确认项目中已存在 `automaton/src/memory/` 目录
- [ ] 检查现有 `EnhancedRetriever` 和 `KnowledgeStore` 实现
- [ ] 准备测试数据集（50 篇样本文档）
- [ ] 确定 ChromaDB 部署模式（embedded vs persistent）

**实施顺序建议:**
1. **第一阶段 (Week 1)**: 基础设施
   - 实现 `VectorStoreInterface` 和 `EmbeddingProvider` 接口
   - 集成 ChromaDB 客户端
   - 实现 OpenAI 嵌入生成
   - 添加嵌入缓存机制

2. **第二阶段 (Week 2)**: 核心功能
   - 实现 `VectorRetriever` 语义搜索
   - 实现 `KeywordRetriever` 关键词搜索
   - 实现 `HybridRetriever` 混合检索
   - 添加结果排序和过滤

3. **第三阶段 (Week 3)**: 集成与优化
   - 扩展 `EnhancedVectorRetriever` 集成向量搜索
   - 为 `KnowledgeStore` 添加向量支持
   - 实现索引优化（HNSW 调优）
   - 添加性能监控和日志

4. **第四阶段 (Week 4)**: 测试与文档
   - 编写单元测试（覆盖率 > 80%）
   - 编写集成测试和性能测试
   - 编写 API 文档和使用示例
   - 更新项目 README

**关键技术决策点:**
1. **向量库选择**: ChromaDB (推荐) - 轻量、易部署、TypeScript 友好
2. **嵌入模型**: OpenAI text-embedding-3-small (推荐) - 高性价比、高精度
3. **索引类型**: HNSW - 平衡精度和速度
4. **缓存策略**: LRU + SQLite 持久化 - 防止内存溢出
5. **检索策略**: 混合检索 (70/20/10) - 结合多种信号

**风险缓解措施:**
- **API 成本超支**: 实现缓存、批量处理、成本监控告警
- **性能瓶颈**: 使用 HNSW 索引、连接池、异步处理
- **内存泄漏**: 实现资源清理钩子、定期压力测试
- **嵌入维度不一致**: 统一模型、验证维度、错误处理
- **集成失败**: 提前对齐接口、版本控制、兼容性测试

**质量保障:**
- 代码审查 (至少 2 人)
- 静态类型检查 (TypeScript strict mode)
- 单元测试覆盖率 > 80%
- 集成测试覆盖主要场景
- 性能基准测试（95% 请求 < 100ms）
- 安全性检查（API Key 保护、输入验证）

**文档交付物:**
- [ ] 技术设计文档（本文件）
- [ ] API 文档（JSDoc 注释）
- [ ] 使用示例（README 更新）
- [ ] 性能测试报告
- [ ] 部署指南

