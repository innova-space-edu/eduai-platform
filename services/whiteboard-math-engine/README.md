# EduAI Whiteboard Math Engine

Servicio aislado para resolver, simplificar, graficar y verificar procedimientos matemáticos mediante FastAPI y SymPy.

## Ejecución local

```bash
cd services/whiteboard-math-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

## Variables

- `WHITEBOARD_MATH_ENGINE_TOKEN`: token opcional exigido mediante `Authorization: Bearer ...`.

En la aplicación Next.js:

- `WHITEBOARD_MATH_ENGINE_URL`: URL pública del servicio, sin `/solve` al final.
- `WHITEBOARD_MATH_ENGINE_TOKEN`: el mismo token configurado en el servicio.

## Despliegue

El directorio contiene un `Dockerfile` compatible con Render, Railway, Cloud Run, Fly.io o cualquier plataforma que despliegue contenedores. El endpoint de salud es `GET /health` y el endpoint matemático es `POST /solve`.

La aplicación web mantiene un motor determinista para aritmética y ecuaciones polinómicas básicas, además de un respaldo pedagógico con IA. Por eso la pizarra sigue funcionando aunque el servicio Python esté temporalmente desconectado; cuando `WHITEBOARD_MATH_ENGINE_URL` está configurado, SymPy tiene prioridad.
