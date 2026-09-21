import assert from "node:assert/strict";
import {
  EDUAI_LOCAL_MODELS,
  evaluateEduAILocalModel,
  recommendEduAILocalModel,
  type EduAIHardwareProfile,
} from "../lib/ai/local/eduai-local-models";

const cases: Array<{ name: string; profile: EduAIHardwareProfile; expected: string }> = [
  {
    name: "4 GB CPU",
    profile: { memoryGB: 4, vramGB: 0, webgpu: false, cores: 4 },
    expected: "eduai-local-lfm-350m",
  },
  {
    name: "8 GB CPU",
    profile: { memoryGB: 8, vramGB: 0, webgpu: false, cores: 8 },
    expected: "eduai-local-qwen35-08b",
  },
  {
    name: "8 GB + 2 GB VRAM",
    profile: { memoryGB: 8, vramGB: 2, webgpu: true, cores: 8 },
    expected: "eduai-local-lfm12-qad",
  },
  {
    name: "8 GB + 4 GB VRAM",
    profile: { memoryGB: 8, vramGB: 4, webgpu: true, cores: 8 },
    expected: "eduai-local-lfm26-qad",
  },
  {
    name: "16 GB + 6 GB VRAM",
    profile: { memoryGB: 16, vramGB: 6, webgpu: true, cores: 12 },
    expected: "eduai-local-lfm26-q5",
  },
];

for (const item of cases) {
  assert.equal(recommendEduAILocalModel(item.profile), item.expected, item.name);
}

for (const model of EDUAI_LOCAL_MODELS) {
  assert.ok(model.sizeMB < 2000, `${model.id} supera el límite práctico de archivo único de wllama`);
  assert.ok(model.minimumMemoryGB <= model.recommendedMemoryGB, `${model.id}: RAM mínima inválida`);
  const fit = evaluateEduAILocalModel(model, {
    memoryGB: model.recommendedMemoryGB,
    vramGB: model.recommendedVramGB,
    webgpu: model.webgpuPreferred || model.recommendedVramGB > 0,
    cores: 8,
  });
  assert.notEqual(fit, "avoid", `${model.id}: su propio perfil recomendado no debe ser avoid`);
}

console.log(`EDUAI local model matrix: OK (${EDUAI_LOCAL_MODELS.length} modelos, ${cases.length} perfiles)`);
