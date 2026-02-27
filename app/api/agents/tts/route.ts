import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { text } = await req.json()

  // Limpiar texto para TTS
  const clean = text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\$\$[^$]*\$\$/g, "fórmula matemática")
    .replace(/\$[^$]*\$/g, "fórmula")
    .replace(/---FOLLOWUPS---[\s\S]*/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 500) // HF tiene límite de caracteres

  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/facebook/mms-tts-spa",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: clean }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error("HF TTS error:", err)
      return new Response(err, { status: res.status })
    }

    const audioBuffer = await res.arrayBuffer()

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-cache",
      },
    })
  } catch (e: any) {
    return new Response(e.message || "Error", { status: 500 })
  }
}
