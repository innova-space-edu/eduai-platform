import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components", "lib", "docs"];
const ROOT_FILES = ["README.md", "DESIGN.md", "SECURITY.md", "INSTALL.md"];
const OUT_DIR = path.join(ROOT, "artifacts", "ai");
const OUT_FILE = path.join(OUT_DIR, "eduai-local-corpus.jsonl");
const MANIFEST_FILE = path.join(OUT_DIR, "eduai-local-corpus-manifest.json");

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".mdx", ".json", ".css", ".sql",
]);

const DENY_PATH = /(?:^|[\\/])(?:node_modules|\.next|\.git|public|artifacts|coverage|dist|build)(?:[\\/]|$)/i;
const SECRET_FILE = /(?:^|[._-])(?:env|secret|credential|private[-_]?key)(?:[._-]|$)/i;
const SECRET_LINE = /(api[_-]?key|secret|password|private[_-]?key|service[_-]?account)\s*[:=]\s*["'][^"']{8,}["']/i;
const MAX_FILE_BYTES = 512 * 1024;
const CHUNK_CHARS = 6000;
const OVERLAP_CHARS = 600;

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

const candidates = [];
for (const root of SOURCE_ROOTS) candidates.push(...await walk(path.join(ROOT, root)));
for (const file of ROOT_FILES) candidates.push(path.join(ROOT, file));

const unique = [...new Set(candidates)].sort();
const records = [];
let skipped = 0;

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
await writeFile(OUT_FILE, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");

const manifest = {
  generatedAt: new Date().toISOString(),
  roots: SOURCE_ROOTS,
  rootFiles: ROOT_FILES,
  output: path.relative(ROOT, OUT_FILE).replaceAll("\\", "/"),
  filesScanned: unique.length,
  records: records.length,
  skipped,
  policy: {
    repositoryOnly: true,
    includesUserConversations: false,
    includesStudentDataByDefault: false,
    secretLikeLinesRedacted: true,
  },
};

await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify(manifest, null, 2));
