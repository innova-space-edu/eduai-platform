import fs from "node:fs";

const path = "components/multimedia/MultimediaStudioV3Client.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-url-importer] No se encontró ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import AudioWaveformCanvas from "@/components/multimedia/AudioWaveformCanvas";\n',
  'import AudioWaveformCanvas from "@/components/multimedia/AudioWaveformCanvas";\nimport UrlMediaImporter, { type ImportedUrlMedia } from "@/components/multimedia/UrlMediaImporter";\n',
  "import del URL importer",
);

replaceOnce(
  'type Tab = "files" | "videos" | "gallery" | "music" | "text" | "project";\n',
  'type Tab = "files" | "url" | "videos" | "gallery" | "music" | "text" | "project";\n',
  "tipo Tab",
);

replaceOnce(
  '  async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {\n    event.preventDefault();\n    const files = Array.from(event.dataTransfer.files || []);\n    if (files.length) await createAssetsFromFiles(files);\n  }\n',
  '  async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {\n    event.preventDefault();\n    const files = Array.from(event.dataTransfer.files || []);\n    if (files.length) await createAssetsFromFiles(files);\n  }\n\n  function importUrlMedia(media: ImportedUrlMedia) {\n    const asset: StudioAsset = {\n      id: uid("asset-url"),\n      name: media.name,\n      kind: media.kind,\n      url: media.url,\n      downloadUrl: media.downloadUrl,\n      duration: Math.max(0.05, media.duration || 10),\n      source: "url",\n      exportable: true,\n      local: false,\n      missing: false,\n      mime: media.mime,\n      extension: media.extension,\n      compatibility: "native",\n    };\n    assetsRef.current = [...assetsRef.current, asset];\n    setAssets((current) => [...current, asset]);\n    setTab("files");\n    setNotice(`${asset.name} importado desde URL. Usa + para agregarlo a la línea de tiempo.`);\n  }\n',
  "función de importación URL",
);

replaceOnce(
  '<div className="mb-3 grid grid-cols-6 gap-1 rounded-xl bg-black/20 p-1">',
  '<div className="mb-3 grid grid-cols-7 gap-1 rounded-xl bg-black/20 p-1">',
  "rejilla de pestañas",
);

replaceOnce(
  '              ["files", FolderOpen, "Archivos"],\n              ["videos", Video, "Videos"],',
  '              ["files", FolderOpen, "Archivos"],\n              ["url", Link2, "Importar URL"],\n              ["videos", Video, "Videos"],',
  "pestaña Importar URL",
);

replaceOnce(
  '          {tab === "videos" && <div className="space-y-3">',
  '          {tab === "url" && <UrlMediaImporter onImport={importUrlMedia} onNotice={setNotice} />}\n\n          {tab === "videos" && <div className="space-y-3">',
  "panel URL importer",
);

if (!source.includes('  Link2,')) {
  replaceOnce(
    '  ImageIcon,\n',
    '  ImageIcon,\n  Link2,\n',
    "icono Link2",
  );
}

replaceOnce(
  'assets.filter((asset) => asset.source === "local" || asset.missing)',
  'assets.filter((asset) => asset.source === "local" || asset.source === "url" || asset.missing)',
  "lista de archivos importados",
);

replaceOnce(
  '!assets.some((asset) => asset.source === "local" || asset.missing)',
  '!assets.some((asset) => asset.source === "local" || asset.source === "url" || asset.missing)',
  "estado vacío de archivos",
);

fs.writeFileSync(path, source);
console.log("[multimedia-url-importer] OK · pestaña URL integrada al editor multimedia");
