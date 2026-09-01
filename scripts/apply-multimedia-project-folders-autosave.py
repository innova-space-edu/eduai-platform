from pathlib import Path
import json

client_path = Path("components/multimedia/MultimediaStudioV3Client.tsx")
store_path = Path("lib/multimedia/project-store.ts")
package_path = Path("package.json")

client = client_path.read_text()


def replace_once(source: str, before: str, after: str, label: str) -> str:
    if before not in source:
        raise RuntimeError(f"[multimedia-folders] No se encontró {label}")
    return source.replace(before, after, 1)


client = replace_once(client, '''import {
  deleteMultimediaProject,
  listSavedMultimediaProjects,
  loadMultimediaProject,
  saveMultimediaProject,
  type SavedProjectSummary,
} from "@/lib/multimedia/project-store";''', '''import {
  clearMultimediaProjects,
  createMultimediaProjectFolder,
  deleteMultimediaProject,
  deleteMultimediaProjectFolder,
  listMultimediaProjectFolders,
  listSavedMultimediaProjects,
  loadMultimediaProject,
  moveMultimediaProjectToFolder,
  saveMultimediaProject,
  type MultimediaProjectFolder,
  type SavedProjectSummary,
} from "@/lib/multimedia/project-store";''', "imports de proyectos")

client = replace_once(client, '''  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);''', '''  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [savedFolders, setSavedFolders] = useState<MultimediaProjectFolder[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState("Guarda una vez para activar el autoguardado.");
  const [extractingAudio, setExtractingAudio] = useState(false);''', "estado de carpetas")

client = replace_once(client, '''  const rafRef = useRef<number | null>(null);
  const playbackAnchor = useRef({ playhead: 0, time: 0 });''', '''  const rafRef = useRef<number | null>(null);
  const autosaveBusyRef = useRef(false);
  const playbackAnchor = useRef({ playhead: 0, time: 0 });''', "ref de autoguardado")

client = replace_once(client, '''  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { void refreshSavedProjects(); }, []);''', '''  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { void refreshSavedProjects(); }, []);

  useEffect(() => {
    if (!savedProjectId) {
      setAutoSaveStatus("Guarda una vez para activar el autoguardado.");
      return;
    }
    if (!autoSaveEnabled) {
      setAutoSaveStatus("Autoguardado pausado.");
      return;
    }

    setAutoSaveStatus("Cambios pendientes…");
    const timer = window.setTimeout(async () => {
      if (autosaveBusyRef.current) return;
      autosaveBusyRef.current = true;
      try {
        const saved = await saveMultimediaProject(projectRef.current, assetsRef.current, savedProjectId, currentFolderId);
        setSavedProjects((current) => {
          const next = current.some((item) => item.id === saved.id)
            ? current.map((item) => item.id === saved.id ? saved : item)
            : [saved, ...current];
          return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        });
        setAutoSaveStatus(`Guardado automático · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } catch (error) {
        setAutoSaveStatus(error instanceof Error ? `Autoguardado: ${error.message}` : "No se pudo autoguardar.");
      } finally {
        autosaveBusyRef.current = false;
      }
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [project, assets, savedProjectId, currentFolderId, autoSaveEnabled]);''', "autoguardado")

client = replace_once(client, '''      setSavedProjectId(null);
      setSelectedClipId(null);''', '''      setSavedProjectId(null);
      setCurrentFolderId(null);
      setAutoSaveStatus("Guarda una vez para activar el autoguardado.");
      setSelectedClipId(null);''', "reset de proyecto")

start = client.find("  async function refreshSavedProjects() {")
end = client.find("  async function separateSelectedVideoAudio() {", start)
if start < 0 or end < 0:
    raise RuntimeError("[multimedia-folders] No se encontró la gestión de proyectos")

