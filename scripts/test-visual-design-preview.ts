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
