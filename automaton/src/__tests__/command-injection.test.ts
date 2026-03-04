/**
 * 命令注入修复测试（阶段 0.3 子阶段）
 *
 * 测试：
 * - 策略规则阻止 shell 元字符注入
 * - 禁止的命令模式被阻止
 * - 输入验证规则（包名、技能名、git 哈希等）
 * - 注册表函数使用安全的替代方案（无 shell 插值）
 * - 加载器使用安全的二进制检查
 * - pull_upstream 使用 conway.exec() 而不是主机 execSync
 * - upstream.ts 使用带参数数组的 execFileSync
 */

import { describe, it, expect } from "vitest";
import { createDefaultRules } from "../agent/policy-rules/index.js";
import { createValidationRules } from "../agent/policy-rules/validation.js";
import { createCommandSafetyRules } from "../agent/policy-rules/command-safety.js";
import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
  AutomatonTool,
  RiskLevel,
  ToolContext,
} from "../types.js";

// ─── 测试辅助函数 ───────────────────────────────────────────────

function makeTool(name: string, category = "vm", riskLevel: RiskLevel = "caution"): AutomatonTool {
  return {
    name,
    description: `Test tool: ${name}`,
    category: category as any,
    riskLevel,
    parameters: { type: "object", properties: {} },
    execute: async () => "ok",
  };
}

function makeRequest(
  toolName: string,
  args: Record<string, unknown>,
  category = "vm",
  riskLevel: RiskLevel = "caution",
): PolicyRequest {
  return {
    tool: makeTool(toolName, category, riskLevel),
    args,
    context: {} as ToolContext,
    turnContext: {
      inputSource: "agent",
      turnToolCallCount: 0,
      sessionSpend: null as any,
    },
  };
}

function evaluateRules(
  rules: PolicyRule[],
  request: PolicyRequest,
): PolicyRuleResult | null {
  for (const rule of rules) {
    // 检查规则是否适用
    const selector = rule.appliesTo;
    let applies = false;
    if (selector.by === "all") applies = true;
    else if (selector.by === "name") applies = selector.names.includes(request.tool.name);
    else if (selector.by === "category") applies = selector.categories.includes(request.tool.category);
    else if (selector.by === "risk") applies = selector.levels.includes(request.tool.riskLevel);

    if (!applies) continue;

    const result = rule.evaluate(request);
    if (result !== null) return result;
  }
  return null;
}

// ─── Shell 注入检测测试 ─────────────────────────────

describe("command.shell_injection rule", () => {
  const rules = createCommandSafetyRules();
  const injectionRule = rules.find((r) => r.id === "command.shell_injection")!;

  it("exists and has correct metadata", () => {
    expect(injectionRule).toBeDefined();
    expect(injectionRule.priority).toBe(300);
  });

  const shellMetachars = [";", "|", "&", "$", "`", "\n", "(", ")", "{", "}", "<", ">"];

  for (const char of shellMetachars) {
    const charName = char === "\n" ? "\\n" : char;

    it(`blocks '${charName}' in pull_upstream commit arg`, () => {
      const request = makeRequest("pull_upstream", {
        commit: `abc1234${char}rm -rf /`,
      }, "self_mod", "dangerous");
      const result = injectionRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
      expect(result!.reasonCode).toBe("SHELL_INJECTION_DETECTED");
    });

    it(`blocks '${charName}' in install_npm_package package arg`, () => {
      const request = makeRequest("install_npm_package", {
        package: `evil-pkg${char}curl attacker.com`,
      }, "self_mod", "caution");
      const result = injectionRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });

    it(`blocks '${charName}' in install_skill name arg`, () => {
      const request = makeRequest("install_skill", {
        name: `evil${char}skill`,
        url: "https://example.com/skill.md",
      }, "skills", "caution");
      const result = injectionRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });
  }

  it("允许在 pull_upstream 中使用干净的提交哈希", () => {
    const request = makeRequest("pull_upstream", {
      commit: "abc1234def5678",
    }, "self_mod", "dangerous");
    const result = injectionRule.evaluate(request);
    expect(result).toBeNull();
  });

  it("允许在 install_npm_package 中使用干净的包名", () => {
    const request = makeRequest("install_npm_package", {
      package: "@scope/my-package",
    }, "self_mod", "caution");
    const result = injectionRule.evaluate(request);
    expect(result).toBeNull();
  });

  it("对 exec 工具返回 null（由 forbidden_patterns 处理）", () => {
    const request = makeRequest("exec", { command: "ls -la" }, "vm", "caution");
    const result = injectionRule.evaluate(request);
    expect(result).toBeNull();
  });

  it("对不在 SHELL_INTERPOLATED_TOOLS 中的工具返回 null", () => {
    const request = makeRequest("read_file", { path: "/etc/passwd; rm -rf /" }, "vm", "safe");
    const result = injectionRule.evaluate(request);
    expect(result).toBeNull();
  });
});