project_functions = '''  async function refreshSavedProjects() {
    try {
      const [projects, folders] = await Promise.all([
        listSavedMultimediaProjects(),
        listMultimediaProjectFolders(),
      ]);
      setSavedProjects(projects);
      setSavedFolders(folders);
    } catch {
      setSavedProjects([]);
      setSavedFolders([]);
    }
  }

  async function saveProjectHere() {
    if (autosaveBusyRef.current) return;
    autosaveBusyRef.current = true;
    setSavingProject(true);
    setNotice("Guardando proyecto y archivos multimedia en EDUAI…");
    try {
      const saved = await saveMultimediaProject(projectRef.current, assetsRef.current, savedProjectId, currentFolderId);
      setSavedProjectId(saved.id);
      setCurrentFolderId(saved.folderId);
      await refreshSavedProjects();
      setAutoSaveStatus(`Guardado · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      setNotice("Proyecto guardado. Los cambios siguientes se guardarán automáticamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el proyecto en este navegador.");
    } finally {
      autosaveBusyRef.current = false;
      setSavingProject(false);
    }
  }

  async function openSavedProject(id: string) {
    setPlaying(false);
    try {
      const restored = await loadMultimediaProject(id);
      assetsRef.current.forEach((asset) => {
        if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
      });
      const nextProject = normalizeProject(restored.project);
      const nextAssets = restored.assets as StudioAsset[];
      projectRef.current = nextProject;
      assetsRef.current = nextAssets;
      setProject(nextProject);
      setAssets(nextAssets);
      setSavedProjectId(restored.id);
      setCurrentFolderId(restored.folderId);
      setSelectedClipId(null);
      setPlayhead(0);
      setUndoStack([]);
      setRedoStack([]);
      setAutoSaveStatus("Autoguardado activo.");
      setNotice(nextAssets.some((asset) => asset.missing)
        ? "Proyecto abierto. Algún recurso ya no está disponible."
        : "Proyecto abierto con sus archivos multimedia.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el proyecto guardado.");
    }
  }

  async function removeSavedProject(id: string) {
    if (!window.confirm("¿Eliminar este proyecto guardado? Esta acción no se puede deshacer.")) return;
    try {
      await deleteMultimediaProject(id);
      if (savedProjectId === id) {
        setSavedProjectId(null);
        setCurrentFolderId(null);
        setAutoSaveStatus("Guarda una vez para activar el autoguardado.");
      }
      await refreshSavedProjects();
      setNotice("Proyecto eliminado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar el proyecto.");
    }
  }

  async function createProjectFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await createMultimediaProjectFolder(name);
      setNewFolderName("");
      setCurrentFolderId(folder.id);
      setFolderFilter(folder.id);
      await refreshSavedProjects();
      setNotice(`Carpeta “${folder.name}” creada.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear la carpeta.");
    }
  }

  async function removeProjectFolder(folder: MultimediaProjectFolder) {
    if (!window.confirm(`¿Eliminar la carpeta “${folder.name}”? Sus proyectos pasarán a “Sin carpeta”.`)) return;
    try {
      await deleteMultimediaProjectFolder(folder.id);
      if (currentFolderId === folder.id) setCurrentFolderId(null);
      if (folderFilter === folder.id) setFolderFilter("all");
      await refreshSavedProjects();
      setNotice("Carpeta eliminada. Los proyectos se conservaron sin carpeta.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar la carpeta.");
    }
  }

  async function moveSavedProject(id: string, folderId: string | null) {
    try {
      await moveMultimediaProjectToFolder(id, folderId);
      if (savedProjectId === id) setCurrentFolderId(folderId);
      await refreshSavedProjects();
      setNotice("Proyecto movido de carpeta.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo mover el proyecto.");
    }
  }

  async function clearSavedProjects() {
    if (!savedProjects.length) return;
    if (!window.confirm(`¿Borrar los ${savedProjects.length} proyectos guardados? Las carpetas se conservarán.`)) return;
    try {
      await clearMultimediaProjects();
      setSavedProjectId(null);
      setCurrentFolderId(null);
      setAutoSaveStatus("Guarda una vez para activar el autoguardado.");
      await refreshSavedProjects();
      setNotice("Se borraron todos los proyectos guardados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudieron borrar los proyectos.");
    }
  }

'''
client = client[:start] + project_functions + client[end:]

