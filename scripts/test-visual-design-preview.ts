import assert from "node:assert/strict";
import {
  compileForEduAI,
  planEduAIVisual,
  requiresAccurateVisualText,
  visualModeForPlan,
  visualStyleForPlan,
} from "../lib/visual-design/eduai-adapter";

const math = planEduAIVisual("Imagen educativa de homotecia de un triángulo con k=-2 para estudiantes", { width: 1024, height: 576 });
assert.ok(math.plan.routing.selected_skills.includes("math-diagram"));
assert.equal(math.plan.visual_brief.render_strategy, "deterministic");
assert.equal(visualStyleForPlan(math.plan), "educational");
assert.equal(visualModeForPlan(math.plan), "educational");

const selfie = planEduAIVisual("Selfie nocturna realista manteniendo el mismo rostro de la referencia");
assert.ok(selfie.plan.routing.selected_skills.includes("selfie"));
assert.ok(selfie.plan.routing.selected_skills.includes("face-identity"));
assert.equal(visualStyleForPlan(selfie.plan), "realistic");

const poster = planEduAIVisual('Afiche vertical con el texto exacto "FERIA CIENTÍFICA 2026"');
const compiled = compileForEduAI(poster.plan, "auto");
assert.ok(compiled.includes("FERIA CIENTÍFICA 2026"));
assert.ok(compiled.includes("Spanish (es-CL)"));
assert.ok(compiled.includes("pseudo-text"));
assert.ok(compiled.includes("SPECIALIST GUIDANCE"));
assert.equal(requiresAccurateVisualText(poster.plan), true);

const fluxCompiled = compileForEduAI(poster.plan, "together");
assert.ok(fluxCompiled.length > 20);

console.log("Visual Design Preview adapter OK");

import {
  buildVisualOptimizationProfile,
  ensureProductionPrompt,
  improvementScore,
  extractOptimizedPromptText,
  buildLocalOptimizationBrief,
} from "../lib/visual-design/prompt-optimizer";

const infographicProfile = buildVisualOptimizationProfile({
  primarySkill: "infographic",
  selectedSkills: ["infographic", "educational-image"],
  textCritical: true,
  format: "16:9",
  level: "recommended",
});
assert.ok(infographicProfile.structure.some((item) => item.toLowerCase().includes("bloques visuales")));
assert.ok(infographicProfile.avoid.includes("pseudo-texto"));
assert.ok(infographicProfile.appliedChanges.includes("Política estricta de texto visible aplicada"));

const weak = "Infografía educativa del sistema solar";
const enriched = ensureProductionPrompt(weak, weak, infographicProfile);
assert.ok(enriched.length > weak.length * 2);
assert.equal(improvementScore(weak, enriched).improved, true);

// Provider routing regression notes:
// - Gemini image requests must use v1beta/interactions, not generateContent responseFormat.
// - text-critical Auto keeps all fallbacks, preferring Gemini then Pollinations.

const plainOptimized = "Crear una infografía horizontal clara del Sistema Solar con jerarquía visual y poco texto.";
assert.equal(extractOptimizedPromptText(plainOptimized), plainOptimized);

const jsonOptimized = JSON.stringify({ optimizedPrompt: plainOptimized, changes: ["x"] });
assert.equal(extractOptimizedPromptText(jsonOptimized), plainOptimized);

const doubleEncoded = JSON.stringify(jsonOptimized);
assert.equal(extractOptimizedPromptText(doubleEncoded), plainOptimized);

assert.equal(
  extractOptimizedPromptText('{"optimizedPrompt":"texto roto",'),
  "texto roto"
);

const localBrief = buildLocalOptimizationBrief(weak, enriched, infographicProfile);
assert.ok(localBrief.composition.includes("16:9"));
assert.ok(localBrief.avoid.includes("pseudo-texto"));

const routedFromOriginal = planEduAIVisual(
  "Infografía educativa del sistema solar para 1° medio",
  { generationPrompt: "Crear una infografía horizontal limpia del Sistema Solar, con jerarquía clara y poco texto." }
);
assert.ok(routedFromOriginal.plan.routing.selected_skills.includes("infographic"));
assert.equal(routedFromOriginal.plan.visual_brief.purpose.includes("horizontal limpia"), true);
const routingContext = (routedFromOriginal.plan.visual_brief.context || {}) as Record<string, unknown>;
assert.equal(String(routingContext.routing_source).includes("Infografía educativa"), true);
