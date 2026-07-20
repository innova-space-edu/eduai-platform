// lib/superagent/tool-registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Registro de herramientas del SuperAgent EduAI Claw.
// Cada tool tiene: nombre, descripción, parámetros y función execute().
// El core usa este registro para decidir qué tool llamar según el mensaje.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos base ────────────────────────────────────────────────────────────────

export type ToolName =
  | "generate_exam_questions"
  | "adapt_for_pie"
  | "plan_curriculum"
  | "explain_concept"
  | "generate_rubric"
  | "summarize_text"
  | "translate_text"
  | "generate_image_prompt"
  | "generate_image"
  | "narrate_text"
  | "generate_edu_video"
  | "recommend_focus_music"
  | "generate_code"
  | "fix_code_error";

export type ToolCategory =
  | "exam"
  | "accessibility"
  | "planning"
  | "content"
  | "media"
  | "audio"
  | "code";

export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  options?: string[];
}

export interface ToolExecutionOptions {
  headers?: HeadersInit;
}

export interface ToolDefinition {
  name: ToolName;
  label: string;
  icon: string;
  description: string;
  category: ToolCategory;
  params: ToolParam[];
  enabled: boolean;
  execute: (
    args: Record<string, unknown>,
    baseUrl: string,
    options?: ToolExecutionOptions,
  ) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function getForwardedHeader(
  headers: HeadersInit | undefined,
  name: string,
): string | null {
  if (!headers) return null;

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    const match = headers.find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    );
    return match?.[1] ?? null;
  }

  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

function buildRequestHeaders(options?: ToolExecutionOptions): HeadersInit {
  const out: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const cookie = getForwardedHeader(options?.headers, "cookie");
  const authorization = getForwardedHeader(options?.headers, "authorization");

  if (cookie) out.Cookie = cookie;
  if (authorization) out.Authorization = authorization;

  return out;
}

