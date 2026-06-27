# Console 进度

## 当前状态

- Phase 5 Console audit baseline 已实现。
- 新增 TypeScript package：`@aom/console`。
- Console 当前是 CLI 审计端，不是完整图形化产品 UI。
- `@aom/agent-mcp` 会为每个 MCP `tools/call` 写入结构化 JSONL audit record。
- 默认 audit log 路径：`AOM/logs/aom-audit.jsonl`，可用 `AOM_AUDIT_LOG` 覆盖。
- `aom-console audit` 可读取 audit log，输出 tool timeline、session、参数摘要、结果摘要、
  action ok/error、event count、graph summary、capability summary 和错误信息。
- `aom-console audit --json` 可输出机器可读摘要，方便后续图形化 Console 或测试消费。

## 已完成

- `@aom/agent-mcp`：
  - 新增 `AuditRecorder`。
  - MCP `tools/call` 成功和失败都会产生 audit record。
  - 大型 graph/context payload 在 audit 中只记录摘要，避免日志膨胀。
  - 记录 action result、eventCount、analysis graph summary、capability 名称和 verification 摘要。
- `@aom/console`：
  - 新增 bin：`aom-console`。
  - 支持 `audit` 命令。
  - 支持 `--file`、`--limit`、`--json`。
  - Smoke test 使用临时 JSONL 验证文本和 JSON 输出。
- 测试：
  - MCP smoke test 已断言 `aom.session_status` 会写出 audit record。
  - Console smoke test 已断言 CLI 能读取并渲染 audit JSONL。

## 使用方式

先构建：

```text
cd /Users/edwinh/Desktop/AOM/AOM
pnpm build
```

查看默认 audit log：

```text
pnpm --filter @aom/console run audit -- --limit 20
```

指定 audit log：

```text
pnpm --filter @aom/console run audit -- --file /tmp/aom-audit.jsonl --json
```

## 近期目标

- 增加 `aom-console audit --watch`，用于实时观察 Agent 调用。
- 增加 action detail view：展示 raw target、view label、action type、event diff 和 verification。
- 增加 graph/context artifact dump：审计记录只保存摘要，但 Console 可按 auditId 关联完整
  graph/context 快照文件。
- 后续用于查看 target 状态、snapshot、event stream、graph、capability 和 Gateway audit。
