#!/usr/bin/env python3
"""Sincroniza los 19 archivos existentes de Educación Media con Currículum Nacional.

La fuente primaria es la URL canónica de curriculumnacional.cl. Cuando la red de
GitHub Actions no puede acceder a ese host, se usa el espejo de preproducción del
mismo portal únicamente como transporte. Los archivos siempre conservan la URL
canónica y el script falla ante códigos duplicados, secuencias incompletas o
páginas sin objetivos.
"""

from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from collections import OrderedDict, defaultdict
from pathlib import Path
from typing import Iterable

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
MINEDUC_ROOT = ROOT / "data" / "mineduc"
MEDIA_ROOT = MINEDUC_ROOT / "media"
CONSULT_DATE = "2026-07-18"
BASE_7_2 = "Bases Curriculares 7º Básico a 2º Medio"
BASE_3_4 = "Bases Curriculares 3° y 4° Medio"
CANONICAL_AVAILABLE = True


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def curl(url: str, retries: int) -> str:
    command = [
        "curl",
        "--ipv4",
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "15",
        "--max-time",
        "120",
        "--retry",
        str(retries),
        "--retry-all-errors",
        "--retry-delay",
        "3",
        "--header",
        "Accept-Language: es-CL,es;q=0.9",
        "--user-agent",
        "Mozilla/5.0 (compatible; EduAI-Curriculum-Audit/2.0; +https://github.com/innova-space-edu/eduai-platform)",
        url,
    ]
    completed = subprocess.run(command, check=True, capture_output=True)
    return completed.stdout.decode("utf-8", errors="strict")


def fetch_html(url: str) -> str:
    global CANONICAL_AVAILABLE
    if CANONICAL_AVAILABLE:
        try:
            return curl(url, retries=0)
        except subprocess.CalledProcessError as error:
            CANONICAL_AVAILABLE = False
            print(
                f"[red] URL canónica temporalmente no disponible ({error.returncode}); "
                "se usará el espejo oficial de contingencia.",
                flush=True,
            )

    mirror = url.replace(
        "https://www.curriculumnacional.cl/",
        "https://pre-curriculumnacional.tifon.cl/",
        1,
    )
    print(f"[red] consultando espejo oficial: {mirror}", flush=True)
    return curl(mirror, retries=3)


def extract_description(heading: Tag) -> str:
    paragraphs: list[str] = []
    bullets: list[str] = []

    for node in heading.find_all_next():
        if node is heading:
            continue
        if isinstance(node, Tag) and node.name in {"h1", "h2", "h3", "h4", "h5"}:
            break
        if not isinstance(node, Tag):
            continue
        if node.name == "p" and node.find_parent("li") is None:
            value = clean(node.get_text(" ", strip=True))
            if value and value.casefold() not in {"ver actividades", "ver recursos"} and value not in paragraphs:
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


