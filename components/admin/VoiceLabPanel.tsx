"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AudioLines, Gauge, Play, ShieldCheck, Square, Volume2 } from "lucide-react"

type VoiceMetrics = {
  startLatencyMs: number | null
  speakDurationMs: number | null
  voiceName: string | null
  lang: string | null
  localService: boolean | null
}

function formatMs(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—"
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`
}

export default function VoiceLabPanel() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState("")
  const [text, setText] = useState("Hola. Esta es una prueba de voz local del EduAI Model Lab.")
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [metrics, setMetrics] = useState<VoiceMetrics>({ startLatencyMs: null, speakDurationMs: null, voiceName: null, lang: null, localService: null })
  const clickAtRef = useRef(0)
  const startAtRef = useRef(0)

  useEffect(() => {
    if (!("speechSynthesis" in window)) return
    const load = () => {
      const available = window.speechSynthesis.getVoices().slice().sort((a, b) => {
        const aEs = a.lang.toLowerCase().startsWith("es") ? 0 : 1
        const bEs = b.lang.toLowerCase().startsWith("es") ? 0 : 1
        return aEs - bEs || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name)
      })
      setVoices(available)
      setVoiceURI(current => current || available.find(voice => voice.lang.toLowerCase().startsWith("es") && voice.localService)?.voiceURI || available.find(voice => voice.lang.toLowerCase().startsWith("es"))?.voiceURI || available[0]?.voiceURI || "")
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load)
      window.speechSynthesis.cancel()
    }
  }, [])

  const selectedVoice = useMemo(() => voices.find(voice => voice.voiceURI === voiceURI) || null, [voices, voiceURI])
  const spanishVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith("es"))
  const localVoices = voices.filter(voice => voice.localService)

  function stop() {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  function speak() {
    if (!("speechSynthesis" in window) || !text.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.trim())
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.lang = selectedVoice?.lang || "es-CL"
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume
    clickAtRef.current = performance.now()
    startAtRef.current = 0
    setSpeaking(true)
    utterance.onstart = () => {
      startAtRef.current = performance.now()
      setMetrics({
        startLatencyMs: startAtRef.current - clickAtRef.current,
        speakDurationMs: null,
        voiceName: selectedVoice?.name || null,
        lang: selectedVoice?.lang || utterance.lang,
        localService: selectedVoice?.localService ?? null,
      })
    }
    utterance.onend = () => {
      const ended = performance.now()
      setSpeaking(false)
      setMetrics(current => ({ ...current, speakDurationMs: startAtRef.current ? ended - startAtRef.current : null }))
    }
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const supported = typeof window !== "undefined" && "speechSynthesis" in window

  return (
    <section className="rounded-[30px] border border-sky-400/15 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,rgba(6,15,28,0.99),rgba(4,10,20,0.99))] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sky-300"><Volume2 className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-[0.2em]">Voice Lab · TTS local</p></div>
          <h2 className="mt-2 text-xl font-black text-white">Salida de voz antes de integrarla en MIRA</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Prueba las voces disponibles en el navegador/sistema operativo, priorizando español y servicios locales. Esta ruta no necesita enviar el texto a un proveedor cloud.</p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 ${supported ? "border-emerald-400/15 bg-emerald-950/20" : "border-red-400/15 bg-red-950/20"}`}><div className={`flex items-center gap-2 text-xs font-black ${supported ? "text-emerald-200" : "text-red-200"}`}><ShieldCheck className="h-4 w-4" />{supported ? "SpeechSynthesis disponible" : "TTS no disponible"}</div><p className="mt-1 text-[9px] text-slate-600">{localVoices.length} locales · {spanishVoices.length} en español · {voices.length} totales</p></div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2"><AudioLines className="h-4 w-4 text-sky-300" /><h3 className="text-sm font-black text-white">Voz y texto</h3></div>
          <label className="mt-3 block text-[10px] font-black text-slate-500">Voz</label>
          <select value={voiceURI} onChange={event => setVoiceURI(event.target.value)} disabled={!voices.length || speaking} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs font-bold text-slate-200 outline-none disabled:opacity-40">
            {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.lang} · {voice.name}{voice.localService ? " · local" : ""}</option>)}
          </select>
          <textarea value={text} onChange={event => setText(event.target.value)} rows={4} disabled={speaking} className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-slate-200 outline-none disabled:opacity-50" />
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={speak} disabled={!supported || !text.trim() || speaking} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-950/25 px-3 py-3 text-xs font-black text-emerald-100 disabled:opacity-40"><Play className="h-4 w-4" />Probar voz</button><button type="button" onClick={stop} disabled={!speaking} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-950/20 px-3 py-3 text-xs font-black text-red-200 disabled:opacity-30"><Square className="h-4 w-4" />Detener</button></div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-black text-white">Controles y métricas</h3></div>
          <div className="mt-4 space-y-4">
            <label className="block"><div className="flex justify-between text-[10px]"><span className="font-black text-slate-500">Velocidad</span><span className="font-black text-slate-200">{rate.toFixed(2)}×</span></div><input type="range" min="0.5" max="1.5" step="0.05" value={rate} disabled={speaking} onChange={event => setRate(Number(event.target.value))} className="mt-2 w-full accent-sky-400" /></label>
            <label className="block"><div className="flex justify-between text-[10px]"><span className="font-black text-slate-500">Tono</span><span className="font-black text-slate-200">{pitch.toFixed(2)}</span></div><input type="range" min="0.5" max="1.5" step="0.05" value={pitch} disabled={speaking} onChange={event => setPitch(Number(event.target.value))} className="mt-2 w-full accent-violet-400" /></label>
            <label className="block"><div className="flex justify-between text-[10px]"><span className="font-black text-slate-500">Volumen</span><span className="font-black text-slate-200">{Math.round(volume * 100)}%</span></div><input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} className="mt-2 w-full accent-emerald-400" /></label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">Inicio</p><p className="mt-1 text-[11px] font-black text-white">{formatMs(metrics.startLatencyMs)}</p></div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">Duración</p><p className="mt-1 text-[11px] font-black text-white">{formatMs(metrics.speakDurationMs)}</p></div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">Idioma</p><p className="mt-1 text-[11px] font-black text-sky-200">{metrics.lang || selectedVoice?.lang || "—"}</p></div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5"><p className="text-[9px] text-slate-600">Ruta</p><p className={`mt-1 text-[11px] font-black ${(metrics.localService ?? selectedVoice?.localService) ? "text-emerald-200" : "text-amber-200"}`}>{(metrics.localService ?? selectedVoice?.localService) ? "local" : selectedVoice ? "sistema/web" : "—"}</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3"><p className="text-[9px] text-slate-600">Voz seleccionada</p><p className="mt-1 text-[10px] font-black text-slate-300">{selectedVoice?.name || "Esperando voces del navegador…"}</p></div>
        </div>
      </div>
    </section>
  )
}
