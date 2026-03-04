/**
 * Automaton 钱包管理
 *
 * 为 automaton 的身份和付款创建和管理 EVM 钱包
 * 私钥是 automaton 的主权身份
 * 改编自 conway-mcp/src/wallet.ts
 */

import type { PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import type { WalletData } from "../types.js";

const AUTOMATON_DIR = path.join(
  process.env.HOME || "/root",
  ".automaton",
);
const WALLET_FILE = path.join(AUTOMATON_DIR, "wallet.json");

export function getAutomatonDir(): string {
  return AUTOMATON_DIR;
}

export function getWalletPath(): string {
  return WALLET_FILE;
}

/**
 * 获取或创建 automaton 的钱包
 * 私钥就是 automaton 的身份 — 保护它
 */
export async function getWallet(): Promise<{
  account: PrivateKeyAccount;
  isNew: boolean;
}> {
  if (!fs.existsSync(AUTOMATON_DIR)) {
    fs.mkdirSync(AUTOMATON_DIR, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(WALLET_FILE)) {
    const walletData: WalletData = JSON.parse(
      fs.readFileSync(WALLET_FILE, "utf-8"),
    );
    const account = privateKeyToAccount(walletData.privateKey);
    return { account, isNew: false };
  } else {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const walletData: WalletData = {
      privateKey,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), {
      mode: 0o600,
    });

    return { account, isNew: true };
  }
}

/**
 * 在不加载完整账户的情况下获取钱包地址
 */
export function getWalletAddress(): string | null {
  if (!fs.existsSync(WALLET_FILE)) {
    return null;
  }

  const walletData: WalletData = JSON.parse(
    fs.readFileSync(WALLET_FILE, "utf-8"),
  );
  const account = privateKeyToAccount(walletData.privateKey);
  return account.address;
}

/**
 * 加载完整的钱包账户（签名需要）
 */
export function loadWalletAccount(): PrivateKeyAccount | null {
  if (!fs.existsSync(WALLET_FILE)) {
    return null;
  }

  const walletData: WalletData = JSON.parse(
    fs.readFileSync(WALLET_FILE, "utf-8"),
  );
  return privateKeyToAccount(walletData.privateKey);
}

export function walletExists(): boolean {
  return fs.existsSync(WALLET_FILE);
}
