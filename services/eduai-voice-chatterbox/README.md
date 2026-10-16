# Chatterbox Multilingual V3 — motor privado de EDUAI

## Estado y arquitectura

Esta implementación utiliza la cuenta y el consentimiento de Audio Lab existentes.
Flujo: navegador EDUAI -> ruta protegida Vercel -> gateway en Google Cloud Run -> contenedor privado Chatterbox GPU -> Supabase Storage privado.

- Administrador adulto, MFA AAL2 y consentimiento grabado son requisitos obligatorios.
- El motor GPU recibe exclusivamente la muestra WAV efímera y el texto, sin claves Supabase.
- Chatterbox genera español desde una referencia propia (zero-shot). No se entrena un modelo nuevo por usuario.
- El motor no utiliza Gemini Voice Replication, la cuota Paid Tier 1 ni Hugging Face Spaces/API.
- Solo el gateway puede invocar el contenedor mediante un token de identidad de Google Cloud Run.

## Imagen recomendada — sin dependencias de buckets ni HF

Dockerfile.baked incorpora los pesos al contenedor DURANTE la compilación, descargándolos desde el mirror público ModelScope ResembleAI/chatterbox. Crea un manifiesto SHA256 para:
- ve.pt
- s3gen.pt
- t3_mtl23ls_v3.safetensors
- grapheme_mtl_merged_expanded_v1.json

El código arranca con ChatterboxMultilingualTTS.from_local, comprueba los hashes y configura HF_HUB_OFFLINE=1. No descarga pesos durante las peticiones de usuario. MIT: https://github.com/resemble-ai/chatterbox .

Modelo: https://modelscope.cn/models/ResembleAI/chatterbox

El Dockerfile tradicional y stage-weights.cloudbuild.yaml se conservan como alternativa GCS, pero NO se necesitan cuando la imagen ya contiene un checkpoint válido. No es necesario conceder acceso a los datos de MaleCNS.

## Despliegue

Proyecto: scientificbrain-compute.
Imagen: us-central1-docker.pkg.dev/scientificbrain-compute/eduai-audio/chatterbox-voice:v1
Servicio privado: eduai-voice-engine (us-central1)
GPU: NVIDIA L4 24 GB, 4 vCPU, 16 GiB RAM.
Escalado: min 0, max 1, concurrencia 1, timeout 900s.
Seguridad: NO permitir acceso público; conceder roles/run.invoker solamente a la cuenta de servicio del gateway eduai-song-gateway.

Validar la cuota específica Cloud Run NVIDIA L4 antes de desplegar. Una cuota para Compute Engine no significa cuota para Cloud Run. Confirmar los costos, límites de facturación y presupuesto de ScientificBrain. El arranque frío carga alrededor de varios GB de modelo, por lo que puede ser lento y facturable.

El contenedor GPU requiere su cuenta de servicio de mínimo privilegio. No necesita Secret Manager, claves API, ni permisos para acceder a Supabase si utiliza la imagen con modelo integrado.

## Activación del gateway

Una vez que el nuevo servicio privado responda correctamente a GET /health con un token Google IAM del gateway:
- Desplegar services/google-audio-gateway con google-auth instalado.
- Configurar VOICE_PROVIDER=chatterbox.
- Configurar CHATTERBOX_ENGINE_URL a la URL concreta del servicio privado.
- Mantener todas las variables actuales de Supabase, CORS, claves Google para otras herramientas y autenticación.

GET /diagnostics/voice deberá devolver provider=chatterbox-self-hosted y ok=true. Solo entonces la interfaz podrá preparar una voz.

## Verificación

Usar el perfil propio existente, con muestra y consentimiento, y probar preparación seguida de síntesis real. No alterar manualmente el estado a ready. El motor anterior continúa sin cambios mientras el gateway no tenga VOICE_PROVIDER=chatterbox.

El servicio nuevo puede generar costos de Cloud Build y GPU aunque no se pague por llamadas a Gemini. La clonación no está verificada hasta obtener y reproducir un WAV.
