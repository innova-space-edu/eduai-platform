# Audio Agent V2 — Transcripción y edición robusta

## Qué cambia
- Nuevo pipeline central: `/api/agents/audio/pipeline`
- Compatibilidad mantenida con `/api/agents/transcription`
- Export real de TXT / MD / SRT / VTT / JSON
- UI de Audio Lab con modo `quick` y `pro`
- Operaciones nuevas: `chapters`, `highlights`, `study_guide`
- Preparado para microservicio externo con Faster-Whisper / WhisperX / pyannote

## Variables de entorno opcionales
```bash
AUDIO_PIPELINE_URL=http://localhost:8000
AUDIO_PIPELINE_TOKEN=
AUDIO_PIPELINE_PROVIDER=external
AUDIO_DEFAULT_MODE=quick
```

## Sin microservicio externo
Si no configuras `AUDIO_PIPELINE_URL`, el sistema usa `Gemini` como fallback estructurado.

## Con microservicio externo
El backend de Next llamará `POST {AUDIO_PIPELINE_URL}/pipeline` con este body:
```json
{
  "audioBase64": "...",
  "mimeType": "audio/mpeg",
  "fileName": "clase.mp3",
  "fileSizeBytes": 123456,
  "options": {
    "mode": "pro",
    "improveAudio": true,
    "preciseSubtitles": true,
    "diarize": true,
    "createSummary": true
  }
}
```

## Respuesta esperada del microservicio externo
```json
{
  "transcript": "texto completo",
  "transcriptClean": "texto limpio",
  "language": "es",
  "durationEstimate": "12 min",
  "qualityNotes": "enhancement+alignment",
  "provider": "external",
  "mode": "pro",
  "speakers": [{"id":"SPEAKER_00","estimatedRole":"Docente"}],
  "segments": [
    {"id":"seg_1","start":0.0,"end":4.2,"speaker":"SPEAKER_00","text":"..."}
  ],
  "summary": "...",
  "metadata": {
    "model": "faster-whisper-large-v3",
    "alignment": "whisperx",
    "diarization": "pyannote"
  },
  "modelUsed": "faster-whisper-large-v3"
}
```

## Siguiente mejora recomendada
1. Montar microservicio Python con Faster-Whisper + WhisperX + pyannote.
2. Guardar archivos fuente en Supabase Storage.
3. Añadir cola asíncrona para audios largos.
4. Renderizar timeline por segmentos y búsqueda por palabra.