ui_start = client.find('            <button disabled={savingProject} onClick={saveProjectHere}')
ui_end = client.find('            <div className="grid grid-cols-2 gap-2"><button onClick={() => downloadProject', ui_start)
if ui_start < 0 or ui_end < 0:
    raise RuntimeError("[multimedia-folders] No se encontró el panel Proyecto")

project_ui = '''            <div className="space-y-2 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-2.5">
              <label className="block text-[10px] text-slate-300">Carpeta del proyecto<select value={currentFolderId || ""} onChange={(event) => setCurrentFolderId(event.target.value || null)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-2 text-[10px]"><option value="">Sin carpeta</option>{savedFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
              <div className="flex gap-1"><input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createProjectFolder(); }} placeholder="Nueva carpeta" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] outline-none" /><button onClick={() => void createProjectFolder()} disabled={!newFolderName.trim()} className="rounded-lg bg-cyan-500/15 px-2 text-[10px] text-cyan-100 disabled:opacity-40">Crear</button></div>
            </div>
            <button disabled={savingProject} onClick={saveProjectHere} className="w-full rounded-xl border border-cyan-400/25 bg-cyan-500/15 p-3 font-semibold text-cyan-100 disabled:opacity-50"><Save size={14} className="mr-1 inline" />{savingProject ? "Guardando…" : savedProjectId ? "Guardar ahora" : "Guardar en EDUAI"}</button>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><label className="flex items-center justify-between gap-2 text-[10px]"><span><b className="text-slate-200">Autoguardado</b><span className="mt-0.5 block text-[9px] text-slate-500">{autoSaveStatus}</span></span><input type="checkbox" checked={autoSaveEnabled} onChange={(event) => setAutoSaveEnabled(event.target.checked)} className="h-4 w-4 accent-cyan-500" /></label></div>
            <p className="text-[9px] leading-4 text-slate-500">Después del primer guardado, cada edición se actualiza automáticamente en este navegador.</p>

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-slate-200">Mis proyectos · {savedProjects.length}</span><div className="flex gap-2"><button onClick={() => void refreshSavedProjects()} className="text-[9px] text-cyan-300">Actualizar</button>{savedProjects.length > 0 && <button onClick={() => void clearSavedProjects()} className="text-[9px] text-rose-300">Borrar todos</button>}</div></div>
              <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1.5 text-[10px]"><option value="all">Todas las carpetas</option><option value="root">Sin carpeta</option>{savedFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
              {savedFolders.length > 0 && <div className="space-y-1 border-b border-white/5 pb-2"><p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Carpetas</p>{savedFolders.map((folder) => <div key={folder.id} className="flex items-center gap-1 rounded-lg bg-white/[0.025] p-1"><button onClick={() => setFolderFilter(folder.id)} className="min-w-0 flex-1 truncate text-left text-[9px] text-slate-300"><FolderOpen size={10} className="mr-1 inline text-cyan-300" />{folder.name} · {savedProjects.filter((item) => item.folderId === folder.id).length}</button><button title="Eliminar carpeta" onClick={() => void removeProjectFolder(folder)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10"><Trash2 size={10} /></button></div>)}</div>}
              <div className="space-y-1">{savedProjects.filter((saved) => folderFilter === "all" ? true : folderFilter === "root" ? !saved.folderId : saved.folderId === folderFilter).map((saved) => <div key={saved.id} className={`rounded-lg border p-1.5 ${savedProjectId === saved.id ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/5 bg-white/[0.02]"}`}><div className="flex items-center gap-1"><button onClick={() => void openSavedProject(saved.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[10px] text-slate-200">{saved.title}</span><span className="block text-[8px] text-slate-500">{new Date(saved.updatedAt).toLocaleString()} · {saved.assetCount} recursos</span></button><button title="Abrir proyecto" onClick={() => void openSavedProject(saved.id)} className="rounded p-1 text-cyan-300 hover:bg-white/10"><FolderOpen size={12} /></button><button title="Eliminar proyecto" onClick={() => void removeSavedProject(saved.id)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10"><Trash2 size={12} /></button></div><select value={saved.folderId || ""} onChange={(event) => void moveSavedProject(saved.id, event.target.value || null)} className="mt-1 w-full rounded border border-white/5 bg-[#0b1020] px-1.5 py-1 text-[8px] text-slate-400"><option value="">Sin carpeta</option>{savedFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>)}</div>
              {savedProjects.length === 0 && <p className="py-3 text-center text-[9px] text-slate-500">Aún no hay proyectos guardados.</p>}
            </div>
'''
client = client[:ui_start] + project_ui + client[ui_end:]
client_path.write_text(client)

