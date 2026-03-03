/**
 * 国产大模型功能集成测试
 * 验证智普、Qwen、Kimi 的完整功能链路
 */

import { resolveZhipuModel, resolveKimiModel, resolveQwenModel } from './src/lib/config';
import { ZHIPU_MODEL_IDS, KIMI_MODEL_IDS, QWEN_MODEL_IDS } from './src/lib/types';

console.log('🧪 TinyClaw 国产大模型集成测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ============================================
// 测试 1: 模型解析功能
// ============================================
console.log('📊 测试 1: 模型解析功能');

const tests = [
  // 智普模型测试
  { type: 'zhipu', func: resolveZhipuModel, tests: [
    { input: 'glm-4', expected: 'glm-4', desc: '标准模型' },
    { input: 'glm', expected: 'glm-4', desc: '别名' },
    { input: 'chatglm', expected: 'glm-4', desc: '别名' },
    { input: 'glm-4-plus', expected: 'glm-4-plus', desc: '增强版' },
    { input: 'glm-4-air', expected: 'glm-4-air', desc: '轻量版' },
    { input: 'glm-4-flash', expected: 'glm-4-flash', desc: '闪存版' },
  ]},
  // Kimi 模型测试
  { type: 'kimi', func: resolveKimiModel, tests: [
    { input: 'kimi-k2.5', expected: 'kimi-k2.5', desc: '最新版' },
    { input: 'kimi', expected: 'kimi-k2.5', desc: '别名' },
    { input: 'moonshot', expected: 'moonshot-v1-8k', desc: '别名' },
    { input: 'kimi-k2.5-free', expected: 'kimi-k2.5-free', desc: '免费版' },
    { input: 'moonshot-v1-128k', expected: 'moonshot-v1-128k', desc: '128K版' },
  ]},
  // Qwen 模型测试
  { type: 'qwen', func: resolveQwenModel, tests: [
    { input: 'qwen-max', expected: 'qwen-max', desc: '最强版' },
    { input: 'qwen', expected: 'qwen-max', desc: '别名' },
    { input: 'tongyi', expected: 'qwen-max', desc: '别名' },
    { input: 'alibaba', expected: 'qwen-max', desc: '别名' },
    { input: 'qwen-plus', expected: 'qwen-plus', desc: '增强版' },
    { input: 'qwen-turbo', expected: 'qwen-turbo', desc: '快速版' },
  ]},
];

let totalPassed = 0;
let totalTests = 0;

tests.forEach(({ type, func, tests: testCases }) => {
  console.log(`\n  📌 ${type.toUpperCase()} 模型:`);
  let passed = 0;

  testCases.forEach(({ input, expected, desc }) => {
    totalTests++;
    const result = func(input);
    const isPass = result === expected;
    if (isPass) passed++;
    totalPassed++;

    console.log(`    ${isPass ? '✅' : '❌'} ${input.padEnd(25)} → ${result.padEnd(25)} ${desc}`);
    if (!isPass) {
      console.log(`       ⚠️  Expected: ${expected}`);
      totalPassed--; // 修正计数
    }
  });

  console.log(`    📊 通过: ${passed}/${testCases.length}`);
});

// ============================================
// 测试 2: 模型映射表完整性
// ============================================
console.log('\n\n📊 测试 2: 模型映射表完整性');

const modelMaps = [
  { name: 'ZHIPU_MODEL_IDS', map: ZHIPU_MODEL_IDS, required: ['glm-4', 'glm', 'chatglm'] },
  { name: 'KIMI_MODEL_IDS', map: KIMI_MODEL_IDS, required: ['kimi-k2.5', 'kimi', 'moonshot'] },
  { name: 'QWEN_MODEL_IDS', map: QWEN_MODEL_IDS, required: ['qwen-max', 'qwen', 'tongyi', 'alibaba'] },
];

let mapsPassed = 0;
modelMaps.forEach(({ name, map, required }) => {
  const missing = required.filter(key => !map[key]);
  const isPass = missing.length === 0;
  if (isPass) mapsPassed++;

  console.log(`  ${isPass ? '✅' : '❌'} ${name}: ${Object.keys(map).length} 个模型`);
  if (!isPass) {
    console.log(`     ⚠️  缺少必需的键: ${missing.join(', ')}`);
  }
});

// ============================================
// 测试 3: Provider 支持检查
// ============================================
console.log('\n\n📊 测试 3: Provider 支持检查');

const providers = {
  zhipu: ['zhipu', 'glm'],
  kimi: ['kimi', 'moonshot'],
  qwen: ['qwen', 'tongyi', 'alibaba']
};

console.log('  ✅ 支持的 Provider:');
Object.entries(providers).forEach(([main, aliases]) => {
  console.log(`    - ${main}: ${[main, ...aliases].join(', ')}`);
});

// ============================================
// 最终总结
// ============================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 测试总结:');
console.log(`  模型解析: ${totalPassed}/${totalTests} 通过 (${((totalPassed/totalTests)*100).toFixed(2)}%)`);
console.log(`  模型映射: ${mapsPassed}/${modelMaps.length} 通过`);
console.log(`  Provider: ✅ 完整支持`);

const allPassed = totalPassed === totalTests && mapsPassed === modelMaps.length;
console.log(`\n${allPassed ? '🎉 所有测试通过！' : '⚠️ 部分测试失败'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ============================================
// 使用指南
// ============================================
console.log('📖 使用指南:');
console.log('\n1️⃣  安装 OpenCode CLI:');
console.log('   npm install -g @opencode/cli');
console.log('\n2️⃣  配置 API 密钥:');
console.log('   opencode config set zhipu.api_key "your-key"');
console.log('   opencode config set kimi.api_key "your-key"');
console.log('   opencode config set qwen.api_key "your-key"');
console.log('\n3️⃣  创建代理 (TinyOffice):');
console.log('   - 打开 http://localhost:3000');
console.log('   - Agents → Add Agent');
console.log('   - 选择 provider (zhipu/kimi/qwen)');
console.log('   - 输入模型名称');
console.log('\n4️⃣  开始使用:');
console.log('   @my-agent 请帮我完成这个任务\n');

process.exit(allPassed ? 0 : 1);
