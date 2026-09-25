import assert from "node:assert/strict";
import {
  extractEduAILocalSymbols,
  renderEduAILocalSymbolDocument,
} from "./eduai-local-symbol-index.mjs";

const ts = `
export async function GET() {}
export function loadModel() {}
export class Runtime {}
export type Mode = "a" | "b";
export const VERSION = 3;
const internal = 1;
`;
const tsSymbols = extractEduAILocalSymbols("app/api/test/route.ts", ts);
assert.deepEqual(
  tsSymbols.map(({ name, kind }) => ({ name, kind })),
  [
    { name: "GET", kind: "function" },
    { name: "loadModel", kind: "function" },
    { name: "Runtime", kind: "class" },
    { name: "Mode", kind: "type" },
    { name: "VERSION", kind: "const" },
  ],
);

const py = `
def train():
    pass

class Trainer:
    pass
`;
assert.deepEqual(
  extractEduAILocalSymbols("training/train.py", py).map((item) => item.name),
  ["train", "Trainer"],
);

const sql = "CREATE TABLE public.ai_models (id uuid);\nCREATE OR REPLACE FUNCTION public.route_ai() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;";
assert.deepEqual(
  extractEduAILocalSymbols("supabase/migrations/a.sql", sql).map((item) => item.kind),
  ["sql-table", "sql-function"],
);

const doc = renderEduAILocalSymbolDocument("lib/a.ts", tsSymbols);
assert.match(doc, /loadModel \(L3\)/);
assert.match(doc, /Archivo: lib\/a\.ts/);

console.log("EDUAI local symbol index: OK");