store_path.write_text('''import type { MediaAsset, MultimediaProject } from "./types";

const DB_NAME = "eduai-multimedia-projects";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const FOLDER_STORE = "folders";

export type PersistableStudioAsset = MediaAsset & {
  mime?: string;
  extension?: string;
  compatibility?: unknown;
  normalizedMime?: boolean;
  downloadUrl?: string;
  width?: number;
  height?: number;
};

type StoredAsset = Omit<PersistableStudioAsset, "url"> & { url: string; blob?: Blob };
type SavedProjectRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  project: MultimediaProject;
  assets: StoredAsset[];
};

export type SavedProjectSummary = Pick<SavedProjectRecord, "id" | "title" | "createdAt" | "updatedAt" | "folderId"> & { assetCount: number };
export type MultimediaProjectFolder = { id: string; name: string; createdAt: string; updatedAt: string };
export type RestoredProject = { id: string; folderId: string | null; project: MultimediaProject; assets: PersistableStudioAsset[] };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento de proyectos."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(FOLDER_STORE)) {
        const store = database.createObjectStore(FOLDER_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error || new Error("La operación de almacenamiento falló."));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo completar la operación."));
    transaction.onabort = () => reject(transaction.error || new Error("La operación fue cancelada."));
  });
}

async function assetToStored(asset: PersistableStudioAsset, previous?: StoredAsset): Promise<StoredAsset> {
  let blob: Blob | undefined = previous?.blob;
  if (asset.local && asset.url && !blob) {
    try {
      const response = await fetch(asset.url);
      if (response.ok) blob = await response.blob();
    } catch {
      blob = undefined;
    }
  }
  return { ...asset, url: asset.local ? "" : asset.url, missing: asset.local ? !blob : Boolean(asset.missing), blob };
}

export async function listSavedMultimediaProjects(): Promise<SavedProjectSummary[]> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    return records.map((record) => ({ id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt, folderId: record.folderId || null, assetCount: record.assets.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally { database.close(); }
}

export async function listMultimediaProjectFolders(): Promise<MultimediaProjectFolder[]> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(FOLDER_STORE, "readonly");
    const folders = await requestResult(tx.objectStore(FOLDER_STORE).getAll()) as MultimediaProjectFolder[];
    return folders.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  } finally { database.close(); }
}

export async function createMultimediaProjectFolder(name: string) {
  const clean = name.trim().replace(/\\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("Escribe un nombre para la carpeta.");
  const database = await openDatabase();
  try {
    const now = new Date().toISOString();
    const folder: MultimediaProjectFolder = { id: `folder-${crypto.randomUUID()}`, name: clean, createdAt: now, updatedAt: now };
    const tx = database.transaction(FOLDER_STORE, "readwrite");
    tx.objectStore(FOLDER_STORE).put(folder);
    await transactionDone(tx);
    return folder;
  } finally { database.close(); }
}

export async function deleteMultimediaProjectFolder(id: string) {
  const database = await openDatabase();
  try {
    const tx = database.transaction([FOLDER_STORE, STORE_NAME], "readwrite");
    tx.objectStore(FOLDER_STORE).delete(id);
    const projects = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    for (const project of projects) if (project.folderId === id) tx.objectStore(STORE_NAME).put({ ...project, folderId: null, updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function saveMultimediaProject(project: MultimediaProject, assets: PersistableStudioAsset[], existingId?: string | null, folderId?: string | null): Promise<SavedProjectSummary> {
  const database = await openDatabase();
  try {
    const id = existingId || `saved-${crypto.randomUUID()}`;
    let existing: SavedProjectRecord | undefined;
    if (existingId) {
      const read = database.transaction(STORE_NAME, "readonly");
      existing = await requestResult(read.objectStore(STORE_NAME).get(existingId)) as SavedProjectRecord | undefined;
    }
    const now = new Date().toISOString();
    const previousAssets = new Map((existing?.assets || []).map((asset) => [asset.id, asset]));
    const storedAssets = await Promise.all(assets.map((asset) => assetToStored(asset, previousAssets.get(asset.id))));
    const record: SavedProjectRecord = { id, title: project.title || "Proyecto multimedia", createdAt: existing?.createdAt || now, updatedAt: now, folderId: folderId === undefined ? existing?.folderId || null : folderId, project: { ...project, updatedAt: now }, assets: storedAssets };
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await transactionDone(tx);
    return { id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt, folderId: record.folderId, assetCount: record.assets.length };
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") throw new Error("No hay espacio suficiente en este navegador para guardar el proyecto con sus archivos multimedia.");
    throw error;
  } finally { database.close(); }
}

export async function moveMultimediaProjectToFolder(id: string, folderId: string | null) {
  const database = await openDatabase();
  try {
    const read = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(read.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    if (!record) throw new Error("El proyecto guardado ya no existe.");
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...record, folderId, updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function loadMultimediaProject(id: string): Promise<RestoredProject> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(tx.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    if (!record) throw new Error("El proyecto guardado ya no existe.");
    const assets = record.assets.map((asset) => {
      const { blob, ...stored } = asset;
      if (stored.local && blob) return { ...stored, url: URL.createObjectURL(blob), missing: false } as PersistableStudioAsset;
      return { ...stored, missing: Boolean(stored.local) || Boolean(stored.missing) } as PersistableStudioAsset;
    });
    return { id: record.id, folderId: record.folderId || null, project: structuredClone(record.project), assets };
  } finally { database.close(); }
}

export async function deleteMultimediaProject(id: string) {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function clearMultimediaProjects() {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await transactionDone(tx);
  } finally { database.close(); }
}
''')