async function callInternalAPI(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  options?: ToolExecutionOptions,
): Promise<Response> {
  const url = `${baseUrl}${path}`;
  const safeBody =
    path === "/api/superagent/chat" ? { ...body, skipTools: true } : body;

  return fetch(url, {
    method: "POST",
    headers: buildRequestHeaders(options),
    body: JSON.stringify(safeBody),
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJsonOrText(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as Record<string, unknown>;
  }
  return { error: await res.text() };
}

function pickSubject(message: string): string {
  const m = message.toLowerCase();
  if (/matem[aá]tica|ecuaci[oó]n|funci[oó]n|geometr/i.test(m))
    return "Matemática";
  if (/f[ií]sica|fuerza|energ[ií]a|movimiento/i.test(m)) return "Física";
  if (/qu[ií]mica|reacci[oó]n|mol[eé]cula|[aá]tomo/i.test(m)) return "Química";
  if (/biolog[ií]a|c[eé]lula|ecosistema|gen[eé]tica/i.test(m))
    return "Biología";
  if (/historia|revoluci[oó]n|guerra|siglo/i.test(m)) return "Historia";
  if (/ingl[eé]s|english/i.test(m)) return "Inglés";
  return "";
}

// ── Definición de tools ───────────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "generate_exam_questions",
    label: "Generar preguntas",
    icon: "📝",
    description:
      "Genera preguntas de examen sobre un tema. Soporta alternativas, V/F y desarrollo.",
    category: "exam",
    enabled: true,
    params: [
      {
        name: "topic",
        type: "string",
        description: "Tema de las preguntas",
        required: true,
      },
      {
        name: "subject",
        type: "string",
        description: "Asignatura",
        required: false,
      },
      {
        name: "count",
        type: "number",
        description: "Cantidad de preguntas",
        required: false,
      },
      {
        name: "type",
        type: "string",
        description: "Tipo",
        required: false,
        options: ["multiple_choice", "true_false", "development", "mixed"],
      },
      { name: "level", type: "string", description: "Nivel", required: false },
    ],
    async execute(args, baseUrl, options) {
      try {
        const topic = normalizeText(args.topic);
        const subject = normalizeText(args.subject) || pickSubject(topic);
        const count = Math.min(10, Math.max(1, Number(args.count) || 5));
        const type = normalizeText(args.type) || "mixed";
        const level = normalizeText(args.level);

        const prompt = `Genera ${count} preguntas de examen en español para el tema: "${topic}".
${subject ? `Asignatura: ${subject}.` : ""}
${level ? `Nivel: ${level}.` : ""}
Tipo de preguntas: ${type === "mixed" ? "variado (alternativas, verdadero/falso y desarrollo)" : type}.

Responde SOLO con un JSON con esta estructura exacta:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "texto de la pregunta",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "por qué es correcta"
    }
  ]
}
Para true_false: omite options, usa correctAnswer: 0 (verdadero) o 1 (falso).
Para development: omite options y correctAnswer, agrega "modelAnswer": "respuesta esperada".`;

        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [{ role: "user", content: prompt }],
            task: "general",
            maxTokens: 3000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const raw = String(data.text || "");
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
            const summary = qs
              .map(
                (q: Record<string, unknown>, i: number) =>
                  `**${i + 1}.** ${String(q.question || "")}\n${
                    Array.isArray(q.options)
                      ? q.options
                          .map(
                            (o: string, j: number) =>
                              `  ${["A", "B", "C", "D"][j]}) ${o}`,
                          )
                          .join("\n")
                      : ""
                  }`,
              )
              .join("\n\n");
            return {
              success: true,
              output: `✅ **${qs.length} preguntas generadas** sobre "${topic}":\n\n${summary}`,
              data: parsed,
            };
          } catch {
            // si no parsea, devolvemos el texto completo
          }
        }

        return { success: true, output: raw };
      } catch (err) {
        return {
          success: false,
          output: "No se pudieron generar las preguntas.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "adapt_for_pie",
    label: "Adaptar para PIE",
    icon: "♿",
    description:
      "Adapta texto, preguntas o instrucciones para estudiantes con NEE.",
    category: "accessibility",
    enabled: true,
    params: [
      {
        name: "content",
        type: "string",
        description: "Texto a adaptar",
        required: true,
      },
      {
        name: "dyslexia",
        type: "boolean",
        description: "Dislexia",
        required: false,
      },
      { name: "adhd", type: "boolean", description: "TDAH", required: false },
      {
        name: "low_vision",
        type: "boolean",
        description: "Baja visión",
        required: false,
      },
      { name: "tea", type: "boolean", description: "TEA", required: false },
      { name: "tel", type: "boolean", description: "TEL", required: false },
    ],
    async execute(args, baseUrl, options) {
      try {
        const content = normalizeText(args.content);
        const dyslexia = Boolean(args.dyslexia);
        const adhd = Boolean(args.adhd);
        const lowVision = Boolean(args.low_vision);
        const tea = Boolean(args.tea);
        const tel = Boolean(args.tel);
        const needs =
          [
            dyslexia &&
              "dislexia: frases cortas, palabras simples, sin texto justificado",
            adhd &&
              "TDAH: instrucciones en pasos, bloques cortos, una idea por vez",
            lowVision &&
              "baja visión: texto grande, alto contraste, sin cursiva",
            tea && "TEA: lenguaje literal, estructura predecible",
            tel && "TEL: vocabulario básico y oraciones simples",
          ]
            .filter(Boolean)
            .join("; ") || "necesidades educativas generales";

        const prompt = `Adapta el siguiente texto para estudiantes con NEE (${needs}).

TEXTO ORIGINAL:
${content}

REGLAS:
- Frases cortas.
- Vocabulario simple.
- Instrucciones numeradas si aplica.
- Palabras clave en **negrita**.
- Mantén el objetivo pedagógico.

Devuelve SOLO el texto adaptado.`;

        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [{ role: "user", content: prompt }],
            task: "general",
            maxTokens: 2000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        return {
          success: true,
          output: `♿ **Texto adaptado para PIE** (${needs}):\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo adaptar el texto.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "plan_curriculum",
    label: "Planificación de clase",
    icon: "📚",
    description:
      "Genera una planificación de clase o unidad alineada al currículum MINEDUC.",
    category: "planning",
    enabled: true,
    params: [
      {
        name: "subject",
        type: "string",
        description: "Asignatura",
        required: false,
      },
      {
        name: "level",
        type: "string",
        description: "Nivel/Curso",
        required: false,
      },
      {
        name: "topic",
        type: "string",
        description: "Tema central",
        required: true,
      },
      {
        name: "sessions",
        type: "number",
        description: "N° de clases",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const topic = normalizeText(args.topic);
        const subject =
          normalizeText(args.subject) ||
          pickSubject(topic) ||
          "Asignatura por definir";
        const level = normalizeText(args.level) || "Enseñanza media";
        const sessions = Math.min(8, Math.max(1, Number(args.sessions) || 3));

        const prompt = `Crea una planificación de ${sessions} clase(s) para:
- Asignatura: ${subject}
- Nivel: ${level}
- Tema: ${topic}
- Marco: Currículum Nacional MINEDUC Chile

Incluye para cada clase: OA sugerido, indicadores, inicio, desarrollo, cierre, recursos y evaluación formativa.`;

        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [{ role: "user", content: prompt }],
            task: "long_context",
            maxTokens: 4000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        return {
          success: true,
          output: `📚 **Planificación generada** — ${subject} · ${level}:\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo generar la planificación.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "explain_concept",
    label: "Explicar concepto",
    icon: "🔬",
    description:
      "Explica un concepto educativo de forma clara, con ejemplos y analogías.",
    category: "content",
    enabled: true,
    params: [
      {
        name: "concept",
        type: "string",
        description: "Concepto a explicar",
        required: true,
      },
      { name: "level", type: "string", description: "Nivel", required: false },
      {
        name: "subject",
        type: "string",
        description: "Asignatura",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const concept = normalizeText(args.concept);
        const level =
          normalizeText(args.level) || "estudiante de enseñanza media";
        const subject = normalizeText(args.subject);

        const prompt = `Explica "${concept}" para un ${level}${subject ? ` en ${subject}` : ""}.

Estructura:
1. Definición simple.
2. Ejemplo cotidiano o chileno.
3. Analogía breve.
4. Puntos clave.
5. Pregunta de reflexión.`;

        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [{ role: "user", content: prompt }],
            task: "general",
            maxTokens: 1500,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        return {
          success: true,
          output: `🔬 **Explicación de "${concept}"**:\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo explicar el concepto.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "generate_rubric",
    label: "Crear rúbrica",
    icon: "📊",
    description:
      "Crea una rúbrica de evaluación con criterios y niveles de logro.",
    category: "exam",
    enabled: true,
    params: [
      {
        name: "task",
        type: "string",
        description: "Tarea/actividad",
        required: true,
      },
      {
        name: "subject",
        type: "string",
        description: "Asignatura",
        required: false,
      },
      {
        name: "points",
        type: "number",
        description: "Puntaje total",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const task = normalizeText(args.task);
        const subject = normalizeText(args.subject);
        const points = Number(args.points || 20);
        const prompt = `Crea una rúbrica para evaluar: "${task}"${subject ? ` en ${subject}` : ""}.
Puntaje total: ${points} puntos.

Formato Markdown con tabla:
| Criterio | Excelente | Satisfactorio | En desarrollo | Insuficiente | Pts |
|---|---|---|---|---|---|

Incluye 4-5 criterios medibles.`;

        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [{ role: "user", content: prompt }],
            task: "general",
            maxTokens: 2000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        return {
          success: true,
          output: `📊 **Rúbrica para "${task}"**:\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo generar la rúbrica.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "summarize_text",
    label: "Resumir texto",
    icon: "📄",
    description: "Resume un texto largo manteniendo las ideas principales.",
    category: "content",
    enabled: true,
    params: [
      {
        name: "text",
        type: "string",
        description: "Texto a resumir",
        required: true,
      },
      {
        name: "lines",
        type: "number",
        description: "N° puntos",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const text = String(args.text || "").trim();
        const lines = Math.min(20, Math.max(3, Number(args.lines) || 5));
        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [
              {
                role: "user",
                content: `Resume el siguiente texto en ${lines} puntos clave, en español:\n\n${text}`,
              },
            ],
            task: text.length > 3000 ? "long_context" : "fast",
            maxTokens: 1000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return { success: true, output: `📄 **Resumen:**\n\n${data.text}` };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo resumir el texto.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "translate_text",
    label: "Traducir",
    icon: "🌐",
    description: "Traduce texto al español u otro idioma.",
    category: "content",
    enabled: true,
    params: [
      {
        name: "text",
        type: "string",
        description: "Texto a traducir",
        required: true,
      },
      {
        name: "target",
        type: "string",
        description: "Idioma destino",
        required: false,
        options: ["Español", "Inglés", "Francés", "Portugués", "Alemán"],
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const text = String(args.text || "").trim();
        const target = normalizeText(args.target) || "Español";
        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [
              {
                role: "user",
                content: `Traduce al ${target}. Devuelve SOLO la traducción:\n\n${text}`,
              },
            ],
            task: "fast",
            maxTokens: 2000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return {
          success: true,
          output: `🌐 **Traducción al ${target}:**\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo traducir el texto.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "generate_image_prompt",
    label: "Prompt para imagen",
    icon: "🖼️",
    description:
      "Genera un prompt optimizado para crear imágenes educativas con IA.",
    category: "media",
    enabled: true,
    params: [
      {
        name: "concept",
        type: "string",
        description: "Concepto o escena",
        required: true,
      },
      {
        name: "style",
        type: "string",
        description: "Estilo visual",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const concept = normalizeText(args.concept);
        const style = normalizeText(args.style) || "diagrama científico";
        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [
              {
                role: "user",
                content: `Crea un prompt en inglés para generar una imagen educativa.\nConcepto: "${concept}"\nEstilo: ${style}\nEl prompt debe ser detallado, apto para FLUX/Stable Diffusion, sin explicaciones.`,
              },
            ],
            task: "fast",
            maxTokens: 400,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return {
          success: true,
          output: `🖼️ **Prompt para imagen** (${style}):\n\n\`\`\`\n${data.text}\n\`\`\`\n\nAbrir generador: [Image Studio](/image-studio).`,
          data: { prompt: data.text },
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo generar el prompt.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "generate_image",
    label: "Generar imagen",
    icon: "🎨",
    description:
      "Genera una imagen desde el chat usando el motor unificado de Image Studio.",
    category: "media",
    enabled: true,
    params: [
      {
        name: "prompt",
        type: "string",
        description: "Descripción de la imagen",
        required: true,
      },
      { name: "style", type: "string", description: "Estilo", required: false },
    ],
    async execute(args, baseUrl, options) {
      try {
        const prompt = normalizeText(args.prompt || args.content);
        const style = normalizeText(args.style) || "educational";

        const res = await callInternalAPI(
          baseUrl,
          "/api/agents/imagenes",
          {
            prompt,
            style,
            width: 1024,
            height: 576,
            provider: "auto",
            mode: "quality",
            source: "superagent",
            educationalContext:
              "Imagen solicitada desde EduAI Claw para uso educativo.",
          },
          options,
        );

        const data = await readJsonOrText(res);
        if (!res.ok)
          throw new Error(String(data.error || `HTTP ${res.status}`));

        const imageUrl = String(data.imageUrl || "");
        const provider = String(data.provider || "motor unificado");
        return {
          success: true,
          output: `🎨 **Imagen generada con ${provider}.**\n\n![Imagen generada por EduAI](${imageUrl})\n\nTambién quedó disponible desde [Image Studio](/image-studio) y la [Galería](/galeria).`,
          data,
        };
      } catch (err) {
        const fallbackPrompt = normalizeText(args.prompt || args.content);
        return {
          success: true,
          output: `🎨 No pude generar la imagen directamente desde el chat (${err instanceof Error ? err.message : String(err)}).\n\nTe dejo el acceso correcto al generador unificado: [abrir Image Studio](/image-studio).\n\nPrompt sugerido:\n\n\`\`\`\n${fallbackPrompt}\n\`\`\``,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "narrate_text",
    label: "Narrar texto",
    icon: "🔊",
    description: "Convierte texto corto a audio usando Edge TTS.",
    category: "audio",
    enabled: true,
    params: [
      {
        name: "text",
        type: "string",
        description: "Texto para narrar",
        required: true,
      },
      {
        name: "speaker",
        type: "string",
        description: "Voz A/B",
        required: false,
        options: ["A", "B"],
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const text = String(args.text || args.content || "")
          .trim()
          .slice(0, 1200);
        const speaker = normalizeText(args.speaker) === "B" ? "B" : "A";
        const res = await callInternalAPI(
          baseUrl,
          "/api/agents/tts",
          {
            text,
            speaker,
            addMotivation: false,
          },
          options,
        );
        if (!res.ok) {
          const data = await readJsonOrText(res);
          throw new Error(String(data.error || `HTTP ${res.status}`));
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = buffer.toString("base64");
        return {
          success: true,
          output: `🔊 **Narración lista.**\n\n<audio controls src="data:audio/mpeg;base64,${base64}"></audio>`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo generar la narración.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "generate_edu_video",
    label: "Video educativo",
    icon: "🎬",
    description: "Crea un job de video educativo con el motor de Video Studio.",
    category: "media",
    enabled: true,
    params: [
      {
        name: "prompt",
        type: "string",
        description: "Descripción del video",
        required: true,
      },
      { name: "style", type: "string", description: "Estilo", required: false },
      {
        name: "duration",
        type: "number",
        description: "Duración",
        required: false,
      },
      {
        name: "withAudio",
        type: "boolean",
        description: "Incluir audio",
        required: false,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const prompt = normalizeText(args.prompt || args.content);
        const style = normalizeText(args.style) || "educational animation";
        const duration = Math.min(10, Math.max(2, Number(args.duration) || 6));
        const withAudio = Boolean(args.withAudio);

        const res = await callInternalAPI(
          baseUrl,
          "/api/agents/video",
          {
            prompt,
            style,
            duration,
            withAudio,
            mode: "text_to_video",
          },
          options,
        );
        const data = await readJsonOrText(res);
        if (!res.ok)
          throw new Error(String(data.error || `HTTP ${res.status}`));

        const jobId = String(data.jobId || "");
        return {
          success: true,
          output: `🎬 **Video enviado a la cola de generación.**\n\n- Job: \`${jobId}\`\n- Estado: \`${String(data.status || "queued")}\`\n- Duración: ${duration}s\n\nPuedes revisar el avance en [Video Studio](/video-studio).`,
          data,
        };
      } catch (err) {
        return {
          success: true,
          output: `🎬 No pude crear el job de video desde el chat (${err instanceof Error ? err.message : String(err)}).\n\nEl módulo correcto ya está integrado aquí: [abrir Video Studio](/video-studio).`,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "recommend_focus_music",
    label: "Música focus",
    icon: "🎵",
    description:
      "Recomienda música de concentración según actividad y asignatura.",
    category: "media",
    enabled: true,
    params: [
      {
        name: "activity",
        type: "string",
        description: "Actividad",
        required: true,
      },
      {
        name: "subject",
        type: "string",
        description: "Asignatura",
        required: false,
      },
    ],
    async execute(args) {
      const activity = normalizeText(args.activity || args.content);
      const subject = normalizeText(args.subject) || pickSubject(activity);
      const lower = `${activity} ${subject}`.toLowerCase();

      const recommendation = /examen|prueba|ensayo/.test(lower)
        ? "Ambiente calmado, sin letra, tempo lento, volumen bajo."
        : /matem[aá]tica|f[ií]sica|programaci[oó]n/.test(lower)
          ? "Lo-fi instrumental o música clásica suave, ideal para resolución de problemas."
          : /lectura|resumen|historia|lenguaje/.test(lower)
            ? "Piano ambiental o sonidos de biblioteca, sin percusión fuerte."
            : "Lo-fi educativo instrumental, 25 minutos de foco y 5 de descanso.";

      return {
        success: true,
        output: `🎵 **Sesión musical recomendada**\n\nActividad: ${activity || "estudio"}${subject ? `\nAsignatura: ${subject}` : ""}\n\n${recommendation}\n\nTambién puedes usar el módulo [EduAI Music](/music), que integra playlists, favoritos y reproducción persistente.`,
      };
    },
  },

  {
    name: "generate_code",
    label: "Generar código",
    icon: "💻",
    description:
      "Genera componentes, rutas API, queries Supabase o utilidades TypeScript.",
    category: "code",
    enabled: true,
    params: [
      {
        name: "request",
        type: "string",
        description: "Qué código generar",
        required: true,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const request = normalizeText(args.request || args.content);
        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [
              {
                role: "user",
                content: `Genera código production-ready para EduAI Platform (Next.js 16, TypeScript, Supabase). Solicitud:\n${request}\n\nIncluye ruta exacta sugerida y código completo.`,
              },
            ],
            task: "coding",
            maxTokens: 4000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return {
          success: true,
          output: `💻 **Código generado:**\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo generar el código.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  {
    name: "fix_code_error",
    label: "Corregir código",
    icon: "🔧",
    description:
      "Analiza y corrige errores de TypeScript, React, Next.js o Supabase.",
    category: "code",
    enabled: true,
    params: [
      {
        name: "error",
        type: "string",
        description: "Error o código con problema",
        required: true,
      },
    ],
    async execute(args, baseUrl, options) {
      try {
        const errorText = String(args.error || args.content || "").trim();
        const res = await callInternalAPI(
          baseUrl,
          "/api/superagent/chat",
          {
            messages: [
              {
                role: "user",
                content: `Corrige este error/código de EduAI Platform. Entrega diagnóstico, archivo probable y parche exacto:\n\n${errorText}`,
              },
            ],
            task: "coding",
            maxTokens: 4000,
          },
          options,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return {
          success: true,
          output: `🔧 **Corrección sugerida:**\n\n${data.text}`,
        };
      } catch (err) {
        return {
          success: false,
          output: "No se pudo corregir el código.",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
];

// ── Funciones del registro ────────────────────────────────────────────────────

export function getToolByName(name: ToolName): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function getEnabledTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => t.enabled);
}

export function getToolsByCategory(
  category: ToolDefinition["category"],
): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => t.enabled && t.category === category);
}

/** Detecta qué tool usar según el texto del mensaje del usuario */
export function detectToolFromMessage(message: string): ToolName | null {
  const m = message.toLowerCase();

  if (
    /corrige|arregla|soluciona|fix|error|bug|typescript|build failed/i.test(
      m,
    ) &&
    /c[oó]digo|tsx|ts|react|next|supabase|api|error/i.test(m)
  )
    return "fix_code_error";
  if (
    /genera(r)?\s*(c[oó]digo|componente|ruta|api|query|funci[oó]n)|crea(r)?\s*(componente|api|query|c[oó]digo)/i.test(
      m,
    )
  )
    return "generate_code";
  if (
    /genera(r)?\s*(un\s*)?(video|animaci[oó]n)|video educativo|text(o)? a video|imagen a video/i.test(
      m,
    )
  )
    return "generate_edu_video";
  if (
    /m[uú]sica|focus|concentraci[oó]n|pomodoro|estudiar con m[uú]sica/i.test(m)
  )
    return "recommend_focus_music";
  if (/narr(a|ar|e)|escuchar|lee en voz|audio/i.test(m)) return "narrate_text";
  if (
    /(?:genera(r)?|crea(r)?|haz|diseña)\s*(una\s*)?(imagen|ilustraci[oó]n|afiche|p[oó]ster|infograf[ií]a|portada|visual)/i.test(
      m,
    )
  )
    return "generate_image";
  if (/prompt.*(imagen|ilustrac|visual)/i.test(m))
    return "generate_image_prompt";
  if (/genera(r|)\s*(preguntas?|examen|evaluac)/i.test(m))
    return "generate_exam_questions";
  if (/adapt(a|ar)\s*(para|el|texto).*(pie|nee|dislexia|tdah)/i.test(m))
    return "adapt_for_pie";
  if (
    /pie|nee|dislexia|tdah|tea|baja\s*visi[oó]n|adapta/i.test(m) &&
    /text|pregunta|contenid/i.test(m)
  )
    return "adapt_for_pie";
  if (/planifica(ci[oó]n|r|)\s*(de\s*)?(clase|unidad|semana)/i.test(m))
    return "plan_curriculum";
  if (/rubric(a|)\s*(de|para|evaluac)/i.test(m)) return "generate_rubric";
  if (/resum(e|ir|en)\s*(este|el|texto|document)/i.test(m))
    return "summarize_text";
  if (/traduc(e|ir|ci[oó]n)/i.test(m)) return "translate_text";
  if (/explic(a|ar)\s*(el|la|qu[eé]\s*es|concepto)/i.test(m))
    return "explain_concept";

  return null;
}
