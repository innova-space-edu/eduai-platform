# Pizarra interactiva — configuración inicial

La ruta principal es `/pizarra-interactiva` y el modo de examen usa el mismo motor desde el cuaderno de desarrollo.

## Variables de entorno

Configura estas variables en Vercel o en tu archivo local `.env.local`:

```env
WHITEBOARD_RECOGNITION_URL=https://api.mathpix.com/v3/strokes
WHITEBOARD_RECOGNITION_HEADERS_JSON={"app_id":"TU_APP_ID","app_key":"TU_APP_KEY"}
WHITEBOARD_RECOGNITION_TIMEOUT_MS=6500
WHITEBOARD_RECOGNITION_CACHE_TTL_MS=12000
WHITEBOARD_RECOGNITION_PAYLOAD_MODE=mathpix
```

No expongas las credenciales en componentes del navegador. La ruta del servidor `/api/whiteboard/recognize` es la encargada de enviar los trazos al proveedor.

## Ajustes de rendimiento

- `WHITEBOARD_RECOGNITION_CACHE_TTL_MS`: evita repetir el mismo reconocimiento cuando el estudiante presiona actualizar o se reenvían trazos iguales.
- `WHITEBOARD_RECOGNITION_MAX_POINTS_PER_STROKE`: reduce puntos por trazo para bajar peso de la petición sin perder la forma general.
- `WHITEBOARD_RECOGNITION_MIN_POINT_DISTANCE`: sube este valor si el envío sigue pesado; bájalo si la escritura del estudiante pierde detalle.
- `WHITEBOARD_RECOGNITION_PAYLOAD_MODE=legacy-nested`: úsalo solo si tu proveedor personalizado espera el formato anterior `{ strokes: { strokes: ... } }`.

## Comportamiento actual

- La pizarra captura trazos con mouse, lápiz o dedo.
- El borrador elimina trazos completos.
- Cada modificación agenda un nuevo reconocimiento.
- El panel derecho muestra y permite editar el LaTeX reconocido.
- El chat superior usa `/api/agents/matematico` e incorpora el LaTeX actual como contexto.
- El modo examen guarda el LaTeX, el texto legible y la imagen del lienzo como evidencia.

## Próximas mejoras

- Validación simbólica paso a paso.
- Historial persistente de procedimientos.
- Modo evaluación con trazabilidad.
- Borrado parcial dentro de un mismo trazo.