Path("scripts/test-multimedia-project-folders.mjs").write_text('''import fs from "node:fs";\nconst client = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");\nconst store = fs.readFileSync("lib/multimedia/project-store.ts", "utf8");\nfunction need(source, text, label) { if (!source.includes(text)) throw new Error(`[multimedia-folders] Falta ${label}`); }\nneed(store, 'const DB_VERSION = 2', 'IndexedDB v2');\nneed(store, 'const FOLDER_STORE = "folders"', 'store de carpetas');\nneed(store, 'createMultimediaProjectFolder', 'crear carpetas');\nneed(store, 'moveMultimediaProjectToFolder', 'mover proyectos');\nneed(store, 'previous?.blob', 'cache de archivos para autoguardado');\nneed(client, 'const [savedFolders', 'estado de carpetas');\nneed(client, 'const [autoSaveEnabled', 'autoguardado');\nneed(client, 'Carpeta del proyecto', 'selector de carpeta');\nneed(client, 'Borrar todos', 'borrado masivo');\nconsole.log('[multimedia-folders] OK · carpetas, borrado y autoguardado');\n''')

pkg = json.loads(package_path.read_text())
if "test-multimedia-project-folders.mjs" not in pkg["scripts"]["prebuild"]:
    pkg["scripts"]["prebuild"] += " && node scripts/test-multimedia-project-folders.mjs"
package_path.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + "\n")

print("[multimedia-folders] Materialización completada")
