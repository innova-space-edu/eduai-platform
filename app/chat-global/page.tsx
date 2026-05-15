"use client";

import Link from "next/link";
import SuperAgentChat from "@/components/superagent/SuperAgentChat";
import { EDUAI_SKILLS } from "@/lib/superagent/skills/skill-registry";

const AGENT_DOCK = [
  { name: "Exámenes", icon: "📝", href: "/examen/crear", desc: "Crear, adaptar y corregir" },
  { name: "Imagen", icon: "🖼️", href: "/image-studio", desc: "FLUX / prompts educativos" },
  { name: "Música", icon: "♫", href: "/music", desc: "Focus y playlists" },
  { name: "PDF/Paper", icon: "📄", href: "/paper", desc: "Conversar con fuentes" },
  { name: "Creator", icon: "🎨", href: "/creator-hub", desc: "Canva educativo" },
  { name: "Video", icon: "🎬", href: "/video-studio", desc: "Al final: proveedores reales" },
];

export default function ChatGlobalPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff,transparent_30%),#f8fafc] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[280px,1fr,310px]">
        <aside className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-xl text-white">🦅</div>
            <div>
              <p className="text-sm font-black">Chat Global Claw</p>
              <p className="text-xs text-slate-500">SuperAgent OS</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Link href="/agentes" className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold hover:bg-slate-100">← Volver a agentes</Link>
            <Link href="/superagent" className="block rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-800 hover:bg-violet-100">Centro SuperAgent</Link>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Agentes conectados</p>
            <div className="mt-3 space-y-2">
              {AGENT_DOCK.map((agent) => (
                <Link key={agent.name} href={agent.href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-violet-200 hover:bg-violet-50/60">
                  <span className="text-lg">{agent.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{agent.name}</span>
                    <span className="block truncate text-xs text-slate-500">{agent.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-32px)] flex-col rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-500">EduAI SuperAgent</p>
            <h1 className="text-2xl font-black tracking-tight">Pregunta de todo, como ChatGPT, pero conectado a EduAI</h1>
            <p className="mt-1 text-sm text-slate-500">Claw puede enrutar hacia exámenes, música, imágenes, papers, código, planificación, voz y video cuando esté listo.</p>
          </div>
          <div className="flex-1 p-4">
            <SuperAgentChat
              context={{ page: "chat-global" }}
              initialMessage="¡Hola! Soy **EduAI Claw** 🦅. Puedo ayudarte a crear exámenes, adaptar para PIE, generar material visual, recomendar música, revisar código o preparar una clase completa."
              placeholder="Escribe una tarea completa: crea, revisa, planifica, explica o conecta agentes…"
              maxHeight="calc(100vh - 280px)"
              showProviderInfo
            />
          </div>
        </section>

        <aside className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Skills rápidas</p>
          <div className="mt-3 space-y-2">
            {EDUAI_SKILLS.filter((skill) => skill.visibility !== "admin").map((skill) => (
              <div key={skill.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{skill.icon}</span>
                  <div>
                    <p className="text-sm font-black">{skill.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{skill.description}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skill.recommendedFor.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-black text-amber-900">Modo laboratorio admin</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">Los modelos experimentales o sin censura quedan fuera del chat global y solo se prueban en Admin Model Lab.</p>
            <Link href="/admin/model-lab" className="mt-2 inline-flex rounded-full bg-amber-500 px-3 py-1.5 text-xs font-black text-white">Ver política</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
