import readline from "readline";
import chalk from "chalk";

let rl: readline.Interface | null = null;

/**
 * 获取 readline 接口实例
 */
function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

/**
 * 向用户提问并获取回答
 */
function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getRL().question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * 提示用户输入必填项
 */
export async function promptRequired(label: string): Promise<string> {
  while (true) {
    const value = await ask(chalk.white(`  → ${label}: `));
    if (value) return value;
    console.log(chalk.yellow("  此字段为必填项。"));
  }
}

/**
 * 提示用户输入可选项
 */
export async function promptOptional(label: string): Promise<string> {
  return ask(chalk.white(`  → ${label}: `));
}

/**
 * 提示用户输入多行文本
 */
export async function promptMultiline(label: string): Promise<string> {
  console.log("");
  console.log(chalk.white(`  ${label}`));
  console.log(chalk.dim("  输入您的提示词，然后按两次 Enter 完成："));
  console.log("");

  const lines: string[] = [];
  let lastWasEmpty = false;

  while (true) {
    const line = await ask("  ");
    if (line === "" && lastWasEmpty && lines.length > 0) {
      // 删除我们添加的尾随空行
      lines.pop();
      break;
    }
    if (line === "" && lines.length > 0) {
      lastWasEmpty = true;
      lines.push("");
    } else {
      lastWasEmpty = false;
      lines.push(line);
    }
  }

  const result = lines.join("\n").trim();
  if (!result) {
    console.log(chalk.yellow("  创世提示词是必填项。请重试。"));
    return promptMultiline(label);
  }
  return result;
}

/**
 * 提示用户输入以太坊地址
 */
export async function promptAddress(label: string): Promise<string> {
  while (true) {
    const value = await ask(chalk.white(`  → ${label}: `));
    if (/^0x[0-9a-fA-F]{40}$/.test(value)) return value;
    console.log(chalk.yellow("  无效的以太坊地址。必须以 0x 开头，后跟 40 个十六进制字符。"));
  }
}

/**
 * 提示输入带默认值的数值。
 * 显示带有默认值的标签，验证输入为正整数，
 * 在空输入或无效输入时返回默认值。
 */
export async function promptWithDefault(label: string, defaultValue: number): Promise<number> {
  const input = await ask(chalk.white(`  → ${label} [${defaultValue}]: `));
  if (!input || input.trim() === "") return defaultValue;
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed < 0) {
    console.log(chalk.yellow(`  输入无效，使用默认值：${defaultValue}`));
    return defaultValue;
  }
  return parsed;
}

/**
 * 关闭 readline 接口
 */
export function closePrompts(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
