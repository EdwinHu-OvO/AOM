import type { ExecutableCapability } from "../analysis/types.js";

export function scoreCapability(item: ExecutableCapability, task: string): number {
  const haystack = [
    item.capability.name,
    item.capability.id,
    item.capability.description,
    item.actionPlan.map((step) => step.summary).join(" "),
  ].join(" ");
  let score = 0;
  if (/搜索|查找|search|query|find/i.test(task) && /搜索|search|query|find/i.test(haystack)) score += 10;
  if (/打开|进入|查看|播放|open|view|detail|result|content|video/i.test(task)
    && /open|view|detail|result|content|video|打开|查看|播放/i.test(haystack)) score += 8;
  if (/购物车|加购|加入|下单|cart|checkout|order/i.test(task)
    && /cart|checkout|order|add_to_cart|购物车|下单/i.test(haystack)) score += 8;
  if (/登录|登陆|sign in|signin|login/i.test(task) && /login|sign.?in|登录|登陆/i.test(haystack)) score += 8;
  if (item.availability === "available") score += 2;
  if (item.availability === "low_confidence") score += 1;
  if (item.automation.canAutoExecute) score += 1;
  return score;
}

export function inferCapabilityInputs(
  item: ExecutableCapability,
  task: string,
): Record<string, unknown> | undefined {
  const slots = item.capability.inputSlots ?? [];
  const inputs: Record<string, unknown> = {};
  const query = extractQuery(task);
  for (const slot of slots) {
    const name = typeof slot.name === "string" ? slot.name : undefined;
    if (!name) continue;
    if (/query|keyword|search|text|input|value/i.test(name) && query) inputs[name] = query;
    if (/product|item|menu/i.test(name)) {
      const product = extractProduct(task);
      if (product) inputs[name] = product;
    }
  }
  if (Object.keys(inputs).length === 0 && /搜索|查找|search|query|find/i.test(task) && query) {
    inputs.query = query;
  }
  return Object.keys(inputs).length > 0 ? inputs : undefined;
}

export function isExecutable(item: ExecutableCapability): boolean {
  return item.availability === "available" || item.availability === "low_confidence";
}

export function normalized(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

export function clampStepLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(8, Math.trunc(value)));
}

export function stableHash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16);
}

function extractQuery(task: string): string | undefined {
  const quoted = task.match(/["'“”‘’]([^"'“”‘’]{2,80})["'“”‘’]/)?.[1];
  if (quoted) return quoted.trim();
  const search = task.match(/(?:搜索|查找|搜|search(?: for)?|find|query)\s*[:：]?\s*([^\n,，。；;]{2,80})/i)?.[1];
  if (search) return cleanupQuery(search);
  const topic = task.match(/(?:我想看|我要看|看一下|打开|进入)\s*([^\n,，。；;]{2,80})/i)?.[1];
  return topic ? cleanupQuery(topic) : undefined;
}

function extractProduct(task: string): string | undefined {
  const match = task.match(/(?:加入|添加|加购|add)\s*([^\n,，。；;]{2,80})(?:到|进|to)?(?:购物车|cart)?/i)?.[1];
  return match ? cleanupQuery(match) : undefined;
}

function cleanupQuery(value: string): string | undefined {
  const cleaned = value
    .replace(/^(一下|一下子|关于|有关|内容|视频)\s*/i, "")
    .replace(/\s*(的内容|的视频|的结果|结果|内容|视频)$/i, "")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
