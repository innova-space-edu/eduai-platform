import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components", "lib", "docs", "scripts", "supabase", "data", ".github/workflows"];
const ROOT_FILES = ["README.md", "DESIGN.md", "SECURITY.md", "INSTALL.md", "package.json", "next.config.ts", "tsconfig.json", "middleware.ts", "proxy.ts"];
const OUT_DIR = path.join(ROOT, "artifacts", "ai");
const OUT_FILE = path.join(OUT_DIR, "eduai-local-corpus.jsonl");
const MANIFEST_FILE = path.join(OUT_DIR, "eduai-local-corpus-manifest.json");
const KNOWLEDGE_DIR = path.join(OUT_DIR, "knowledge");
const KNOWLEDGE_INDEX_FILE = path.join(KNOWLEDGE_DIR, "index.json");

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".mdx", ".json", ".css", ".sql",
  ".py", ".sh", ".yml", ".yaml", ".toml", ".html",
]);

const DENY_PATH = /(?:^|[\\/])(?:node_modules|\.next|\.git|public|artifacts|coverage|dist|build)(?:[\\/]|$)/i;
const SECRET_FILE = /(?:^|[._-])(?:env|secret|credential|private[-_]?key)(?:[._-]|$)/i;
const SECRET_LINE = /(api[_-]?key|secret|password|private[_-]?key|service[_-]?account)\s*[:=]\s*["'][^"']{8,}["']/i;
const MAX_FILE_BYTES = 512 * 1024;
const CHUNK_CHARS = 6000;
const OVERLAP_CHARS = 600;
const KNOWLEDGE_SHARD_TARGET_BYTES = 1_500_000;

async function walk(target) {
  const entries = [];
  const info = await stat(target).catch(() => null);
  if (!info) return entries;
  if (info.isFile()) return [target];
  for (const child of await readdir(target, { withFileTypes: true })) {
    const absolute = path.join(target, child.name);
    const relative = path.relative(ROOT, absolute);
    if (DENY_PATH.test(relative) || SECRET_FILE.test(child.name)) continue;
    if (child.isDirectory()) entries.push(...await walk(absolute));
    else if (child.isFile()) entries.push(absolute);
  }
  return entries;
}

function sanitize(text) {
  return text
    .split(/\r?\n/)
    .map((line) => SECRET_LINE.test(line) ? "[REDACTED_SECRET_LIKE_LINE]" : line)
    .join("\n");
}

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_CHARS);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(start + 1, end - OVERLAP_CHARS);
  }
  return chunks;
}

function recordBytes(record) {
  return Buffer.byteLength(JSON.stringify(record), "utf8") + 1;
}

const candidates = [];
for (const root of SOURCE_ROOTS) candidates.push(...await walk(path.join(ROOT, root)));
for (const file of ROOT_FILES) candidates.push(path.join(ROOT, file));

const unique = [...new Set(candidates)].sort();
const records = [];
const byExtension = {};
let skipped = 0;
let totalSourceBytes = 0;

for (const absolute of unique) {
  const relative = path.relative(ROOT, absolute).replaceAll("\\", "/");
  if (DENY_PATH.test(relative) || SECRET_FILE.test(path.basename(relative))) {
    skipped += 1;
    continue;
  }
  const ext = path.extname(relative).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    skipped += 1;
    continue;
  }
  const info = await stat(absolute).catch(() => null);
  if (!info || info.size > MAX_FILE_BYTES) {
    skipped += 1;
    continue;
  }
  const raw = await readFile(absolute, "utf8").catch(() => "");
  if (!raw.trim()) continue;
  totalSourceBytes += info.size;
  byExtension[ext || "text"] = (byExtension[ext || "text"] || 0) + 1;
  const clean = sanitize(raw);
  const chunks = chunkText(clean);
  chunks.forEach((content, index) => {
    const id = createHash("sha256").update(relative + ":" + index + ":" + content).digest("hex").slice(0, 20);
    records.push({
      id,
      source: relative,
      chunk: index,
      language: ext.slice(1) || "text",
      content,
    });
  });
}

await mkdir(OUT_DIR, { recursive: true });
const serialized = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
await writeFile(OUT_FILE, serialized, "utf8");

const generatedAt = new Date().toISOString();
const buildCommit = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 40);

await rm(KNOWLEDGE_DIR, { recursive: true, force: true });
await mkdir(KNOWLEDGE_DIR, { recursive: true });

const shards = [];
let current = [];
let currentBytes = 0;

async function flushShard() {
  if (!current.length) return;
  const index = shards.length;
  const file = `shard-${String(index).padStart(4, "0")}.json`;
  const payload = {
    schemaVersion: 2,
    generatedAt,
    buildCommit,
    index,
    records: current.map(({ id, source, language, content }) => ({ id, source, language, content })),
  };
  const body = JSON.stringify(payload);
  await writeFile(path.join(KNOWLEDGE_DIR, file), body, "utf8");
  shards.push({
    index,
    file,
    records: current.length,
    bytes: Buffer.byteLength(body, "utf8"),
  });
  current = [];
  currentBytes = 0;
}

for (const record of records) {
  const bytes = recordBytes(record);
  if (current.length && currentBytes + bytes > KNOWLEDGE_SHARD_TARGET_BYTES) {
    await flushShard();
  }
  current.push(record);
  currentBytes += bytes;
}
await flushShard();

const knowledgePackBytes = shards.reduce((sum, shard) => sum + shard.bytes, 0);
const knowledgeIndex = {
  schemaVersion: 2,
  sourceProfile: "development-full",
  generatedAt,
  buildCommit,
  totalRecords: records.length,
  totalBytes: knowledgePackBytes,
  shards,
};
await writeFile(KNOWLEDGE_INDEX_FILE, JSON.stringify(knowledgeIndex, null, 2) + "\n", "utf8");

const manifest = {
  schemaVersion: 3,
  sourceProfile: "development-full",
  generatedAt,
  buildCommit,
  roots: SOURCE_ROOTS,
  rootFiles: ROOT_FILES,
  output: path.relative(ROOT, OUT_FILE).replaceAll("\\", "/"),
  filesScanned: unique.length,
  indexedFiles: Object.values(byExtension).reduce((sum, value) => sum + value, 0),
  records: records.length,
  skipped,
  totalSourceBytes,
  corpusBytes: Buffer.byteLength(serialized),
  knowledgePackIndex: path.relative(ROOT, KNOWLEDGE_INDEX_FILE).replaceAll("\\", "/"),
  knowledgePackBytes,
  knowledgePackShards: shards.length,
  knowledgeShardTargetBytes: KNOWLEDGE_SHARD_TARGET_BYTES,
  byExtension,
  policy: {
    repositoryOnly: true,
    includesUserConversations: false,
    includesStudentDataByDefault: false,
    secretLikeLinesRedacted: true,
  },
};

await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify(manifest, null, 2));
