"""Private Innova Kaggle MCP. Staging token auth; production needs ChatGPT-compatible OAuth."""
from __future__ import annotations
import os
from fastmcp import FastMCP
from fastmcp.server.auth import StaticTokenVerifier
from client import (
    connection_info, eduai_report, my_notebooks, notebook_files,
    notebook_status, submit_eduai_smoke,
)

secret = os.environ.get("KAGGLE_MCP_BEARER", "")
if len(secret) < 32:
    raise RuntimeError("KAGGLE_MCP_BEARER debe tener 32+ caracteres y ser aleatorio")

mcp = FastMCP(
    name="Innova Kaggle MCP",
    auth=StaticTokenVerifier(
        tokens={secret: {"client_id": "innova-admin", "scopes": ["kaggle:read", "kaggle:write"]}},
        required_scopes=["kaggle:read"],
    ),
)


@mcp.tool()
def kaggle_connection_status() -> dict:
    """Consulta configuración local sin mostrar credenciales."""
    return connection_info()


@mcp.tool()
def kaggle_list_my_notebooks(page: int = 1) -> dict:
    """Lista notebooks propios de Kaggle."""
    return my_notebooks(page)


@mcp.tool()
def kaggle_notebook_status(owner: str, slug: str) -> dict:
    """Obtiene el estado de la última versión de un notebook."""
    return notebook_status(owner, slug)


@mcp.tool()
def kaggle_notebook_output_files(owner: str, slug: str) -> dict:
    """Lista archivos de resultado sin descargarlos."""
    return notebook_files(owner, slug)


@mcp.tool()
def kaggle_eduai_training_report(owner: str, slug: str) -> dict:
    """Obtiene solo reportes JSON pequeños de EDUAI Nano."""
    return eduai_report(owner, slug)


@mcp.tool()
def kaggle_submit_eduai_phase1(
    owner: str, slug: str, confirmed: bool = False, run_gpu: bool = False
) -> dict:
    """ACCIÓN DE ESCRITURA: publica notebook privado fijo; requiere aprobación.

    Desactivada por defecto. Sin run_gpu, guarda versión sin ejecutar.
    Con run_gpu, usa cuota si Kaggle autoriza la GPU.
    """
    return submit_eduai_smoke(owner, slug, confirmed=confirmed, run_gpu=run_gpu)


if __name__ == "__main__":
    host = os.environ.get("KAGGLE_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("KAGGLE_MCP_PORT", "8789"))
    if host not in ("127.0.0.1", "localhost") and os.environ.get("KAGGLE_MCP_EXTERNAL_APPROVED") != "true":
        raise RuntimeError("Acceso externo bloqueado: exige OAuth, TLS y controles de red")
    mcp.run(transport="http", host=host, port=port, path="/mcp", stateless_http=True)
