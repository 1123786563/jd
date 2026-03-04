/**
 * 统一签名消息协议
 *
 * 定义签名消息接口和使用 ECDSA secp256k1 进行消息创建
 * 和验证的工具。
 *
 * Phase 3.2: 社交与注册表加固
 */

import crypto from "crypto";
import { ulid } from "ulid";
import {
  keccak256,
  toBytes,
  verifyMessage,
} from "viem";

/**
 * 完整签名的社交消息。
 */
export interface SignedMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

/**
 * 使用 ULID 创建唯一的消息 ID。
 */
export function createMessageId(): string {
  return ulid();
}

/**
 * 创建加密随机数以用于重放保护。
 */
export function createNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * 验证 ECDSA secp256k1 消息签名。
 *
 * 重建签名期间使用的规范字符串，并对照预期发件人地址
 * 验证签名。
 */
export async function verifyMessageSignature(
  message: { to: string; content: string; signed_at: string; signature: string },
  expectedFrom: string,
): Promise<boolean> {
  try {
    const contentHash = keccak256(toBytes(message.content));
    const canonical = `Conway:send:${message.to.toLowerCase()}:${contentHash}:${message.signed_at}`;

    const valid = await verifyMessage({
      address: expectedFrom as `0x${string}`,
      message: canonical,
      signature: message.signature as `0x${string}`,
    });

    return valid;
  } catch {
    return false;
  }
}
