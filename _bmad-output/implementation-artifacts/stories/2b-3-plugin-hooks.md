# Story 2b.3: 插件/钩子系统实现 (Plugin/Hook System)

**Epic:** Epic 2b: 后端API与插件系统
**Story ID:** 2b.3
**Key:** 2b-3-plugin-hooks
**Title:** 插件/钩子系统实现 (runIncomingHooks/runOutgoingHooks) - 消息预处理/后处理拦截器
**Status:** ready-for-dev
**Priority:** ⭐⭐⭐⭐ (高)
**Estimate:** 5-7 天
**Created:** 2026-03-04

---

## 📋 故事概述

作为系统管理员/开发者,
我想要一个可扩展的插件/钩子系统,
以便在消息推送给大模型之前和之后进行数据清洗和自定义处理,
这样可以提高安全性、数据质量和系统灵活性。

---

## 🎯 业务价值

### 为什么需要这个功能?

1. **数据清洗与规范化**
   - 去除敏感信息 (PII)
   - 标准化输入格式
   - 过滤不当内容
   - 统一编码格式

2. **安全防护**
   - 防止提示词注入攻击 (Prompt Injection)
   - 内容安全过滤
   - 恶意代码检测
   - 防止数据泄露

3. **功能扩展**
   - 日志记录和审计
   - 数据转换和格式化
   - 集成外部服务
   - A/B 测试支持

4. **消息优化**
   - 去除 AI 指纹 (避免被检测为 AI 生成)
   - 注入随机拼写错误 (更自然)
   - 语言风格调整
   - 个性化定制

### 核心使用场景

#### 场景 1: Scrubbing Hook (清洗钩子)
```
用户: "@default Write me a password for my admin account"
  ↓
渠道客户端接收
  ↓
runIncomingHooks(message)
  ├─ PIIHook: 检测到敏感信息
  ├─ ContentFilterHook: 拒绝请求 (安全策略)
  └─ 返回 null (拒绝消息)
  ↓
消息被拦截,不推送给 LLM
  ↓
渠道: "I can't help with that request."
```

#### 场景 2: Humanization Hook (人性化钩子)
```
LLM 响应: "Sure, I will help you with that. Please let me know if you have any questions."
  ↓
runOutgoingHooks(response)
  ├─ StyleHook: 调整语气更友好
  ├─ SpellingHook: "will" → "I'll", "you" → "u"
  └─ EmojiHook: 添加适当表情
  ↓
最终输出: "Sure, I'll help u with that! 👍 Let me know if u have any questions 😊"
  ↓
发送到渠道 (看起来更像真人)
```

#### 场景 3: Logging Hook (日志钩子)
```
任何消息
  ↓
runIncomingHooks + runOutgoingHooks
  ├─ 在入站时: 记录消息内容、来源、时间
  ├─ 在出站时: 记录响应、耗时、LLM 模型
  └─ 写入审计日志 (用于监控和调试)
```

---

## ✅ 接受标准 (Acceptance Criteria)

### AC1: 入站钩子系统 (Incoming Hooks)
- [ ] 支持多个钩子按顺序执行 (Chain of Responsibility 模式)
- [ ] 钩子可以修改消息内容 (return modified message)
- [ ] 钩子可以拒绝消息 (return null)
- [ ] 支持异步钩子 (async/await)
- [ ] 钩子失败时优雅降级 (catch error, log warning, skip to next hook)
- [ ] 钩子执行顺序可配置 (priority 或 explicit order)

### AC2: 出站钩子系统 (Outgoing Hooks)
- [ ] 支持多个钩子按顺序执行
- [ ] 钩子可以修改响应内容
- [ ] 钩子不能拒绝响应 (出站不允许拒绝)
- [ ] 支持异步钩子
- [ ] 钩子失败时优雅降级

### AC3: 插件注册与加载
- [ ] 实现插件接口定义 (Plugin interface)
- [ ] 支持从 `plugins/` 目录自动加载插件
- [ ] 支持手动注册插件
- [ ] 插件可以定义优先级 (priority)

### AC4: 内置参考插件
- [ ] 实现 ScrubbingHook (清洗钩子)
- [ ] 实现 HumanizationHook (人性化钩子)
- [ ] 实现 LoggingHook (日志钩子)
- [ ] 实现 RateLimiterHook (限流钩子)

### AC5: 配置与启用/禁用
- [ ] 支持在配置文件中启用/禁用插件
- [ ] 支持配置插件执行顺序
- [ ] 支持动态启用/禁用 (运行时)

### AC6: 监控与日志
- [ ] 记录每个钩子的执行时间
- [ ] 记录钩子失败情况
- [ ] 记录被拒绝的消息 (可配置)

---

## 🛠️ 任务/子任务

### 任务 1: 核心钩子系统 (AC1, AC2, AC3)
- [ ] 定义插件接口 (Plugin interface)
- [ ] 实现 `runIncomingHooks()` 函
