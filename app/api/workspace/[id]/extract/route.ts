import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { data: project } = await supabase
      .from("projects").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : ""
    // La ruta se valida antes de descargar. No aceptar URLs externas ni rutas de otros usuarios.
    if (!storagePath.startsWith("workspace/" + user.id + "/") ||
        storagePath.includes("..") || storagePath.length > 512) {
      return NextResponse.json({ error: "Ruta de archivo no permitida" }, { status: 403 })
    }

    const extension = storagePath.split(".").pop()?.toLowerCase() || ""
    if (!["pdf", "docx", "txt", "md", "csv"].includes(extension)) {
      return NextResponse.json({ text: "", supported: false, reason: "Este formato todavía no admite extracción de texto." })
    }
    const { data: file, error } = await supabase.storage.from("workspace-files").download(storagePath)
    if (error || !file) return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 404 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera el máximo de 15 MB para extracción." }, { status: 413 })

    const bytes = Buffer.from(await file.arrayBuffer())
    let text = ""
    if (extension === "pdf") {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(bytes) })
      try { text = (await parser.getText()).text || "" }
      finally { await parser.destroy() }
    } else if (extension === "docx") {
      const mammoth = await import("mammoth")
      text = (await mammoth.extractRawText({ buffer: bytes })).value || ""
    } else {
      text = bytes.toString("utf8")
    }

    text = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim().slice(0, 80000)
    return NextResponse.json({
      text,
      supported: true,
      truncated: text.length === 80000,
      reason: text ? undefined : "No se encontró texto seleccionable (podría ser un PDF escaneado).",
    })
  } catch (cause: unknown) {
    console.error("[Workspace extract]", cause)
    return NextResponse.json({ error: "No se pudo extraer texto de este archivo." }, { status: 422 })
  }
}
