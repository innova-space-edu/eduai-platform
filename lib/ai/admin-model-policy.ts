export type ExperimentalModelPolicy = {
  id: string;
  label: string;
  access: "admin_only";
  enabledByDefault: boolean;
  allowedContexts: string[];
  blockedContexts: string[];
  requiredControls: string[];
  notes: string;
};

export const ADMIN_ONLY_EXPERIMENTAL_MODELS: ExperimentalModelPolicy[] = [
  {
    id: "uncensored-lab-placeholder",
    label: "Modelo experimental sin censura — solo laboratorio admin",
    access: "admin_only",
    enabledByDefault: false,
    allowedContexts: [
      "evaluación técnica interna",
      "comparación de rendimiento",
      "pruebas de robustez",
      "red teaming institucional",
    ],
    blockedContexts: [
      "estudiantes",
      "exámenes públicos",
      "chat general",
      "modo tutor",
      "contenido escolar sin revisión docente",
    ],
    requiredControls: [
      "rol admin o super_admin",
      "auditoría obligatoria",
      "prompt y respuesta registrados",
      "filtro de seguridad antes y después",
      "sin exposición de API key al frontend",
      "apagado por defecto en producción",
    ],
    notes:
      "Esta política deja preparado EduAI para probar modelos experimentales sin exponerlos a estudiantes ni usuarios generales.",
  },
];

export function canUseExperimentalModel(role?: string | null) {
  return role === "admin" || role === "super_admin";
}
