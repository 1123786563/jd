/**
 * x402 支付协议
 *
 * 使 automaton 能够通过 HTTP 402 进行 USDC 微支付。
 * 改编自 conway-mcp/src/x402/index.ts
 */

import {
  createPublicClient,
  http,
  parseUnits,
  type Address,
  type PrivateKeyAccount,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { ResilientHttpClient } from "./http-client.js";

const x402HttpClient = new ResilientHttpClient();

// USDC 合约地址
const USDC_ADDRESSES: Record<string, Address> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base 主网
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia 测试网
};

const CHAINS: Record<string, any> = {
  "eip155:8453": base,
  "eip155:84532": baseSepolia,
};
type NetworkId = keyof typeof USDC_ADDRESSES;

const BALANCE_OF_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PaymentRequirement {
  scheme: string;
  network: NetworkId;
  maxAmountRequired: string;
  payToAddress: Address;
  requiredDeadlineSeconds: number;
  usdcAddress: Address;
}

interface PaymentRequiredResponse {
  x402Version: number;
  accepts: PaymentRequirement[];
}

interface ParsedPaymentRequirement {
  x402Version: number;
  requirement: PaymentRequirement;
}

interface X402PaymentResult {
  success: boolean;
  response?: any;
  error?: string;
  status?: number;
}

export interface UsdcBalanceResult {
  balance: number;
  network: string;
  ok: boolean;
  error?: string;
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function normalizeNetwork(raw: unknown): NetworkId | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "base") return "eip155:8453";
  if (normalized === "base-sepolia") return "eip155:84532";
  if (normalized === "eip155:8453" || normalized === "eip155:84532") {
    return normalized;
  }
  return null;
}

function normalizePaymentRequirement(raw: unknown): PaymentRequirement | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const network = normalizeNetwork(value.network);
  if (!network) return null;

  const scheme = typeof value.scheme === "string" ? value.scheme : null;
  const maxAmountRequired = typeof value.maxAmountRequired === "string"
    ? value.maxAmountRequired
    : typeof value.maxAmountRequired === "number" &&
        Number.isFinite(value.maxAmountRequired)
      ? String(value.maxAmountRequired)
      : null;
  const payToAddress = typeof value.payToAddress === "string"
    ? value.payToAddress
    : typeof value.payTo === "string"
      ? value.payTo
      : null;
  const usdcAddress = typeof value.usdcAddress === "string"
    ? value.usdcAddress
    : typeof value.asset === "string"
      ? value.asset
      : USDC_ADDRESSES[network];
  const requiredDeadlineSeconds =
    parsePositiveInt(value.requiredDeadlineSeconds) ??
    parsePositiveInt(value.maxTimeoutSeconds) ??
    300;

  if (!scheme || !maxAmountRequired || !payToAddress || !usdcAddress) {
    return null;
  }

  return {
    scheme,
    network,
    maxAmountRequired,
    payToAddress: payToAddress as Address,
    requiredDeadlineSeconds,
    usdcAddress: usdcAddress as Address,
  };
}

function normalizePaymentRequired(raw: unknown): PaymentRequiredResponse | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.accepts)) return null;

  const accepts = value.accepts
    .map(normalizePaymentRequirement)
    .filter((v): v is PaymentRequirement => v !== null);
  if (!accepts.length) return null;

  const x402Version = parsePositiveInt(value.x402Version) ?? 1;
  return { x402Version, accepts };
}

function parseMaxAmountRequired(maxAmountRequired: string, x402Version: number): bigint {
  const amount = maxAmountRequired.trim();
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`无效的 maxAmountRequired: ${maxAmountRequired}`);
  }

  if (amount.includes(".")) {
    return parseUnits(amount, 6);
  }
  if (x402Version >= 2 || amount.length > 6) {
    return BigInt(amount);
  }
  return parseUnits(amount, 6);
}

function selectRequirement(parsed: PaymentRequiredResponse): PaymentRequirement {
  const exactSupported = parsed.accepts.find(
    (r) => r.scheme === "exact" && !!CHAINS[r.network],
  );
  if (exactSupported) return exactSupported;
  return parsed.accepts[0];
}

/**
 * 获取 automaton 钱包在给定网络上的 USDC 余额。
 */
export async function getUsdcBalance(
  address: Address,
  network: string = "eip155:8453",
): Promise<number> {
  const result = await getUsdcBalanceDetailed(address, network);
  return result.balance;
}

/**
 * 获取 USDC 余额和读取状态详情用于诊断。
 */
