import { readFileSync, writeFileSync } from "node:fs";

const path = "app/examen/editar/[id]/page.tsx";
let s = readFileSync(path, "utf8");

s = s.replace(
  'type: "multiple_choice" | "true_false" | "development"',
  'type: "multiple_choice" | "true_false" | "development" | "mixed_choice_development"'
);

s = s.replace(
  '  if (type === "true_false")      return "V/F"\n  return "Desarrollo"',
  '  if (type === "true_false")      return "V/F"\n  if (type === "mixed_choice_development") return "Alternativa + desarrollo"\n  return "Desarrollo"'
);

s = s.replace(
  '  justificationMaxPoints?: number\n}',
  '  justificationMaxPoints?: number\n  developmentMaxPoints?: number\n  showRubricToStudent?: boolean\n}'
);

s = s.replaceAll(
  '{q.type === "development" && (',
  '{(q.type === "development" || q.type === "mixed_choice_development") && ('
);

s = s.replaceAll(
  '{q.type === "development" && q.rubric && q.rubric.length > 0 && (',
  '{(q.type === "development" || q.type === "mixed_choice_development") && q.rubric && q.rubric.length > 0 && ('
);

s = s.replace(
  '      if (normalizedQ.type === "development") {\n        normalizedQ.modelAnswer = rawQ.modelAnswer || ""',
  '      if (normalizedQ.type === "mixed_choice_development") {\n        normalizedQ.modelAnswer = rawQ.modelAnswer || rawQ.expectedAnswer || ""\n        normalizedQ.expectedLatex = rawQ.expectedLatex || rawQ.expected_latex || ""\n        normalizedQ.rubric = Array.isArray(rawQ.rubric) ? rawQ.rubric : []\n        normalizedQ.selectionPoints = rawQ.selectionPoints || 3\n        normalizedQ.developmentMaxPoints = rawQ.developmentMaxPoints || 2\n      }\n\n      if (normalizedQ.type === "development") {\n        normalizedQ.modelAnswer = rawQ.modelAnswer || ""'
);

writeFileSync(path, s);
