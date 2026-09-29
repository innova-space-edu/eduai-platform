import { visual, type VisualPlan } from "@innova-space/visual-design";
import { renderSvgPreview } from "@innova-space/visual-design/providers";

export const EDUAI_VISUAL_PROVIDER_OPTIONS = [
  { id: "auto", label: "Auto · modelos EDUAI" },
  { id: "gemini", label: "Gemini Imagen" },
  { id: "pollinations", label: "Pollinations FLUX" },
  { id: "together", label: "Together FLUX" },
  { id: "huggingface", label: "Hugging Face" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

export type EduAIVisualProvider = typeof EDUAI_VISUAL_PROVIDER_OPTIONS[number]["id"];
export type EduAIVisualMode = "fast" | "quality" | "educational";

const EDUCATIONAL_SKILLS = new Set([
  "educational-image",
  "math-diagram",
  "physics-diagram",
  "chemistry-diagram",
  "biology-diagram",
  "science-illustration",
  "worksheet-design",
  "textbook-page",
  "infographic",
  "data-visualization",
]);

const FLAT_SKILLS = new Set([
  "graphic-design",
  "poster-design",
  "logo-design",
  "icon-design",
  "vector-illustration",
  "branding",
  "flowchart-diagram",
  "timeline-design",
]);

function hasAny(plan: VisualPlan, values: Set<string>) {
  return plan.routing.selected_skills.some((skill) => values.has(skill));
}

export function visualStyleForPlan(plan: VisualPlan): string {
  const skills = plan.routing.selected_skills;
  if (hasAny(plan, EDUCATIONAL_SKILLS)) return "educational";
  if (skills.includes("anime-general")) return "anime";
  if (skills.includes("3d-render") || skills.includes("isometric-illustration")) return "3d render";
  if (skills.includes("cartoon") || skills.includes("childrens-illustration") || skills.includes("comic")) return "digital art";
  if (hasAny(plan, FLAT_SKILLS)) return "flat design";
  if (skills.includes("landscape") || skills.includes("editorial-photo")) return "cinematic";
  if (skills.includes("portrait") || skills.includes("selfie") || skills.includes("photorealism") || skills.includes("product-photo")) return "realistic";
  return "realistic";
}

export function visualModeForPlan(plan: VisualPlan): EduAIVisualMode {
  if (hasAny(plan, EDUCATIONAL_SKILLS) || plan.routing.signals.educational) return "educational";
  if (plan.routing.selected_skills.some((skill) => ["portrait","product-photo","architecture-render","editorial-photo"].includes(skill))) {
    return "quality";
  }
  return "fast";
}

export function planEduAIVisual(prompt: string, input?: {
  audience?: string | null;
  context?: Record<string, unknown>;
  width?: number;
  height?: number;
}) {
  const plan = visual.plan(prompt, {
    context: {
      product: "eduai",
      module: "visual-design-preview",
      ...(input?.context || {}),
    },
    brief: {
      audience: input?.audience || null,
      output: {
        format: "png",
        width: input?.width || 1024,
        height: input?.height || 1024,
        editable: true,
      },
    },
  });
  return {
    plan,
    style: visualStyleForPlan(plan),
    mode: visualModeForPlan(plan),
  };
}

export function compileForEduAI(plan: VisualPlan, provider: EduAIVisualProvider) {
  const compilerBackend =
    provider === "pollinations" || provider === "together"
      ? "flux"
      : "openai";
  const request = visual.compile(plan.visual_brief, compilerBackend) as {
    prompt?: string;
  };
  return String(request.prompt || plan.prompt || plan.visual_brief.purpose).trim();
}

export function deterministicPreview(plan: VisualPlan) {
  if (plan.visual_brief.render_strategy === "generative") return null;
  return renderSvgPreview(plan.visual_brief);
}
