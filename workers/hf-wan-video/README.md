# EduAI Wan Video Worker

Plantilla de worker Gradio para conectar **Wan 2.1 T2V 1.3B** con Video Studio sin acoplar el frontend de EduAI al proveedor.

## Qué hace

- Expone `api_name="generate"`.
- Entrada compatible con `lib/video/providers/hf-gradio.ts`:
  1. prompt
  2. style
  3. duration
  4. mode
  5. image_url
  6. aspect_ratio
  7. resolution
- Genera texto→video con `Wan-AI/Wan2.1-T2V-1.3B-Diffusers`.
- Devuelve un MP4 que EduAI descarga inmediatamente y persiste en `eduai-assets`.
- No implementa imagen→video con el modelo 1.3B; si recibe ese modo, devuelve error y el Video Router puede continuar con otro proveedor.

## Hugging Face Space

Esta carpeta está pensada para copiarse a un Space Gradio compatible. Si el Space usa ZeroGPU, `@spaces.GPU` solicita GPU únicamente durante la inferencia.

La disponibilidad y cuota de ZeroGPU depende del plan/cuenta de Hugging Face y puede cambiar. EduAI no asume que el recurso sea ilimitado ni que esté siempre disponible.

Variables opcionales del Space:

```env
WAN_MODEL_ID=Wan-AI/Wan2.1-T2V-1.3B-Diffusers
WAN_INFERENCE_STEPS=30
```

## Variables en Vercel / EduAI

Después de disponer de un Space compatible:

```env
HF_GRADIO_VIDEO_BASE_URL=https://TU-SPACE.hf.space
HF_GRADIO_VIDEO_API_NAME=generate
HF_GRADIO_VIDEO_MODEL=Wan-AI/Wan2.1-T2V-1.3B-Diffusers
HF_TOKEN=hf_... # opcional/recomendado si el Space lo admite
VIDEO_PROVIDER_ORDER=wan,hf-gradio,hf-space,google
```

No uses prefijo `NEXT_PUBLIC_` para tokens.

## Flujo

```text
Video Studio
  -> Reuse Engine
  -> WAN API si está configurada
  -> HF Gradio si está configurado
  -> provider legacy opcional
  -> Google Veo solo como premium/fallback
  -> eduai-assets
```

Los intentos fallidos no deben consumir el cupo diario de EduAI; solo se contabilizan videos completados.

## Nota sobre producción

Un Space gratuito/compartido es adecuado para pruebas y uso liviano, no para garantizar gran concurrencia. Para producción con alta demanda, despliega el mismo worker en infraestructura GPU propia o un proveedor con SLA, manteniendo el mismo contrato Gradio/HTTP para no modificar Video Studio.
