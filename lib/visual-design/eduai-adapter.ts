import { visual, type VisualPlan } from "@innova-space/visual-design";

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
  if (skills.includes("infographic")) return "infographic";
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
  generationPrompt?: string;
}) {
  const routePrompt = prompt.trim();
  const generationPrompt = input?.generationPrompt?.trim() || routePrompt;
  const basePlan = visual.plan(routePrompt, {
    context: {
      product: "eduai",
      module: "image-studio-pro",
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
  const plan: VisualPlan = {
    ...basePlan,
    prompt: generationPrompt,
    visual_brief: {
      ...basePlan.visual_brief,
      purpose: generationPrompt,
      source_request: generationPrompt,
      context: {
        ...(basePlan.visual_brief.context as Record<string, unknown> | undefined),
        routing_source: routePrompt,
      },
    },
  };
  return {
    plan,
    style: visualStyleForPlan(plan),
    mode: visualModeForPlan(plan),
  };
}

const TEXT_CRITICAL_SKILLS = new Set([
  "infographic",
  "poster-design",
  "typography-design",
  "logo-design",
  "worksheet-design",
  "textbook-page",
  "flowchart-diagram",
  "timeline-design",
  "educational-image",
]);

function visualTextBlocks(plan: VisualPlan): Array<{ text?: unknown; exact?: unknown }> {
  return Array.isArray(plan.visual_brief.text_blocks)
    ? (plan.visual_brief.text_blocks as Array<{ text?: unknown; exact?: unknown }>)
    : [];
}

export function requiresAccurateVisualText(plan: VisualPlan): boolean {
  if (visualTextBlocks(plan).some((block) => block?.exact === true && block?.text)) return true;
  return hasAny(plan, TEXT_CRITICAL_SKILLS);
}

function visibleTextRules(plan: VisualPlan): string {
  if (!requiresAccurateVisualText(plan)) return "";
  const exact = visualTextBlocks(plan)
    .filter((block) => block?.exact === true && block?.text)
    .map((block) => String(block.text).trim())
    .filter((text): text is string => Boolean(text));

  const exactRule = exact.length
    ? [
        `EXACT VISIBLE TEXT — reproduce exactly and do not translate: ${exact.map((text) => `"${text}"`).join(", ")}.`,
        `These are the ONLY words or phrases allowed to appear visibly in the image. Do not add planet names, captions, legends, paragraphs, filler copy or any other visible text unless it is in this exact list.`,
      ].join(" ")
    : "";

  return [
    "VISIBLE TEXT POLICY:",
    "All visible words must be coherent Spanish (es-CL), correctly spelled and semantically related to the subject.",
    "Use very little text: one short title and at most six short labels of 1–4 words each unless the user explicitly requested more.",
    "Never render paragraphs, filler copy, lorem ipsum, pseudo-text, random letters, invented words, mixed languages or unreadable microtext.",
    "If a word cannot be rendered clearly, omit it instead of inventing or approximating it.",
    "Prefer strong visual hierarchy, icons and illustration over dense written content.",
    exactRule,
  ].filter(Boolean).join(" ");
}

export function compileForEduAI(plan: VisualPlan, provider: EduAIVisualProvider) {
  const compilerBackend =
    provider === "pollinations" || provider === "together"
      ? "flux"
      : "openai";
  const request = visual.compile(plan.visual_brief, compilerBackend) as {
    prompt?: string;
  };
  const compiled = String(request.prompt || plan.prompt || plan.visual_brief.purpose).trim();
  const languageRule = "OUTPUT LANGUAGE: Spanish (es-CL). Keep the requested subject, educational level and intent coherent.";
  const textRule = visibleTextRules(plan);
  return [compiled, languageRule, textRule].filter(Boolean).join("\n\n");
}

