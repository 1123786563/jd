/**
 * 社交签名模块
 *
 * 运行时和 CLI 的唯一规范签名实现。
 * 使用 viem 的 account.signMessage() 进行 ECDSA secp256k1 签名。
 *
 * Phase 3.2: 社交与注册表加固 (S-P0-1)
 */

import {
  type PrivateKeyAccount,
  keccak256,
  toBytes,
} from "viem";
import type { SignedMessagePayload } from "../types.js";

export const MESSAGE_LIMITS = {
  maxContentLength: 64_000, // 64KB
  maxTotalSize: 128_000, // 128KB
  replayWindowMs: 300_000, // 5 minutes
  maxOutboundPerHour: 100,
} as const;

/**
 * 签名发送消息负载。
 *
 * 规范格式：Conway:send:{to_lowercase}:{keccak256(toBytes(content))}:{signed_at_iso}
 */
export async function signSendPayload(
  account: PrivateKeyAccount,
  to: string,
  content: string,
  replyTo?: string,
): Promise<SignedMessagePayload> {
  if (content.length > MESSAGE_LIMITS.maxContentLength) {
    throw new Error(
      `Message content too long: ${content.length} bytes (max ${MESSAGE_LIMITS.maxContentLength})`,
    );
  }

  const signedAt = new Date().toISOString();
  const contentHash = keccak256(toBytes(content));
  const canonical = `Conway:send:${to.toLowerCase()}:${contentHash}:${signedAt}`;
  const signature = await account.signMessage({ message: canonical });

  return {
    from: account.address.toLowerCase(),
    to: to.toLowerCase(),
    content,
    signed_at: signedAt,
    signature,
    reply_to: replyTo,
  };
}

/**
 * 签名轮询负载。
 *
 * 规范格式：Conway:poll:{address_lowercase}:{timestamp_iso}
 */
export async function signPollPayload(
  account: PrivateKeyAccount,
): Promise<{ address: string; signature: string; timestamp: string }> {
  const timestamp = new Date().toISOString();
  const canonical = `Conway:poll:${account.address.toLowerCase()}:${timestamp}`;
  const signature = await account.signMessage({ message: canonical });

  return {
    address: account.address.toLowerCase(),
    signature,
    timestamp,
  };
}
