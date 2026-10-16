# EDUAI · Voz administrativa sin Hugging Face

## Motor de voz

Gemini 3.8 Flash TTS y Voices API (replicated) sobre el gateway existente Google Cloud Run.
No requiere Hugging Face, OpenVoice ni GPU del navegador.
Referencia oficial: https://ai.google.dev/gemini-api/docs/voice-replication

## Condiciones de acceso

- Exclusivo para usuarios registrados en admin_emails, verificado por RPC is_admin().
- Fecha de nacimiento adulta en profiles, validada por RPC is_adult_profile().
- Sesión protegida y MFA para el navegador; Cloud Run exige JWT Supabase con AAL2.
- Muestra de referencia propia y segunda grabación real de consentimiento.
- Datos y audio privados bajo RLS. Clonación deshabilitada a usuarios no administradores incluso si son adultos.
- Transcripción y TTS genérica no se afectan por esta protección.

## Perfil existente

1. Entrar como administrador en /audio-lab/voices y desbloquear con el autenticador.
2. Si dice «referencia lista», conservar ese perfil. No volver a crearlo.
3. Grabar con la misma voz: «Soy el propietario de esta voz y doy mi consentimiento para que Google la utilice para crear un modelo de voz sintética.»
4. Pulsar «Subir consentimiento», con preferencia WAV mono 16 bit / 24 kHz. La muestra de voz principal debe durar 10-30 segundos.
5. Verificar el cuadro de estado «Motor Google Gemini». Si no está disponible, corregir Cloud Run o la cuenta Google antes de pulsar «Replicar voz».
6. Cuando el motor esté disponible, pulsar «Replicar voz». Luego «Probar clon» si el estado es ready.
7. No modificar a mano estados ready ni eliminar el error histórico como si la voz se hubiese generado.

## Publicación del gateway Cloud Run

Los cambios en services/google-audio-gateway NO se publican automáticamente mediante el deploy de Vercel. Un operador con permisos en Google Cloud debe desplegar la imagen revisada:

    gcloud config set project scientificbrain-compute
    gcloud builds submit services/google-audio-gateway --tag us-central1-docker.pkg.dev/scientificbrain-compute/eduai-audio/gateway:voice-admin-v1
    gcloud run deploy eduai-song-gateway --region us-central1 --image us-central1-docker.pkg.dev/scientificbrain-compute/eduai-audio/gateway:voice-admin-v1

Revisar la configuración efectiva del servicio: SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY mediante Secret Manager, VOICE_MODEL=gemini-3.8-flash-tts y EDUAI_ALLOWED_ORIGINS, que debe incluir el dominio https://eduai.innova-space-edu.cl. La configuración de Cloud Run prevalece sobre el valor por defecto del código.

Verificar GET /health y GET /diagnostics/voice en Cloud Run, y GET /api/agents/audio/voices/engine desde una sesión autorizada de EDUAI.

## Límites

- Independiente de HF, pero depende de Google Cloud y de sus cuotas.
- El despliegue Vercel READY no implica que el gateway de Google esté operativo.
- No se prueba la replicación de voz con grabaciones ajenas. La activación real requiere consentimiento grabado por la persona titular.
