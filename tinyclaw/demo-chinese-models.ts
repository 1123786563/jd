/**
 * 国产大模型端到端功能演示
 * 展示如何在 TinyClaw 中实际使用智普、Kimi、Qwen
 */

import { resolveZhipuModel, resolveKimiModel, resolveQwenModel } from './src/lib/config';
import { AgentConfig } from './src/lib/types';

console.log('🚀 TinyClaw 国产大模型功能演示');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ============================================
// 1. 配置示例
// ============================================
console.log('📄 1. 配置示例 (settings.json)\n');

const exampleConfig = {
  workspace: {
    path: '/Users/me/tinyclaw-workspace',
    name: 'tinyclaw-workspace'
  },
  agents: {
    'zhipu-fast': {
      name: '智普快速助手',
      provider: 'zhipu',
      model: 'glm-4-air',
      working_directory: '/Users/me/tinyclaw-workspace/zhipu-fast'
    },
    'qwen-main': {
      name: '通义千问主力',
      provider: 'qwen',
      model: 'qwen-max',
      working_directory: '/Users/me/tinyclaw-workspace/qwen-main'
    },
    'kimi-research': {
      name: 'Kimi 研究助手',
      provider: 'kimi',
      model: 'kimi-k2.5',
      working_directory: '/Users/me/tinyclaw-workspace/kimi-research'
    }
  }
};

console.log(JSON.stringify(exampleConfig, null, 2));

// ============================================
// 2. Provider 和模型解析演示
// ============================================
console.log('\n\n🔍 2. Provider 和模型解析演示');

const demoAgents: AgentConfig[] = [
  { name: '智普助手', provider: 'zhipu', model: 'glm-4-air', working_directory: '/tmp' },
  { name: '通义助手', provider: 'qwen', model: 'qwen-max', working_directory: '/tmp' },
  { name: 'Kimi 助手', provider: 'kimi', model: 'kimi-k2.5', working_directory: '/tmp' },
];

demoAgents.forEach((agent, i) => {
  console.log(`\n  Agent ${i + 1}: ${agent.name}`);
  console.log(`    Provider: ${agent.provider}`);
  console.log(`    Model: ${agent.model}`);

  let resolvedModel = '';
  if (agent.provider === 'zhipu' || agent.provider === 'glm') {
    resolvedModel = resolveZhipuModel(agent.model);
  } else if (agent.provider === 'kimi' || agent.provider === 'moonshot') {
    resolvedModel = resolveKimiModel(agent.model);
  } else if (agent.provider === 'qwen' || agent.provider === 'tongyi' || agent.provider === 'alibaba') {
    resolvedModel = resolveQwenModel(agent.model);
  }

  console.log(`    Resolved Model: ${resolvedModel}`);
  console.log(`    OpenCode 调用: opencode run --model ${agent.provider}/${resolvedModel} "你的消息"`);
});

// ============================================
// 3. 使用场景演示
// ============================================
console.log('\n\n💡 3. 使用场景演示\n');

const scenarios = [
  {
    title: '场景 1: 快速代码生成',
    agent: 'zhipu-fast',
    provider: 'zhipu',
    model: 'glm-4-air',
    message: '@zhipu-fast 请帮我写一个 Python 爬虫，爬取新闻网站',
    expected: '快速生成高质量的爬虫代码'
  },
  {
    title: '场景 2: 复杂文档分析',
    agent: 'kimi-research',
    provider: 'kimi',
    model: 'kimi-k2.5',
    message: '@kimi-research 请总结这篇论文的主要贡献',
    expected: '利用 128K 上下文进行深度分析'
  },
  {
    title: '场景 3: 高质量内容创作',
    agent: 'qwen-main',
    provider: 'qwen',
    model: 'qwen-max',
    message: '@qwen-main 请帮我写一篇技术博客文章',
    expected: '生成结构完整、内容丰富的文章'
  }
];

scenarios.forEach((scenario, i) => {
  console.log(`📌 ${scenario.title}`);
  console.log(`   代理: @${scenario.agent} (${scenario.provider}/${scenario.model})`);
  console.log(`   消息: "${scenario.message}"`);
  console.log(`   期望: ${scenario.expected}\n`);
});

// ============================================
// 4. 团队协作演示
// ============================================
console.log('👥 4. 团队协作演示 (使用多个国产模型)\n');

const teamConfig = {
  teams: {
    'ai-research-team': {
      name: 'AI 研究团队',
      agents: ['zhipu-fast', 'qwen-main', 'kimi-research'],
      leader_agent: 'zhipu-fast'
    }
  }
};

