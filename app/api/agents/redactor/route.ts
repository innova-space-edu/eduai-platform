import { runAIText } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { message, history = [], designTemplateId, outputFormat = "generic" } = await req.json()
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Escribe una solicitud." }, { status: 400 })
  }

  const messages = [
    {
      role: "system" as const,
      content: `Eres un redactor profesional experto en escritura académica, periodística y corporativa. Produces textos bien estructurados, con vocabulario apropiado al contexto, buena sintaxis y coherencia. Adaptas el tono según el tipo de documento (formal, académico, informativo, narrativo). Cuando redactas documentos completos, los estructuras con encabezados, introducción, desarrollo y conclusión. Respondes en español a menos que se pida otro idioma.${buildDesignPromptDirective(designTemplateId, outputFormat)}`,
    },
    ...history.slice(-12).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    })),
    { role: "user" as const, content: message.trim() },
  ]

  try {
    const result = await runAIText({
      messages,
      capability: "text",
      maxOutputTokens: 3000,
      context: {
        userId: user.id,
        module: "redactor",
        reusePolicy: "exact_private",
        visibility: "private",
      },
      supabase,
    })

    return Response.json({
      text: result.data,
      provider: result.provider,
      model: result.model,
      reused: result.reused,
      generationAvoided: result.reused,
      _design: getDesignTemplateSummary(designTemplateId, outputFormat),
    })
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "No fue posible redactar.", code: e?.code || undefined },
      { status: e?.status || 500 },
    )
  }
}