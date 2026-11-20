# Gestión Docente — una sola aplicación (candidato, NO desplegado)
Unifica en el mismo dominio y sesión la identidad/Connect del Worker original y el HUB V2 con tareas, formularios, supervisión autorizada, carpetas y archivos del Dell.
- Entrada: `gestion-docente.innova-space-edu.cl`. El piloto publicado actual **no se reemplaza con estos cambios** hasta una ventana de release.
- `gestion-unificada.mjs`: fachada de rutas `/workspace`, `/connect`, `/login` y configuración administrativa; identidad EDUAI y membresía institucional Dell separadas.
- `hub-core.mjs`, `hub-router.mjs`, `hub-ui.mjs`: prototipo de dominio y BFF, aún con adaptadores inyectados. **NO exponga esto a producción sin implementación de persistencia/autenticación reales.**
- Funciones oficiales de notas, matrículas, asistencia e informes NO se replican; Napsis solo por API oficial autorizada cuando exista.
- Solo administrativos con MFA crean tareas; los demás completan formularios y entregan evidencia; supervisión únicamente por grants vigentes.
- Versionado y cambios del flujo en el directorio `integrations/gestion-docente-unified`. Este PR queda en borrador.
- Pendiente: Dell Postgres + RLS reales, gateway autorización/sesiones, storage ClamAV real, backup/restore, OAuth Google, E2E dos colegios y CI.
- `node --test integrations/gestion-docente-unified/gestion-unificada.test.mjs integrations/gestion-docente-worker/worker.test.mjs` desde raíz.
**No activar con estudiantes reales ni publicar por el hecho de pasar pruebas simuladas.**
