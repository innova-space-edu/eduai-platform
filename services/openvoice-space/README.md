---
title: EduAI OpenVoice Private Service
emoji: 🎙️
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# EduAI OpenVoice Private Service

Private Docker Space scaffold for Audio Lab voice processing. Keep this Space private. The service exposes health, voice processing, synthesis and deletion routes. Model wiring is isolated in `app.py` so the web platform never stores model files in Vercel.

## Required runtime variables

- `VOICE_STORE_DIR=/data/voices`
- `OPENVOICE_ENABLED=true`

## Recommended hardware

Use a GPU Space for real-time synthesis. CPU mode remains available for smoke tests but will be slower.

## Endpoints

- `GET /health`
- `POST /voices/process`
- `POST /voices/synthesize`
- `DELETE /voices/{voice_id}`

## Deploy

Create a private Docker Space and upload the contents of this folder. Add persistent storage when using the service beyond testing.
