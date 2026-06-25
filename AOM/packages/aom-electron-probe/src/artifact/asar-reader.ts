import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import path from "node:path";

const MAX_HEADER_BYTES = 32 * 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_ENTRY_COUNT = 100_000;

interface AsarEntry {
  size?: number;
  offset?: string;
  unpacked?: boolean;
  executable?: boolean;
  integrity?: { algorithm?: string; hash?: string };
  files?: Record<string, AsarEntry>;
}

export interface AsarFileEntry extends AsarEntry {
  path: string;
}

export interface AsarIndex {
  archiveSize: number;
  dataOffset: number;
  entries: AsarFileEntry[];
  headerDigest: string;
  headerSize: number;
}

export async function readAsarIndex(asarPath: string): Promise<AsarIndex> {
  const handle = await open(asarPath, "r");
  try {
    const archiveSize = (await handle.stat()).size;
    const prefix = Buffer.alloc(16);
    await readExactly(handle, prefix, 0);
    const headerSize = prefix.readUInt32LE(4);
    const jsonSize = prefix.readUInt32LE(12);
    const paddedJsonSize = headerSize - 8;
    if (
      headerSize < 8
      || headerSize > MAX_HEADER_BYTES
      || jsonSize > paddedJsonSize
      || paddedJsonSize - jsonSize > 8
    ) {
      throw new Error(`Invalid or oversized ASAR header: ${asarPath}`);
    }
    const dataOffset = 8 + headerSize;
    if (dataOffset > archiveSize) throw new Error(`ASAR header exceeds archive size: ${asarPath}`);
    const json = Buffer.alloc(jsonSize);
    await readExactly(handle, json, 16);
    const header = JSON.parse(json.toString("utf8").replace(/\0+$/, "")) as AsarEntry;
    return {
      archiveSize,
      dataOffset,
      entries: flattenEntries(header),
      headerDigest: createHash("sha256").update(json).digest("hex"),
      headerSize,
    };
  } finally {
    await handle.close();
  }
}

export async function readAsarEntryText(
  asarPath: string,
  index: Pick<AsarIndex, "archiveSize" | "dataOffset">,
  entry: AsarFileEntry,
): Promise<string> {
  const size = entry.size ?? 0;
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_TEXT_BYTES) {
    throw new Error(`Invalid or oversized ASAR entry: ${entry.path}`);
  }
  if (entry.unpacked) {
    return readFile(`${asarPath}.unpacked/${entry.path}`, "utf8");
  }
  const offset = Number(entry.offset ?? 0);
  if (
    !Number.isSafeInteger(offset)
    || offset < 0
    || index.dataOffset + offset + size > index.archiveSize
  ) {
    throw new Error(`Invalid ASAR entry offset: ${entry.path}`);
  }
  const handle = await open(asarPath, "r");
  try {
    const bytes = Buffer.alloc(size);
    await readExactly(handle, bytes, index.dataOffset + offset);
    return bytes.toString("utf8");
  } finally {
    await handle.close();
  }
}

function flattenEntries(root: AsarEntry): AsarFileEntry[] {
  const entries: AsarFileEntry[] = [];
  function visit(node: AsarEntry, parent = ""): void {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const entryPath = parent ? `${parent}/${name}` : name;
      validateEntryPath(entryPath);
      if (entries.length >= MAX_ENTRY_COUNT) {
        throw new Error(`ASAR contains more than ${MAX_ENTRY_COUNT} entries`);
      }
      if (entry.files) visit(entry, entryPath);
      else entries.push({ ...entry, path: entryPath });
    }
  }
  visit(root);
  return entries;
}

async function readExactly(
  handle: Awaited<ReturnType<typeof open>>,
  buffer: Buffer,
  position: number,
): Promise<void> {
  let consumed = 0;
  while (consumed < buffer.length) {
    const { bytesRead } = await handle.read(
      buffer,
      consumed,
      buffer.length - consumed,
      position + consumed,
    );
    if (bytesRead === 0) throw new Error("Unexpected end of ASAR archive");
    consumed += bytesRead;
  }
}

function validateEntryPath(entryPath: string): void {
  if (
    path.posix.isAbsolute(entryPath)
    || entryPath.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error(`Unsafe ASAR entry path: ${entryPath}`);
  }
}
