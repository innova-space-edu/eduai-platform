import assert from "node:assert/strict";
import { rankEduAIRagRecords, eduAIRagQueryTerms } from "../lib/ai/local/eduai-local-rag-score";

assert.deepEqual(
  eduAIRagQueryTerms("¿Dónde está runEduAILocalChat en el código?"),
  ["runeduailocalchat", "codigo"],
);

const records = [
  {
    source: "docs/notes.md",
    content: "Aquí se menciona de forma casual runEduAILocalChat en una explicación.",
  },
  {
    source: "__eduai__/symbols/lib/ai/local/eduai-local-runtime.ts.md",
    content: "# Symbols\n- function: runEduAILocalChat (L253)\n- function: loadEduAILocalModel (L190)",
  },
  {
    source: "lib/ai/local/eduai-local-runtime.ts",
    content: "export async function runEduAILocalChat(prompt: string) { return prompt; }",
  },
  {
    source: "components/admin/Other.tsx",
    content: "export function Other() { return null; }",
  },
];

const hits = rankEduAIRagRecords(records, "runEduAILocalChat", 4);
assert.equal(hits[0]?.source, "__eduai__/symbols/lib/ai/local/eduai-local-runtime.ts.md");
assert.ok(hits.some((hit) => hit.source === "lib/ai/local/eduai-local-runtime.ts"));
assert.ok(!hits.some((hit) => hit.source === "components/admin/Other.tsx"));

const pathHits = rankEduAIRagRecords(records, "lib/ai/local/eduai-local-runtime.ts", 2);
assert.ok(pathHits[0]?.source.includes("lib/ai/local/eduai-local-runtime.ts"));

console.log("EDUAI local RAG ranking: OK");
