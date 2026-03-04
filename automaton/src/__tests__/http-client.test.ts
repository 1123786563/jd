/**
 * ResilientHttpClient 测试 - 阶段 1.3 网络弹性
 *
 * 涵盖：超时、重试、退避、断路器、幂等性键、
 * 缓存余额回退、api_unreachable 状态处理。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ResilientHttpClient,
  CircuitOpenError,
} from "../conway/http-client.js";

// ─── 模拟 fetch ────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function mockResponse(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({
      "content-type": "application/json",
      ...headers,
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

// ─── 测试 ─────────────────────────────────────────────────────

describe("ResilientHttpClient", () => {
  describe("超时行为", () => {
    it("在配置的超时后中止请求", async () => {
      const client = new ResilientHttpClient({
        baseTimeout: 100,
        maxRetries: 0,
      });

      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          });
        },
      );

      const pending = client.request("https://api.example.com/test");
      const assertion = expect(pending).rejects.toThrow();
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe("在 5xx/429 时重试", () => {
    it("在 500 时重试并在第二次尝试成功", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 2,
        backoffBase: 1,
        backoffMax: 10,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(mockResponse(500));
        }
        return Promise.resolve(mockResponse(200, { ok: true }));
      });

      const pending = client.request("https://api.example.com/test");
      await vi.runAllTimersAsync();
      const resp = await pending;
      expect(resp.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it("在 429 时使用退避重试", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 2,
        backoffBase: 1,
        backoffMax: 10,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(mockResponse(429));
        }
        return Promise.resolve(mockResponse(200, { ok: true }));
      });

      const pending = client.request("https://api.example.com/test");
      await vi.runAllTimersAsync();
      const resp = await pending;
      expect(resp.status).toBe(200);
      expect(callCount).toBe(3);
    });

    it("retries on 502, 503, 504", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 3,
        backoffBase: 1,
        backoffMax: 10,
      });

      const statusCodes = [502, 503, 504];
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(() => {
        if (callCount < statusCodes.length) {
          const status = statusCodes[callCount];
          callCount++;
          return Promise.resolve(mockResponse(status));
        }
        callCount++;
        return Promise.resolve(mockResponse(200, { ok: true }));
      });

      const pending = client.request("https://api.example.com/test");
      await vi.runAllTimersAsync();
      const resp = await pending;
      expect(resp.status).toBe(200);
      expect(callCount).toBe(4);
    });
  });

  describe("在 4xx 时不重试", () => {
    it("在 400 时不重试", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 3,
        backoffBase: 1,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockResponse(400, { error: "bad request" }));
      });

      const resp = await client.request("https://api.example.com/test");
      expect(resp.status).toBe(400);
      expect(callCount).toBe(1);
    });

    it("does not retry on 401", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 3,
        backoffBase: 1,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockResponse(401));
      });

      const resp = await client.request("https://api.example.com/test");
      expect(resp.status).toBe(401);
      expect(callCount).toBe(1);
    });

    it("does not retry on 404", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 3,
        backoffBase: 1,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockResponse(404));
      });

      const resp = await client.request("https://api.example.com/test");
      expect(resp.status).toBe(404);
      expect(callCount).toBe(1);
    });
  });

  describe("重试耗尽", () => {
    it("在网络错误上达到最大重试次数后抛出错误", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 2,
        backoffBase: 1,
        backoffMax: 10,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error("Network failure"));
      });

      const pending = client.request("https://api.example.com/test");
      const assertion = expect(pending).rejects.toThrow("Network failure");
      await vi.runAllTimersAsync();
      await assertion;
      expect(callCount).toBe(3); // 1 次初始 + 2 次重试
    });

    it("如果所有重试耗尽，返回最后一个可重试状态", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 2,
        backoffBase: 1,
        backoffMax: 10,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockResponse(503));
      });

      const pending = client.request("https://api.example.com/test");
      await vi.runAllTimersAsync();
      const resp = await pending;
      // 在 maxRetries 耗尽后，返回最后一个 503 响应
      expect(resp.status).toBe(503);
      expect(callCount).toBe(3); // 1 次初始 + 2 次重试
    });
  });

  describe("断路器", () => {
    it("在阈值连续失败后打开", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 3,
        circuitBreakerResetMs: 5000,
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      // 触发 3 次连续失败
      for (let i = 0; i < 3; i++) {
        await expect(
          client.request("https://api.example.com/test"),
        ).rejects.toThrow("fail");
      }

      expect(client.isCircuitOpen()).toBe(true);
      expect(client.getConsecutiveFailures()).toBe(3);

      // 下一次调用应立即抛出 CircuitOpenError
      await expect(
        client.request("https://api.example.com/test"),
      ).rejects.toThrow(CircuitOpenError);
    });

    it("在冷却期后自动重置", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 1000,
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      // 打开断路器
      for (let i = 0; i < 2; i++) {
        await expect(
          client.request("https://api.example.com/test"),
        ).rejects.toThrow("fail");
      }
      expect(client.isCircuitOpen()).toBe(true);

      // 推进时间超过重置期
      vi.advanceTimersByTime(1100);

      // 断路器现在应该已关闭
      expect(client.isCircuitOpen()).toBe(false);

      // 应该能够再次发出请求
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));
      const resp = await client.request("https://api.example.com/test");
      expect(resp.status).toBe(200);
    });

    it("在成功时重置连续失败", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 5,
      });

      // 失败 3 次
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));
      for (let i = 0; i < 3; i++) {
        await expect(
          client.request("https://api.example.com/test"),
        ).rejects.toThrow();
      }
      expect(client.getConsecutiveFailures()).toBe(3);

      // 成功一次
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));
      await client.request("https://api.example.com/test");
      expect(client.getConsecutiveFailures()).toBe(0);
    });

    it("CircuitOpenError 包含 resetAt 时间戳", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 1,
        circuitBreakerResetMs: 60_000,
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));
      await expect(
        client.request("https://api.example.com/test"),
      ).rejects.toThrow();

      try {
        await client.request("https://api.example.com/test");
      } catch (err) {
        expect(err).toBeInstanceOf(CircuitOpenError);
        expect((err as CircuitOpenError).resetAt).toBeGreaterThan(Date.now());
      }
    });

    it("resetCircuit() 清除状态", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 1,
        circuitBreakerResetMs: 60_000,
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));
      await expect(
        client.request("https://api.example.com/test"),
      ).rejects.toThrow();
      expect(client.isCircuitOpen()).toBe(true);

      client.resetCircuit();
      expect(client.isCircuitOpen()).toBe(false);
      expect(client.getConsecutiveFailures()).toBe(0);
    });

    it("将可重试的 HTTP 状态计入断路器阈值", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 3,
        circuitBreakerResetMs: 5000,
      });

      // 返回 502 三次（可重试状态，无重试）
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(502));

      for (let i = 0; i < 3; i++) {
        await client.request("https://api.example.com/test");
      }

      // 断路器应该已打开，因为可重试状态计为失败
      expect(client.getConsecutiveFailures()).toBe(3);
      expect(client.isCircuitOpen()).toBe(true);
    });

    it("仅在非可重试成功时重置失败计数器", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 0,
        circuitBreakerThreshold: 5,
      });

      // 两次 502 失败
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(502));
      await client.request("https://api.example.com/test");
      await client.request("https://api.example.com/test");
      expect(client.getConsecutiveFailures()).toBe(2);

      // 一次 200 成功应该重置
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200));
      await client.request("https://api.example.com/test");
      expect(client.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("幂等性键", () => {
    it("在提供时包含 Idempotency-Key 头", async () => {
      const client = new ResilientHttpClient({ maxRetries: 0 });

      let capturedHeaders: HeadersInit | undefined;
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) => {
          capturedHeaders = init?.headers;
          return Promise.resolve(mockResponse(200));
        },
      );

      await client.request("https://api.example.com/test", {
        method: "POST",
        idempotencyKey: "test-key-123",
      });

      expect(capturedHeaders).toBeDefined();
      const headers = capturedHeaders as Record<string, string>;
      expect(headers["Idempotency-Key"]).toBe("test-key-123");
    });

    it("在未提供时不包含 Idempotency-Key 头", async () => {
      const client = new ResilientHttpClient({ maxRetries: 0 });

      let capturedHeaders: HeadersInit | undefined;
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) => {
          capturedHeaders = init?.headers;
          return Promise.resolve(mockResponse(200));
        },
      );

      await client.request("https://api.example.com/test", {
        method: "GET",
      });

      const headers = capturedHeaders as Record<string, string>;
      expect(headers["Idempotency-Key"]).toBeUndefined();
    });
  });

  describe("默认配置", () => {
    it("在未提供配置时使用默认配置", () => {
      const client = new ResilientHttpClient();
      expect(client.isCircuitOpen()).toBe(false);
      expect(client.getConsecutiveFailures()).toBe(0);
    });

    it("将部分配置与默认值合并", () => {
      const client = new ResilientHttpClient({ maxRetries: 5 });
      // 其他字段应仍具有默认值
      expect(client.isCircuitOpen()).toBe(false);
    });
  });

  describe("请求选项覆盖", () => {
    it("允许每个请求覆盖重试", async () => {
      const client = new ResilientHttpClient({
        maxRetries: 3,
        backoffBase: 1,
        backoffMax: 10,
      });

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error("fail"));
      });

      await expect(
        client.request("https://api.example.com/test", { retries: 0 }),
      ).rejects.toThrow("fail");
      expect(callCount).toBe(1); // 无重试
    });

    it("允许每个请求覆盖超时", async () => {
      const client = new ResilientHttpClient({
        baseTimeout: 30_000,
        maxRetries: 0,
      });

      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          });
        },
      );

      const pending = client.request("https://api.example.com/test", { timeout: 50 });
      const assertion = expect(pending).rejects.toThrow();
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe("错误时清理定时器", () => {
    it("当 fetch 抛出错误时清理超时定时器", async () => {
      const client = new ResilientHttpClient({
        baseTimeout: 5000,
        maxRetries: 0,
      });

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      await expect(
        client.request("https://api.example.com/test"),
      ).rejects.toThrow("Network failure");

      // clearTimeout 应该在 catch 块中被调用
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
