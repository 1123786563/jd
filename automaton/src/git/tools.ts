/**
 * Git 工具
 *
 * automaton 的内置 git 操作
 * 用于状态版本控制和代码开发
 */

import type { ConwayClient, GitStatus, GitLogEntry } from "../types.js";

/**
 * 获取仓库的 git 状态
 */
export async function gitStatus(
  conway: ConwayClient,
  repoPath: string,
): Promise<GitStatus> {
  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git status --porcelain -b 2>/dev/null`,
    10000,
  );

  const lines = result.stdout.split("\n").filter(Boolean);
  let branch = "unknown";
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      branch = line.slice(3).split("...")[0];
      continue;
    }

    const statusCode = line.slice(0, 2);
    const file = line.slice(3);

    if (statusCode[0] !== " " && statusCode[0] !== "?") {
      staged.push(file);
    }
    if (statusCode[1] === "M" || statusCode[1] === "D") {
      modified.push(file);
    }
    if (statusCode === "??") {
      untracked.push(file);
    }
  }

  return {
    branch,
    staged,
    modified,
    untracked,
    clean:
      staged.length === 0 && modified.length === 0 && untracked.length === 0,
  };
}

/**
 * 获取 git diff 输出
 */
export async function gitDiff(
  conway: ConwayClient,
  repoPath: string,
  staged: boolean = false,
): Promise<string> {
  const flag = staged ? "--cached" : "";
  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git diff ${flag} 2>/dev/null`,
    10000,
  );
  return result.stdout || "(无更改)";
}

/**
 * 创建 git 提交
 */
export async function gitCommit(
  conway: ConwayClient,
  repoPath: string,
  message: string,
  addAll: boolean = true,
): Promise<string> {
  if (addAll) {
    await conway.exec(`cd ${escapeShellArg(repoPath)} && git add -A`, 10000);
  }

  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git commit -m ${escapeShellArg(message)} --allow-empty 2>&1`,
    10000,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Git 提交失败：${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

/**
 * 获取 git 日志
 */
export async function gitLog(
  conway: ConwayClient,
  repoPath: string,
  limit: number = 10,
): Promise<GitLogEntry[]> {
  const safeLimit = Math.max(1, Math.floor(Number(limit))) || 10;
  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git log --format="%H|%s|%an|%ai" -n ${safeLimit} 2>/dev/null`,
    10000,
  );

  if (!result.stdout.trim()) return [];

  return result.stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, message, author, date] = line.split("|");
      return { hash, message, author, date };
    });
}

/**
 * 推送到远程
 */
export async function gitPush(
  conway: ConwayClient,
  repoPath: string,
  remote: string = "origin",
  branch?: string,
): Promise<string> {
  const branchArg = branch ? ` ${escapeShellArg(branch)}` : "";
  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git push ${escapeShellArg(remote)}${branchArg} 2>&1`,
    30000,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Git 推送失败：${result.stderr || result.stdout}`);
  }

  return result.stdout || "推送成功";
}

/**
 * 管理分支
 */
export async function gitBranch(
  conway: ConwayClient,
  repoPath: string,
  action: "list" | "create" | "checkout" | "delete",
  branchName?: string,
): Promise<string> {
  let cmd: string;

  switch (action) {
    case "list":
      cmd = `cd ${escapeShellArg(repoPath)} && git branch -a 2>/dev/null`;
      break;
    case "create":
      if (!branchName) throw new Error("需要分支名称");
      cmd = `cd ${escapeShellArg(repoPath)} && git checkout -b ${escapeShellArg(branchName)} 2>&1`;
      break;
    case "checkout":
      if (!branchName) throw new Error("需要分支名称");
      cmd = `cd ${escapeShellArg(repoPath)} && git checkout ${escapeShellArg(branchName)} 2>&1`;
      break;
    case "delete":
      if (!branchName) throw new Error("需要分支名称");
      cmd = `cd ${escapeShellArg(repoPath)} && git branch -d ${escapeShellArg(branchName)} 2>&1`;
      break;
    default:
      throw new Error(`未知的分支操作：${action}`);
  }

  const result = await conway.exec(cmd, 10000);
  return result.stdout || result.stderr || "完成";
}

/**
 * 克隆仓库
 */
export async function gitClone(
  conway: ConwayClient,
  url: string,
  targetPath: string,
  depth?: number,
): Promise<string> {
  const depthArg = depth
    ? ` --depth ${Math.max(1, Math.floor(Number(depth)))}`
    : "";
  const result = await conway.exec(
    `git clone${depthArg} ${escapeShellArg(url)} ${escapeShellArg(targetPath)} 2>&1`,
    120000,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Git 克隆失败：${result.stderr || result.stdout}`);
  }

  return `已克隆 ${url} 到 ${targetPath}`;
}

/**
 * 初始化 git 仓库
 */
export async function gitInit(
  conway: ConwayClient,
  repoPath: string,
): Promise<string> {
  const result = await conway.exec(
    `cd ${escapeShellArg(repoPath)} && git init 2>&1`,
    10000,
  );
  return result.stdout || "Git 已初始化";
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
