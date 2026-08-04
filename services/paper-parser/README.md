---
title: EduAI Paper Parser
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# EduAI Paper Parser

Microservicio Docker para leer PDF normales, mixtos y escaneados desde Chat Paper.

## Arquitectura actual

1. El usuario sube el PDF directamente a Supabase Storage.
2. Los archivos de 6 MB o más usan carga TUS reanudable.
3. `pdf-inspector` clasifica rápidamente el documento como texto, mixto, escaneado o basado en imágenes.
4. Cuando la versión instalada expone extracción completa, EduAI utiliza su salida estructurada. En caso contrario, los PDF con texto se extraen localmente con `pdf-parse`.
5. Los PDF escaneados, mixtos o con texto insuficiente pasan a este Space.
6. Para archivos grandes, EduAI envía una URL firmada temporal de Supabase en vez de reenviar el archivo completo mediante Vercel.
7. El resultado se divide y guarda en `paper_documents` y `paper_chunks` para que la IA consulte solo los fragmentos relevantes.

## Entradas admitidas por `POST /parse`

El endpoint acepta una de estas dos formas:

- `file`: PDF mediante `multipart/form-data`.
- `source_url`: URL HTTPS firmada de Supabase Storage.

Campos adicionales:

- `filename`: nombre del PDF cuando se usa `source_url`.
- `force_ocr=true|false`: fuerza OCR para documentos escaneados.

Las URL remotas se restringen a hosts Supabase o a los declarados en `PAPER_PARSER_ALLOWED_HOSTS`. El servicio no sigue redirecciones y valida la firma `%PDF-` antes de procesar el archivo.

## Variables del Space

- `PAPER_PARSER_MAX_MB=250`
- `PAPER_PARSER_DOWNLOAD_TIMEOUT_SECONDS=300`
- `PAPER_PARSER_OCR_LANGUAGES=spa+eng`
- `PAPER_PARSER_TOKEN=`
- `PAPER_PARSER_MIN_TEXT_CHARS=700`
- `PAPER_PARSER_MIN_TEXT_WORDS=120`
- `PAPER_PARSER_FORCE_OCR_IF_LOW_TEXT=true`
- `PAPER_PARSER_ALLOWED_HOSTS=`

## Variables de Vercel

- `DOCLING_PARSER_URL=https://esthefanomc23-eduai-paper-parser.hf.space`
- `DOCLING_PARSER_WAKE_TIMEOUT_MS=8000`
- `DOCLING_PARSER_TIMEOUT_MS=38000`
- `PAPER_PARSER_TOKEN=`
- `PAPER_MAX_PDF_SIZE_MB=250`
- `PAPER_SERVER_BUFFER_MAX_MB=40`

`PAPER_PARSER_TOKEN` debe tener el mismo valor en Vercel y en el Space.

Chat Paper mantiene sus rutas en el bundle compartido de 60 segundos del plan Hobby. El cliente del parser reserva como máximo 52 segundos para despertar y consultar Hugging Face, dejando tiempo para cerrar la respuesta. Un escaneo muy grande que no alcance a terminar devuelve un error controlado y puede reintentarse cuando el Space ya esté activo.

## Despliegue

El workflow `.github/workflows/deploy-paper-parser-hf.yml` actualiza el Space `EsthefanoMC23/eduai-paper-parser` al integrar cambios en `main`.

Secretos requeridos en GitHub Actions:

- `HF_TOKEN`
- `PAPER_PARSER_TOKEN` recomendado

El workflow valida `app.py`, publica la carpeta `services/paper-parser` y comprueba que `/health` responda correctamente.

## Comportamiento de OCR

El parser intenta primero extracción nativa con PyMuPDF4LLM. Cuando el texto es insuficiente o `force_ocr=true`, utiliza OCR adaptativo con Tesseract en español e inglés. De esta forma los PDF normales no pagan el costo de OCR y los escaneados conservan una ruta de respaldo.
