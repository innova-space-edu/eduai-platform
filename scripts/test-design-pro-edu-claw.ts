import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESIGN_REFERENCES, resolveDesignReference, buildVisualSkillPrompt } from "../lib/visual-design/design-references";

const source = "Haz a Mario Bros saltando en la selva, estilo videojuego de Minecraft";
const detected = resolveDesignReference("auto", source);
assert.equal(detected.id, "voxel-game");
assert.equal(resolveDesignReference("pixel-art", source).id, "pixel-art");
assert.equal(resolveDesignReference("auto", "Infografía de química").id, "infographic");
assert.equal(resolveDesignReference("auto", "Acuarela de una flor").id, "watercolor");
assert.equal(new Set(DESIGN_REFERENCES.map((x) => x.id)).size, DESIGN_REFERENCES.length);
const built = buildVisualSkillPrompt({
  originalPrompt: source, format: "16:9", selectedSkills: ["3d-render"],
  primarySkill: "visual-design", textCritical: false, level: "recommended",
});
assert.ok(built.enhanced.includes("Mario Bros"));
assert.ok(built.enhanced.includes("Minecraft"));
assert.ok(/voxel|bloques/i.test(built.enhanced));
assert.equal(built.reference.engineStyle, "3d render");
assert.ok(built.enhanced.length > source.length);
const technical = buildVisualSkillPrompt({
  originalPrompt: "Diagrama de homotecia con k=-2", format: "A4",
  selectedSkills: ["math-diagram"], primarySkill: "math-diagram",
  textCritical: true, level: "recommended",
});
assert.ok(technical.enhanced.includes("k=-2"));
assert.ok(technical.enhanced.includes("A4"));

const pro = readFileSync("app/image-studio/pro/page.tsx", "utf8");
const gen = readFileSync("app/api/agents/imagenes/route.ts", "utf8");
const api = readFileSync("app/api/admin/edu-claw/overview/route.ts", "utf8");
const root = readFileSync("app/layout.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261016153000_eduai_admin_claw_incidents.sql", "utf8");
const helper = readFileSync("lib/admin/edu-claw-incidents.ts","utf8");
const bell = readFileSync("components/admin/AdminIncidentBell.tsx", "utf8");

assert.ok(pro.includes("setAutoOptimize(true)"));
assert.ok(pro.includes("buildVisualSkillPrompt("));
assert.ok(pro.includes('"/api/image-studio/pro/optimize"'));
assert.ok(pro.includes("allowProviderFallback: allowFallback"));
assert.ok(gen.includes('source === "image-studio-pro"') || gen.includes('body?.source === "image-studio-pro"'));
assert.ok(gen.includes("recordImageProviderFailures(attempts)"));
assert.ok(gen.includes("providerOrder(\"auto\", mode).filter"));
assert.ok(api.includes("requireIncidentAdmin()"));
assert.ok(api.includes('status === "resolved"'));
assert.ok(root.includes("<AdminIncidentBell />"));
assert.ok(bell.includes('120_000'));
assert.ok(bell.includes('aria-label="Centro de notificaciones Edu Claw"'));
assert.ok(helper.includes('p_metadata: {}'));
assert.ok(helper.includes('first_seen_at'));
assert.ok(migration.includes("on conflict(fingerprint) do update"));
assert.ok(migration.includes("revoke all on public.eduai_admin_incidents from anon, authenticated"));
assert.ok(migration.includes("to service_role"));
assert.ok(migration.includes("on conflict(task_key) do nothing"));
console.log("EDUAI Diseño Pro + Edu Claw: 23+ regression checks passed");
