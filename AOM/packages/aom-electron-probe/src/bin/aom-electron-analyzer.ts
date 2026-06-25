#!/usr/bin/env node
import { createInterface } from "node:readline";
import type { AnalyzerCommand, AnalyzerReply } from "@aom/protocol";
import { AnalyzerSession } from "../stdio/session.js";

const session = new AnalyzerSession();
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of lines) {
  if (!line.trim()) continue;
  let reply: AnalyzerReply;
  try {
    const command = JSON.parse(line) as AnalyzerCommand;
    reply = await session.handle(command);
  } catch (error) {
    reply = {
      replyType: "error",
      data: {
        code: "invalid_command",
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
        evidence: [],
      },
    };
  }
  process.stdout.write(`${JSON.stringify(reply)}\n`);
  if (reply.replyType === "ack") break;
}

await session.close();
