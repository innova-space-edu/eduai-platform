import assert from "node:assert/strict";
import fs from "node:fs";
import "./apply-multimedia-monitor-default-closed.mjs";
import "./apply-multimedia-url-importer.mjs";

const component = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");
const importer = fs.readFileSync("components/multimedia/UrlMediaImporter.tsx", "utf8");

assert.match(component, /function CompactAudioEqualizer/, "Debe incluir el ecualizador compacto para proyectos de audio");
assert.match(component, /hasVisualTimelineContent/, "Debe detectar contenido visual en la timeline");
assert.match(component, /hasAudioTimelineContent/, "Debe detectar contenido de audio en la timeline");
assert.match(component, /shouldShowVisualPreview\s*=\s*hasVisualTimelineContent/, "La vista visual solo debe abrirse cuando existe contenido visual");
assert.match(component, /isAudioOnlyMode\s*=\s*hasAudioTimelineContent\s*&&\s*!shouldShowVisualPreview/, "El modo solo audio debe activarse sin contenido visual");
assert.match(component, /isMonitorCollapsed\s*=\s*!shouldShowVisualPreview/, "El monitor debe iniciar y permanecer contraído mientras no haya contenido visual");
assert.match(component, /Monitor cerrado/, "El estado inicial debe mostrar el monitor cerrado");
assert.match(component, /Se abrirá al agregar video, imagen o texto/, "Debe explicar cuándo se abre la vista previa");
assert.match(component, /CompactAudioEqualizer playing=\{playing\}/, "Cuando hay solo audio debe mostrar el ecualizador");
assert.match(component, /width:\s*"min\(100%, 520px\)"/, "El monitor contraído debe usar ancho compacto");
assert.match(component, /height:\s*isAudioOnlyMode\s*\?\s*210\s*:\s*112/, "Vacío debe ser más bajo que el modo audio");
assert.match(component, /eduaiAudioEq/, "El ecualizador debe incluir animación moderna de barras");
assert.match(component, /isMonitorCollapsed\s*\?\s*\(/, "La vista previa debe alternar entre cerrado/audio y contenido visual");
assert.match(component, /MP3 · solo audio/, "El selector superior debe mantener exportación MP3");
assert.match(component, /Eliminar archivo del proyecto/, "El panel debe mantener la eliminación de recursos");
assert.match(component, /Abrir biblioteca de proyectos/, "Debe mantener acceso a la biblioteca multimedia");
assert.match(component, /type Tab = "files" \| "url"/, "Debe incluir la pestaña Importar URL");
assert.match(component, /<UrlMediaImporter onImport=\{importUrlMedia\}/, "Debe montar el importador URL en el editor");
assert.match(component, /asset\.source === "url"/, "Los recursos URL deben aparecer en Archivos");
assert.match(importer, /NEXT_PUBLIC_MEDIA_WORKER_URL/, "El importador debe usar el worker multimedia configurable");
assert.match(importer, /rights_confirmed/, "Debe exigir confirmación de derechos antes de convertir");
assert.match(importer, /MP3 · solo audio/, "Debe permitir MP3");
assert.match(importer, /MP4 · video/, "Debe permitir MP4");
assert.doesNotMatch(importer, /cookies|username|password/i, "No debe incluir mecanismos de autenticación o cookies para fuentes restringidas");

console.log("[multimedia-audio-monitor] OK · monitor, ecualizador e importador URL verificados");
