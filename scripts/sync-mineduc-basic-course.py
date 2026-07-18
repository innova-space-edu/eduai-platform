#!/usr/bin/env python3
"""Sincroniza OA de contenido desde páginas oficiales de Currículum Nacional.

Uso local:
  python -m pip install beautifulsoup4
  python scripts/sync-mineduc-basic-course.py --course 5
  python scripts/sync-mineduc-basic-course.py --course 6

El script falla si la cantidad o la secuencia de códigos no coincide con la
configuración esperada. No genera ni completa OA por inferencia.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.request
from collections import OrderedDict
from pathlib import Path

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
MINEDUC_ROOT = ROOT / "data" / "mineduc"
CONSULT_DATE = "2026-07-18"
BASE_CURRICULAR = "Bases Curriculares 1° a 6° Básico"
BASE_CURRICULAR_ID = "basica-1-6"

COMMON_SUBJECTS = {
    "matematica": {
        "file": "matematica.json",
        "slug": "matematica",
        "name": "Matemática",
        "prefix": "MA",
        "axes": ["Números y operaciones", "Patrones y álgebra", "Geometría", "Medición", "Datos y probabilidades"],
    },
    "lenguaje": {
        "file": "lenguaje.json",
        "slug": "lenguaje-comunicacion",
        "name": "Lenguaje y Comunicación",
        "prefix": "LE",
        "axes": ["Lectura - Comprensión", "Escritura - Producción", "Comunicación oral"],
    },
    "ciencias": {
        "file": "ciencias_naturales.json",
        "slug": "ciencias-naturales",
        "name": "Ciencias Naturales",
        "prefix": "CN",
        "axes": ["Ciencias de la Vida", "Ciencias Físicas y Químicas", "Ciencias de la Tierra y el Universo"],
    },
    "historia": {
        "file": "historia_geografia_y_cs_sociales.json",
        "slug": "historia-geografia-ciencias-sociales",
        "name": "Historia, Geografía y Ciencias Sociales",
        "prefix": "HI",
        "axes": ["Historia", "Geografía", "Formación ciudadana"],
    },
    "ingles": {
        "file": "ingles.json",
        "slug": "ingles",
        "name": "Inglés",
        "prefix": "IN",
        "axes": ["Comprensión auditiva", "Comprensión de lectura", "Expresión oral", "Expresión escrita"],
    },
    "artes": {
        "file": "artes_visuales.json",
        "slug": "artes-visuales",
        "name": "Artes Visuales",
        "prefix": "AR",
        "axes": ["Expresar y crear visualmente", "Apreciar y responder frente al arte"],
    },
    "educacion_fisica": {
        "file": "educacion_fisica_y_salud.json",
        "slug": "educacion-fisica-salud",
        "name": "Educación Física y Salud",
        "prefix": "EF",
        "axes": ["Habilidades motrices", "Vida activa y saludable", "Seguridad, juego limpio y liderazgo"],
    },
    "musica": {
        "file": "musica.json",
        "slug": "musica",
        "name": "Música",
        "prefix": "MU",
        "axes": ["Escuchar y apreciar", "Interpretar y crear", "Reflexionar y contextualizar"],
    },
    "orientacion": {
        "file": "orientacion.json",
        "slug": "orientacion",
        "name": "Orientación",
        "prefix": "OR",
        "axes": ["Crecimiento personal", "Relaciones interpersonales", "Participación y pertenencia", "Trabajo escolar"],
    },
    "tecnologia": {
        "file": "tecnologia.json",
        "slug": "tecnologia",
        "name": "Tecnología",
        "prefix": "TE",
        "axes": ["Diseñar, hacer y probar", "Tecnologías de la información y la comunicación"],
    },
}


def subject(key: str, count: int) -> dict:
    return {**COMMON_SUBJECTS[key], "count": count}


COURSES = {
    5: {
        "folder": "5_basico",
        "label": "5° Básico",
        "expected_total": 149,
        "subjects": [
            subject("matematica", 27),
            subject("lenguaje", 30),
            subject("ciencias", 14),
            subject("historia", 22),
            subject("ingles", 16),
            subject("artes", 5),
            subject("educacion_fisica", 11),
            subject("musica", 8),
            subject("orientacion", 9),
            subject("tecnologia", 7),
        ],
        "revision": "fase_8_5_basico_completo_verificado",
        "progress": {
            "fase": "5_basico_completo",
            "asignaturas_verificadas_oficialmente": 66,
            "propuestas_oficiales_verificadas": 4,
            "archivos_pendientes": 35,
            "oa_contenido_verificados": 954,
            "cursos_completos": ["1_basico", "2_basico", "3_basico", "4_basico", "5_basico", "7_basico", "8_basico"],
            "siguiente_bloque": "6_basico",
        },
    },
    6: {
        "folder": "6_basico",
        "label": "6° Básico",
        "expected_total": 155,
        "subjects": [
            subject("matematica", 24),
            subject("lenguaje", 31),
            subject("ciencias", 18),
            subject("historia", 26),
            subject("ingles", 16),
            subject("artes", 5),
            subject("educacion_fisica", 11),
            subject("musica", 8),
            subject("orientacion", 9),
            subject("tecnologia", 7),
        ],
        "revision": "fase_9_educacion_basica_completa_verificada",
        "progress": {
            "fase": "educacion_basica_completa",
            "asignaturas_verificadas_oficialmente": 76,
            "propuestas_oficiales_verificadas": 4,
            "archivos_pendientes": 25,
            "oa_contenido_verificados": 1109,
            "cursos_completos": ["1_basico", "2_basico", "3_basico", "4_basico", "5_basico", "6_basico", "7_basico", "8_basico"],
            "siguiente_bloque": "educacion_media",
        },
    },
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; EduAI-Curriculum-Audit/1.0; +https://github.com/innova-space-edu/eduai-platform)",
            "Accept-Language": "es-CL,es;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="strict")


def extract_description(heading: Tag) -> str:
    paragraphs: list[str] = []
    bullets: list[str] = []

    for node in heading.find_all_next():
        if node is heading:
            continue
        if isinstance(node, Tag) and node.name in {"h2", "h3", "h4"}:
            break
        if not isinstance(node, Tag):
            continue
        if node.name == "p" and node.find_parent("li") is None:
            value = clean(node.get_text(" ", strip=True))
            if value and value.lower() != "ver actividades" and value not in paragraphs:
                paragraphs.append(value)
        elif node.name == "li":
            value = clean(node.get_text(" ", strip=True))
            if value and value not in bullets:
                bullets.append(value.rstrip("."))

    if not paragraphs and not bullets:
        raise RuntimeError(f"No se pudo extraer la descripción posterior a: {clean(heading.get_text(' ', strip=True))}")

    body = "\n".join(paragraphs)
    if bullets:
        body = f"{body}\n" if body else ""
        body += "\n".join(f"- {item}" for item in bullets)
    return body.strip()


def parse_subject(url: str, subject_config: dict, course: int) -> list[dict]:
    soup = BeautifulSoup(fetch_html(url), "html.parser")
    axes_lookup = {clean(axis).casefold(): axis for axis in subject_config["axes"]}
    current_axis: str | None = None
    collected: list[dict] = []
    code_pattern = re.compile(rf"\b{subject_config['prefix']}{course:02d} OA (\d{{2}})\b")

    for heading in soup.find_all(["h3", "h4"]):
        heading_text = clean(heading.get_text(" ", strip=True))
        axis = axes_lookup.get(heading_text.casefold())
        if axis:
            current_axis = axis
            continue

        match = code_pattern.search(heading_text)
        if not match:
            continue
        if current_axis is None:
            raise RuntimeError(f"{url}: OA {match.group(0)} encontrado sin eje curricular anterior")

        number = int(match.group(1))
        code = f"{subject_config['prefix']}{course:02d} OA {number:02d}"
        collected.append(
            {
                "number": number,
                "code": code,
                "axis": current_axis,
                "description": extract_description(heading),
            }
        )

    unique: OrderedDict[str, dict] = OrderedDict()
    for item in collected:
        unique.setdefault(item["code"], item)
    result = list(unique.values())

    expected_codes = [
        f"{subject_config['prefix']}{course:02d} OA {number:02d}"
        for number in range(1, subject_config["count"] + 1)
    ]
    actual_codes = [item["code"] for item in result]
    if actual_codes != expected_codes:
        raise RuntimeError(
            f"{subject_config['name']}: secuencia oficial inesperada.\nEsperada: {expected_codes}\nObtenida: {actual_codes}"
        )
    return result


def build_file(course: int, course_cfg: dict, subject_config: dict, url: str, objectives: list[dict]) -> dict:
    units = []
    for index, axis in enumerate(subject_config["axes"], start=1):
        axis_objectives = [item for item in objectives if item["axis"] == axis]
        if not axis_objectives:
            raise RuntimeError(f"{subject_config['name']}: eje sin OA extraídos: {axis}")
        units.append(
            {
                "numero": index,
                "id": f"eje-{slugify(axis)}",
                "nombre": axis,
                "tipo_agrupacion": "eje_curricular",
                "oa": [
                    {
                        "id": f"{subject_config['prefix']}{course}B-OA-{item['number']:02d}",
                        "codigo_oficial": item["code"],
                        "descripcion": item["description"],
                        "eje": axis,
                    }
                    for item in axis_objectives
                ],
            }
        )

    return {
        "metadata": {
            "nivel": "Básica",
            "curso": course_cfg["label"],
            "fuente": "Currículum Nacional - MINEDUC Chile",
            "base_curricular": BASE_CURRICULAR,
            "estado_verificacion": "verificado_oficial",
            "alcance_verificacion": ["oa_contenido"],
            "fecha_consulta": CONSULT_DATE,
            "nota": "Los OA de contenido fueron obtenidos directamente de la página oficial vigente de Currículum Nacional. La agrupación corresponde a ejes curriculares y no inventa unidades del programa de estudio.",
            "asignatura": subject_config["name"],
            "source_url": url,
        },
        "objetivos_habilidad": [],
        "objetivos_actitud": [],
        "unidades": units,
    }


def update_registry(course: int, course_cfg: dict, results: list[tuple[dict, str]]) -> None:
    path = MINEDUC_ROOT / "sources.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["revision"] = course_cfg["revision"]
    data["fecha_actualizacion"] = CONSULT_DATE
    registry = data.setdefault("asignaturas_verificadas", {})

    for subject_config, url in results:
        key = f"basica/{course_cfg['folder']}/{subject_config['file'].removesuffix('.json')}"
        registry[key] = {
            "url": url,
            "base_curricular_id": BASE_CURRICULAR_ID,
            "fecha_consulta": CONSULT_DATE,
            "alcance": [
                f"{subject_config['prefix']}{course:02d} OA 01",
                f"{subject_config['prefix']}{course:02d} OA {subject_config['count']:02d}",
            ],
            "cantidad_oa_contenido": subject_config["count"],
        }

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_progress(course_cfg: dict) -> None:
    path = MINEDUC_ROOT / "meta" / "verification-progress.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data.update(
        {
            "fecha_actualizacion": CONSULT_DATE,
            "archivos_curriculares_totales": 105,
            **course_cfg["progress"],
            "ultima_validacion": "pendiente",
            "nota": "Contabiliza OA de contenido cotejados con páginas oficiales específicas. Inglés de 1° a 4° básico se registra como propuesta oficial; Inglés de 5° y 6° básico pertenece a la base curricular obligatoria.",
        }
    )
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--course", type=int, required=True, choices=sorted(COURSES))
    args = parser.parse_args()

    course = args.course
    course_cfg = COURSES[course]
    output_dir = MINEDUC_ROOT / "basica" / course_cfg["folder"]
    written = []
    total = 0

    for subject_config in course_cfg["subjects"]:
        url = f"https://www.curriculumnacional.cl/curriculum/1o-6o-basico/{subject_config['slug']}/{course}-basico"
        objectives = parse_subject(url, subject_config, course)
        total += len(objectives)
        output = build_file(course, course_cfg, subject_config, url, objectives)
        destination = output_dir / subject_config["file"]
        destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append((subject_config, url))
        print(f"[ok] {subject_config['name']}: {len(objectives)} OA -> {destination.relative_to(ROOT)}")

    if total != course_cfg["expected_total"]:
        raise RuntimeError(f"Total inesperado para {course_cfg['label']}: {total}, esperado {course_cfg['expected_total']}")

    update_registry(course, course_cfg, written)
    update_progress(course_cfg)
    print(f"[ok] {course_cfg['label']}: {total} OA oficiales sincronizados desde Currículum Nacional")


if __name__ == "__main__":
    main()
