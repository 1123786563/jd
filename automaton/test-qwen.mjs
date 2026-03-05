#!/usr/bin/env node
/**
 * Qwen 模型测试脚本
 * 测试 Automaton 是否能正确调用 Qwen API
 */

import OpenAI from 'openai';

import fs from 'fs';
import path from 'path';

// 从环境变量或配置文件获取 API Key
let QWEN_API_KEY = process.env.QWEN_API_KEY;

// 如果环境变量没有，尝试从配置文件读取
if (!QWEN_API_KEY) {
  const configPath = path.join(process.env.HOME || '', '.automaton', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    QWEN_API_KEY = config.qwenApiKey;
    if (QWEN_API_KEY) {
      console.log('✅ 从配置文件读取到 qwenApiKey');
    }
  }
  } catch (e) {
    console.log('⚠️ 读取配置文件失败:', e.message);
  }
}
const QWEN_BASE_URL = 'https://coding.dashscope.aliyuncs.com/v1';

async function main() {
  console.log('=== Qwen 模型测试 ===\n');

  if (!QWEN_API_KEY) {
    console.error('❌ QWEN_API_KEY 环境变量未设置');
    console.log('\n请设置环境变量:');
    console.log('  export QWEN_API_KEY="sk-你的qwen-api-key"');
    console.log('\n或者在 ~/.automaton/config.json 中添加:');
    console.log('  "qwenApiKey": "sk-你的qwen-api-key"');
    process.exit(1);
  }

  console.log(`✅ QWEN_API_KEY 已设置 (${QWEN_API_KEY.length} 字符)`);
  console.log(`📡 Base URL: ${QWEN_BASE_URL}\n`);

  const client = new OpenAI({
    apiKey: QWEN_API_KEY,
    baseURL: QWEN_BASE_URL,
  });

  // 测试模型列表
  const models = [
    'qwen-turbo',      // 快速经济型
    'qwen-plus',       // 平衡型
    'qwen3.5-plus',    // 新版推荐
  ];

  for (const model of models) {
    console.log(`\n--- 测试模型: ${model} ---`);

    try {
      const startTime = Date.now();
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'user', content: '你好，请用一句话介绍自己。' }
        ],
        max_tokens: 100,
      });
      const latency = Date.now() - startTime;

      console.log(`✅ 成功! 延迟: ${latency}ms`);
      console.log(`📝 回复: ${response.choices[0]?.message?.content?.substring(0, 100)}...`);
      console.log(`📊 Tokens: 输入=${response.usage?.prompt_tokens || 'N/A'}, 输出=${response.usage?.completion_tokens || 'N/A'}`);
    } catch (error) {
      console.error(`❌ 失败: ${error.message}`);
      if (error.status) {
        console.error(`   HTTP 状态: ${error.status}`);
      }
    }
  }

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
