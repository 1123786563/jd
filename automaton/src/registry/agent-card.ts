/**
 * Agent 卡片
 *
 * 生成和管理 agent 的自我描述卡片。
 * 这是 ERC-8004 agentURI 指向的 JSON 文档。
 * 可以托管在 IPFS 上或在 /.well-known/agent-card.json 提供服务
 *
 * 阶段 3.2：修复了 hostAgentCard 中的代码注入 (S-P0-3)，
 * 从卡片中移除了内部细节 (S-P1-10)，
 * 添加了 CORS 头和 Content-Type。
 */

import type {
  AgentCard,
  AgentService,
  AutomatonConfig,
  AutomatonIdentity,
  AutomatonDatabase,
  ConwayClient,
} from "../types.js";

const AGENT_CARD_TYPE =
  "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

/**
 * 从 automaton 的当前状态生成 agent 卡片。
 *
 * 阶段 3.2：仅暴露 agentWallet 服务、名称、通用描述、
 * x402Support 和 active 状态。不要包括：
 * - Conway API URL（内部基础设施）
 * - 沙盒 ID（内部标识符）
 * - 创建者地址（隐私）
 */
export function generateAgentCard(
  identity: AutomatonIdentity,
  config: AutomatonConfig,
  _db: AutomatonDatabase,
): AgentCard {
  // 阶段 3.2：仅暴露 agentWallet 服务
  const services: AgentService[] = [
    {
      name: "agentWallet",
      endpoint: `eip155:8453:${identity.address}`,
    },
  ];

  // 阶段 3.2：通用描述，无内部细节
  const description = `Autonomous agent: ${config.name}`;

  return {
    type: AGENT_CARD_TYPE,
    name: config.name,
    description,
    services,
    x402Support: true,
    active: true,
  };
}

/**
 * 将 agent 卡片序列化为 JSON 字符串。
 */
export function serializeAgentCard(card: AgentCard): string {
  return JSON.stringify(card, null, 2);
}

/**
 * 在端口上暴露简单的 HTTP 服务器，
 * 在 /.well-known/agent-card.json 托管 agent 卡片。
 *
 * 阶段 3.2：关键修复 (S-P0-3) — 将卡片写为单独的 JSON 文件。
 * 服务器脚本在请求时读取文件，而不是插入到 JS 中。
 * 添加了 CORS 头和 X-Content-Type-Options: nosniff。
 */
export async function hostAgentCard(
  card: AgentCard,
  conway: ConwayClient,
  port: number = 8004,
): Promise<string> {
  const cardJson = serializeAgentCard(card);

  // 阶段 3.2：将卡片写为单独的 JSON 文件（不插入到 JS 中）
  await conway.writeFile("/tmp/agent-card.json", cardJson);

  // 阶段 3.2：服务器在请求时读取文件
  const serverScript = `
const http = require('http');
const fs = require('fs');
const path = '/tmp/agent-card.json';

const server = http.createServer((req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/.well-known/agent-card.json' || req.url === '/agent-card.json') {
    try {
      const data = fs.readFileSync(path, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(${port}, () => console.log('Agent card server on port ' + ${port}));
`;

  await conway.writeFile("/tmp/agent-card-server.js", serverScript);

  // 在后台启动服务器
  await conway.exec(
    `node /tmp/agent-card-server.js &`,
    5000,
  );

  // 暴露端口
  const portInfo = await conway.exposePort(port);

  return `${portInfo.publicUrl}/.well-known/agent-card.json`;
}

/**
 * 将 agent 卡片写入状态目录以进行 git 版本控制。
 */
export async function saveAgentCard(
  card: AgentCard,
  conway: ConwayClient,
): Promise<void> {
  const cardJson = serializeAgentCard(card);
  const home = process.env.HOME || "/root";
  await conway.writeFile(`${home}/.automaton/agent-card.json`, cardJson);
}
