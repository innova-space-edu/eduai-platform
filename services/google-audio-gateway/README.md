# EduAI Google Audio Gateway

Backend administrado de Audio Lab.

- Canciones: Google Lyria 3.5.
- Replicación y TTS: Gemini 3.8 Flash TTS + Voices API.
- Persistencia: Supabase Storage + tablas de Audio Lab.
- Cloud Run: `min=0`; escala a cero cuando no hay uso.
- Autenticación: cada solicitud exige el JWT de Supabase del usuario y respeta RLS.
- La clave Gemini debe montarse desde Secret Manager; no debe almacenarse en Git ni en variables públicas.

## Despliegue final

Usar una única revisión de Cloud Run con Secret Manager, por ejemplo:

```bash
gcloud run deploy eduai-song-gateway \
  --image=us-central1-docker.pkg.dev/scientificbrain-compute/eduai-audio/gateway:final \
  --region=us-central1 \
  --execution-environment=gen2 \
  --cpu=1 \
  --memory=2Gi \
  --min=0 \
  --max=2 \
  --concurrency=4 \
  --timeout=900 \
  --allow-unauthenticated \
  --service-account=eduai-audio-runtime@scientificbrain-compute.iam.gserviceaccount.com \
  --set-secrets=GEMINI_API_KEY=eduai-lyria-api-key:latest
```

Además configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EDUAI_ALLOWED_ORIGINS`, `LYRIA_MODEL=lyria-3.5` y `VOICE_MODEL=gemini-3.8-flash-tts`.

El servicio público no confía en el cliente: valida el bearer de Supabase y solo opera sobre recursos del usuario autenticado.
