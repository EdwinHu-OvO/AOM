import { writeFileSync } from "node:fs";

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function writeSyntheticAsar(destination, files) {
  let offset = 0;
  const payloads = [];
  const root = { files: {} };
  for (const [entryPath, text] of Object.entries(files)) {
    const bytes = Buffer.from(text);
    payloads.push(bytes);
    insertEntry(root, entryPath.split("/"), {
      size: bytes.length,
      offset: String(offset),
    });
    offset += bytes.length;
  }
  const rawJson = Buffer.from(JSON.stringify(root));
  const padding = Buffer.alloc((4 - (rawJson.length % 4)) % 4, 0x20);
  const json = Buffer.concat([rawJson, padding]);
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(json.length + 8, 4);
  prefix.writeUInt32LE(json.length + 4, 8);
  prefix.writeUInt32LE(json.length, 12);
  writeFileSync(destination, Buffer.concat([prefix, json, ...payloads]));
}

function insertEntry(root, parts, entry) {
  const [name, ...rest] = parts;
  if (name === undefined) return;
  if (rest.length === 0) {
    root.files[name] = entry;
    return;
  }
  const directory = root.files[name] ?? { files: {} };
  root.files[name] = directory;
  insertEntry(directory, rest, entry);
}
