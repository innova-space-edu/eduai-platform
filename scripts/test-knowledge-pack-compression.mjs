import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const knowledgeDir = path.join(process.cwd(), "artifacts", "ai", "knowledge");
const index = JSON.parse(await readFile(path.join(knowledgeDir, "index.json"), "utf8"));

assert.equal(index.compression, "gzip");
assert.ok(index.shards.length > 0, "El Knowledge Pack debe tener shards");

let originalBytes = 0;
let storedBytes = 0;
let totalRecords = 0;
for (const shard of index.shards) {
  assert.match(shard.file, /^shard-\\d{4}\\.json\\.gz$/);
  const compressed = await readFile(path.join(knowledgeDir, shard.file));
  const raw = gunzipSync(compressed);
  const payload = JSON.parse(raw.toString("utf8"));
  assert.equal(payload.buildCommit, index.buildCommit);
  assert.equal(payload.index, shard.index);
  assert.equal(payload.records.length, shard.records);
  assert.equal(raw.byteLength, shard.bytes);
  assert.equal(compressed.byteLength, shard.storedBytes);
  originalBytes += raw.byteLength;
  storedBytes += compressed.byteLength;
  totalRecords += payload.records.length;
}

assert.equal(totalRecords, index.totalRecords);
assert.equal(originalBytes, index.totalBytes);
assert.equal(storedBytes, index.totalStoredBytes);
assert.ok(storedBytes < originalBytes, "Los shards comprimidos deben ocupar menos espacio");
console.log(JSON.stringify({ test: "Knowledge Pack gzip", shards: index.shards.length, originalBytes, storedBytes, savedPercent: Math.round(100 * (1 - storedBytes / originalBytes)) }));
