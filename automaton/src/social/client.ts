/**
 * 社交客户端工厂
 *
 * 为 Automaton 运行时创建 SocialClient。
 * 自包含：使用 viem 进行签名，使用 fetch 进行 HTTP 请求。
 *
 * Phase 3.2: 通过 HTTPS 强制、共享签名、请求超时、
 * 重放保护和速率限制进行加固。
 */

import type { PrivateKeyAccount } from "viem";
import type { SocialClientInterface, InboxMessage } from "../types.js";
import { ResilientHttpClient } from "../conway/http-client.js";
import { signSendPayload, signPollPayload, MESSAGE_LIMITS } from "./signing.js";
import { validateRelayUrl, validateMessage } from "./validation.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("social");

// 所有 fetch 调用的请求超时（30 秒）
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * 创建连接到 Agent 钱包的 SocialClient。
 *
 * @throws 如果 relayUrl 不是 HTTPS
 */
export function createSocialClient(
  relayUrl: string,
  account: PrivateKeyAccount,
  db?: import("better-sqlite3").Database,
): SocialClientInterface {
  // Phase 3.2: 验证中继 URL 是否为 HTTPS
  validateRelayUrl(relayUrl);

  const baseUrl = relayUrl.replace(/\/$/, "");
  const httpClient = new ResilientHttpClient();

  // 速率限制状态：跟踪出站消息时间戳
  const outboundTimestamps: number[] = [];

  function checkRateLimit(): void {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    // 清理旧时间戳
    while (outboundTimestamps.length > 0 && outboundTimestamps[0]! < oneHourAgo) {
      outboundTimestamps.shift();
    }
    if (outboundTimestamps.length >= MESSAGE_LIMITS.maxOutboundPerHour) {
      throw new Error(
        `Rate limit exceeded: ${MESSAGE_LIMITS.maxOutboundPerHour} messages per hour`,
      );
    }
  }

  function checkReplayNonce(nonce: string): boolean {
    if (!db) return false;
    try {
      const row = db
        .prepare(
          "SELECT 1 FROM heartbeat_dedup WHERE dedup_key = ? AND expires_at >= datetime('now')",
        )
        .get(`social:nonce:${nonce}`);
      if (row) return true; // 已经看到过这个 nonce

      // 插入具有 5 分钟 TTL 的 nonce
      const expiresAt = new Date(Date.now() + MESSAGE_LIMITS.replayWindowMs).toISOString();
      db.prepare(
        "INSERT OR IGNORE INTO heartbeat_dedup (dedup_key, task_name, expires_at) VALUES (?, ?, ?)",
      ).run(`social:nonce:${nonce}`, "social_replay", expiresAt);

      return false;
    } catch {
      return false;
    }
  }

  return {
    send: async (
      to: string,
      content: string,
      replyTo?: string,
    ): Promise<{ id: string }> => {
      // Phase 3.2: 速率限制检查
      checkRateLimit();

      // 在网络调用之前跟踪出站尝试以进行速率限制。
      // 计算尝试（不仅仅是成功）可以防止在服务器返回错误时
      // 用无限重试攻击中继。
      outboundTimestamps.push(Date.now());

      // Phase 3.2: 发送前验证消息
      const validation = validateMessage({ from: account.address, to, content });
      if (!validation.valid) {
        throw new Error(`Message validation failed: ${validation.errors.join("; ")}`);
      }

      // Phase 3.2: 使用共享签名模块
      const payload = await signSendPayload(account, to, content, replyTo);

      const res = await httpClient.request(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeout: REQUEST_TIMEOUT_MS,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `Send failed (${res.status}): ${(err as any).error || res.statusText}`,
        );
      }

      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },

    poll: async (
      cursor?: string,
      limit?: number,
    ): Promise<{ messages: InboxMessage[]; nextCursor?: string }> => {
      // Phase 3.2: 使用共享签名模块
      const pollAuth = await signPollPayload(account);

      const res = await httpClient.request(`${baseUrl}/v1/messages/poll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": pollAuth.address,
          "X-Signature": pollAuth.signature,
          "X-Timestamp": pollAuth.timestamp,
        },
        body: JSON.stringify({ cursor, limit }),
        timeout: REQUEST_TIMEOUT_MS,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `Poll failed (${res.status}): ${(err as any).error || res.statusText}`,
        );
      }

      const data = (await res.json()) as {
        messages: Array<{
          id: string;
          from: string;
          to: string;
          content: string;
          signedAt: string;
          createdAt: string;
          replyTo?: string;
          nonce?: string;
        }>;
        next_cursor?: string;
      };

      // Phase 3.2: 入站消息的重放保护
      const filtered = data.messages.filter((m) => {
        if (m.nonce && checkReplayNonce(m.nonce)) {
          logger.warn(`Dropped replayed message: nonce=${m.nonce}`);
          return false;
        }
        return true;
      });

      return {
        messages: filtered.map((m) => ({
          id: m.id,
          from: m.from,
          to: m.to,
          content: m.content,
          signedAt: m.signedAt,
          createdAt: m.createdAt,
          replyTo: m.replyTo,
        })),
        nextCursor: data.next_cursor,
      };
    },

    unreadCount: async (): Promise<number> => {
      // Phase 3.2: 使用共享签名模块
      const pollAuth = await signPollPayload(account);

      const res = await httpClient.request(`${baseUrl}/v1/messages/count`, {
        method: "GET",
        headers: {
          "X-Wallet-Address": pollAuth.address,
          "X-Signature": pollAuth.signature,
          "X-Timestamp": pollAuth.timestamp,
        },
        timeout: REQUEST_TIMEOUT_MS,
      });

      // Phase 3.2: 错误时抛出异常而不是返回 0 (S-P1-7)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `Unread count failed (${res.status}): ${(err as any).error || res.statusText}`,
        );
      }

      const data = (await res.json()) as { unread: number };
      return data.unread;
    },
  };
}
