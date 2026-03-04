/**
 * 父子消息传递
 *
 * 基于中继的父子自动机之间的通信。
 * 替换未认证的基于文件系统的 messageChild()。
 */

import type { SocialClientInterface, ParentChildMessage } from "../types.js";
import { MESSAGE_LIMITS } from "../types.js";
import { ulid } from "ulid";

/**
 * 通过社交中继向子自动机发送消息。
 */
export async function sendToChild(
  social: SocialClientInterface,
  childAddress: string,
  content: string,
  type: string = "parent_message",
): Promise<{ id: string }> {
  if (content.length > MESSAGE_LIMITS.maxContentLength) {
    throw new Error(`消息过长：${content.length} 字节（最大 ${MESSAGE_LIMITS.maxContentLength}）`);
  }

  const result = await social.send(childAddress, JSON.stringify({
    type,
    content,
    sentAt: new Date().toISOString(),
  }));

  return { id: result.id };
}

/**
 * 通过社交中继向父自动机发送消息。
 */
export async function sendToParent(
  social: SocialClientInterface,
  parentAddress: string,
  content: string,
  type: string = "child_message",
): Promise<{ id: string }> {
  if (content.length > MESSAGE_LIMITS.maxContentLength) {
    throw new Error(`消息过长：${content.length} 字节（最大 ${MESSAGE_LIMITS.maxContentLength}）`);
  }

  const result = await social.send(parentAddress, JSON.stringify({
    type,
    content,
    sentAt: new Date().toISOString(),
  }));

  return { id: result.id };
}
