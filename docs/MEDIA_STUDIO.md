# EDUAI Media Studio

Media Studio es el editor audiovisual por capas de EDUAI. La V1 une el flujo creativo existente (Video Studio, Image Studio, Audio Lab, Galería y EduAI Music) con un timeline no destructivo y asistencia IA.

## Funciones V1

- Timeline multipista para video, audio, imágenes, música/SFX y texto.
- Importación local de formatos soportados por el navegador.
- Preview sincronizado con reproducción, playhead y velocidad por clip.
- Mover clips en el tiempo, dividir, borrar, mute/ocultar pistas y undo/redo.
- Inspector de posición, escala, rotación, opacidad, volumen, velocidad, brillo, contraste, saturación y blur.
- Proporciones 16:9, 9:16, 1:1 y 4:5.
- Texto superpuesto editable.
- Biblioteca EDUAI unificada para imágenes generadas, assets de Media Studio y catálogo de EduAI Music.
- Búsqueda integrada de recursos permitidos mediante Pexels, Pixabay, Freesound y Jamendo.
- Media AI: convierte lenguaje natural en acciones reversibles del timeline usando el router IA existente de EDUAI.
- Autosave local y guardado autenticado en Supabase.
- Exportación en navegador a WebM, captura PNG, subtítulos SRT y proyecto no destructivo `.eduai-media.json`.

## Variables opcionales para búsqueda multimedia

Configurar como secretos server-side en Vercel. No usar prefijo `NEXT_PUBLIC_`.

```bash
PEXELS_API_KEY=
PIXABAY_API_KEY=
FREESOUND_API_KEY=
JAMENDO_CLIENT_ID=
```

Si una clave no está configurada, ese proveedor simplemente no entrega resultados; el editor sigue funcionando.

## Base de datos

Aplicar `supabase/migrations/202608310001_media_studio.sql` para habilitar:

- `media_projects`
- `media_assets`
- `media_exports`

Las tres tablas tienen RLS y sólo permiten acceso al propietario autenticado.

## Arquitectura

- `app/media-studio/page.tsx`: entrada del módulo.
- `components/media-studio/MediaStudioClient.tsx`: UI, preview, timeline e inspector.
- `components/media-studio/MediaLibraryDrawer.tsx`: biblioteca interna EDUAI.
- `components/media-studio/MediaExportMenu.tsx`: exportación WebM/PNG/SRT/JSON.
- `lib/media-studio/store.ts`: motor de estado/edición no destructiva con Zustand.
- `lib/media-studio/types.ts`: contrato de proyecto, pistas, clips y Media AI.
- `lib/media-studio/browser-export.ts`: render/exportación browser-native.
- `app/api/media-studio/library/route.ts`: biblioteca interna unificada.
- `app/api/media-studio/search/route.ts`: adaptadores de biblioteca multimedia externa.
- `app/api/media-studio/ai/route.ts`: planificador de comandos Media AI.

## Licencias y fuentes externas

Pexels, Pixabay, Freesound y Jamendo se muestran con proveedor/licencia/atribución cuando la API la entrega. YouTube y Spotify no se usan como fuentes descargables para el timeline. Si se integran en el futuro deben mantenerse como búsqueda/reproducción oficial según sus políticas, no como descargadores.

## Exportación V1

- **WebM:** montaje audiovisual generado en el navegador con Canvas, MediaRecorder y Web Audio; se realiza en tiempo real.
- **PNG:** captura del frame actual.
- **SRT:** exporta las capas de texto temporizadas como subtítulos.
- **EDUAI JSON:** conserva el proyecto completo para continuar editando.

Un asset externo que bloquee CORS se omite del render browser-native en vez de derribar toda la exportación. Para una exportación profesional reproducible se recomienda que los assets del proyecto terminen almacenados en el storage propio de EDUAI.

## Próxima etapa de render

El esquema `media_exports` deja preparada la cola para un worker de render posterior con MP4/MP3/4K, FFmpeg nativo y/o MediaBunny/WebCodecs. Separación de stems, denoise avanzado, detección/eliminación automática de silencios y renders largos deben ejecutarse fuera de una función normal de Vercel.
