---
title: EduAI OpenVoice V2
emoji: 🎙️
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 5.50.0
app_file: app.py
python_version: 3.10.13
pinned: false
---

# EduAI OpenVoice V2

Private ZeroGPU service for EduAI Audio Lab.

The service is intentionally stateless:

- the source voice sample stays in the private Supabase bucket;
- EduAI sends a short-lived signed URL only when processing is requested;
- OpenVoice V2 extracts tone color in memory and does not persist a biometric embedding in the Space;
- spoken synthesis starts with EduAI's existing Edge TTS voice and OpenVoice converts the tone color to the authorized reference voice.

## Gradio API

- `prepare_voice(reference_audio_url)`: validates the private sample and verifies that a tone-color embedding can be extracted.
- `convert_voice(reference_audio_url, source_audio_base64, source_mime)`: converts EduAI's base speech to the authorized tone color.

The Space also launches its Gradio MCP server so the same private functions can be exposed as tools when needed.

## Hardware

This service targets a private Gradio ZeroGPU Space. It is deliberately not a Docker Space because free personal Hugging Face accounts can host up to two ZeroGPU Gradio Spaces, while new Docker compute Spaces require a paid plan.

## Security

Keep the Space private. The web app authenticates to Hugging Face with `OPENVOICE_HF_TOKEN` or, as a fallback, the existing `ACE_STEP_HF_TOKEN`. Reference URLs expire after a few minutes.
