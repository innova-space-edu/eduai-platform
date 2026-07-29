import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"
import { generateSongWithAceStep } from "@/lib/audio/gradio-song-engine"

export const runtime = "nodejs"
export const maxDuration = 300

type SongPlan = {
  title: string
  caption: string
  lyrics: string
  genre: string
  mood: string
  bpm: number | null
  keyScale: string
  timeSignature: string
  duration: number
}

const VOCAL_STYLES: Record<string, string> = {
  automatic: "natural lead singer, expressive and clear",
  female_warm: "warm expressive female singer, clear pronunciation, natural vibrato",
  female_bright: "bright youthful female singer, energetic and melodic",
  male_warm: "warm expressive male singer, clear pronunciation, natural vibrato",
  male_deep: "deep male singer, resonant low register, controlled delivery",
  youthful: "youthful singer, friendly educational tone, clear diction",
  choir: "mixed choir with balanced male and female harmonies",
}

function text(value: unknown, max = 8000) {
  return typeof value === "string" ? value.replace(/\x00/g, " ").trim().slice(0, max) : ""
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback
}

function parseJsonObject(value: string): Record<string, any> | null {
  const clean = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    const parsed = JSON.parse(clean)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function fallbackPlan(input: {
  prompt: string
  lyrics: string
  genre: string
  mood: string
  duration: number
  bpm: number | null
  keyScale: string
  timeSignature: string
  instrumental: boolean
}): SongPlan {
  const title = input.prompt.split(/[.!?\n]/)[0]?.trim().slice(0, 72) || "Canción EduAI"
  const caption = [input.genre, input.mood, input.prompt]
    .filter(Boolean)
    .join(", ")
    .slice(0, 1800)

  return {
    title,
    caption,
    lyrics: input.instrumental ? "" : input.lyrics,
    genre: input.genre,
    mood: input.mood,
    bpm: input.bpm,
    keyScale: input.keyScale,
    timeSignature: input.timeSignature,
    duration: input.duration,
  }
}

async function composeSongPlan(input: {
  inputMode: "prompt" | "lyrics"
  prompt: string
  lyrics: string
  genre: string
  mood: string
  duration: number
  bpm: number | null
  keyScale: string
  timeSignature: string
  instrumental: boolean
  vocalLanguage: string
}): Promise<SongPlan> {
  const fallback = fallbackPlan(input)
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return fallback

  try {
    const groq = new Groq({ apiKey })
    const request = input.inputMode === "prompt"
      ? `Crea una canción a partir de esta idea: ${input.prompt}`
      : `Conserva el sentido de esta letra y mejórala para que sea cantable. Idea o contexto: ${input.prompt}\n\nLetra:\n${input.lyrics}`

    const completion = await groq.chat.completions.create({
      model: process.env.AUDIO_SONG_COMPOSER_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.72,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Eres compositor y productor musical educativo. Devuelve SOLO JSON válido con estas claves: title, caption, lyrics, genre, mood, bpm, keyScale, timeSignature, duration. La letra debe usar etiquetas [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge] y [Outro] cuando corresponda. Escribe en idioma ${input.vocalLanguage}. No imites artistas reales ni canciones protegidas. Si instrumental=true, lyrics debe ser cadena vacía. Respeta valores indicados por el usuario.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            request,
            genre: input.genre,
            mood: input.mood,
            duration: input.duration,
            bpm: input.bpm,
            keyScale: input.keyScale,
            timeSignature: input.timeSignature,
            instrumental: input.instrumental,
          }),
        },
      ],
    })

    const parsed = parseJsonObject(completion.choices[0]?.message?.content || "")
    if (!parsed) return fallback

    return {
      title: text(parsed.title, 120) || fallback.title,
      caption: text(parsed.caption, 1800) || fallback.caption,
      lyrics: input.instrumental ? "" : text(parsed.lyrics, 8000) || fallback.lyrics,
      genre: text(parsed.genre, 120) || fallback.genre,
      mood: text(parsed.mood, 120) || fallback.mood,
      bpm: input.bpm || (Number.isFinite(Number(parsed.bpm)) ? clamp(parsed.bpm, 30, 300, 100) : null),
      keyScale: input.keyScale || text(parsed.keyScale, 40),
      timeSignature: ["2", "3", "4", "6"].includes(String(parsed.timeSignature))
        ? String(parsed.timeSignature)
        : fallback.timeSignature,
      duration: input.duration || clamp(parsed.duration, 10, 180, fallback.duration),
    }
  } catch (error) {
    console.warn("song composer fallback:", error)
    return fallback
  }
}

