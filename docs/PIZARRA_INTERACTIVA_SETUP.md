# Pizarra interactiva — configuración inicial

La ruta principal es `/pizarra-interactiva`.

## Variables de entorno

Configura estas variables en Vercel o en tu archivo local `.env.local`:

```env
WHITEBOARD_RECOGNITION_URL=https://api.mathpix.com/v3/strokes
WHITEBOARD_RECOGNITION_HEADERS_JSON={"app_id":"TU_APP_ID","app_key":"TU_APP_KEY"}
```

No expongas las credenciales en componentes del navegador. La ruta del servidor `/api/whiteboard/recognize` es la encargada de enviar los trazos al proveedor.

## Comportamiento actual

- La pizarra captura trazos con mouse, lápiz o dedo.
- El borrador elimina trazos completos.
- Cada modificación agenda un nuevo reconocimiento.
- El panel derecho muestra y permite editar el LaTeX reconocido.
- El chat superior usa `/api/agents/matematico` e incorpora el LaTeX actual como contexto.

## Próximas mejoras

- Validación simbólica paso a paso.
- Historial persistente de procedimientos.
- Modo evaluación con trazabilidad.
- Borrado parcial dentro de un mismo trazo.
