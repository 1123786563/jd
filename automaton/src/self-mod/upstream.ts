/**
 * 上游感知
 *
 * 帮助 automaton 了解其自己的 git 源，
 * 检测新的上游提交，并审查差异。
 * 所有 git 命令都使用带参数数组的 execFileSync 以防止注入。
 */

import { execFileSync } from "child_process";

const REPO_ROOT = process.cwd();

/**
 * 使用带参数数组的 execFileSync 运行 git 命令（无 shell 插值）。
 */
function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    timeout: 15_000,
  }).trim();
}

/**
 * 返回源 URL（已去除凭据）、当前分支和 HEAD 信息。
 */
export function getRepoInfo(): {
  originUrl: string;
  branch: string;
  headHash: string;
  headMessage: string;
} {
  const rawUrl = git(["config", "--get", "remote.origin.url"]);
  // 去除嵌入的凭据（https://user:token@host/... -> https://host/...）
  const originUrl = rawUrl.replace(/\/\/[^@]+@/, "//");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const headLine = git(["log", "-1", "--format=%h %s"]);
  const [headHash, ...rest] = headLine.split(" ");
  return { originUrl, branch, headHash, headMessage: rest.join(" ") };
}

/**
 * 获取源并报告我们落后多少个提交。
 */
export function checkUpstream(): {
  behind: number;
  commits: { hash: string; message: string }[];
} {
  git(["fetch", "origin", "main", "--quiet"]);
  const log = git(["log", "HEAD..origin/main", "--oneline"]);
  if (!log) return { behind: 0, commits: [] };
  const commits = log.split("\n").map((line) => {
    const [hash, ...rest] = line.split(" ");
    return { hash, message: rest.join(" ") };
  });
  return { behind: commits.length, commits };
}

/**
 * 返回 origin/main 上 HEAD 之前每个提交的每个提交差异。
 */
export function getUpstreamDiffs(): {
  hash: string;
  message: string;
  author: string;
  diff: string;
}[] {
  const log = git(["log", "HEAD..origin/main", "--format=%H %an|||%s"]);
  if (!log) return [];

  return log.split("\n").map((line) => {
    const [hashAndAuthor, message] = line.split("|||");
    const parts = hashAndAuthor.split(" ");
    const hash = parts[0];
    const author = parts.slice(1).join(" ");
    let diff: string;
    try {
      diff = git(["diff", `${hash}~1..${hash}`]);
    } catch {
      // 范围内的第一个提交可能没有父提交
      diff = git(["show", hash, "--format=", "--stat"]);
    }
    return { hash: hash.slice(0, 12), message, author, diff };
  });
}
