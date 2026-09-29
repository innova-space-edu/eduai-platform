export type VisualOptimizationLevel = "light" | "recommended" | "advanced";

export type VisualOptimizationProfile = {
  level: VisualOptimizationLevel;
  format: string;
  primarySkill: string;
  selectedSkills: string[];
  textCritical: boolean;
  structure: string[];
  priorities: string[];
  avoid: string[];
  appliedChanges: string[];
};

const INFOGRAPHIC = new Set(["infographic","educational-image","science-illustration","data-visualization"]);
const POSTER = new Set(["poster-design","graphic-design","social-media-design","cover-design"]);
const PORTRAIT = new Set(["portrait","selfie","photorealism","editorial-photo","group-photo"]);
const LOGO = new Set(["logo-design","branding","icon-design","vector-illustration"]);
const TECHNICAL = new Set(["math-diagram","physics-diagram","chemistry-diagram","biology-diagram","flowchart-diagram","timeline-design","technical-drawing","technical-floorplan"]);
const PRODUCT = new Set(["product-photo","packaging-design","mockup-design"]);
const LANDSCAPE = new Set(["landscape","architecture-render","interior-design"]);

function includesAny(skills: string[], group: Set<string>) {
  return skills.some((skill) => group.has(skill));
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeOptimizationLevel(value: unknown): VisualOptimizationLevel {
  return value === "light" || value === "advanced" ? value : "recommended";
}

export function buildVisualOptimizationProfile(input: {
  primarySkill?: string;
  selectedSkills?: string[];
  textCritical?: boolean;
  format?: string;
  level?: VisualOptimizationLevel;
}): VisualOptimizationProfile {
  const selectedSkills = dedupe([input.primarySkill || "", ...(input.selectedSkills || [])]).slice(0, 6);
  const level = normalizeOptimizationLevel(input.level);
  const format = input.format || "1:1";
  const textCritical = input.textCritical === true;

  const structure = [
    `Composición adaptada al formato ${format}, con un punto focal claro y lectura visual inmediata.`,
  ];
  const priorities = [
    "Mantener fielmente el tema, propósito y restricciones explícitas del usuario.",
    "Usar jerarquía visual clara y evitar elementos decorativos que compitan con la idea principal.",
  ];
  const avoid = [
    "saturación visual",
    "elementos sin función",
    "contradicciones entre texto e imagen",
  ];
  const appliedChanges = [
    "Objetivo visual clarificado",
    "Composición y jerarquía definidas",
  ];

  if (includesAny(selectedSkills, INFOGRAPHIC)) {
    structure.push(
      "Organizar la información en bloques visuales claramente diferenciados alrededor de una ilustración principal.",
      "Mantener suficiente espacio negativo y una ruta de lectura simple de izquierda a derecha o de arriba abajo."
    );
    priorities.push(
      "Priorizar ilustraciones, iconos y relaciones espaciales sobre párrafos.",
      "Si el contenido es educativo, representar solo información coherente con el tema y nivel indicado."
    );
    avoid.push("párrafos largos dentro de la imagen", "microtexto", "pseudo-texto", "etiquetas redundantes");
    appliedChanges.push("Arquitectura de infografía añadida", "Densidad de texto reducida");
  }

  if (includesAny(selectedSkills, POSTER)) {
    structure.push("Separar claramente titular, imagen protagonista y zona secundaria de información.");
    priorities.push("Reservar aire alrededor del titular y mantener contraste suficiente entre texto y fondo.");
    avoid.push("varios focos visuales compitiendo", "texto incrustado sobre fondos complejos");
    appliedChanges.push("Jerarquía de afiche definida");
  }

  if (includesAny(selectedSkills, PORTRAIT)) {
    structure.push("Definir encuadre, distancia de cámara y relación sujeto-fondo de forma coherente.");
    priorities.push("Mantener anatomía natural, iluminación plausible, expresión creíble y textura de piel no plástica.");
    avoid.push("rasgos faciales inconsistentes", "manos deformadas", "piel excesivamente suavizada");
    appliedChanges.push("Dirección fotográfica añadida");
  }

  if (includesAny(selectedSkills, LOGO)) {
    structure.push("Construir una marca con silueta reconocible, proporciones simples y lectura clara a tamaño pequeño.");
    priorities.push("Mantener el concepto visual simple, memorable y escalable.");
    avoid.push("detalles microscópicos", "efectos 3D innecesarios", "ornamentos que dificulten la lectura");
    appliedChanges.push("Criterios de identidad visual añadidos");
  }

  if (includesAny(selectedSkills, TECHNICAL)) {
    structure.push("Organizar elementos y etiquetas para que las relaciones técnicas se entiendan de inmediato.");
    priorities.push("Preservar números, fórmulas, relaciones, nombres y geometría mencionados por el usuario sin alterarlos.");
    avoid.push("valores inventados", "etiquetas ambiguas", "relaciones visuales incorrectas");
    appliedChanges.push("Restricciones técnicas reforzadas");
  }

  if (includesAny(selectedSkills, PRODUCT)) {
    structure.push("Mantener el producto como foco principal con perspectiva, escala y materialidad coherentes.");
    priorities.push("Preservar forma, etiqueta, proporciones y características visibles del producto.");
    avoid.push("deformación del producto", "reflejos físicamente incoherentes", "fondos que compitan con el objeto");
    appliedChanges.push("Dirección de producto añadida");
  }

  if (includesAny(selectedSkills, LANDSCAPE)) {
    structure.push("Definir profundidad mediante primer plano, plano medio y fondo cuando sea apropiado.");
    priorities.push("Mantener perspectiva, iluminación y atmósfera coherentes.");
    avoid.push("horizontes deformados", "escala incoherente", "iluminación contradictoria");
    appliedChanges.push("Profundidad y atmósfera definidas");
  }

  if (textCritical) {
    priorities.push(
      "Todo texto visible debe estar en español de Chile, correctamente escrito y relacionado con el tema.",
      "Usar un título corto y como máximo seis etiquetas breves de 1 a 4 palabras, salvo que el usuario pida explícitamente más.",
      "Si una palabra no puede representarse con claridad, omitirla antes que inventarla o aproximarla."
    );
    avoid.push("lorem ipsum", "palabras inventadas", "mezcla de idiomas", "letras aleatorias", "texto diminuto ilegible");
    appliedChanges.push("Política estricta de texto visible aplicada");
  }

  if (level === "light") {
    return {
      level,
      format,
      primarySkill: input.primarySkill || "visual-design",
      selectedSkills,
      textCritical,
      structure: structure.slice(0, 2),
      priorities: priorities.slice(0, 3),
      avoid: avoid.slice(0, 4),
      appliedChanges: ["Redacción aclarada", ...appliedChanges.slice(0, 2)],
    };
  }

  if (level === "advanced") {
    priorities.push(
      "Definir paleta, contraste, iluminación y acabado solo cuando sean relevantes al tipo de pieza.",
      "Eliminar instrucciones redundantes o contradictorias antes de la generación."
    );
    appliedChanges.push("Brief de producción avanzado aplicado");
  }

  return {
    level,
    format,
    primarySkill: input.primarySkill || "visual-design",
    selectedSkills,
    textCritical,
    structure: dedupe(structure),
    priorities: dedupe(priorities),
    avoid: dedupe(avoid),
    appliedChanges: dedupe(appliedChanges),
  };
}

function normalizedWords(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function improvementScore(original: string, candidate: string) {
  const a = new Set(normalizedWords(original));
  const b = normalizedWords(candidate);
  const newWords = b.filter((word) => !a.has(word)).length;
  const expansion = original.trim().length ? candidate.trim().length / original.trim().length : 1;
  return {
    expansion,
    newWords,
    improved: expansion >= 1.3 || newWords >= 12,
  };
}

export function ensureProductionPrompt(original: string, candidate: string, profile: VisualOptimizationProfile) {
  if (profile.level === "light") return candidate.trim() || original.trim();
  const score = improvementScore(original, candidate);
  if (score.improved) return candidate.trim();

  const structure = profile.structure.slice(0, profile.level === "advanced" ? 5 : 3).join(" ");
  const priorities = profile.priorities.slice(0, profile.level === "advanced" ? 7 : 5).join(" ");
  const avoid = profile.avoid.slice(0, profile.level === "advanced" ? 8 : 6).join(", ");

  return [
    candidate.trim() || original.trim(),
    `Composición: ${structure}`,
    `Prioridades: ${priorities}`,
    avoid ? `Evitar: ${avoid}.` : "",
  ].filter(Boolean).join(" ");
}
