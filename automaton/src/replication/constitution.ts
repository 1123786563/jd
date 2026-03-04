/**
 * 宪法完整性
 *
 * 在父子和子沙盒之间传播和验证宪法文件。
 * 使用 SHA-256 哈希验证而不是表面的 chmod 444。
 */

import fs from "fs";
import pathLib from "path";
import { createHash } from "crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import type { ConwayClient } from "../types.js";

/**
 * 计算内容的 SHA-256 哈希。
 */
function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * 将本地宪法传播到子沙盒。
 * 写入文件，计算哈希，在 KV 中存储哈希。
 */
export async function propagateConstitution(
  conway: ConwayClient,
  sandboxId: string,
  db: DatabaseType,
): Promise<void> {
  const constitutionPath = pathLib.join(
    process.env.HOME || "/root",
    ".automaton",
    "constitution.md",
  );

  const constitution = fs.readFileSync(constitutionPath, "utf-8");
  const hash = sha256(constitution);

  // 将宪法写入子沙盒
  await conway.writeFile("/root/.automaton/constitution.md", constitution);

  // 写入哈希文件供子自动机验证
  await conway.writeFile("/root/.automaton/constitution.sha256", hash);

  // 在 KV 中存储哈希以供以后验证
  db.prepare(
    "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))",
  ).run(`constitution_hash:${sandboxId}`, hash);

  // chmod 444 作为深度防御（不是主要验证机制）
  try {
    await conway.exec("chmod 444 /root/.automaton/constitution.md", 5000);
  } catch {
    // 非关键
  }
}

/**
 * 通过比较哈希来验证子自动机的宪法完整性。
 */
export async function verifyConstitution(
  conway: ConwayClient,
  sandboxId: string,
  db: DatabaseType,
): Promise<{ valid: boolean; detail: string }> {
  // 获取存储的哈希
  const storedRow = db
    .prepare("SELECT value FROM kv WHERE key = ?")
    .get(`constitution_hash:${sandboxId}`) as { value: string } | undefined;

  if (!storedRow) {
    return { valid: false, detail: "未找到存储的宪法哈希" };
  }

  try {
    // 从子沙盒读取宪法
    const childConstitution = await conway.readFile("/root/.automaton/constitution.md");
    const childHash = sha256(childConstitution);

    if (childHash === storedRow.value) {
      return { valid: true, detail: "宪法哈希匹配" };
    }

    return {
      valid: false,
      detail: `哈希不匹配：预期 ${storedRow.value.slice(0, 16)}...，得到 ${childHash.slice(0, 16)}...`,
    };
  } catch (error) {
    return {
      valid: false,
      detail: `读取子自动机宪法失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
