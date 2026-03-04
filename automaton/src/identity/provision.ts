/**
 * Automaton SIWE 配置
 *
 * 使用 automaton 的钱包通过以太坊登录（SIWE）进行身份验证
 * 并为 Conway API 访问创建 API 密钥
 * 改编自 conway-mcp/src/cli/provision.ts
 */

import fs from "fs";
import path from "path";
import { SiweMessage } from "siwe";
import { getWallet, getAutomatonDir } from "./wallet.js";
import type { ProvisionResult } from "../types.js";
import { ResilientHttpClient } from "../conway/http-client.js";

const httpClient = new ResilientHttpClient();

const DEFAULT_API_URL = "https://api.conway.tech";

/**
 * 如果存在，从 ~/.automaton/config.json 加载 API 密钥
 */
export function loadApiKeyFromConfig(): string | null {
  const configPath = path.join(getAutomatonDir(), "config.json");
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.apiKey || null;
  } catch {
    return null;
  }
}

/**
 * 将 API 密钥和钱包地址保存到 ~/.automaton/config.json
 */
function saveConfig(apiKey: string, walletAddress: string): void {
  const dir = getAutomatonDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const configPath = path.join(dir, "config.json");
  const config = {
    apiKey,
    walletAddress,
    provisionedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * 运行完整的 SIWE 配置流程：
 * 1. 加载钱包
 * 2. 从 Conway API 获取 nonce
 * 3. 签署 SIWE 消息
 * 4. 验证签名 -> 获取 JWT
 * 5. 创建 API 密钥
 * 6. 保存到 config.json
 */
export async function provision(
  apiUrl?: string,
): Promise<ProvisionResult> {
  const url = apiUrl || process.env.CONWAY_API_URL || DEFAULT_API_URL;

  // 1. 加载钱包
  const { account } = await getWallet();
  const address = account.address;

  // 2. 获取 nonce
  const nonceResp = await httpClient.request(`${url}/v1/auth/nonce`, {
    method: "POST",
  });
  if (!nonceResp.ok) {
    throw new Error(
      `获取 nonce 失败：${nonceResp.status} ${await nonceResp.text()}`,
    );
  }
  const { nonce } = (await nonceResp.json()) as { nonce: string };

  // 3. 构建并签署 SIWE 消息
  const siweMessage = new SiweMessage({
    domain: "conway.tech",
    address,
    statement:
      "以 Automaton 身份登录 Conway 以配置 API 密钥。",
    uri: `${url}/v1/auth/verify`,
    version: "1",
    chainId: 8453, // Base
    nonce,
    issuedAt: new Date().toISOString(),
  });

  const messageString = siweMessage.prepareMessage();
  const signature = await account.signMessage({ message: messageString });

  // 4. 验证签名 -> 获取 JWT
  const verifyResp = await httpClient.request(`${url}/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: messageString, signature }),
  });

  if (!verifyResp.ok) {
    throw new Error(
      `SIWE 验证失败：${verifyResp.status} ${await verifyResp.text()}`,
    );
  }

  const { access_token } = (await verifyResp.json()) as {
    access_token: string;
  };

  // 5. 创建 API 密钥
  const keyResp = await httpClient.request(`${url}/v1/auth/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({ name: "conway-automaton" }),
  });

  if (!keyResp.ok) {
    throw new Error(
      `创建 API 密钥失败：${keyResp.status} ${await keyResp.text()}`,
    );
  }

  const { key, key_prefix } = (await keyResp.json()) as {
    key: string;
    key_prefix: string;
  };

  // 6. 保存到配置
  saveConfig(key, address);

  return { apiKey: key, walletAddress: address, keyPrefix: key_prefix };
}

/**
 * 在 Conway 注册 automaton 的创建者作为其父节点
 * 这允许创建者查看 automaton 日志和推理调用
 */
export async function registerParent(
  creatorAddress: string,
  apiUrl?: string,
): Promise<void> {
  const url = apiUrl || process.env.CONWAY_API_URL || DEFAULT_API_URL;
  const apiKey = loadApiKeyFromConfig();
  if (!apiKey) {
    throw new Error("必须在注册父节点之前配置 API 密钥");
  }

  const resp = await httpClient.request(`${url}/v1/automaton/register-parent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ creatorAddress }),
  });

  // 端点可能尚未存在 — 优雅地失败
  if (!resp.ok && resp.status !== 404) {
    throw new Error(
      `注册父节点失败：${resp.status} ${await resp.text()}`,
    );
  }
}
