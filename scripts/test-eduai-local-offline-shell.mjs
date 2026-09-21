import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, page, panel, runtime, config] = await Promise.all([
  readFile("public/eduai-local-sw.js", "utf8"),
  readFile("app/local-ai/offline/page.tsx", "utf8"),
  readFile("components/admin/EduAILocalRuntimePanel.tsx", "utf8"),
  readFile("lib/ai/local/eduai-local-runtime.ts", "utf8"),
  readFile("next.config.ts", "utf8"),
]);

assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /pathname\.startsWith\("\/admin\/"\)/);
assert.match(worker, /\/local-ai\/offline/);
assert.match(worker, /\/eduai-local\/wllama\.wasm/);
assert.match(page, /EduAILocalRuntimePanel standalone/);
assert.match(panel, /useState\(!standalone\)/);
assert.match(panel, /useKnowledge: false/);
assert.match(runtime, /options\.useKnowledge === false/);
assert.match(config, /source: "\/local-ai\/:path\*"/);

console.log("EDUAI offline shell: OK");
