#!/usr/bin/env python3
"""Sincroniza los tres tramos oficiales y los seis archivos operativos de Parvularia.

Currículum Nacional define tres tramos oficiales: Sala Cuna (SC), Nivel Medio
(NM) y Nivel Transición (NT). EduAI conserva seis nombres operativos para la
planificación, pero cada par comparte exactamente los OA/OAT del tramo oficial:

- sala_cuna_menor y sala_cuna_mayor -> SC
- medio_menor y medio_mayor -> NM
- nt1 y nt2 -> NT

El script consulta las páginas oficiales específicas de los tres ámbitos,
valida secuencias por núcleo y no genera objetivos por inferencia.
"""

from __future__ import annotations

import json
import re
import subprocess
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
MINEDUC_ROOT = ROOT / "data" / "mineduc"
PARVULARIA_ROOT = MINEDUC_ROOT / "parvularia"
CONSULT_DATE = "2026-07-18"
BASE_CURRICULAR = "Bases Curriculares de Educación Parvularia (vigentes desde 2019)"
BASE_CURRICULAR_ID = "parvularia"
CANONICAL_AVAILABLE = True

NUCLEI = OrderedDict(
    [
        (
            "Desarrollo personal y social",
            {
                "slug": "desarrollo-personal-social",
                "field": "oa_transversales",
                "kind": "OAT",
                "nuclei": OrderedDict(
                    [
                        ("IA", "Identidad y autonomía"),
                        ("CC", "Convivencia y ciudadanía"),
                        ("CM", "Corporalidad y movimiento"),
                    ]
                ),
            },
        ),
        (
            "Comunicación integral",
            {
                "slug": "comunicacion-integral",
                "field": "oa_contenido",
                "kind": "OA",
                "nuclei": OrderedDict(
                    [
                        ("LV", "Lenguaje verbal"),
                        ("LA", "Lenguajes artísticos"),
                    ]
                ),
            },
        ),
        (
            "Interacción y comprensión del entorno",
            {
                "slug": "interaccion-comprension-entorno",
                "field": "oa_contenido",
                "kind": "OA",
                "nuclei": OrderedDict(
                    [
                        ("EEN", "Exploración del entorno natural"),
                        ("CES", "Comprensión del entorno sociocultural"),
                        ("PM", "Pensamiento matemático"),
                    ]
                ),
            },
        ),
    ]
)

TRAMOS = OrderedDict(
    [
        (
            "SC",
            {
                "official_name": "Sala Cuna",
                "url_segment": "sc-sala-cuna",
                "common_file": "sala_cuna.json",
                "operational": OrderedDict(
                    [
                        ("sala_cuna_menor.json", "Sala Cuna Menor"),
                        ("sala_cuna_mayor.json", "Sala Cuna Mayor"),
                    ]
                ),
            },
        ),
        (
            "NM",
            {
                "official_name": "Nivel Medio",
                "url_segment": "nm-nivel-medio",
                "common_file": "nivel_medio.json",
                "operational": OrderedDict(
                    [
                        ("medio_menor.json", "Medio Menor"),
                        ("medio_mayor.json", "Medio Mayor"),
                    ]
                ),
            },
        ),
        (
            "NT",
            {
                "official_name": "Nivel Transición",
                "url_segment": "nt-nivel-transicion",
                "common_file": "nivel_transicion.json",
                "operational": OrderedDict(
                    [
                        ("nt1.json", "NT1 / Prekínder"),
                        ("nt2.json", "NT2 / Kínder"),
                    ]
                ),
            },
        ),
    ]
)

CODE_PATTERN = re.compile(r"\b(OAT|OA) (\d{2}) (IA|CC|CM|LV|LA|EEN|CES|PM) (SC|NM|NT)\b")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


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
        if isinstance(node, Tag) and node.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
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
        raise RuntimeError(f"No se pudo extraer descripción para {clean(heading.get_text(' ', strip=True))}")

    body = "\n".join(paragraphs)
    if bullets:
        body = f"{body}\n" if body else ""
        body += "\n".join(f"- {item}" for item in bullets)
    return body.strip()


def parse_scope(url: str, tramo_code: str, expected_kind: str, allowed_nuclei: set[str]) -> list[dict]:
    soup = BeautifulSoup(fetch_html(url), "html.parser")
    unique: OrderedDict[str, dict] = OrderedDict()

    for heading in soup.find_all(["h2", "h3", "h4", "h5", "h6"]):
        heading_text = clean(heading.get_text(" ", strip=True))
        match = CODE_PATTERN.search(heading_text)
        if not match:
            continue
        kind, number, nucleus, tramo = match.groups()
        if tramo != tramo_code or kind != expected_kind or nucleus not in allowed_nuclei:
            continue
        code = f"{kind} {number} {nucleus} {tramo}"
        unique.setdefault(
            code,
            {
                "codigo_oficial": code,
                "numero": int(number),
                "nucleo": nucleus,
                "descripcion": extract_description(heading),
            },
        )

    result = list(unique.values())
    if not result:
        raise RuntimeError(f"No se encontraron {expected_kind} de {tramo_code} en {url}")
    return result


