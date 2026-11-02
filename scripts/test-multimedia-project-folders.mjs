import "./apply-multimedia-project-library.mjs";
import fs from "node:fs";

const client = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");
const store = fs.readFileSync("lib/multimedia/project-store.ts", "utf8");
const library = fs.readFileSync("components/multimedia/MultimediaProjectLibraryClient.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/202609010001_multimedia_project_cloud_library.sql", "utf8");
function need(source, text, label) { if (!source.includes(text)) throw new Error(`[multimedia-folders] Falta ${label}`); }

need(store, 'const DB_VERSION = 2', 'IndexedDB v2');
need(store, 'const FOLDER_STORE = "folders"', 'store de carpetas');
need(store, 'createMultimediaProjectFolder', 'crear carpetas');
need(store, 'moveMultimediaProjectToFolder', 'mover proyectos');
need(store, 'previous?.blob', 'cache de archivos para autoguardado');
need(store, 'from("multimedia_projects")', 'sincronización de proyectos en Supabase');
need(store, 'CLOUD_BUCKET = "multimedia-projects"', 'bucket multimedia');
need(client, 'const [savedFolders', 'estado de carpetas');
need(client, 'const [autoSaveEnabled', 'autoguardado');
need(client, 'Carpeta del proyecto', 'selector de carpeta');
need(client, 'Borrar todos', 'borrado masivo');
need(client, 'MP3 · solo audio', 'MP3 en selector superior');
need(client, 'WAV · solo audio', 'WAV en selector superior');
need(client, 'removeAsset(asset)', 'eliminación de archivos del panel');
need(client, '/multimedia-studio/projects', 'enlace a biblioteca');
need(client, 'URLSearchParams(window.location.search)', 'apertura de proyecto por URL');
need(library, 'Mis proyectos multimedia', 'página de biblioteca');
need(library, 'duplicateProject', 'duplicación de proyectos');
need(migration, 'create table if not exists public.multimedia_projects', 'tabla cloud');
need(migration, "'multimedia-projects'", 'storage cloud');
console.log('[multimedia-folders] OK · carpetas, MP3/WAV, borrado, biblioteca, nube y autoguardado');

const exporter = fs.readFileSync("lib/multimedia/export-media.ts", "utf8");
need(store, "protectMultimediaDraft", "respaldo no destructivo del borrador");
need(store, "listMultimediaDraftRecovery", "lista de snapshots recuperables");
need(store, "if (local && (local.project.updatedAt ||", "recuperar copia local más reciente");
need(store, "const browserCopy = localById.get(rawAsset.id)", "recuperar blobs locales cuando falla la nube");
need(store, "let localSaveError: unknown = null;", "guardar en nube aun si navegador alcanza la cuota");
need(client, "if (!draftHydrated) return;", "no sobreescribir borrador antes de hidratar");
need(client, "restoreRecoverySnapshot", "abrir snapshots recuperables");
need(client, "workingAssets", "enlace multiparchivo coherente");
need(client, "Solo navegador (nube pendiente)", "informar el guardado exclusivamente local");
need(exporter, "No se puede exportar todavía: falta volver a enlazar", "bloquear exportación incompleta");
need(exporter, "blob.size < 1024", "detectar exportación vacía");
console.log("[multimedia-folders] Rescate local/cloud, borradores y exportación verificados");

need(client, "getActiveSavedMultimediaProjectPointer", "reapertura tras actualizar página");
need(client, "setExportMaxDimension", "selector de exportación segura 1080p");
need(client, "maxDimension: exportMaxDimension", "renderización adaptativa de exportación");
need(store, "export function getActiveSavedMultimediaProjectPointer", "recuperar puntero activo sin modificar datos");
need(exporter, "const scale = Math.min(1, maxDimension", "reducción de lienzo 4K en exportación");
need(exporter, "Conversion.init", "conversión real de WebM a MP4 mediante Mediabunny");
console.log("[multimedia-export-recovery] OK · reapertura de proyecto, Full HD y conversión MP4");


need(client, "async function newMultimediaProject()", "botón y flujo de proyecto nuevo");
need(client, "id: `media-${crypto.randomUUID()}`", "identidad independiente de cada proyecto");
need(client, "const created = await persistProjectSnapshot(next, [], null, null)", "guardar proyecto nuevo inmediatamente");
need(client, "const old = await persistProjectSnapshot(previous, previousAssets", "guardar anterior antes de cambiar");
need(client, "window.history.replaceState", "eliminar referencia URL al proyecto anterior");
need(client, "async function runLockedExport(", "bloqueo de exportación único");
need(client, "const saved = await persistProjectSnapshot(snapshot, media", "guardado obligatorio antes de exportar");
need(client, "pendingSaveRef.current.catch(", "guardado serializado ante autoguardado");
need(client, "const filename = `${safeFilename(snapshot.title)}", "archivos exportados separados");
need(client, "inert={exporting ? true : undefined}", "inhabilitar edición durante exportación");
need(client, "aria-modal=\"true\"", "indicador accesible exportando");
need(client, "if (exportingRef.current || creatingProjectRef.current)", "bloqueo de operaciones durante exportación");
need(client, "window.addEventListener(\"beforeunload\", confirmUnload)", "protección de recarga durante exportación");
console.log("[multimedia-export-isolation] OK · proyectos individuales y bloqueo de edición");