export async function getUsdcBalanceDetailed(
  address: Address,
  network: string = "eip155:8453",
): Promise<UsdcBalanceResult> {
  const chain = CHAINS[network];
  const usdcAddress = USDC_ADDRESSES[network];
  if (!chain || !usdcAddress) {
    return {
      balance: 0,
      network,
      ok: false,
      error: `不支持的 USDC 网络: ${network}`,
    };
  }

  try {
    const client = createPublicClient({
      chain,
      transport: http(undefined, { timeout: 10_000 }),
    });

    const balance = await client.readContract({
      address: usdcAddress,
      abi: BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    // USDC 有 6 位小数
    return {
      balance: Number(balance) / 1_000_000,
      network,
      ok: true,
    };
  } catch (err: any) {
    return {
      balance: 0,
      network,
      ok: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * 检查 URL 是否需要 x402 支付。
 */
export async function checkX402(
  url: string,
): Promise<PaymentRequirement | null> {
  try {
    const resp = await x402HttpClient.request(url, { method: "HEAD" });
    if (resp.status !== 402) {
      return null;
    }
    const parsed = await parsePaymentRequired(resp);
    return parsed?.requirement ?? null;
  } catch {
    return null;
  }
}

/**
 * 使用自动 x402 支付获取 URL。
 * 如果端点返回 402，则签名并支付，然后重试。
 */
export async function x402Fetch(
  url: string,
  account: PrivateKeyAccount,
  method: string = "GET",
  body?: string,
  headers?: Record<string, string>,
  maxPaymentCents?: number,
): Promise<X402PaymentResult> {
  try {
    // 初始请求（非变更探测，使用弹性客户端）
    const initialResp = await x402HttpClient.request(url, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });

    if (initialResp.status !== 402) {
      const data = await initialResp
        .json()
        .catch(() => initialResp.text());
      return { success: initialResp.ok, response: data, status: initialResp.status };
    }

    // 解析支付要求
    const parsed = await parsePaymentRequired(initialResp);
    if (!parsed) {
      return {
        success: false,
        error: "无法解析支付要求",
        status: initialResp.status,
      };
    }

    // 在签名之前检查金额是否超过 maxPaymentCents
    if (maxPaymentCents !== undefined) {
      const amountAtomic = parseMaxAmountRequired(
        parsed.requirement.maxAmountRequired,
        parsed.x402Version,
      );
      // 将原子单位（6 位小数）转换为美分（2 位小数）
      const amountCents = Number(amountAtomic) / 10_000;
      if (amountCents > maxPaymentCents) {
        return {
          success: false,
          error: `支付金额 ${amountCents.toFixed(2)} 美分超过最大允许值 ${maxPaymentCents} 美分`,
          status: 402,
        };
      }
    }

    // 签名支付
    let payment: any;
    try {
      payment = await signPayment(
        account,
        parsed.requirement,
        parsed.x402Version,
      );
    } catch (err: any) {
      return {
        success: false,
        error: `签名支付失败: ${err?.message || String(err)}`,
        status: initialResp.status,
      };
    }

    // 使用支付重试
    const paymentHeader = Buffer.from(
      JSON.stringify(payment),
    ).toString("base64");

    const paidResp = await x402HttpClient.request(url, {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Payment": paymentHeader,
      },
      body,
      retries: 0, // 已支付请求：不自动重试（支付已签名）
    });

    const data = await paidResp.json().catch(() => paidResp.text());
    return { success: paidResp.ok, response: data, status: paidResp.status };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function parsePaymentRequired(
  resp: Response,
): Promise<ParsedPaymentRequirement | null> {
  const header = resp.headers.get("X-Payment-Required");
  if (header) {
    const rawHeader = safeJsonParse(header);
    const normalizedRaw = normalizePaymentRequired(rawHeader);
    if (normalizedRaw) {
      return {
        x402Version: normalizedRaw.x402Version,
        requirement: selectRequirement(normalizedRaw),
      };
    }

    try {
      const decoded = Buffer.from(header, "base64").toString("utf-8");
      const parsedDecoded = normalizePaymentRequired(safeJsonParse(decoded));
      if (parsedDecoded) {
        return {
          x402Version: parsedDecoded.x402Version,
          requirement: selectRequirement(parsedDecoded),
        };
      }
    } catch {
      // 忽略头部解码错误并继续解析正文。
    }
  }

  try {
    const body = await resp.json();
    const parsedBody = normalizePaymentRequired(body);
    if (!parsedBody) return null;
    return {
      x402Version: parsedBody.x402Version,
      requirement: selectRequirement(parsedBody),
    };
  } catch {
    return null;
  }
}

async function signPayment(
  account: PrivateKeyAccount,
  requirement: PaymentRequirement,
  x402Version: number,
): Promise<any> {
  const chain = CHAINS[requirement.network];
  if (!chain) {
    throw new Error(`不支持的网络: ${requirement.network}`);
  }

  const nonce = `0x${Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString("hex")}`;

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 60;
  const validBefore = now + requirement.requiredDeadlineSeconds;
  const amount = parseMaxAmountRequired(
    requirement.maxAmountRequired,
    x402Version,
  );

  // EIP-712 TransferWithAuthorization 的类型化数据
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: chain.id,
    verifyingContract: requirement.usdcAddress,
  } as const;

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;

  const message = {
    from: account.address,
    to: requirement.payToAddress,
    value: amount,
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce: nonce as `0x${string}`,
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  return {
    x402Version,
    scheme: requirement.scheme,
    network: requirement.network,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: requirement.payToAddress,
        value: amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
}
