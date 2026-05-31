from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

import pymupdf
import pymupdf4llm
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

APP_NAME = "EduAI Paper Parser"
MAX_FILE_SIZE_MB = int(os.getenv("PAPER_PARSER_MAX_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
PARSER_TOKEN = os.getenv("PAPER_PARSER_TOKEN", "").strip()
OCR_LANGUAGES = os.getenv("PAPER_PARSER_OCR_LANGUAGES", "spa+eng").strip() or "spa+eng"

app = FastAPI(title=APP_NAME, version="1.0.0")


def _authorize(x_parser_token: str | None) -> None:
    if PARSER_TOKEN and x_parser_token != PARSER_TOKEN:
        raise HTTPException(status_code=401, detail="Parser token inválido")


def _clean_text(value: Any) -> str:
    return str(value or "").replace("\x00", "").strip()


def _page_number(metadata: dict[str, Any], fallback: int) -> int:
    raw = metadata.get("page_number", metadata.get("page", fallback))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return fallback


def _native_fallback(pdf_path: str) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pymupdf.open(pdf_path) as document:
        for index, page in enumerate(document):
            text = _clean_text(page.get_text("text"))
            pages.append({"pageNumber": index + 1, "text": text})
    return pages


def _markdown_pages(pdf_path: str, force_ocr: bool) -> list[dict[str, Any]]:
    chunks = pymupdf4llm.to_markdown(
        pdf_path,
        page_chunks=True,
        use_ocr=True,
        force_ocr=force_ocr,
        ocr_language=OCR_LANGUAGES,
    )

    pages: list[dict[str, Any]] = []
    for index, chunk in enumerate(chunks or []):
        metadata = chunk.get("metadata") or {}
        text = _clean_text(chunk.get("text"))
        pages.append({
            "pageNumber": _page_number(metadata, index + 1),
            "text": text,
        })
    return pages


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "endpoints": ["/health", "/parse"],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "maxFileSizeMB": MAX_FILE_SIZE_MB,
        "ocrLanguages": OCR_LANGUAGES,
        "tokenRequired": bool(PARSER_TOKEN),
    }


@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    force_ocr: bool = Form(False),
    x_parser_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_parser_token)

    filename = Path(file.filename or "documento.pdf").name
    suffix = Path(filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Por ahora el parser acepta archivos PDF")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"El PDF supera el límite de {MAX_FILE_SIZE_MB} MB",
        )

    with tempfile.TemporaryDirectory(prefix="eduai-paper-") as temp_dir:
        pdf_path = Path(temp_dir) / filename
        pdf_path.write_bytes(content)

        method = "pymupdf4llm-hybrid-ocr"
        try:
            pages = _markdown_pages(str(pdf_path), force_ocr=force_ocr)
        except Exception as exc:  # pragma: no cover - defensive fallback
            print(f"[paper-parser] pymupdf4llm failed: {exc}", flush=True)
            pages = _native_fallback(str(pdf_path))
            method = "pymupdf-native-fallback"

    useful_pages = [page for page in pages if _clean_text(page.get("text"))]
    text = "\n\n\f\n\n".join(page["text"] for page in useful_pages)

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "No se pudo extraer texto útil. El PDF puede contener imágenes de baja calidad, "
                "texto vectorial complejo o un escaneo que requiere OCR forzado."
            ),
        )

    return {
        "success": True,
        "parser": "eduai-paper-parser",
        "method": method,
        "title": Path(filename).stem,
        "markdown": text,
        "text": text,
        "summary": "",
        "pageCount": len(pages),
        "pages": useful_pages,
        "ocrUsed": True,
        "metadata": {
            "forceOCR": force_ocr,
            "ocrLanguages": OCR_LANGUAGES,
            "fileSizeBytes": len(content),
        },
    }
