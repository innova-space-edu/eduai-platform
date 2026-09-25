import assert from "node:assert/strict";
import {
  sanitizeEduAILocalCorpusText,
  shouldRedactEduAILocalCorpusLine,
} from "./eduai-local-corpus-safety.mjs";

const sensitive = [
  "API_KEY=sk-example-value-123456",
  "PASSWORD: super-secret-value",
  "access_token=abcdefghijklmno",
  "client-secret: abcdefghijklmno",
  "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
  "token = \"abcdefghijklmnop\"",
];

for (const line of sensitive) {
  assert.equal(shouldRedactEduAILocalCorpusLine(line), true, line);
}

const safe = [
  "const count = 42;",
  "export function tokenCount() { return 5; }",
  "GEMINI_API_KEY",
  "password policy documentation",
];

for (const line of safe) {
  assert.equal(shouldRedactEduAILocalCorpusLine(line), false, line);
}

assert.equal(
  sanitizeEduAILocalCorpusText(["hello", sensitive[0], "world"].join("\n")),
  ["hello", "[REDACTED_SECRET_LIKE_LINE]", "world"].join("\n"),
);

console.log("EDUAI local corpus secret safety: OK");
