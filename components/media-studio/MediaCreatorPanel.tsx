"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Mic2, Play, Sparkles, Square, Video, WandSparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMediaStudioStore } from "@/lib/media-studio/store";
import type { MediaAsset } from "@/lib/media-studio/types";

const EDGE_VOICES = [
  { id: "auto", label: "Automático · variar voz" },
  { id: "es-ES-AlvaroNeural", label: "Álvaro · España" },
  { id: "es-ES-ElviraNeural", label: "Elvira · España" },
  { id: "es-CL-LorenzoNeural", label: "Lorenzo · Chile" },
  { id: "es-CL-CatalinaNeural", label: "Catalina · Chile" },
  { id: "es-MX-JorgeNeural", label: "Jorge · México" },
  { id: "es-MX-DaliaNeural", label: "Dalia · México" },
  { id: "es-US-AlonsoNeural", label: "Alonso · EE.UU." },
  { id: "es-US-PalomaNeural", label: "Paloma · EE.UU." },
] as const;

const IMAGE_PROVIDERS = [
  { id: "auto", label: "Auto · multiproveedor" },
  { id: "gemini", label: "Gemini Imagen" },
  { id: "pollinations", label: "Pollinations FLUX" },
  { id: "together", label: "Together FLUX" },
  { id: "huggingface", label: "Hugging Face" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

const IMAGE_STYLES = ["realistic", "cinematic", "educational", "digital art", "3d render", "watercolor", "anime", "flat design"];

type VideoModel = {
  key: string;
  name: string;
  provider: "auto" | "google" | "fal";
  tier: "free" | "economy" | "balanced" | "premium";
  description: string;
  modes: Array<"text_to_video" | "image_to_video">;
  durations: number[];
  resolutions: Array<"720p" | "1080p" | "4k">;
  audio: "optional" | "included" | "auto";
  available: boolean;
};

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function projectImageSize(ratio: string) {
  if (ratio === "9:16") return { width: 576, height: 1024 };
  if (ratio === "1:1") return { width: 1024, height: 1024 };
  if (ratio === "4:5") return { width: 819, height: 1024 };
  return { width: 1024, height: 576 };
}

function pickAutoVoice(text: string, dialogue: boolean) {
  const hash = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const voices = ["es-ES-AlvaroNeural", "es-CL-CatalinaNeural", "es-CL-LorenzoNeural", "es-MX-DaliaNeural", "es-MX-JorgeNeural", "es-US-PalomaNeural"];
  const a = voices[hash % voices.length];
  const b = voices[(hash + 3) % voices.length];
  return { a, b: dialogue && b === a ? voices[(hash + 1) % voices.length] : b };
}

export default function MediaCreatorPanel() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"voice" | "image" | "video">("voice");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [voiceA, setVoiceA] = useState("es-ES-AlvaroNeural");
  const [voiceB, setVoiceB] = useState("es-ES-ElviraNeural");
  const [dialogue, setDialogue] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "prompt">("text");
  const [imageProvider, setImageProvider] = useState("auto");
  const [imageStyle, setImageStyle] = useState("educational");
  const [imageMode, setImageMode] = useState<"fast" | "quality" | "educational">("fast");
  const [videoModels, setVideoModels] = useState<VideoModel[]>([]);
  const [videoModelKey, setVideoModelKey] = useState("free-auto");
  const [videoDuration, setVideoDuration] = useState(6);
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p" | "4k">("720p");
  const [videoQuote, setVideoQuote] = useState<string>("");
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [localVoiceURI, setLocalVoiceURI] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const pollAbort = useRef(false);
  const { project, addAsset, addClipFromAsset } = useMediaStudioStore();

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices().slice().sort((a, b) => Number(b.lang.toLowerCase().startsWith("es")) - Number(a.lang.toLowerCase().startsWith("es")) || a.name.localeCompare(b.name));
      setLocalVoices(voices);
      setLocalVoiceURI((current) => current || voices.find((voice) => voice.lang.toLowerCase().startsWith("es") && voice.localService)?.voiceURI || voices.find((voice) => voice.lang.toLowerCase().startsWith("es"))?.voiceURI || voices[0]?.voiceURI || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => { pollAbort.current = true; window.speechSynthesis.removeEventListener("voiceschanged", load); window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    if (!open || videoModels.length) return;
    void fetch("/api/video/models", { cache: "no-store" }).then((res) => res.json()).then((body) => {
      const models = Array.isArray(body?.models) ? body.models.filter((item: VideoModel) => item.available) : [];
      setVideoModels(models);
      if (!models.some((item: VideoModel) => item.key === videoModelKey) && models[0]) setVideoModelKey(models[0].key);
    }).catch(() => undefined);
  }, [open, videoModels.length, videoModelKey]);

  const selectedVideoModel = useMemo(() => videoModels.find((item) => item.key === videoModelKey) || null, [videoModels, videoModelKey]);

  useEffect(() => {
    if (!selectedVideoModel) return;
    if (!selectedVideoModel.durations.includes(videoDuration)) setVideoDuration(selectedVideoModel.durations[0] || 6);
    if (!selectedVideoModel.resolutions.includes(videoResolution)) setVideoResolution(selectedVideoModel.resolutions[0] || "720p");
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/video/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelKey: selectedVideoModel.key, mode: "text_to_video", duration: selectedVideoModel.durations.includes(videoDuration) ? videoDuration : selectedVideoModel.durations[0], resolution: selectedVideoModel.resolutions.includes(videoResolution) ? videoResolution : selectedVideoModel.resolutions[0], withAudio: false }) });
        const body = await res.json();
        if (body?.ok) setVideoQuote(body.billingLabel || (body.estimatedCredits ? `${body.estimatedCredits} créditos` : selectedVideoModel.tier));
        else setVideoQuote("");
      } catch { setVideoQuote(""); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedVideoModel, videoDuration, videoResolution]);

  async function persistAudio(bytes: Uint8Array, name: string, mime = "audio/mpeg", provider = "Edge TTS") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Inicia sesión para guardar la voz generada.");
    await supabase.from("media_projects").upsert({ id: project.id, user_id: user.id, name: project.name, aspect_ratio: project.aspectRatio, width: project.width, height: project.height, fps: project.fps, duration_seconds: project.duration, timeline_json: project, updated_at: new Date().toISOString() });
    const path = `${user.id}/${project.id}/${crypto.randomUUID()}-tts.mp3`;
    const { error: uploadError } = await supabase.storage.from("media-studio").upload(path, bytes, { contentType: mime, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabase.storage.from("media-studio").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (!signed?.signedUrl) throw new Error("No se pudo firmar el audio.");
    const { data: row, error } = await supabase.from("media_assets").insert({ user_id: user.id, project_id: project.id, asset_type: "audio", name, source: "generated", provider, storage_path: path, mime_type: mime, license: "Generado por el usuario en EDUAI", metadata: { generated: true, kind: "tts" } }).select("id").single();
    if (error) throw error;
    const asset: MediaAsset = { id: String(row.id), type: "audio", name, url: signed.signedUrl, storagePath: path, mimeType: mime, source: "eduai", provider, license: "Generado por el usuario en EDUAI" };
    addAsset(asset); addClipFromAsset(asset);
  }

  async function generateVoice() {
    const clean = prompt.trim(); if (!clean) return;
    setBusy(true); setStatus("");
    try {
      const auto = voiceA === "auto" || voiceB === "auto" ? pickAutoVoice(clean, dialogue) : null;
      const res = await fetch("/api/agents/audio/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean, inputMode, style: dialogue ? "dialogue" : "narration", voiceA: voiceA === "auto" ? auto?.a : voiceA, voiceB: voiceB === "auto" ? auto?.b : voiceB }) });
      const body = await res.json();
      if (!res.ok || !body?.ok || !body.audioBase64) throw new Error(body?.error || "No se pudo generar la voz.");
      await persistAudio(bytesFromBase64(String(body.audioBase64)), dialogue ? "Diálogo EDUAI" : `Narración · ${String(body.voices?.A || "voz")}`, body.mime || "audio/mpeg", body.provider || "Audio Lab");
      setStatus(`Audio generado con ${body.provider || "Audio Lab"} y añadido al timeline.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo generar la voz."); }
    finally { setBusy(false); }
  }

  function previewLocalVoice() {
    if (!("speechSynthesis" in window) || !prompt.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt.trim().slice(0, 700));
    const voice = localVoices.find((item) => item.voiceURI === localVoiceURI);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function generateImage() {
    const clean = prompt.trim(); if (!clean) return;
    setBusy(true); setStatus("");
    try {
      const size = projectImageSize(project.aspectRatio);
      const res = await fetch("/api/agents/imagenes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean, style: imageStyle, width: size.width, height: size.height, provider: imageProvider, mode: imageMode, source: "media-studio" }) });
      const body = await res.json();
      if (!res.ok || !body?.imageUrl) throw new Error(body?.error || "No se pudo generar la imagen.");
      const raw: MediaAsset = { id: `generated-${crypto.randomUUID()}`, type: "image", name: clean.slice(0, 80), url: body.imageUrl, thumbnailUrl: body.imageUrl, source: "generated", provider: `${body.provider || imageProvider}${body.model ? ` · ${body.model}` : ""}`, license: "Generado por el usuario en EDUAI", width: size.width, height: size.height };
      const savedRes = await fetch("/api/media-studio/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: raw, project }) });
      const savedBody = await savedRes.json();
      const asset = savedRes.ok && savedBody.asset ? savedBody.asset as MediaAsset : raw;
      addAsset(asset); addClipFromAsset(asset);
      setStatus(`Imagen generada con ${body.provider || imageProvider} y añadida al timeline.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo generar la imagen."); }
    finally { setBusy(false); }
  }

  async function generateVideo() {
    const clean = prompt.trim(); if (!clean || !selectedVideoModel) return;
    setBusy(true); setStatus(""); pollAbort.current = false;
    try {
      const res = await fetch("/api/agents/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelKey: selectedVideoModel.key, prompt: clean, style: "educativo cinematográfico", duration: videoDuration, withAudio: false, mode: "text_to_video", imageUrl: null, aspectRatio: project.aspectRatio === "9:16" ? "9:16" : "16:9", resolution: videoResolution }) });
      const body = await res.json();
      if (!res.ok || !body?.ok || !body.jobId) throw new Error(body?.error || "No se pudo iniciar el video.");
      setStatus(`Video en cola con ${selectedVideoModel.name}…`);
      let completed: any = body;
      for (let attempt = 0; attempt < 75 && !pollAbort.current; attempt += 1) {
        if (completed.status === "completed" && completed.videoUrl) break;
        await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 2500 : 4000));
        const statusRes = await fetch(`/api/agents/video/status/${encodeURIComponent(body.jobId)}`, { cache: "no-store" });
        completed = await statusRes.json();
        if (["failed", "blocked", "canceled"].includes(completed.status)) throw new Error(completed.errorMessage || "La generación de video no terminó correctamente.");
        setStatus(`Generando ${selectedVideoModel.name} · ${Math.round(Number(completed.progress || 0) * (Number(completed.progress || 0) <= 1 ? 100 : 1))}%`);
      }
      if (!completed?.videoUrl) throw new Error("El video sigue procesándose. Quedará disponible en Video Studio cuando termine.");
      const raw: MediaAsset = { id: `generated-video-${body.jobId}`, type: "video", name: clean.slice(0, 80), url: completed.videoUrl, thumbnailUrl: completed.thumbnailUrl || undefined, duration: videoDuration, source: "generated", provider: `${completed.provider || selectedVideoModel.provider} · ${completed.model || selectedVideoModel.name}`, license: "Generado por el usuario en EDUAI" };
      let asset = raw;
      try {
        const savedRes = await fetch("/api/media-studio/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: raw, project }) });
        const savedBody = await savedRes.json();
        if (savedRes.ok && savedBody.asset) asset = savedBody.asset;
      } catch {}
      addAsset(asset); addClipFromAsset(asset);
      setStatus(`Video listo con ${selectedVideoModel.name} y añadido al timeline.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo generar el video."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed bottom-4 left-[560px] z-[64] text-slate-100">
      {open && <div className="mb-2 w-[410px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#101621]/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2"><WandSparkles className="h-4 w-4 text-amber-300" /><div><p className="text-xs font-bold">Generadores EDUAI</p><p className="text-[9px] text-slate-500">Audio Lab · Image Studio · Video Studio multiproveedor</p></div></div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">{(["voice","image","video"] as const).map((id) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg py-2 text-[10px] font-bold ${tab === id ? "bg-white/10 text-white" : "text-slate-500"}`}>{id === "voice" ? "Voz/TTS" : id === "image" ? "Imagen" : "Video"}</button>)}</div>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder={tab === "voice" ? "Texto o idea para narrar..." : tab === "image" ? "Describe la imagen..." : "Describe el video..."} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 outline-none focus:border-amber-400/40" />

        {tab === "voice" && <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2"><select value={inputMode} onChange={(e) => setInputMode(e.target.value as any)} className="rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]"><option value="text">Texto exacto</option><option value="prompt">IA crea guion</option></select><label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 text-[10px]"><input type="checkbox" checked={dialogue} onChange={(e) => setDialogue(e.target.checked)} />Diálogo 2 voces</label></div>
          <select value={voiceA} onChange={(e) => setVoiceA(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{EDGE_VOICES.map((voice) => <option key={voice.id} value={voice.id}>Voz A · {voice.label}</option>)}</select>
          {dialogue && <select value={voiceB} onChange={(e) => setVoiceB(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{EDGE_VOICES.map((voice) => <option key={voice.id} value={voice.id}>Voz B · {voice.label}</option>)}</select>}
          {!!localVoices.length && <div className="grid grid-cols-[1fr_auto] gap-2"><select value={localVoiceURI} onChange={(e) => setLocalVoiceURI(e.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[9px]"><option value="">Voz local del dispositivo…</option>{localVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.lang} · {voice.name}{voice.localService ? " · local" : ""}</option>)}</select><button onClick={() => { if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); } else previewLocalVoice(); }} className="rounded-lg bg-white/10 px-3">{speaking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button></div>}
          <button onClick={generateVoice} disabled={busy || !prompt.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-[10px] font-black text-slate-950 disabled:opacity-35">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic2 className="h-4 w-4" />}Generar y añadir voz</button>
        </div>}

        {tab === "image" && <div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><select value={imageProvider} onChange={(e) => setImageProvider(e.target.value)} className="rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{IMAGE_PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} className="rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{IMAGE_STYLES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><select value={imageMode} onChange={(e) => setImageMode(e.target.value as any)} className="w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]"><option value="fast">Rápido · menor costo</option><option value="quality">Calidad</option><option value="educational">Educativo</option></select><button onClick={generateImage} disabled={busy || !prompt.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-2.5 text-[10px] font-black disabled:opacity-35">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Generar y añadir imagen</button></div>}

        {tab === "video" && <div className="mt-3 space-y-2"><select value={videoModelKey} onChange={(e) => setVideoModelKey(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{videoModels.map((item) => <option key={item.key} value={item.key}>{item.provider === "auto" ? "Gratis/Auto" : item.provider.toUpperCase()} · {item.name}</option>)}</select>{selectedVideoModel && <p className="rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-500">{selectedVideoModel.description}{videoQuote ? ` · ${videoQuote}` : ""}</p>}<div className="grid grid-cols-2 gap-2"><select value={videoDuration} onChange={(e) => setVideoDuration(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{selectedVideoModel?.durations.map((value) => <option key={value} value={value}>{value} s</option>)}</select><select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value as any)} className="rounded-lg border border-white/10 bg-[#151d2a] p-2 text-[10px]">{selectedVideoModel?.resolutions.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></div><button onClick={generateVideo} disabled={busy || !prompt.trim() || !selectedVideoModel} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-[10px] font-black disabled:opacity-35">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}Generar y añadir video</button></div>}

        {status && <p className="mt-3 rounded-lg bg-black/20 p-2 text-[9px] leading-4 text-slate-300">{status}</p>}
        <p className="mt-2 text-[8px] leading-3 text-slate-700">“Automático” prioriza reutilización y proveedores disponibles. Los modelos de pago de Video Studio sólo se usan si los eliges explícitamente.</p>
      </div>}
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-[#1b1710]/95 px-4 py-2.5 text-xs font-black text-amber-200 shadow-xl backdrop-blur-xl hover:bg-amber-400/10"><Sparkles className="h-4 w-4" />Generar {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}</button>
    </div>
  );
}