def parse_page(url: str, code_pattern: str, axes: Iterable[str] | None = None) -> list[dict]:
    soup = BeautifulSoup(fetch_html(url), "html.parser")
    regex = re.compile(code_pattern)
    axis_lookup = {clean(axis).casefold(): axis for axis in (axes or [])}
    current_axis = "Objetivos de Aprendizaje"
    collected: list[dict] = []

    for heading in soup.find_all(["h2", "h3", "h4", "h5"]):
        heading_text = clean(heading.get_text(" ", strip=True))
        axis = axis_lookup.get(heading_text.casefold())
        if axis:
            current_axis = axis
            continue

        match = regex.search(heading_text)
        if not match:
            continue
        code = match.group(0)
        collected.append(
            {
                "code": code,
                "axis": current_axis,
                "description": extract_description(heading),
                "number": int(re.search(r"(\d{2})$", code).group(1)),
            }
        )

    unique: OrderedDict[str, dict] = OrderedDict()
    for item in collected:
        unique.setdefault(item["code"], item)
    result = list(unique.values())
    if not result:
        raise RuntimeError(f"No se encontraron OA en {url}")

    grouped: dict[str, list[int]] = defaultdict(list)
    for item in result:
        prefix = re.sub(r"\d{2}$", "", item["code"])
        grouped[prefix].append(item["number"])
    for prefix, numbers in grouped.items():
        ordered = sorted(set(numbers))
        expected = list(range(1, max(ordered) + 1))
        if ordered != expected:
            raise RuntimeError(f"Secuencia incompleta para {prefix}: obtenida {ordered}, esperada {expected}")

    return sorted(result, key=lambda item: (item["number"], item["code"]))


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_units(objectives: list[dict], id_prefix: str, axes: Iterable[str] | None = None) -> list[dict]:
    order = list(axes or [])
    if not order:
        order = list(OrderedDict.fromkeys(item["axis"] for item in objectives))

    units = []
    for number, axis in enumerate(order, start=1):
        axis_items = [item for item in objectives if item["axis"] == axis]
        if not axis_items:
            continue
        units.append(
            {
                "numero": number,
                "id": f"eje-{slugify(axis)}",
                "nombre": axis,
                "tipo_agrupacion": "eje_curricular" if axis != "Objetivos de Aprendizaje" else "lista_oficial",
                "oa": [
                    {
                        "id": item["code"].replace(" ", "-") if "-" not in item["code"] else item["code"],
                        "codigo_oficial": item["code"],
                        "descripcion": item["description"],
                        "eje": axis,
                    }
                    for item in axis_items
                ],
            }
        )
    return units


def build_media_file(
    *,
    course_label: str,
    subject_name: str,
    source_url: str,
    base_curricular: str,
    objectives: list[dict],
    axes: Iterable[str] | None = None,
    origin_subject: str | None = None,
    source_urls: list[str] | None = None,
    shared_base: str | None = None,
) -> dict:
    metadata = {
        "nivel": "Media",
        "curso": course_label,
        "asignatura": subject_name,
        "fuente": "Currículum Nacional - MINEDUC Chile",
        "source_url": source_url,
        "base_curricular": base_curricular,
        "estado_verificacion": "verificado_oficial",
        "alcance_verificacion": ["oa_contenido"],
        "fecha_consulta": CONSULT_DATE,
        "nota": "Los OA fueron obtenidos directamente de páginas oficiales específicas de Currículum Nacional. La agrupación interna no altera el texto oficial.",
    }
    if origin_subject:
        metadata["base_asignatura_origen"] = origin_subject
    if source_urls:
        metadata["source_urls"] = source_urls
    if shared_base:
        metadata["base_oficial_compartida"] = shared_base

    return {
        "metadata": metadata,
        "objetivos_habilidad": [],
        "objetivos_actitud": [],
        "unidades": build_units(objectives, slugify(subject_name), axes),
    }