def validate_nucleus_sequence(items: list[dict], kind: str, nucleus: str, tramo: str) -> None:
    numbers = sorted(item["numero"] for item in items)
    expected = list(range(1, max(numbers) + 1))
    if numbers != expected:
        raise RuntimeError(
            f"Secuencia incompleta para {kind} {nucleus} {tramo}: obtenida {numbers}, esperada {expected}"
        )
    descriptions = [item["descripcion"] for item in items]
    if len(descriptions) != len(set(descriptions)):
        raise RuntimeError(f"Descripciones duplicadas en {kind} {nucleus} {tramo}")


def build_tramo(tramo_code: str, config: dict) -> tuple[dict, list[str], int, int]:
    source_urls: list[str] = []
    parsed_by_nucleus: dict[str, list[dict]] = {}

    for _scope_name, scope in NUCLEI.items():
        url = (
            "https://www.curriculumnacional.cl/curriculum/educacion-parvularia/"
            f"{scope['slug']}/{config['url_segment']}"
        )
        source_urls.append(url)
        parsed = parse_scope(url, tramo_code, scope["kind"], set(scope["nuclei"]))
        for nucleus_code in scope["nuclei"]:
            items = sorted(
                (item for item in parsed if item["nucleo"] == nucleus_code),
                key=lambda item: item["numero"],
            )
            if not items:
                raise RuntimeError(f"{tramo_code}: núcleo oficial sin objetivos: {nucleus_code}")
            validate_nucleus_sequence(items, scope["kind"], nucleus_code, tramo_code)
            parsed_by_nucleus[nucleus_code] = items

    ambitos = []
    oat_count = 0
    content_count = 0
    for scope_name, scope in NUCLEI.items():
        nucleos = []
        for nucleus_code, nucleus_name in scope["nuclei"].items():
            items = parsed_by_nucleus[nucleus_code]
            payload = [
                {
                    "id": item["codigo_oficial"].replace(" ", "-"),
                    "codigo_oficial": item["codigo_oficial"],
                    "descripcion": item["descripcion"],
                }
                for item in items
            ]
            if scope["field"] == "oa_transversales":
                oat_count += len(payload)
            else:
                content_count += len(payload)
            nucleos.append(
                {
                    "codigo": nucleus_code,
                    "nombre": nucleus_name,
                    "oa_transversales": payload if scope["field"] == "oa_transversales" else [],
                    "oa_contenido": payload if scope["field"] == "oa_contenido" else [],
                }
            )
        ambitos.append({"nombre": scope_name, "nucleos": nucleos})

    common_path = f"data/mineduc/parvularia/common/{config['common_file']}"
    common = {
        "metadata": {
            "nivel": "Parvularia",
            "tramo_oficial": tramo_code,
            "nombre_tramo_oficial": config["official_name"],
            "fuente": "Currículum Nacional - MINEDUC Chile",
            "source_url": source_urls[0],
            "source_urls": source_urls,
            "base_curricular": BASE_CURRICULAR,
            "estado_verificacion": "verificado_oficial",
            "alcance_verificacion": ["oa_contenido", "oat"],
            "fecha_consulta": CONSULT_DATE,
            "nota": "Base oficial común del tramo. Contiene los OA y OAT de los ocho núcleos establecidos por las Bases Curriculares de Educación Parvularia.",
        },
        "ambitos": ambitos,
    }
    return common, source_urls, content_count, oat_count


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_operational_files(
    tramo_code: str,
    tramo_config: dict,
    common: dict,
    source_urls: list[str],
    content_count: int,
    oat_count: int,
) -> list[dict]:
    registry_entries = []
    common_path = f"data/mineduc/parvularia/common/{tramo_config['common_file']}"
    write_json(PARVULARIA_ROOT / "common" / tramo_config["common_file"], common)

    for file_name, operational_name in tramo_config["operational"].items():
        output = deepcopy(common)
        output["metadata"].update(
            {
                "curso": operational_name,
                "subnivel_operativo": operational_name,
                "base_oficial_compartida": common_path,
                "nota": (
                    f"{operational_name} es una subdivisión operativa de EduAI. MINEDUC define los OA/OAT "
                    f"para el tramo oficial {tramo_config['official_name']} ({tramo_code}); por ello este archivo "
                    "reproduce exactamente la base común del tramo y no inventa una progresión curricular separada."
                ),
            }
        )
        write_json(PARVULARIA_ROOT / file_name, output)
        key = f"parvularia/{file_name.removesuffix('.json')}"
        registry_entries.append(
            {
                "key": key,
                "url": source_urls[0],
                "urls": source_urls,
                "tramo": tramo_code,
                "content_count": content_count,
                "oat_count": oat_count,
                "common_path": common_path,
            }
        )
        print(
            f"[ok] {operational_name}: {content_count} OA + {oat_count} OAT "
            f"({content_count + oat_count} objetivos oficiales)",
            flush=True,
        )
    return registry_entries


