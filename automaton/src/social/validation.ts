/**
 * 消息验证
 *
 * 验证社交消息的大小限制、重放保护和地址格式。
 *
 * Phase 3.2: 社交与注册表加固
 */

import type { MessageValidationResult } from "../types.js";
import { MESSAGE_LIMITS } from "./signing.js";

/**
 * 验证社交消息的大小、时间戳和地址约束。
 */
export function validateMessage(message: {
  from: string;
  to: string;
  content: string;
  signed_at?: string;
  timestamp?: string;
}): MessageValidationResult {
  const errors: string[] = [];

  // 大小限制
  const totalSize = JSON.stringify(message).length;
  if (totalSize > MESSAGE_LIMITS.maxTotalSize) {
    errors.push(`Message exceeds total size limit: ${totalSize} > ${MESSAGE_LIMITS.maxTotalSize}`);
  }
  if (message.content.length > MESSAGE_LIMITS.maxContentLength) {
    errors.push(`Content exceeds size limit: ${message.content.length} > ${MESSAGE_LIMITS.maxContentLength}`);
  }

  // 时间戳验证（重放保护）
  const ts = message.signed_at || message.timestamp;
  if (ts) {
    const parsed = new Date(ts).getTime();
    if (isNaN(parsed)) {
      errors.push("Invalid timestamp");
    } else {
      const age = Date.now() - parsed;
      if (age > MESSAGE_LIMITS.replayWindowMs) {
        errors.push("Message too old (possible replay)");
      }
      if (age < -60_000) {
        errors.push("Message from future");
      }
    }
  }

  // 地址验证
  if (!isValidAddress(message.from)) {
    errors.push("Invalid sender address");
  }
  if (!isValidAddress(message.to)) {
    errors.push("Invalid recipient address");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证中继 URL 是否使用 HTTPS。
 * 如果 URL 不是 HTTPS 则抛出异常。
 */
export function validateRelayUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid relay URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Relay URL must use HTTPS: ${url}`);
  }
}

/**
 * 检查字符串是否为有效的以太坊样式十六进制地址。
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