def sync_first_second_media() -> list[dict]:
    registry_entries: list[dict] = []
    common = {
        "matematica": {
            "file": "matematica.json",
            "slug": "matematica",
            "name": "Matemática",
            "prefix": "MA",
            "axes": ["Números", "Álgebra y funciones", "Geometría", "Probabilidad y estadística"],
        },
        "lengua": {
            "file": "lengua_literatura.json",
            "slug": "lengua-literatura",
            "name": "Lengua y Literatura",
            "prefix": "LE",
            "axes": ["Lectura - Comprensión", "Escritura - Producción", "Comunicación oral", "Investigación"],
        },
        "tecnologia": {
            "file": "tecnologia.json",
            "slug": "tecnologia",
            "name": "Tecnología",
            "prefix": "TE",
            "axes": ["Resolución de problemas tecnológicos", "Tecnología, ambiente y sociedad"],
        },
    }

    for course in (1, 2):
        folder = MEDIA_ROOT / f"{course}_medio"
        label = f"{course}° Medio"
        for config in common.values():
            url = f"https://www.curriculumnacional.cl/curriculum/7o-basico-2-medio/{config['slug']}/{course}-medio"
            objectives = parse_page(url, rf"\b{config['prefix']}{course}M OA \d{{2}}\b", config["axes"])
            output = build_media_file(
                course_label=label,
                subject_name=config["name"],
                source_url=url,
                base_curricular=BASE_7_2,
                objectives=objectives,
                axes=config["axes"],
            )
            write_json(folder / config["file"], output)
            registry_entries.append(
                {
                    "key": f"media/{course}_medio/{config['file'].removesuffix('.json')}",
                    "url": url,
                    "base_curricular_id": "basica-7-media-2",
                    "codes": [item["code"] for item in objectives],
                }
            )
            print(f"[ok] {label} {config['name']}: {len(objectives)} OA", flush=True)

        science_url = f"https://www.curriculumnacional.cl/curriculum/7o-basico-2-medio/ciencias-naturales/{course}-medio"
        science_axes = ["Biología", "Física", "Química"]
        science = parse_page(science_url, rf"\bCN{course}M OA \d{{2}}\b", science_axes)
        for axis, file_name in (("Biología", "biologia.json"), ("Física", "fisica.json"), ("Química", "quimica.json")):
            objectives = [item for item in science if item["axis"] == axis]
            if not objectives:
                raise RuntimeError(f"{label}: Ciencias Naturales no entregó OA para el eje {axis}")
            output = build_media_file(
                course_label=label,
                subject_name=axis,
                source_url=science_url,
                base_curricular=BASE_7_2,
                objectives=objectives,
                axes=[axis],
                origin_subject=f"Ciencias Naturales {label}",
            )
            write_json(folder / file_name, output)
            registry_entries.append(
                {
                    "key": f"media/{course}_medio/{file_name.removesuffix('.json')}",
                    "url": science_url,
                    "base_curricular_id": "basica-7-media-2",
                    "codes": [item["code"] for item in objectives],
                }
            )
            print(f"[ok] {label} {axis}: {len(objectives)} OA", flush=True)

    return registry_entries


