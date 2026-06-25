import type { JsonValue } from "@aom/protocol";

const sensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
]);

export function summarizeNetworkRequest(
  params: Record<string, unknown>,
): Record<string, JsonValue> {
  const request = record(params.request);
  const postData = stringValue(request.postData);
  return compact({
    requestId: stringValue(params.requestId),
    url: stringValue(request.url),
    method: stringValue(request.method),
    resourceType: stringValue(params.type),
    hasBody: Boolean(request.hasPostData ?? postData),
    bodyBytes: postData === undefined ? undefined : Buffer.byteLength(postData),
    headers: sanitizeHeaders(request.headers),
  });
}

export function summarizeNetworkResponse(
  params: Record<string, unknown>,
): Record<string, JsonValue> {
  const response = record(params.response);
  return compact({
    requestId: stringValue(params.requestId),
    url: stringValue(response.url),
    status: numberValue(response.status),
    statusText: stringValue(response.statusText),
    mimeType: stringValue(response.mimeType),
    resourceType: stringValue(params.type),
    fromDiskCache: booleanValue(response.fromDiskCache),
    fromServiceWorker: booleanValue(response.fromServiceWorker),
    headers: sanitizeHeaders(response.headers),
  });
}

function sanitizeHeaders(value: unknown): Record<string, JsonValue> {
  const headers = record(value);
  const sanitized: Record<string, JsonValue> = {};
  for (const [name, headerValue] of Object.entries(headers)) {
    sanitized[name] = sensitiveHeaders.has(name.toLowerCase())
      ? "[redacted]"
      : scalarValue(headerValue);
  }
  return sanitized;
}

function compact(
  value: Record<string, JsonValue | undefined>,
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, JsonValue] => entry[1] !== undefined,
    ),
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scalarValue(value: unknown): JsonValue {
  return typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || value === null
    ? value
    : String(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
