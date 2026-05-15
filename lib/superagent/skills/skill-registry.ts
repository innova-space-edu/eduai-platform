export type SkillVisibility = "all" | "teacher" | "admin";

export type EduAISkill = {
  id: string;
  name: string;
  icon: string;
  description: string;
  visibility: SkillVisibility;
  promptTemplate: string;
  routes: string[];
  tools: string[];
  recommendedFor: string[];
};

export const EDUAI_SKILLS: EduAISkill[] = [
  {
    id: "exam-pie-builder",
    name: "Crear examen PIE/NEE",
    icon: "♿",
    description:
      "Genera una evaluación con preguntas claras, adecuaciones de lectura, rúbrica y narración disponible.",
    visibility: "teacher",
    promptTemplate:
      "Crea un examen adaptado para PIE/NEE sobre {tema}, nivel {curso}, con {cantidad} preguntas y justificación pedagógica.",
    routes: ["/examen/crear", "/examen/docente"],
    tools: ["generate_exam_questions", "adapt_for_pie", "narrate_text"],
    recommendedFor: ["Docentes", "PIE", "Evaluación"],
  },
  {
    id: "study-music-session",
    name: "Sesión de estudio con música",
    icon: "♫",
    description:
      "Crea una playlist focus según la actividad, duración y estado emocional del estudiante.",
    visibility: "all",
    promptTemplate:
      "Recomienda música focus para estudiar {tema} durante {minutos} minutos y prepara una rutina breve.",
    routes: ["/music", "/exam-focus"],
    tools: ["recommend_focus_music"],
    recommendedFor: ["Estudiantes", "Concentración", "Rutinas"],
  },
  {
    id: "teacher-workflow",
    name: "Workflow docente completo",
    icon: "🧑‍🏫",
    description:
      "Planifica clase, crea material, genera rúbrica y prepara evaluación desde una sola instrucción.",
    visibility: "teacher",
    promptTemplate:
      "Organiza un workflow docente para {asignatura}: planificación, actividad, rúbrica, evaluación y recursos visuales.",
    routes: ["/superagent/chat", "/chat-global", "/educador", "/creator-hub"],
    tools: ["plan_curriculum", "generate_rubric", "generate_exam_questions", "generate_image_prompt"],
    recommendedFor: ["Docentes", "Planificación", "Materiales"],
  },
  {
    id: "research-diagram",
    name: "Diagrama académico",
    icon: "📊",
    description:
      "Convierte una explicación o paper en un diagrama educativo estilo Canva/paper.",
    visibility: "all",
    promptTemplate:
      "Transforma este contenido en un diagrama académico claro con secciones, flechas y explicación breve: {contenido}",
    routes: ["/creator-hub", "/image-studio", "/paper"],
    tools: ["summarize_text", "generate_image_prompt", "generate_image"],
    recommendedFor: ["Ciencias", "Papers", "Presentaciones"],
  },
  {
    id: "admin-model-lab",
    name: "Admin Model Lab",
    icon: "🛡️",
    description:
      "Zona aislada para evaluar modelos experimentales solo con rol administrador, auditoría y filtros.",
    visibility: "admin",
    promptTemplate:
      "Evalúa este modelo experimental en modo laboratorio, con riesgos, límites y recomendación de uso: {modelo}",
    routes: ["/admin/model-lab"],
    tools: ["explain_concept"],
    recommendedFor: ["Administración", "Modelos", "Seguridad"],
  },
];

export function getVisibleSkills(role: "student" | "teacher" | "admin" = "student") {
  return EDUAI_SKILLS.filter((skill) => {
    if (skill.visibility === "all") return true;
    if (skill.visibility === "teacher") return role === "teacher" || role === "admin";
    return role === "admin";
  });
}

export function findSkillById(id: string) {
  return EDUAI_SKILLS.find((skill) => skill.id === id);
}
