import {
  buildVisualOptimizationProfile,
  ensureProductionPrompt,
  type VisualOptimizationLevel,
} from "./prompt-optimizer";

export const DESIGN_REFERENCES = [
  { id: "auto", label: "Detección automática", type: "auto", engineStyle: "", cue: "", composition: "" },
  { id: "voxel-game", label: "Videojuego voxel", type: "game", engineStyle: "3d render", cue: "Estética videojuego voxel de bloques cúbicos, texturas pixeladas y materiales low-poly, geometría modular y colores vivos.", composition: "Acción clara en primer plano; escenario tridimensional profundo, plataformas y atmósfera de aventura." },
  { id: "pixel-art", label: "Pixel art retro", type: "game", engineStyle: "digital art", cue: "Pixel art 16 bits, sprites consistentes, píxeles nítidos, paleta controlada y estética de videojuego retro.", composition: "Silueta y movimiento legibles; perspectiva de videojuego coherente." },
  { id: "comic", label: "Cómic y cartoon", type: "illustration", engineStyle: "digital art", cue: "Ilustración cartoon, líneas limpias, expresiones dinámicas, sombreado controlado.", composition: "Sujeto protagonista, acción congelada y jerarquía clara de personajes." },
  { id: "science-poster", label: "Póster científico", type: "educational", engineStyle: "educational", cue: "Lámina científica didáctica, jerarquía visual, esquema preciso y pocos rótulos.", composition: "Dividir por conceptos y reservar espacio para título y etiquetas verificables." },
  { id: "infographic", label: "Infografía educativa", type: "educational", engineStyle: "infographic", cue: "Infografía clara con ilustraciones, bloques informativos espaciados y contraste legible.", composition: "Secciones con orden de lectura lógico, mínima densidad textual." },
  { id: "worksheet", label: "Guía de ejercicios", type: "educational", engineStyle: "educational", cue: "Hoja de ejercicios con diagramas exactos, tipografía grande, divisiones ordenadas.", composition: "Cuadrícula equilibrada, espacio para resolver y números consistentes." },
  { id: "watercolor", label: "Acuarela ilustrada", type: "illustration", engineStyle: "watercolor", cue: "Acuarela sobre papel texturizado, pigmentos suaves y bordes orgánicos.", composition: "Punto focal definido y ritmo visual ligero." },
  { id: "realism", label: "Realismo fotográfico", type: "photography", engineStyle: "realistic", cue: "Fotografía realista con texturas naturales, iluminación plausible y materiales coherentes.", composition: "Encuadre fotográfico definido, profundidad de campo intencional." },
  { id: "isometric", label: "3D isométrico", type: "illustration", engineStyle: "3d render", cue: "Maqueta 3D isométrica de materiales estilizados y geometría limpia.", composition: "Perspectiva isométrica estable, escala uniforme y objetos separados." },
  { id: "minimalist", label: "Minimalista", type: "graphic", engineStyle: "flat design", cue: "Diseño minimalista con formas precisas, pocos colores y espacio negativo generoso.", composition: "Un único foco principal y sin ornamentación superflua." },
  { id: "book-cover", label: "Portada editorial", type: "graphic", engineStyle: "digital art", cue: "Portada editorial profesional, jerarquía del título y arte principal coherente.", composition: "Zona segura para título y composición balanceada." },
  { id: "social-banner", label: "Banner y redes", type: "graphic", engineStyle: "flat design", cue: "Gráfico digital para redes, contrastes claros, legibilidad a escala móvil.", composition: "Centro de interés y área libre para texto breve." },
] as const;

export type DesignReferenceId = typeof DESIGN_REFERENCES[number]["id"];
export type DesignReference = typeof DESIGN_REFERENCES[number];
export function resolveDesignReference(raw: string, prompt: string): DesignReference {
  const explicit = DESIGN_REFERENCES.find((item) => item.id === raw && raw !== "auto");
  if (explicit) return explicit;
  const normalized = prompt.toLowerCase();
  if (/minecraft|voxel|bloques|block.?game|blocky/.test(normalized)) return DESIGN_REFERENCES[1];
  if (/pixel.?art|8.bit|16.bit|retro.?game/.test(normalized)) return DESIGN_REFERENCES[2];
  if (/infograf[ií]a|visualizaci[oó]n de datos/.test(normalized)) return DESIGN_REFERENCES[5];
  if (/afiche cient[ií]fico|p[oó]ster cient[ií]fico/.test(normalized)) return DESIGN_REFERENCES[4];
  if (/gu[ií]a de ejercicios|hoja de ejercicios/.test(normalized)) return DESIGN_REFERENCES[6];
  if (/acuarela/.test(normalized)) return DESIGN_REFERENCES[7];
  if (/c[oó]mic|cartoon|caricatura/.test(normalized)) return DESIGN_REFERENCES[3];
  if (/isom[eé]tric/.test(normalized)) return DESIGN_REFERENCES[9];
  if (/minimalis/.test(normalized)) return DESIGN_REFERENCES[10];
  return DESIGN_REFERENCES[0];
}

export function buildVisualSkillPrompt(input: {
  originalPrompt: string;
  format: string;
  referenceId?: string;
  selectedSkills: string[];
  primarySkill: string;
  textCritical: boolean;
  level: VisualOptimizationLevel;
}) {
  const prompt = input.originalPrompt.trim();
  const reference = resolveDesignReference(input.referenceId || "auto", prompt);
  const profile = buildVisualOptimizationProfile({
    level: input.level, format: input.format,
    selectedSkills: input.selectedSkills, primarySkill: input.primarySkill,
    textCritical: input.textCritical,
  });
  const additions = [
    "FORMATO: " + input.format + ". Ajusta encuadre y área segura al formato solicitado.",
    reference.cue ? "DIRECCIÓN ARTÍSTICA: " + reference.cue : "",
    reference.composition ? "COMPOSICIÓN: " + reference.composition : "",
    "Mantén la identidad, los personajes, la acción y el estilo especificados por el usuario; no sustituyas nombres propios ni añadas texto no solicitado.",
  ].filter(Boolean).join(" ");
  const enhanced = ensureProductionPrompt(prompt, [prompt, additions].filter(Boolean).join("\n"), profile).slice(0, 6200);
  return { enhanced, reference, profile };
}
