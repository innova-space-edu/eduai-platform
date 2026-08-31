# EDUAI Media Studio

Media Studio es el editor audiovisual por capas de EDUAI. La V1 une el flujo creativo existente (Video Studio, Image Studio, Audio Lab y EduAI Music) con un timeline no destructivo y asistencia IA.

## Funciones V1

- Timeline multipista para video, audio, imágenes y texto.
- Importación local de formatos soportados por el navegador.
- Preview sincronizado con reproducción, playhead y velocidad por clip.
- Mover clips en el tiempo, dividir, borrar, mute/ocultar pistas y undo/redo.
- Inspector de posición, escala, rotación, opacidad, volumen, velocidad, brillo, contraste, saturación y blur.
- Proporciones 16:9, 9:16, 1:1 y 4:5.
- Texto superpuesto editable.
- Búsqueda integrada de recursos permitidos mediante Pexels, Pixabay, Freesound y Jamendo.
- Media AI: convierte lenguaje natural en acciones reversibles del timeline usando el router IA existente de EDUAI.
- Autosave local y guardado autenticado en Supabase.
- Exportación del proyecto no destructivo `.eduai-media.json`.

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
- `lib/media-studio/store.ts`: motor de estado/edición no destructiva con Zustand.
- `lib/media-studio/types.ts`: contrato de proyecto, pistas, clips y Media AI.
- `app/api/media-studio/search/route.ts`: adaptadores de biblioteca multimedia.
- `app/api/media-studio/ai/route.ts`: planificador de comandos Media AI.

## Licencias y fuentes externas

Pexels, Pixabay, Freesound y Jamendo se muestran con proveedor/licencia/atribución cuando la API la entrega. YouTube y Spotify no se usan como fuentes descargables para el timeline. Si se integran en el futuro deben mantenerse como búsqueda/reproducción oficial según sus políticas, no como descargadores.

## Próxima etapa de render

La V1 exporta el proyecto editable. El esquema `media_exports` deja preparada la cola para un render worker posterior (FFmpeg nativo/MediaBunny/WebCodecs) sin acoplar trabajos pesados a una función normal de Vercel.
