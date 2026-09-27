import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raw = await readFile("training/eduai-local/eval-cases.jsonl", "utf8");
const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

assert.ok(rows.length >= 10, "La suite debe tener al menos 10 casos");
const ids = new Set();
let critical = 0;
for (const row of rows) {
  assert.equal(typeof row.id, "string");
  assert.ok(row.id.length > 2);
  assert.ok(!ids.has(row.id), `ID duplicado: ${row.id}`);
  ids.add(row.id);
  assert.equal(typeof row.category, "string");
  assert.equal(typeof row.prompt, "string");
  assert.ok(row.prompt.trim().length > 10);
  assert.equal(typeof row.checks, "object");
  if (row.critical) critical += 1;
}
assert.ok(critical >= 5, "Deben existir al menos cinco casos críticos");

console.log(`EDUAI local eval suite: OK (${rows.length} casos, ${critical} críticos)`);
