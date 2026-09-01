import assert from "node:assert/strict";
import fs from "node:fs";
import "./apply-multimedia-monitor-default-closed.mjs";

const component = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");

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

console.log("[multimedia-audio-monitor] OK · cerrado por defecto, ecualizador para audio y apertura automática con contenido visual");
