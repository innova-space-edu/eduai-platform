# VIDEO_AGENT_SETUP

## Qué incluye este parche

- `app/api/agents/video/route.ts`
  - Crea jobs de video con límites diarios/minuto.
  - Deduplica prompts repetidos por usuario.
- `app/api/agents/video/status/[jobId]/route.ts`
  - Devuelve el estado de un job.
- `app/api/agents/video/process/route.ts`
  - Procesa jobs pendientes. Sirve para Vercel Cron o llamada interna.
- `lib/video-config.ts`
  - Normaliza duración, fps, audio y proveedores.
- `lib/video-agent.ts`
  - Hash, caché Redis, límites y fallback entre proveedores.
- `supabase/migrations/20260402_video_jobs.sql`
  - Tabla con RLS.

## Recomendación de proveedor

### Orden sugerido
1. **LTX** como proveedor principal.
   - Mejor para clips cortos.
   - Acepta image-to-video y es el mejor punto de partida si luego quieres audio.
2. **CogVideoX** como respaldo para text-to-video.
3. **HunyuanVideo-I2V** como respaldo para image-to-video.

## Límites recomendados

- Duración base: `6s`
- Extensión máxima: `10s`
- FPS por defecto: `8`
- FPS máximo: `12`
- Resolución sugerida en los workers: `512p` o `704p`
- Usuarios free: `2` por minuto y `10` por día

## Variables de entorno

```env
VIDEO_PROVIDER_ORDER=ltx,cogvideox,hunyuan_i2v
VIDEO_CRON_SECRET=pon_un_secreto_largo

LTX_VIDEO_ENDPOINT=https://tu-endpoint-ltx/api/generate
LTX_VIDEO_API_KEY=
LTX_VIDEO_MODEL=Lightricks/LTX-Video

COGVIDEOX_ENDPOINT=https://tu-endpoint-cogvideox/api/generate
COGVIDEOX_API_KEY=
COGVIDEOX_MODEL=zai-org/CogVideoX-5b

HUNYUAN_I2V_ENDPOINT=https://tu-endpoint-hunyuan/api/generate
HUNYUAN_I2V_API_KEY=
HUNYUAN_I2V_MODEL=Tencent-Hunyuan/HunyuanVideo-I2V
```

## Cómo procesar la cola sin interrumpir el servicio

### Opción recomendada en Vercel
Crear un cron que llame:

`POST /api/agents/video/process?limit=1`

con el header:

`x-video-cron-secret: <VIDEO_CRON_SECRET>`

Esto evita procesar muchos trabajos al mismo tiempo y reduce picos de costo.

## Audio

Este parche deja listo el campo `audio` en el payload.

Para que el audio se una al MP4, el endpoint real del proveedor o tu worker Python debe devolver:

```json
{
  "video_url": "https://.../video.mp4",
  "audio_url": "https://.../audio.wav",
  "preview_image_url": "https://.../preview.jpg",
  "model": "LTX-Video"
}
```

### Recomendación práctica
- Primera fase: usar TTS separado y devolverlo como `audio_url`.
- Segunda fase: unir audio y video en el worker con `ffmpeg`.
- Tercera fase: usar LTX-2.x si quieres audio sincronizado generado por el propio modelo.

## Payload esperado por `POST /api/agents/video`

```json
{
  "prompt": "Un profesor explicando fracciones con una pizarra azul futurista",
  "mode": "text_to_video",
  "durationSeconds": 6,
  "extendToSeconds": 10,
  "aspectRatio": "16:9",
  "fps": 8,
  "style": "educational cinematic",
  "includeAudio": true,
  "audio": {
    "enabled": true,
    "ttsText": "Hoy aprenderemos fracciones de forma visual."
  }
}
```

## Qué falta después de integrar estos archivos

1. Crear una página en tu frontend, por ejemplo `app/video-studio/page.tsx`.
2. Subir imagen a Supabase Storage si vas a usar `image_to_video`.
3. Hacer polling a `GET /api/agents/video/status/[jobId]`.
4. Configurar al menos un endpoint real para LTX.
5. Opcional: crear un worker Python en Hugging Face Space, RunPod o GPU propia.
