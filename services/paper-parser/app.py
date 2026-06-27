from __future__ import annotations

import os
import re
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
MIN_TEXT_CHARS = int(os.getenv("PAPER_PARSER_MIN_TEXT_CHARS", "700"))
MIN_TEXT_WORDS = int(os.getenv("PAPER_PARSER_MIN_TEXT_WORDS", "120"))
FORCE_OCR_IF_LOW_TEXT = os.getenv("PAPER_PARSER_FORCE_OCR_IF_LOW_TEXT", "true").lower() != "false"

app = FastAPI(title=APP_NAME, version="1.1.0")

MATH_REPLACEMENTS = {
    "√": r"\sqrt",
    "×": r"\times",
    "✕": r"\times",
    "÷": r"\div",
    "≤": r"\leq",
    "≥": r"\geq",
    "≠": r"\neq",
    "≈": r"\approx",
    "π": r"\pi",
}


def _authorize(x_parser_token: str | None) -> None:
    if PARSER_TOKEN and x_parser_token != PARSER_TOKEN:
        raise HTTPException(status_code=401, detail="Parser token inválido")


def _normalize_math_symbols(value: str) -> str:
    text = value
    for source, target in MATH_REPLACEMENTS.items():
        text = text.replace(source, target)
    text = re.sub(r"(^|[^\\])\b(frac|sqrt|sum|int|lim|sin|cos|tan|log|ln)\s*\{", r"\1\\\2{", text)
    text = re.sub(r"(^|[\s=+\-([{])([0-9]+)\s*/\s*([0-9]+)(?=$|[\s=+\-)\]}.,;])", r"\1\\frac{\2}{\3}", text)
    return text


def _clean_text(value: Any) -> str:
    text = str(value or "").replace("\x00", "").strip()
    text = _normalize_math_symbols(text)
    text = re.sub(r"[ \t\u00A0]{2,}", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def _page_number(metadata: dict[str, Any], fallback: int) -> int:
    raw = metadata.get("page_number", metadata.get("page", fallback))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return fallback


def _quality(pages: list[dict[str, Any]]) -> dict[str, Any]:
    text = "\n\n".join(_clean_text(page.get("text")) for page in pages)
    words = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+", text)
    useful_pages = [page for page in pages if _clean_text(page.get("text"))]
    return {
        "chars": len(text.strip()),
        "words": len(words),
        "usefulPages": len(useful_pages),
        "isUseful": len(text.strip()) >= MIN_TEXT_CHARS or len(words) >= MIN_TEXT_WORDS,
    }


def _native_fallback(pdf_path: str) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pymupdf.open(pdf_path) as document:
        for index, page in enumerate(document):
            text = _clean_text(page.get_text("text"))
            pages.append({"pageNumber": index + 1, "text": text})
    return pages


def _markdown_pages(pdf_path: str, use_ocr: bool, force_ocr: bool) -> list[dict[str, Any]]:
    chunks = pymupdf4llm.to_markdown(
        pdf_path,
        page_chunks=True,
        use_ocr=use_ocr,
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


def _extract_pages(pdf_path: str, force_ocr: bool) -> tuple[list[dict[str, Any]], str, bool, dict[str, Any]]:
    method = "pymupdf4llm-native"
    ocr_used = False
    ocr_attempted = False
    pages: list[dict[str, Any]] = []

    try:
        if force_ocr:
            ocr_attempted = True
            pages = _markdown_pages(pdf_path, use_ocr=True, force_ocr=True)
            method = "pymupdf4llm-forced-ocr"
            ocr_used = True
        else:
            pages = _markdown_pages(pdf_path, use_ocr=False, force_ocr=False)
            method = "pymupdf4llm-native"
    except Exception as exc:
        print(f"[paper-parser] pymupdf4llm failed: {exc}", flush=True)
        pages = _native_fallback(pdf_path)
        method = "pymupdf-native-fallback"

    quality = _quality(pages)

    if not quality["isUseful"] and FORCE_OCR_IF_LOW_TEXT and not ocr_attempted:
        try:
            ocr_attempted = True
            ocr_pages = _markdown_pages(pdf_path, use_ocr=True, force_ocr=True)
            ocr_quality = _quality(ocr_pages)
            if ocr_quality["chars"] >= quality["chars"] or ocr_quality["words"] >= quality["words"]:
                pages = ocr_pages
                quality = ocr_quality
                method = "pymupdf4llm-adaptive-ocr"
                ocr_used = True
        except Exception as exc:
            print(f"[paper-parser] adaptive OCR failed: {exc}", flush=True)

    if not pages:
        pages = _native_fallback(pdf_path)
        quality = _quality(pages)
        method = "pymupdf-native-fallback"
        ocr_used = False

    return pages, method, ocr_used, quality


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
        "minTextChars": MIN_TEXT_CHARS,
        "minTextWords": MIN_TEXT_WORDS,
        "forceOcrIfLowText": FORCE_OCR_IF_LOW_TEXT,
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
        pages, method, ocr_used, quality = _extract_pages(str(pdf_path), force_ocr=force_ocr)

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
        "ocrUsed": ocr_used,
        "metadata": {
            "forceOCR": force_ocr,
            "ocrLanguages": OCR_LANGUAGES,
            "fileSizeBytes": len(content),
            "quality": quality,
        },
    }