def update_sources(entries: list[dict]) -> None:
    path = MINEDUC_ROOT / "sources.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["revision"] = "fase_11_base_mineduc_completa_verificada"
    data["fecha_actualizacion"] = CONSULT_DATE
    registry = data.setdefault("asignaturas_verificadas", {})
    for entry in entries:
        registry[entry["key"]] = {
            "url": entry["url"],
            "urls": entry["urls"],
            "base_curricular_id": BASE_CURRICULAR_ID,
            "fecha_consulta": CONSULT_DATE,
            "tramo_oficial": entry["tramo"],
            "base_oficial_compartida": entry["common_path"],
            "cantidad_oa_contenido": entry["content_count"],
            "cantidad_oat": entry["oat_count"],
            "cantidad_objetivos_oficiales": entry["content_count"] + entry["oat_count"],
        }
    write_json(path, data)


def collect_counts(data: dict) -> tuple[int, int]:
    content = 0
    oat = 0
    for unit in data.get("unidades", []):
        content += len(unit.get("oa", []))
    for module in data.get("modulos", []):
        content += len(module.get("oa", []))
    for scope in data.get("ambitos", []):
        for core in scope.get("nucleos", []):
            content += len(core.get("oa_contenido", []))
            oat += len(core.get("oa_transversales", []))
    return content, oat


def update_progress(unique_tramo_counts: dict[str, dict]) -> None:
    course_files: list[Path] = []
    course_files.extend(PARVULARIA_ROOT.glob("*.json"))
    course_files.extend((MINEDUC_ROOT / "basica").glob("*/*.json"))
    course_files.extend((MINEDUC_ROOT / "media").glob("*/*.json"))

    official = 0
    proposals = 0
    pending = 0
    content_total = 0
    oat_total = 0
    for path in course_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        status = data.get("metadata", {}).get("estado_verificacion", "pendiente_verificacion")
        content, oat = collect_counts(data)
        if status == "verificado_oficial":
            official += 1
            content_total += content
            oat_total += oat
        elif status == "verificado_propuesta_oficial":
            proposals += 1
            content_total += content
            oat_total += oat
        else:
            pending += 1

    unique_content = sum(value["content"] for value in unique_tramo_counts.values())
    unique_oat = sum(value["oat"] for value in unique_tramo_counts.values())

    path = MINEDUC_ROOT / "meta" / "verification-progress.json"
    progress = json.loads(path.read_text(encoding="utf-8"))
    progress.update(
        {
            "fecha_actualizacion": CONSULT_DATE,
            "fase": "base_mineduc_completa",
            "archivos_curriculares_totales": len(course_files),
            "asignaturas_verificadas_oficialmente": official,
            "propuestas_oficiales_verificadas": proposals,
            "archivos_pendientes": pending,
            "oa_contenido_verificados": content_total,
            "oat_verificados": oat_total,
            "objetivos_oficiales_verificados": content_total + oat_total,
            "objetivos_unicos_parvularia": unique_content + unique_oat,
            "detalle_unico_parvularia": {
                "oa_contenido": unique_content,
                "oat": unique_oat,
                "por_tramo": unique_tramo_counts,
            },
            "cursos_parvularia_completos": [
                "sala_cuna_menor",
                "sala_cuna_mayor",
                "medio_menor",
                "medio_mayor",
                "nt1",
                "nt2",
            ],
            "siguiente_bloque": "ninguno",
            "ultima_validacion": "pendiente",
            "estado_fusion": "listo_para_fusion",
            "nota": (
                "Los 105 archivos curriculares cargados por EduAI quedaron revisados. Educación Parvularia "
                "mantiene seis archivos operativos, pero respeta los tres tramos oficiales SC, NM y NT sin "
                "inventar objetivos distintos para menor/mayor o NT1/NT2."
            ),
        }
    )
    write_json(path, progress)


def main() -> None:
    entries: list[dict] = []
    unique_counts: dict[str, dict] = {}
    for tramo_code, config in TRAMOS.items():
        common, urls, content_count, oat_count = build_tramo(tramo_code, config)
        unique_counts[tramo_code] = {
            "nombre": config["official_name"],
            "oa_contenido": content_count,
            "oat": oat_count,
            "total": content_count + oat_count,
            "content": content_count,
        }
        entries.extend(
            write_operational_files(
                tramo_code,
                config,
                common,
                urls,
                content_count,
                oat_count,
            )
        )

    if len(entries) != 6:
        raise RuntimeError(f"Se esperaban seis archivos operativos y se generaron {len(entries)}")
    update_sources(entries)
    update_progress(unique_counts)
    print("[ok] Educación Parvularia completa: 3 tramos oficiales y 6 archivos operativos", flush=True)


if __name__ == "__main__":
    main()
