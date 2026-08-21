import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "components/video/PersonalAIMarketplace.tsx")
if (!fs.existsSync(target)) throw new Error("[video-personal-recovery] PersonalAIMarketplace no encontrado")

let source = fs.readFileSync(target, "utf8")
let changed = false

const marker = "PERSONAL_VIDEO_JOB_RECOVERY_V1"
if (!source.includes(marker)) {
  const anchor = "  const generatePersonal = async () => {"
  if (!source.includes(anchor)) throw new Error("[video-personal-recovery] No se encontró generatePersonal")

  const recovery = `  // ${marker}\n  useEffect(() => {\n    if (!open || job) return\n    let cancelled = false\n\n    const recover = async () => {\n      try {\n        const response = await fetch(\"/api/agents/video/personal/recent\", { cache: \"no-store\" })\n        const body = await response.json().catch(() => null)\n        if (!response.ok || cancelled) return\n        const jobs = Array.isArray(body?.jobs) ? body.jobs as PersonalJob[] : []\n        const latest = jobs.find(item => item.status === \"processing\" || item.status === \"queued\") || jobs[0] || null\n        if (!latest || cancelled) return\n\n        setJob(latest)\n        if (latest.status === \"processing\" || latest.status === \"queued\") {\n          setMessage(\"Se recuperó una generación Premium Personal pendiente. EduAI retomará el seguimiento.\")\n          setGenerating(true)\n          try {\n            await poll(latest.jobId)\n          } catch (caught) {\n            if (!cancelled) setError(caught instanceof Error ? caught.message : \"No fue posible recuperar el job personal\")\n          } finally {\n            if (!cancelled) setGenerating(false)\n          }\n        } else if (latest.status === \"completed\" && latest.videoUrl) {\n          setMessage(\"Último video Premium Personal recuperado desde Recursos IA.\")\n        }\n      } catch {\n        // La recuperación es best-effort y nunca debe bloquear el marketplace.\n      }\n    }\n\n    void recover()\n    return () => { cancelled = true }\n  }, [open])\n\n`

  source = source.replace(anchor, recovery + anchor)
  changed = true
}

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[video-personal-recovery] jobs Premium Personal se recuperan después de recargar")
} else {
  console.log("[video-personal-recovery] ya aplicado")
}