console.log('  团队配置:');
console.log(JSON.stringify(teamConfig, null, 2));

console.log('\n  使用方式:');
console.log('  @ai-research-team 请帮我完成这个 AI 项目:');
console.log('    1. @zhipu-fast 快速原型开发');
console.log('    2. @qwen-main 详细文档编写');
console.log('    3. @kimi-research 论文调研和分析');

// ============================================
// 5. 性能对比
// ============================================
console.log('\n\n📊 5. 模型性能对比 (推荐使用场景)\n');

const performanceTable = `
  模型          | 速度    | 质量    | 成本    | 推荐场景
  ──────────────+────────+────────+────────+──────────────────
  glm-4-air     | ⚡⚡⚡⚡  | ⭐⭐⭐   | 💰      | 快速响应、简单任务
  glm-4         | ⚡⚡⚡   | ⭐⭐⭐⭐  | 💰💰    | 通用场景
  glm-4-plus    | ⚡⚡    | ⭐⭐⭐⭐⭐ | 💰💰💰  | 高质量生成
  ──────────────+────────+────────+────────+──────────────────
  kimi-k2.5     | ⚡⚡    | ⭐⭐⭐⭐⭐ | 💰💰💰  | 长文档、研究分析
  kimi-free     | ⚡⚡    | ⭐⭐⭐⭐  | 💰      | 成本敏感场景
  ──────────────+────────+────────+────────+──────────────────
  qwen-turbo    | ⚡⚡⚡⚡  | ⭐⭐⭐   | 💰      | 快速响应
  qwen-plus     | ⚡⚡⚡   | ⭐⭐⭐⭐  | 💰💰    | 平衡性能
  qwen-max      | ⚡⚡    | ⭐⭐⭐⭐⭐ | 💰💰💰  | 最高质量输出
`;

console.log(performanceTable);

// ============================================
// 6. 完整工作流演示
// ============================================
console.log('📝 6. 完整工作流演示 (从零开始)\n');

const workflowSteps = [
  {
    step: 1,
    title: '安装 OpenCode CLI',
    command: 'npm install -g @opencode/cli'
  },
  {
    step: 2,
    title: '配置 API 密钥',
    commands: [
      'opencode config set zhipu.api_key "your-zhipu-key"',
      'opencode config set kimi.api_key "your-kimi-key"',
      'opencode config set qwen.api_key "your-qwen-key"'
    ]
  },
  {
    step: 3,
    title: '启动 TinyClaw',
    command: 'tinyclaw start'
  },
  {
    step: 4,
    title: '打开 TinyOffice',
    command: 'cd tinyclaw/tinyoffice && npm run dev'
  },
  {
    step: 5,
    title: '创建代理',
    description: '在 http://localhost:3000 的 Agents 页面'
  },
  {
    step: 6,
    title: '开始对话',
    command: '@zhipu-fast 请帮我写一个 Node.js 脚本'
  }
];

workflowSteps.forEach(({ step, title, command, commands, description }) => {
  console.log(`  ${step}. ${title}`);
  if (command) {
    console.log(`     $ ${command}`);
  }
  if (commands) {
    commands.forEach(cmd => console.log(`     $ ${cmd}`));
  }
  if (description) {
    console.log(`     ${description}`);
  }
  console.log();
});

// ============================================
// 7. 常见问题
// ============================================
console.log('❓ 7. 常见问题\n');

const faqs = [
  {
    question: 'Q: 如何获取这些模型的 API 密钥？',
    answer: 'A: 访问对应的开放平台:\n   - 智普: https://open.bigmodel.cn/\n   - Kimi: https://platform.moonshot.cn/\n   - 通义: https://bailian.console.aliyun.com/'
  },
  {
    question: 'Q: 可以同时使用多个模型吗？',
    answer: 'A: 可以！可以为每个任务创建不同的代理，或组成团队协作。'
  },
  {
    question: 'Q: 模型响应慢怎么办？',
    answer: 'A: 选择轻量版模型 (glm-4-air, qwen-turbo) 或检查网络连接。'
  },
  {
    question: 'Q: API 配额用完了怎么办？',
    answer: 'A: 在对应平台充值或升级套餐，或切换到其他模型。'
  }
];

faqs.forEach(({ question, answer }) => {
  console.log(`  ${question}`);
  console.log(`  ${answer}\n`);
});

// ============================================
// 结束
// ============================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 演示完成！现在可以开始使用国产大模型了。');
console.log('📖 更多文档: 查看 docs/ 目录下的相关文档');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