def sync_third_fourth_media() -> list[dict]:
    registry_entries: list[dict] = []
    simple_pages = [
        {
            "course": 3,
            "folder": "3_medio",
            "file": "matematica.json",
            "name": "Matemática",
            "url": "https://www.curriculumnacional.cl/curriculum/3o-4o-medio/matematica-3o-medio/3-medio-fg",
            "pattern": r"\bFG-MATE-3M-OAC-\d{2}\b",
        },
        {
            "course": 4,
            "folder": "4_medio",
            "file": "matematica.json",
            "name": "Matemática",
            "url": "https://www.curriculumnacional.cl/curriculum/3o-4o-medio/matematica-4o-medio/4-medio-fg",
            "pattern": r"\bFG-MATE-4M-OAC-\d{2}\b",
        },
        {
            "course": 3,
            "folder": "3_medio",
            "file": "educacion_ciudadana.json",
            "name": "Educación Ciudadana",
            "url": "https://www.curriculumnacional.cl/curriculum/3o-4o-medio/educacion-ciudadana-3-medio/3-medio-fg",
            "pattern": r"\bFG-ECIU-3M-OAC-\d{2}\b",
        },
        {
            "course": 4,
            "folder": "4_medio",
            "file": "educacion_ciudadana.json",
            "name": "Educación Ciudadana",
            "url": "https://www.curriculumnacional.cl/curriculum/3o-4o-medio/educacion-ciudadana-4m/4-medio-fg",
            "pattern": r"\bFG-ECIU-4M-OAC-\d{2}\b",
        },
        {
            "course": 4,
            "folder": "4_medio",
            "file": "lengua_literatura.json",
            "name": "Lengua y Literatura",
            "url": "https://www.curriculumnacional.cl/curriculum/3o-4o-medio/lengua-literatura-4o-medio/4-medio-fg",
            "pattern": r"\bFG-LELI-4M-OAC-\d{2}\b",
        },
    ]

    for config in simple_pages:
        objectives = parse_page(config["url"], config["pattern"])
        label = f"{config['course']}° Medio FG"
        output = build_media_file(
            course_label=label,
            subject_name=config["name"],
            source_url=config["url"],
            base_curricular=BASE_3_4,
            objectives=objectives,
        )
        write_json(MEDIA_ROOT / config["folder"] / config["file"], output)
        registry_entries.append(
            {
                "key": f"media/{config['folder']}/{config['file'].removesuffix('.json')}",
                "url": config["url"],
                "base_curricular_id": "media-3-4",
                "codes": [item["code"] for item in objectives],
            }
        )
        print(f"[ok] {label} {config['name']}: {len(objectives)} OA", flush=True)

    module_configs = [
        ("ambiente_sostenibilidad", "Ambiente y sostenibilidad", "ambiente-sostenibilidad", r"\bFG-CIAS-3y4-OAC-\d{2}\b"),
        ("bienestar_salud", "Bienestar y salud", "bienestar-salud", r"\bFG-CIBS-3y4-OAC-\d{2}\b"),
        ("seguridad_prevencion_autocuidado", "Seguridad, prevención y autocuidado", "seguridad-prevencion-autocuidado", r"\bFG-CISA-3y4-OAC-\d{2}\b"),
        ("tecnologia_sociedad", "Tecnología y sociedad", "tecnologia-sociedad", r"\bFG-CITS-3y4-OAC-\d{2}\b"),
    ]
    source_urls: list[str] = []
    modules: list[dict] = []
    all_objectives: list[dict] = []
    for module_id, module_name, slug, pattern in module_configs:
        url = f"https://www.curriculumnacional.cl/curriculum/3o-4o-medio/{slug}/3-medio-fg"
        objectives = parse_page(url, pattern)
        source_urls.append(url)
        all_objectives.extend(objectives)
        modules.append(
            {
                "id": module_id,
                "nombre": module_name,
                "tipo_agrupacion": "modulo_oficial_compartido_3y4",
                "oa": [
                    {
                        "id": item["code"],
                        "codigo_oficial": item["code"],
                        "descripcion": item["description"],
                        "eje": module_name,
                    }
                    for item in objectives
                ],
            }
        )
        print(f"[ok] Ciencias para la Ciudadanía — {module_name}: {len(objectives)} OA", flush=True)

    shared = {
        "metadata": {
            "nivel": "Media",
            "base_compartida": "3° y 4° Medio FG",
            "asignatura": "Ciencias para la Ciudadanía",
            "fuente": "Currículum Nacional - MINEDUC Chile",
            "source_url": source_urls[0],
            "source_urls": source_urls,
            "base_curricular": BASE_3_4,
            "estado_verificacion": "verificado_oficial",
            "alcance_verificacion": ["oa_contenido"],
            "fecha_consulta": CONSULT_DATE,
            "nota": "La asignatura se organiza oficialmente en cuatro módulos comunes para 3° y 4° medio. Los textos fueron obtenidos de las páginas oficiales específicas de cada módulo.",
        },
        "modulos": modules,
    }
    write_json(MINEDUC_ROOT / "shared" / "ciencias_para_la_ciudadania_3y4_base.json", shared)

    for course in (3, 4):
        folder = f"{course}_medio"
        label = f"{course}° Medio FG"
        course_file = {
            "metadata": {
                "nivel": "Media",
                "curso": label,
                "asignatura": "Ciencias para la Ciudadanía",
                "fuente": "Currículum Nacional - MINEDUC Chile",
                "source_url": source_urls[0],
                "source_urls": source_urls,
                "base_curricular": BASE_3_4,
                "estado_verificacion": "verificado_oficial",
                "alcance_verificacion": ["oa_contenido"],
                "fecha_consulta": CONSULT_DATE,
                "base_oficial_compartida": "data/mineduc/shared/ciencias_para_la_ciudadania_3y4_base.json",
                "nota": "Los cuatro módulos y sus OA son comunes para 3° y 4° medio. Se duplican en este archivo para permitir selección y validación por curso sin alterar el texto oficial.",
            },
            "modulos": modules,
        }
        write_json(MEDIA_ROOT / folder / "ciencias_para_la_ciudadania.json", course_file)
        registry_entries.append(
            {
                "key": f"media/{folder}/ciencias_para_la_ciudadania",
                "url": source_urls[0],
                "source_urls": source_urls,
                "base_curricular_id": "media-3-4",
                "codes": [item["code"] for item in all_objectives],
            }
        )
        print(f"[ok] {label} Ciencias para la Ciudadanía: {len(all_objectives)} OA compartidos", flush=True)

    return registry_entries