async function signedAudioUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (!path) return null
  const { data } = await supabase.storage.from("generated-songs").createSignedUrl(path, 60 * 60)
  return data?.signedUrl || null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("audio_song_jobs")
    .select("id,title,prompt,caption,lyrics,genre,mood,vocal_language,duration_seconds,bpm,key_scale,time_signature,instrumental,vocal_style,voice_profile_id,status,progress,provider,audio_path,metadata,error,created_at,updated_at,completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    const missing = error.message.toLowerCase().includes("audio_song_jobs")
    return NextResponse.json({
      error: missing ? "Falta aplicar la migración audio_song_studio en Supabase" : error.message,
      jobs: [],
    }, { status: missing ? 503 : 500 })
  }

  const jobs = await Promise.all((data || []).map(async (job: any) => ({
    ...job,
    audio_url: await signedAudioUrl(supabase, job.audio_path),
  })))

  return NextResponse.json({ ok: true, jobs })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let jobId = ""

  try {
    const body = await req.json().catch(() => ({}))
    const inputMode = body.inputMode === "lyrics" ? "lyrics" : "prompt"
    const prompt = text(body.prompt, 3000)
    const directLyrics = text(body.lyrics, 8000)
    const instrumental = body.instrumental === true
    const genre = text(body.genre, 120)
    const mood = text(body.mood, 120)
    const vocalLanguage = text(body.vocalLanguage, 16) || "es"
    const duration = clamp(body.duration, 10, 180, 45)
    const bpmRaw = Number(body.bpm)
    const bpm = Number.isFinite(bpmRaw) && bpmRaw >= 30 ? clamp(bpmRaw, 30, 300, 100) : null
    const keyScale = text(body.keyScale, 40)
    const timeSignature = ["2", "3", "4", "6"].includes(String(body.timeSignature)) ? String(body.timeSignature) : "4"
    const vocalStyleId = text(body.vocalStyle, 40) || "automatic"
    const vocalStyle = VOCAL_STYLES[vocalStyleId] || VOCAL_STYLES.automatic
    const voiceProfileId = text(body.voiceProfileId, 80) || null
    const voiceConsentConfirmed = body.voiceConsentConfirmed === true
    const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : -1

    if (!prompt && !directLyrics) {
      return NextResponse.json({ error: "Escribe una idea o una letra para la canción" }, { status: 400 })
    }
    if (inputMode === "lyrics" && !instrumental && !directLyrics) {
      return NextResponse.json({ error: "Pega una letra o cambia a modo Idea" }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from("audio_song_jobs")
      .insert({
        user_id: user.id,
        title: "Preparando canción...",
        prompt,
        lyrics: directLyrics,
        genre,
        mood,
        vocal_language: vocalLanguage,
        duration_seconds: duration,
        bpm,
        key_scale: keyScale,
        time_signature: timeSignature,
        instrumental,
        vocal_style: vocalStyleId,
        voice_profile_id: voiceProfileId,
        status: "composing",
        progress: 10,
      })
      .select("id")
      .single()

    if (insertError || !inserted) {
      const missing = insertError?.message?.toLowerCase().includes("audio_song_jobs")
      throw new Error(missing ? "Falta aplicar la migración audio_song_studio en Supabase" : insertError?.message || "No se pudo crear el trabajo")
    }
    jobId = inserted.id

    const plan = await composeSongPlan({
      inputMode,
      prompt,
      lyrics: directLyrics,
      genre,
      mood,
      duration,
      bpm,
      keyScale,
      timeSignature,
      instrumental,
      vocalLanguage,
    })

    let referenceAudioUrl = ""
    let voiceName = ""

    if (voiceProfileId) {
      if (!voiceConsentConfirmed) {
        throw new Error("Debes autorizar expresamente el uso de esa voz para canto IA")
      }

      const { data: voice, error: voiceError } = await supabase
        .from("audio_voice_profiles")
        .select("id,display_name,status,sample_path,internal_use_enabled,consent_confirmed,authorization_confirmed")
        .eq("id", voiceProfileId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()

      if (voiceError || !voice) throw new Error("La voz seleccionada no está disponible")
      if (!voice.sample_path || voice.status !== "ready" || !voice.internal_use_enabled) {
        throw new Error("La voz debe estar procesada y habilitada en Mis voces")
      }
      if (!voice.consent_confirmed || !voice.authorization_confirmed) {
        throw new Error("La voz seleccionada no tiene autorización verificable")
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from("voice-clones")
        .createSignedUrl(voice.sample_path, 60 * 10)
      if (signedError || !signed?.signedUrl) throw new Error("No se pudo preparar la referencia vocal")

      referenceAudioUrl = signed.signedUrl
      voiceName = voice.display_name

      await supabase
        .from("audio_voice_profiles")
        .update({
          singing_enabled: true,
          singing_consent_at: new Date().toISOString(),
          singing_engine: "ace-step-1.5",
          updated_at: new Date().toISOString(),
        })
        .eq("id", voiceProfileId)
        .eq("user_id", user.id)

      await supabase.from("audio_voice_events").insert({
        user_id: user.id,
        voice_profile_id: voiceProfileId,
        event_type: "singing_consent_recorded",
        metadata: { engine: "ace-step-1.5", job_id: jobId },
      })
    }

    await supabase
      .from("audio_song_jobs")
      .update({
        title: plan.title,
        caption: plan.caption,
        lyrics: plan.lyrics,
        genre: plan.genre,
        mood: plan.mood,
        bpm: plan.bpm,
        key_scale: plan.keyScale,
        time_signature: plan.timeSignature,
        duration_seconds: plan.duration,
        status: "generating",
        progress: 35,
        updated_at: new Date().toISOString(),
        metadata: { voice_name: voiceName || null, voice_reference_experimental: Boolean(referenceAudioUrl) },
      })
      .eq("id", jobId)
      .eq("user_id", user.id)

    const generated = await generateSongWithAceStep({
      prompt: plan.caption,
      lyrics: plan.lyrics,
      duration: plan.duration,
      bpm: plan.bpm,
      keyScale: plan.keyScale,
      timeSignature: plan.timeSignature,
      vocalLanguage,
      instrumental,
      vocalStyle,
      referenceAudioUrl,
      seed,
    })

    await supabase
      .from("audio_song_jobs")
      .update({ status: "uploading", progress: 85, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", user.id)

    const extension = generated.mime.includes("mpeg") ? "mp3" : generated.mime.includes("flac") ? "flac" : "wav"
    const audioPath = `${user.id}/${jobId}/song.${extension}`
    const { error: uploadError } = await supabase.storage
      .from("generated-songs")
      .upload(audioPath, generated.bytes, {
        contentType: generated.mime,
        cacheControl: "3600",
        upsert: true,
      })
    if (uploadError) throw new Error(`No se pudo guardar la canción: ${uploadError.message}`)

    const completedAt = new Date().toISOString()
    const metadata = {
      ...generated.metadata,
      voice_name: voiceName || null,
      source_engine: "EsthefanoMC23/eduai-song-engine",
    }

    const { data: completed, error: updateError } = await supabase
      .from("audio_song_jobs")
      .update({
        audio_path: audioPath,
        status: "completed",
        progress: 100,
        provider: "ace-step-1.5",
        metadata,
        error: null,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", jobId)
      .eq("user_id", user.id)
      .select("*")
      .single()
    if (updateError) throw new Error(updateError.message)

    const audioUrl = await signedAudioUrl(supabase, audioPath)
    return NextResponse.json({ ok: true, job: { ...completed, audio_url: audioUrl } })
  } catch (error: any) {
    const message = error?.message || "No se pudo generar la canción"
    console.error("audio/songs error:", message)

    if (jobId) {
      await supabase
        .from("audio_song_jobs")
        .update({
          status: "failed",
          progress: 100,
          error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ ok: false, error: message, jobId: jobId || null }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const { data: job } = await supabase
    .from("audio_song_jobs")
    .select("audio_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (job?.audio_path) await supabase.storage.from("generated-songs").remove([job.audio_path])
  const { error } = await supabase.from("audio_song_jobs").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
