"use client"

const INFOGRAPHIC_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#16a34a",
  purple: "#8b5cf6",
  orange: "#ea580c",
  red: "#ef4444",
  teal: "#0d9488",
  indigo: "#4338ca",
}

export function EditableInfographicPreview({ data }: { data: any }) {
  const accent = INFOGRAPHIC_COLORS[data?.colorScheme] || data?._design?.palette?.primary || "#3b82f6"
  const sections = Array.isArray(data?.sections) ? data.sections : []

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10" style={{ background: "linear-gradient(155deg,#07111f,#0d1d36 55%,#10182d)" }}>
      <header className="relative overflow-hidden px-7 pb-7 pt-10 text-center">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `radial-gradient(ellipse at 20% 20%,${accent},transparent 48%),radial-gradient(ellipse at 85% 35%,${accent}88,transparent 42%)` }} />
        <div className="relative z-10">
          <span className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ borderColor: `${accent}55`, background: `${accent}22`, color: accent }}>Infografía educativa</span>
          <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-black leading-tight text-white">{data?.title || "Infografía"}</h1>
          {data?.subtitle && <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-slate-300">{data.subtitle}</p>}
        </div>
      </header>

      {data?.keyFact && (
        <div className="mx-5 mb-5 rounded-2xl border px-5 py-4 text-center" style={{ borderColor: `${accent}40`, background: `${accent}15` }}>
          <p className="text-sm font-bold" style={{ color: accent }}>💡 {data.keyFact}</p>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-3 px-5 pb-5 ${sections.length > 3 ? "md:grid-cols-2" : ""}`}>
        {sections.map((section: any, index: number) => (
          <section key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055]">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${accent}20` }}>{section.icon || "📌"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Bloque {String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-0.5 text-sm font-bold text-white">{section.heading || `Sección ${index + 1}`}</h2>
              </div>
            </div>
            <div className="p-4">
              {(section.stat?.value || section.stat?.label) && (
                <div className="mb-3 rounded-xl px-3 py-3 text-center" style={{ background: `${accent}16` }}>
                  <p className="text-2xl font-black" style={{ color: accent }}>{section.stat?.value}</p>
                  {section.stat?.label && <p className="mt-1 text-[10px] text-slate-400">{section.stat.label}</p>}
                </div>
              )}
              <ul className="space-y-2">
                {(section.points || []).map((point: string, pointIndex: number) => (
                  <li key={pointIndex} className="flex gap-2 text-xs leading-relaxed text-slate-300"><span className="mt-0.5 font-black" style={{ color: accent }}>▸</span><span>{point}</span></li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {data?.conclusion && (
        <div className="mx-5 mb-5 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 text-center">
          <p className="text-xs italic leading-relaxed text-slate-300">📝 {data.conclusion}</p>
        </div>
      )}

      <footer className="flex items-center justify-between px-5 pb-4 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
        <span>EduAI Creator Studio</span>
        <span>{new Date().toLocaleDateString("es-CL")}</span>
      </footer>
    </article>
  )
}

const PRESENTATION_THEMES: Record<string, { bg: string; accent: string; text: string; sub: string; card: string }> = {
  academic: { bg: "linear-gradient(145deg,#08162a,#122849)", accent: "#60a5fa", text: "#f8fafc", sub: "#bfdbfe", card: "rgba(96,165,250,0.13)" },
  corporate: { bg: "linear-gradient(145deg,#06141c,#0b2532)", accent: "#22d3ee", text: "#ecfeff", sub: "#a5f3fc", card: "rgba(34,211,238,0.12)" },
  minimal: { bg: "linear-gradient(145deg,#18181b,#2a2a2e)", accent: "#e4e4e7", text: "#fafafa", sub: "#d4d4d8", card: "rgba(228,228,231,0.09)" },
  creative: { bg: "linear-gradient(145deg,#25103f,#172554)", accent: "#c084fc", text: "#faf5ff", sub: "#e9d5ff", card: "rgba(192,132,252,0.13)" },
  dark: { bg: "linear-gradient(145deg,#020617,#111827)", accent: "#34d399", text: "#f0fdf4", sub: "#a7f3d0", card: "rgba(52,211,153,0.11)" },
}

export function EditablePresentationSlidePreview({ data, index }: { data: any; index: number }) {
  const slides = Array.isArray(data?.slides) ? data.slides : []
  const slide = slides[index]
  if (!slide) return <div className="flex aspect-video items-center justify-center rounded-2xl border border-soft text-sm text-muted2">No hay diapositivas</div>

  const theme = PRESENTATION_THEMES[data?.theme] || PRESENTATION_THEMES.academic
  const isTitle = index === 0 || slide.type === "title"
  const isQuote = slide.type === "quote"
  const isStats = slide.type === "stats"
  const isSplit = slide.layout === "two-column" && (slide.bullets?.length || 0) >= 4

  return (
    <article className="relative flex aspect-video min-h-[360px] flex-col overflow-hidden rounded-3xl border border-white/10" style={{ background: theme.bg }}>
      <div className="absolute left-0 top-0 h-1.5 w-full" style={{ background: `linear-gradient(90deg,${theme.accent},${theme.accent}30)` }} />
      {!isTitle && <div className="absolute bottom-0 left-0 top-0 w-1.5 opacity-70" style={{ background: theme.accent }} />}
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: `radial-gradient(ellipse at 85% 10%,${theme.accent},transparent 48%)` }} />
      <div className="absolute bottom-5 right-7 select-none text-7xl font-black opacity-[0.06]" style={{ color: theme.accent }}>{index + 1}</div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-12 py-9">
        {isTitle ? (
          <div className="text-center">
            <div className="mx-auto mb-6 h-1 w-20 rounded-full" style={{ background: theme.accent }} />
            <h1 className="text-3xl font-black leading-tight" style={{ color: theme.text }}>{slide.title}</h1>
            {slide.subtitle && <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed" style={{ color: theme.sub }}>{slide.subtitle}</p>}
            {data?.author && <p className="mt-7 text-xs font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{data.author}</p>}
          </div>
        ) : isQuote ? (
          <div className="px-8 text-center">
            <div className="text-7xl font-serif leading-none opacity-20" style={{ color: theme.accent }}>“</div>
            <p className="text-2xl font-semibold italic leading-relaxed" style={{ color: theme.text }}>{slide.title}</p>
            {slide.notes && <p className="mt-5 text-sm" style={{ color: theme.sub }}>— {slide.notes}</p>}
          </div>
        ) : isStats ? (
          <div>
            <div className="mb-6 flex items-center gap-3"><div className="h-7 w-1.5 rounded-full" style={{ background: theme.accent }} /><h2 className="text-xl font-black" style={{ color: theme.text }}>{slide.title}</h2></div>
            <div className="grid grid-cols-3 gap-4">
              {(slide.bullets || []).slice(0, 6).map((bullet: string, bulletIndex: number) => {
                const [value, ...rest] = bullet.split(" — ")
                return <div key={bulletIndex} className="rounded-2xl border border-white/10 p-4 text-center" style={{ background: theme.card }}><p className="text-2xl font-black" style={{ color: theme.accent }}>{value}</p><p className="mt-2 text-xs leading-relaxed" style={{ color: theme.sub }}>{rest.join(" — ")}</p></div>
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 flex items-center gap-3"><div className="h-7 w-1.5 rounded-full" style={{ background: theme.accent }} /><h2 className="text-xl font-black" style={{ color: theme.text }}>{slide.title}</h2></div>
            {slide.subtitle && <p className="mb-4 text-sm" style={{ color: theme.sub }}>{slide.subtitle}</p>}
            <div className={isSplit ? "grid grid-cols-2 gap-x-8 gap-y-3" : "space-y-3"}>
              {(slide.bullets || []).map((bullet: string, bulletIndex: number) => (
                <div key={bulletIndex} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ background: theme.card, color: theme.accent }}>{bulletIndex + 1}</span>
                  <p className="text-sm leading-relaxed" style={{ color: theme.sub }}>{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="relative z-10 flex items-center justify-between px-7 pb-5 text-[10px] font-bold uppercase tracking-widest" style={{ color: `${theme.sub}99` }}>
        <span>{data?.title || "Presentación EduAI"}</span>
        <span>{index + 1} / {slides.length}</span>
      </footer>
    </article>
  )
}
