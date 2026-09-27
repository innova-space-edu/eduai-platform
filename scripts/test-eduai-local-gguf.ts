import assert from "node:assert/strict";
import { validateEduAIGgufFiles } from "../lib/ai/local/eduai-local-gguf";

const single = validateEduAIGgufFiles([{ name: "eduai-lite-Q4_K_M.gguf", size: 100 }]);
assert.equal(single.shardCount, 1);
assert.equal(single.label, "eduai-lite-Q4_K_M");

const shards = validateEduAIGgufFiles([
  { name: "eduai-performance-Q4_K_M-00002-of-00003.gguf", size: 20 },
  { name: "eduai-performance-Q4_K_M-00001-of-00003.gguf", size: 10 },
  { name: "eduai-performance-Q4_K_M-00003-of-00003.gguf", size: 30 },
]);
assert.equal(shards.shardCount, 3);
assert.deepEqual(shards.files.map((file) => file.name), [
  "eduai-performance-Q4_K_M-00001-of-00003.gguf",
  "eduai-performance-Q4_K_M-00002-of-00003.gguf",
  "eduai-performance-Q4_K_M-00003-of-00003.gguf",
]);
assert.equal(shards.totalBytes, 60);

assert.throws(
  () => validateEduAIGgufFiles([
    { name: "a-00001-of-00003.gguf", size: 1 },
    { name: "a-00003-of-00003.gguf", size: 1 },
  ]),
  /incompleto|Falta/,
);

assert.throws(
  () => validateEduAIGgufFiles([{ name: "model.bin", size: 1 }]),
  /no GGUF/,
);

console.log("EDUAI local GGUF selection: OK");
