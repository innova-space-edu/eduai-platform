---
title: EduAI Paper Parser
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# EduAI Paper Parser

Microservicio Python para mejorar la lectura de PDF en Chat Paper.

## Despliegue recomendado

1. Crear un Space nuevo en Hugging Face.
2. Seleccionar Docker como SDK.
3. Copiar el contenido de esta carpeta como raíz del Space.
4. Esperar el build.
5. Verificar que `/health` responda correctamente.

## Variables opcionales del parser

- `PAPER_PARSER_MAX_MB=50`
- `PAPER_PARSER_OCR_LANGUAGES=spa+eng`
- `PAPER_PARSER_TOKEN=`
- `PAPER_PARSER_MIN_TEXT_CHARS=700`
- `PAPER_PARSER_MIN_TEXT_WORDS=120`
- `PAPER_PARSER_FORCE_OCR_IF_LOW_TEXT=true`

## Variables requeridas en Vercel

- `DOCLING_PARSER_URL=https://TU-SPACE.hf.space`
- `DOCLING_PARSER_TIMEOUT_MS=12000`

## Arquitectura

Chat Paper descarga el PDF desde Supabase Storage, lo envía al parser externo y guarda los fragmentos procesados en `paper_documents` y `paper_chunks`.

## Mejora recomendada

El parser debe usar OCR adaptativo: primero texto nativo para PDFs normales y OCR forzado solo cuando el texto extraído es bajo o el usuario lo solicita. Esto reduce latencia sin perder capacidad para PDFs escaneados.

## Próximas mejoras

- OCR forzado para PDF escaneados difíciles.
- Ingestión de páginas web.
- Soporte posterior para DOCX, PPTX y XLSX.
- Segundo nivel con Docling para documentos complejos.
