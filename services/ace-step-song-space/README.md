---
title: EduAI Song Engine
emoji: 🎵
colorFrom: purple
colorTo: cyan
sdk: gradio
sdk_version: 6.20.0
python_version: 3.12.12
app_file: app.py
pinned: false
license: mit
suggested_hardware: zero-a10g
models:
  - ACE-Step/acestep-v15-xl-turbo-diffusers
short_description: Motor privado de canciones IA para Audio Lab de EduAI
---

# EduAI Song Engine

Servicio privado de generación musical para EduAI, basado en ACE-Step 1.5 XL Turbo y ejecutado con ZeroGPU.

El endpoint Gradio público interno es `generate_song`. La aplicación principal autentica las llamadas con el token privado de Hugging Face y guarda los resultados en Supabase Storage.

El despliegue del Space se administra automáticamente mediante GitHub Actions desde el repositorio de EduAI.