// ─── 禁止的命令模式测试 ─────────────────────────────

describe("command.forbidden_patterns rule", () => {
  const rules = createCommandSafetyRules();
  const forbiddenRule = rules.find((r) => r.id === "command.forbidden_patterns")!;

  it("exists and has correct metadata", () => {
    expect(forbiddenRule).toBeDefined();
    expect(forbiddenRule.priority).toBe(300);
    expect(forbiddenRule.appliesTo).toEqual({ by: "name", names: ["exec"] });
  });

  // 自我销毁模式
  const selfDestructPatterns = [
    "rm -rf .automaton",
    "rm -rf /home/user/.automaton",
    "rm state.db",
    "rm -f wallet.json",
    "rm automaton.json",
    "rm heartbeat.yml",
    "rm SOUL.md",
  ];

  for (const cmd of selfDestructPatterns) {
    it(`阻止自我销毁：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
      expect(result!.reasonCode).toBe("FORBIDDEN_COMMAND");
    });
  }

  // 进程终止
  const processKillPatterns = [
    "kill -9 automaton",
    "pkill automaton",
    "systemctl stop automaton",
    "systemctl disable automaton",
  ];

  for (const cmd of processKillPatterns) {
    it(`阻止进程终止：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });
  }

  // 数据库销毁
  const dbDestructPatterns = [
    "sqlite3 state.db 'DROP TABLE turns'",
    "DELETE FROM identity WHERE 1=1",
    "TRUNCATE everything",
  ];

  for (const cmd of dbDestructPatterns) {
    it(`阻止数据库销毁：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });
  }

  // 凭证窃取
  const credentialPatterns = [
    "cat ~/.ssh/id_rsa",
    "cat ~/.gnupg/private-keys-v1.d/key",
    "cat .env",
    "cat /home/user/wallet.json",
  ];

  for (const cmd of credentialPatterns) {
    it(`阻止凭证窃取：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });
  }

  // 安全基础设施修改
  const safetyModPatterns = [
    "sed -i 's/deny/allow/' injection-defense.ts",
    "sed -i '' policy-engine/something",
    "sed -i '' policy-rules/index.ts",
    "> injection-defense.ts",
    "> self-mod/code/file.ts",
    "> audit-log/log.txt",
    "> policy-engine.ts",
    "> policy-rules/command-safety.ts",
  ];

  for (const cmd of safetyModPatterns) {
    it(`阻止安全修改：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).not.toBeNull();
      expect(result!.action).toBe("deny");
    });
  }

  // 允许的命令
  const allowedPatterns = [
    "ls -la",
    "npm install express",
    "git status",
    "cat /tmp/output.txt",
    "node index.js",
  ];

  for (const cmd of allowedPatterns) {
    it(`允许安全命令：${cmd}`, () => {
      const request = makeRequest("exec", { command: cmd }, "vm", "caution");
      const result = forbiddenRule.evaluate(request);
      expect(result).toBeNull();
    });
  }

  it("仅适用于 exec 工具", () => {
    const request = makeRequest("write_file", { command: "rm -rf .automaton" }, "vm", "caution");
    // 规则的 appliesTo 是 { by: "name", names: ["exec"] }，所以不应匹配 write_file
    const result = evaluateRules([forbiddenRule], request);
    expect(result).toBeNull();
  });
});

// ─── 输入验证规则测试 ─────────────────────────────────

describe("Validation rules", () => {
  const rules = createValidationRules();

  describe("validate.package_name", () => {
    const rule = rules.find((r) => r.id === "validate.package_name")!;

    it("允许有效的包名", () => {
      const validNames = ["express", "@scope/pkg", "my-package", "pkg.js", "underscore_pkg"];
      for (const pkg of validNames) {
        const request = makeRequest("install_npm_package", { package: pkg }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝带有 shell 元字符的包名", () => {
      const invalidNames = [
        "pkg; rm -rf /",
        "pkg && curl evil.com",
        "pkg | cat /etc/passwd",
        "$(evil)",
        "`evil`",
      ];
      for (const pkg of invalidNames) {
        const request = makeRequest("install_npm_package", { package: pkg }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
        expect(result!.reasonCode).toBe("VALIDATION_FAILED");
      }
    });

    it("当缺少 package 参数时返回 null", () => {
      const request = makeRequest("install_npm_package", {}, "self_mod");
      const result = rule.evaluate(request);
      expect(result).toBeNull();
    });
  });

  describe("validate.skill_name", () => {
    const rule = rules.find((r) => r.id === "validate.skill_name")!;

    it("允许有效的技能名", () => {
      const validNames = ["my-skill", "skill123", "MySkill"];
      for (const name of validNames) {
        const request = makeRequest("install_skill", { name }, "skills");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝带有特殊字符的技能名", () => {
      const invalidNames = [
        "../etc/passwd",
        "skill; rm -rf /",
        "skill name",
        "skill/path",
        "skill.dot",
      ];
      for (const name of invalidNames) {
        const request = makeRequest("install_skill", { name }, "skills");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
      }
    });
  });

  describe("validate.git_hash", () => {
    const rule = rules.find((r) => r.id === "validate.git_hash")!;

    it("允许有效的 git 哈希", () => {
      const validHashes = ["abc1234", "deadbeef", "a".repeat(40)];
      for (const commit of validHashes) {
        const request = makeRequest("pull_upstream", { commit }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝无效的 git 哈希", () => {
      const invalidHashes = [
        "abc123; rm -rf /",
        "ABCDEF",  // uppercase
        "abc12",   // too short (6 chars)
        "ghijkl",  // non-hex chars
        "a".repeat(41), // too long
      ];
      for (const commit of invalidHashes) {
        const request = makeRequest("pull_upstream", { commit }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
      }
    });

    it("当未提供 commit 时返回 null（可选）", () => {
      const request = makeRequest("pull_upstream", {}, "self_mod");
      const result = rule.evaluate(request);
      expect(result).toBeNull();
    });
  });

  describe("validate.port_range", () => {
    const rule = rules.find((r) => r.id === "validate.port_range")!;

    it("允许有效的端口", () => {
      for (const port of [1, 80, 443, 8080, 65535]) {
        const request = makeRequest("expose_port", { port }, "vm");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝无效的端口", () => {
      for (const port of [0, -1, 65536, 100000, 1.5]) {
        const request = makeRequest("expose_port", { port }, "vm");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
      }
    });
  });

  describe("validate.cron_expression", () => {
    const rule = rules.find((r) => r.id === "validate.cron_expression")!;

    it("允许有效的 cron 表达式", () => {
      const valid = ["* * * * *", "0 */2 * * *", "30 9 * * 1-5", "0 0 1,15 * *"];
      for (const schedule of valid) {
        const request = makeRequest("modify_heartbeat", { schedule }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝无效的 cron 表达式", () => {
      const invalid = [
        "not a cron",
        "* * *",       // too few fields
        "* * * * * *", // too many fields
      ];
      for (const schedule of invalid) {
        const request = makeRequest("modify_heartbeat", { schedule }, "self_mod");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
      }
    });
  });

  describe("validate.address_format", () => {
    const rule = rules.find((r) => r.id === "validate.address_format")!;

    it("允许有效的以太坊地址", () => {
      const valid = [
        "0x1234567890abcdef1234567890abcdef12345678",
        "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      ];
      for (const to_address of valid) {
        const request = makeRequest("transfer_credits", { to_address }, "treasury");
        const result = rule.evaluate(request);
        expect(result).toBeNull();
      }
    });

    it("拒绝无效的地址", () => {
      const invalid = [
        "not-an-address",
        "0x1234",     // too short
        "1234567890abcdef1234567890abcdef12345678", // no 0x prefix
        "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // non-hex
      ];
      for (const to_address of invalid) {
        const request = makeRequest("transfer_credits", { to_address }, "treasury");
        const result = rule.evaluate(request);
        expect(result).not.toBeNull();
        expect(result!.action).toBe("deny");
      }
    });
  });
});

// ─── 默认规则集成 ─────────────────────────────────────

describe("createDefaultRules integration", () => {
  const rules = createDefaultRules();

  it("返回所有验证和命令安全规则", () => {
    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain("validate.package_name");
    expect(ruleIds).toContain("validate.skill_name");
    expect(ruleIds).toContain("validate.git_hash");
    expect(ruleIds).toContain("validate.port_range");
    expect(ruleIds).toContain("validate.cron_expression");
    expect(ruleIds).toContain("validate.address_format");
    expect(ruleIds).toContain("command.shell_injection");
    expect(ruleIds).toContain("command.forbidden_patterns");
  });

  it("使用组合规则阻止 install_skill 名称中的 shell 注入", () => {
    const request = makeRequest("install_skill", {
      name: "evil;rm -rf /",
      url: "https://example.com",
    }, "skills");
    const result = evaluateRules(rules, request);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("deny");
  });

  it("使用组合规则阻止 pull_upstream 中的无效 git 哈希", () => {
    const request = makeRequest("pull_upstream", {
      commit: "abc; rm -rf /",
    }, "self_mod", "dangerous");
    const result = evaluateRules(rules, request);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("deny");
  });
});

// ─── 注册表安全测试 ─────────────────────────────────────────

describe("skills/registry.ts safety", () => {
  // 这些测试验证注册表函数是否具有输入验证
  // 通过导入函数并检查它们在无效输入时是否抛出错误。
  // 我们实际上不执行 shell 命令——我们测试验证。

  it("installSkillFromGit 拒绝无效的技能名", async () => {
    const { installSkillFromGit } = await import("../skills/registry.js");
    await expect(
      installSkillFromGit("https://github.com/test/repo", "../evil", "/tmp/skills", {} as any, {} as any),
    ).rejects.toThrow(/Invalid skill name/);
  });

  it("installSkillFromGit 拒绝带有 shell 元字符的 URL", async () => {
    const { installSkillFromGit } = await import("../skills/registry.js");
    await expect(
      installSkillFromGit("https://evil.com/repo; rm -rf /", "test-skill", "/tmp/skills", {} as any, {} as any),
    ).rejects.toThrow(/Invalid repo URL/);
  });

  it("installSkillFromUrl 拒绝无效的技能名", async () => {
    const { installSkillFromUrl } = await import("../skills/registry.js");
    await expect(
      installSkillFromUrl("https://example.com/skill.md", "evil;name", "/tmp/skills", {} as any, {} as any),
    ).rejects.toThrow(/Invalid skill name/);
  });

  it("installSkillFromUrl 拒绝带有 shell 元字符的 URL", async () => {
    const { installSkillFromUrl } = await import("../skills/registry.js");
    await expect(
      installSkillFromUrl("https://evil.com/skill.md | cat /etc/passwd", "test-skill", "/tmp/skills", {} as any, {} as any),
    ).rejects.toThrow(/Invalid URL/);
  });

  it("createSkill 拒绝无效的技能名", async () => {
    const { createSkill } = await import("../skills/registry.js");
    await expect(
      createSkill("../etc/passwd", "evil", "inject code", "/tmp/skills", {} as any, {} as any),
    ).rejects.toThrow(/Invalid skill name/);
  });

  it("removeSkill 拒绝无效的技能名", async () => {
    const { removeSkill } = await import("../skills/registry.js");
    await expect(
      removeSkill("../../../etc", {} as any, {} as any, "/tmp/skills", true),
    ).rejects.toThrow(/Invalid skill name/);
  });
});

// ─── 源代码安全断言 ─────────────────────────────────

describe("Source code injection safety", () => {
  it("upstream.ts 使用 execFileSync 而不是带字符串插值的 execSync", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../self-mod/upstream.ts", import.meta.url).pathname.replace("/src/__tests__/../", "/src/"),
      "utf-8",
    );
    // 不应该有：execSync(`git ${cmd}`)
    expect(source).not.toMatch(/execSync\s*\(/);
    // 应该有：execFileSync("git", args, ...)
    expect(source).toMatch(/execFileSync\s*\(\s*"git"/);
  });

  it("registry.ts 使用 execFileSync 而不是带插值的 conway.exec", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../skills/registry.ts", import.meta.url).pathname.replace("/src/__tests__/../", "/src/"),
      "utf-8",
    );
    // 在 conway.exec 调用中不应该有模板字符串
    expect(source).not.toMatch(/conway\.exec\s*\(\s*`/);
    // 应该使用 execFileSync 或 fs.* 代替
    expect(source).toMatch(/execFileSync\s*\(/);
    expect(source).toMatch(/fs\.mkdirSync\(/);
    expect(source).toMatch(/fs\.rmSync\(/);
  });

  it("loader.ts 使用 execFileSync('which', [bin]) 而不是 execSync('which ${bin}')", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../skills/loader.ts", import.meta.url).pathname.replace("/src/__tests__/../", "/src/"),
      "utf-8",
    );
    // 不应该有：execSync(`which ${bin}`)
    expect(source).not.toMatch(/execSync\s*\(\s*`which/);
    // 应该有：execFileSync("which", [bin])
    expect(source).toMatch(/execFileSync\s*\(\s*"which"/);
  });

  it("tools.ts pull_upstream 使用 conway.exec 而不是主机 execSync", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../agent/tools.ts", import.meta.url).pathname.replace("/src/__tests__/../", "/src/"),
      "utf-8",
    );
    // 查找 pull_upstream 部分并检查它没有导入 child_process
    const pullSection = source.slice(
      source.indexOf("name: \"pull_upstream\""),
      source.indexOf("name: \"modify_heartbeat\""),
    );
    expect(pullSection).not.toMatch(/import\s*\(\s*"child_process"\s*\)/);
    expect(pullSection).toMatch(/ctx\.conway\.exec\(/);
  });

  it("tools.ts 在 FORBIDDEN_COMMAND_PATTERNS 上有纵深防御注释", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../agent/tools.ts", import.meta.url).pathname.replace("/src/__tests__/../", "/src/"),
      "utf-8",
    );
    expect(source).toMatch(/[Dd]efense.in.depth.*policy engine/i);
  });
});
