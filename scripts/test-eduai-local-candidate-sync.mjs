import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, factory, lab] = await Promise.all([
  readFile("app/api/admin/ai-core/model-candidates/route.ts", "utf8"),
  readFile("components/admin/EduAIModelFactoryPanel.tsx", "utf8"),
  readFile("components/admin/ModelCandidateLabPanel.tsx", "utf8"),
]);

assert.match(route, /action === "add_local_candidate"/);
assert.match(route, /promotionGatePassed/);
assert.match(route, /criticalFailures\.length > 0/);
assert.match(route, /provider: "eduai-local"/);
assert.match(route, /status: "discovered"/);
assert.match(route, /action: "add_local_model_candidate"/);

assert.match(factory, /action: "add_local_candidate"/);
assert.match(factory, /promotionGatePassed: candidate\.promotionGatePassed/);
assert.match(factory, /criticalFailures: candidate\.criticalFailures/);
assert.match(factory, /eduai-model-candidates-changed/);

assert.match(lab, /candidate\.provider !== "eduai-local"/);
assert.match(lab, /Pasar a testing/);
assert.match(lab, /Local Gate/);

console.log("EDUAI local candidate sync: OK");
