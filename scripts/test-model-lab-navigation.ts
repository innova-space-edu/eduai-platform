import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MODEL_LAB_SECTIONS, MODEL_LAB_GROUPS, resolveModelLabSection,
  modelLabSectionHash,
} from "../lib/admin/model-lab-sections";

const ids = MODEL_LAB_SECTIONS.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length, "No duplicate sidebar section ids");
assert.ok(ids.length >= 12, "All existing Model Lab modules remain accessible");
const groups = new Set(MODEL_LAB_GROUPS.map((item) => item.id));
assert.ok(MODEL_LAB_SECTIONS.every((item) => groups.has(item.group)));
assert.equal(resolveModelLabSection(null), "resumen");
assert.equal(resolveModelLabSection("#brain-ai"), "brain-ai");
assert.equal(resolveModelLabSection("infraestructura"), "infraestructura");
assert.equal(resolveModelLabSection("#observabilidad"), "observabilidad");
assert.equal(resolveModelLabSection("#experimental"), "experimental");
assert.equal(resolveModelLabSection("#local-runtime"), "local-runtime");
assert.equal(resolveModelLabSection("#benchmark"), "benchmark");
assert.equal(resolveModelLabSection("#adaptador"), "efficiency");
assert.equal(resolveModelLabSection("#almacenamiento"), "artifacts");
assert.equal(resolveModelLabSection("#not-a-real-section"), "resumen");
assert.equal(modelLabSectionHash("efficiency"), "#efficiency");
for (const section of MODEL_LAB_SECTIONS) {
  assert.equal(resolveModelLabSection(modelLabSectionHash(section.id)), section.id);
}
const workspace = readFileSync("components/admin/ModelLabWorkspace.tsx", "utf-8");
const page = readFileSync("app/admin/model-lab/page.tsx", "utf-8");
const expectedModules = [
  "AICoreHealthPanel", "AICoreMetricsPanel", "AIModelRegistryPanel",
  "BrainAILabPanel", "BrainAIV6LearningPanel", "VoiceLabPanel",
  "LiteRTLocalAIPanel", "LiteRTCacheAnalyticsPanel", "LiteRTRouterStatusPanel",
  "LiteRTQuantizationPanelV3", "LiteRTBenchmarkPanelV4",
  "WhisperTinyLocalPanel", "LocalAITelemetryPanel", "LocalAIModelMetricsPanel",
  "LocalLLMReadinessPanel", "EduAILocalRuntimePanel", "EduAILocalBridgePanel",
  "EduAIEfficiencyAdapterPanel", "EduAIModelFactoryPanel",
  "ModelCandidateLabPanel", "VideoProviderStatusPanel",
];
for (const moduleName of expectedModules) {
  assert.ok(workspace.includes('dynamic(() => import("@/components/admin/' + moduleName + '")'),
    "Missing lazy module: " + moduleName);
  assert.ok(!page.includes("<" + moduleName), "Eager old page render: " + moduleName);
}
assert.ok(workspace.includes('window.addEventListener("popstate"'), "Browser back handling missing");
assert.ok(workspace.includes('window.addEventListener("hashchange"'), "Deep link handling missing");
assert.ok(workspace.includes('aria-current={chosen ? "page"'), "Accessible active menu missing");
assert.ok(workspace.includes('aria-label="Abrir secciones"'), "Mobile navigation control missing");
assert.ok(workspace.includes('aria-label="Navegación Model Lab"'), "Mobile menu dialog missing");
assert.ok(workspace.includes('overflow-y-auto'), "Local scroll container missing");
assert.ok(page.includes("<ModelLabWorkspace />"));
assert.ok(page.includes("<LiteRTPrewarm />"));
console.log("Model Lab sidebar: " + ids.length + " sections, " + expectedModules.length + " lazy panels, deep-links and responsive navigation OK");
