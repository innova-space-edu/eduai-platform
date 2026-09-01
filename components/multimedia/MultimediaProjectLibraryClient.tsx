"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Film, FolderOpen, HardDrive, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteMultimediaProject,
  listMultimediaProjectFolders,
  listSavedMultimediaProjects,
  loadMultimediaProject,
  saveMultimediaProject,
  type MultimediaProjectFolder,
  type SavedProjectSummary,
} from "@/lib/multimedia/project-store";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export default function MultimediaProjectLibraryClient() {
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [folders, setFolders] = useState<MultimediaProjectFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("Tus proyectos guardados aparecen aquí. Con sesión iniciada, la biblioteca se sincroniza con EDUAI.");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProjects, nextFolders] = await Promise.all([
        listSavedMultimediaProjects(),
        listMultimediaProjectFolders(),
      ]);
      setProjects(nextProjects);
      setFolders(nextFolders);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => projects.filter((project) => {
    if (folderFilter === "all") return true;
    if (folderFilter === "root") return !project.folderId;
    return project.folderId === folderFilter;
  }), [folderFilter, projects]);

  async function removeProject(project: SavedProjectSummary) {
    if (!window.confirm(`¿Eliminar “${project.title}”? También se eliminará su copia sincronizada y sus archivos guardados.`)) return;
    setBusyId(project.id);
    try {
      await deleteMultimediaProject(project.id);
      setMessage(`“${project.title}” fue eliminado.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el proyecto.");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateProject(project: SavedProjectSummary) {
    setBusyId(project.id);
    try {
      const restored = await loadMultimediaProject(project.id);
      const now = new Date().toISOString();
      const clone = {
        ...restored.project,
        id: `media-${Date.now().toString(36)}`,
        title: `${restored.project.title} · copia`,
        createdAt: now,
        updatedAt: now,
      };
      await saveMultimediaProject(clone, restored.assets, null, restored.folderId);
      setMessage(`Se creó una copia de “${project.title}”.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo duplicar el proyecto.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100">
      <header className="border-b border-white/10 bg-[#070b18]/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Link href="/multimedia-studio" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10" title="Volver al editor"><ArrowLeft size={18} /></Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600"><Film size={19} /></div>
          <div className="min-w-[220px] flex-1">
            <h1 className="text-base font-semibold">Mis proyectos multimedia</h1>
            <p className="text-xs text-slate-400">Audio, video y proyectos mixtos guardados en EDUAI.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"><RefreshCw size={14} className={`mr-1 inline ${loading ? "animate-spin" : ""}`} />Actualizar</button>
          <Link href="/multimedia-studio" className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold hover:bg-cyan-500">+ Nuevo proyecto</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-6">
        <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold">Biblioteca EDUAI</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">La copia local protege el trabajo en este navegador. Cuando has iniciado sesión, el proyecto y sus recursos se sincronizan con Supabase para poder abrirlos desde otra página o equipo.</p>
          </div>
          <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-xs">
            <option value="all">Todas las carpetas</option>
            <option value="root">Sin carpeta</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </section>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">{message}</div>

        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">Cargando proyectos…</div>
        ) : filtered.length ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => {
              const folder = folders.find((item) => item.id === project.folderId);
              const isBusy = busyId === project.id;
              return (
                <article key={project.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-xl shadow-black/10">
                  <Link href={`/multimedia-studio?project=${encodeURIComponent(project.id)}`} className="flex aspect-video items-center justify-center border-b border-white/10 bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-transparent hover:from-cyan-500/15">
                    <Film size={42} className="text-cyan-300/80" />
                  </Link>
                  <div className="space-y-3 p-4">
                    <div>
                      <Link href={`/multimedia-studio?project=${encodeURIComponent(project.id)}`} className="block truncate text-sm font-semibold hover:text-cyan-200">{project.title}</Link>
                      <p className="mt-1 text-[10px] text-slate-500">Actualizado {formatDate(project.updatedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1"><HardDrive size={10} className="mr-1 inline" />{project.storage === "cloud" ? "Nube EDUAI" : "Local"}</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{project.assetCount} recursos</span>
                      {folder && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1"><FolderOpen size={10} className="mr-1 inline" />{folder.name}</span>}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                      <Link href={`/multimedia-studio?project=${encodeURIComponent(project.id)}`} className="rounded-lg bg-cyan-600/20 px-3 py-2 text-center text-xs font-semibold text-cyan-100 hover:bg-cyan-600/30"><FolderOpen size={13} className="mr-1 inline" />Abrir</Link>
                      <button disabled={isBusy} title="Duplicar" onClick={() => void duplicateProject(project)} className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 disabled:opacity-40"><Copy size={14} /></button>
                      <button disabled={isBusy} title="Eliminar" onClick={() => void removeProject(project)} className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
            <Film size={40} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No hay proyectos en esta vista</p>
            <p className="mt-1 text-xs text-slate-500">Crea uno nuevo o cambia el filtro de carpeta.</p>
            <Link href="/multimedia-studio" className="mt-4 inline-block rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold">Abrir editor multimedia</Link>
          </section>
        )}
      </div>
    </main>
  );
}