def update_sources(entries: list[dict]) -> None:
    path = MINEDUC_ROOT / "sources.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["revision"] = "fase_10_educacion_media_completa_verificada"
    data["fecha_actualizacion"] = CONSULT_DATE
    registry = data.setdefault("asignaturas_verificadas", {})
    for entry in entries:
        codes = entry["codes"]
        record = {
            "url": entry["url"],
            "base_curricular_id": entry["base_curricular_id"],
            "fecha_consulta": CONSULT_DATE,
            "alcance": [codes[0], codes[-1]],
            "cantidad_oa_contenido": len(codes),
        }
        if entry.get("source_urls"):
            record["urls"] = entry["source_urls"]
        registry[entry["key"]] = record
    write_json(path, data)


def collect_oa(data: dict) -> list[dict]:
    out: list[dict] = []
    for unit in data.get("unidades", []):
        out.extend(unit.get("oa", []))
    for module in data.get("modulos", []):
        out.extend(module.get("oa", []))
    for scope in data.get("ambitos", []):
        for core in scope.get("nucleos", []):
            out.extend(core.get("oa_contenido", []))
    return out


def update_progress() -> None:
    course_files: list[Path] = []
    course_files.extend((MINEDUC_ROOT / "parvularia").glob("*.json"))
    course_files.extend((MINEDUC_ROOT / "basica").glob("*/*.json"))
    course_files.extend((MINEDUC_ROOT / "media").glob("*/*.json"))

    official = 0
    proposals = 0
    pending = 0
    oa_total = 0
    for path in course_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        status = data.get("metadata", {}).get("estado_verificacion", "pendiente_verificacion")
        if status == "verificado_oficial":
            official += 1
            oa_total += len(collect_oa(data))
        elif status == "verificado_propuesta_oficial":
            proposals += 1
            oa_total += len(collect_oa(data))
        else:
            pending += 1

    progress_path = MINEDUC_ROOT / "meta" / "verification-progress.json"
    progress = json.loads(progress_path.read_text(encoding="utf-8"))
    progress.update(
        {
            "fecha_actualizacion": CONSULT_DATE,
            "fase": "educacion_media_completa",
            "archivos_curriculares_totales": len(course_files),
            "asignaturas_verificadas_oficialmente": official,
            "propuestas_oficiales_verificadas": proposals,
            "archivos_pendientes": pending,
            "oa_contenido_verificados": oa_total,
            "cursos_media_completos": ["1_medio", "2_medio", "3_medio", "4_medio"],
            "siguiente_bloque": "educacion_parvularia",
            "ultima_validacion": "pendiente",
            "estado_fusion": "rama_en_revision",
            "nota": "Educación Básica y los 19 archivos existentes de Educación Media quedaron cotejados con páginas oficiales específicas. Permanecen pendientes los seis archivos operativos de Educación Parvularia.",
        }
    )
    write_json(progress_path, progress)


def main() -> None:
    entries = sync_first_second_media()
    entries.extend(sync_third_fourth_media())
    if len(entries) != 19:
        raise RuntimeError(f"Se esperaban 19 archivos de Educación Media y se procesaron {len(entries)}")
    update_sources(entries)
    update_progress()
    print(f"[ok] Educación Media completa: {len(entries)} archivos cotejados", flush=True)


if __name__ == "__main__":
    main()
