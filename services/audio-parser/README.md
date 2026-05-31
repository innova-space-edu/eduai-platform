---
title: EduAI Audio Parser
emoji: 🎙️
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
---

# EduAI Audio Parser

Microservicio externo para Audio Lab Pro.

## Objetivo

Procesar transcripciones de audio fuera de Vercel mediante Faster Whisper, con timestamps por segmento, VAD y timestamps por palabra en modo Pro.

## Endpoints

- `GET /health`
- `POST /pipeline`

## Variables opcionales del Space

- `WHISPER_MODEL=small`
- `WHISPER_DEVICE=cpu`
- `WHISPER_COMPUTE_TYPE=int8`
- `AUDIO_PARSER_MAX_MB=50`
- `AUDIO_PARSER_TOKEN=`

## Variables requeridas en Vercel

- `AUDIO_PIPELINE_URL=https://TU-SPACE.hf.space`
- `AUDIO_PIPELINE_PROVIDER=faster-whisper`
- `AUDIO_PIPELINE_TOKEN=`

## Arquitectura inicial

Audio Lab envía audio al microservicio externo. El parser devuelve transcripción, idioma detectado, duración estimada, segmentos y timestamps por palabra cuando se activa el modo Pro.

## Próximas mejoras

- Carga directa a Supabase para audios grandes.
- Cola asíncrona de procesamiento.
- WhisperX para alineación avanzada.
- pyannote.audio para diarización real.
- OpenVoice u OmniVoice para clonación de voz con consentimiento.
