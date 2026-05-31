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

## Variables requeridas en Vercel

- `DOCLING_PARSER_URL=https://TU-SPACE.hf.space`
- `DOCLING_PARSER_TIMEOUT_MS=12000`

## Arquitectura

Chat Paper descarga el PDF desde Supabase Storage, lo envía al parser externo y guarda los fragmentos procesados en `paper_documents` y `paper_chunks`.

## Próximas mejoras

- OCR forzado para PDF escaneados difíciles.
- Ingestión de páginas web.
- Soporte posterior para DOCX, PPTX y XLSX.
- Segundo nivel con Docling para documentos complejos.
