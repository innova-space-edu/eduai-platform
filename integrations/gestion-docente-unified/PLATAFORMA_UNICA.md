# EDUAI Gestión Docente — UNIFICACIÓN DE PILOTO + HUB V2
**Fecha:** 20-11-2026. **Estado:** candidata única en desarrollo, SIN despliegue institucional.

## Regla de producto
UNA aplicación, UNA URL: https://gestion-docente.innova-space-edu.cl
- El Worker ya asignado a la URL queda como punto de entrada, login EDUAI y Connect.
- El HUB de tareas, carpetas, formularios, evidencias, búsqueda, anuncios y supervisión es un módulo de **la misma aplicación**, disponible bajo /workspace una vez autorizado, no otro portal ni otro dominio.
- /workspace/configuration muestra el estado real de integraciones y sólo Administración institucional puede consultarlo.
- El código está en una SOLA PR: https://github.com/innova-space-edu/eduai-platform/pull/345
- Al publicar, se debe hacer la transición del Worker piloto al enrutador unificado en una ventana controlada; no mantener dos aplicaciones publicadas.
- El acceso desde el dashboard de EDUAI será un único enlace directo al dominio.

## Unificación de código
- `eduai-worker-foundation.mjs`: copia de trabajo del Worker piloto, verifica EDUAI, consentimiento y Connect. La versión GitHub exporta `requireEduaiIdentity` sin otorgar rol escolar.
- `gestion-unificada.mjs`: entrada única: /login, /connect, /workspace, /workspace/configuration; rutas HUB con el mismo origen y redirección tras autenticarse.
- `hub-core.mjs`, `hub-ui.mjs`, `hub-router.mjs`: núcleo del portal, roles, creación de tareas sólo por administrativos, respuestas/evidencias, carpetas y autorizaciones.
- `configuration-probes.mjs`: comprobaciones de configuración: pending por defecto, sólo ready si un probe verificado y reciente aporta referencia de evidencia. NO considera un simple Docker healthy como prueba suficiente.
- `source-registry.mjs`: metadatos de EDUAI/Google sólo cuando se conecte OAuth real y el usuario autorice; Napsis sigue no conectado y sin libro de notas.
- `dell-storage.mjs`, `clamav-adapter.mjs`, `ooxml-adapter.mjs`: cifrado, antivirus y tipos documentales bajo servidor Dell (aún adaptadores probados con simuladores).
- `DELL_POSTGRES_*DRAFT.sql`, `DELL_TRANSACCIONES_CONTRATO.md`: persistencia propuesta de carpetas, tareas, recibos y cuotas. NO APICAR EN PRODUCCIÓN todavía.

## Estado de verificación
- En el Dell aislado: **350/350 pruebas aprobadas**:
  - 167 Node del HUB + enrutador unificado + Worker EDUAI copiado.
  - 36 Python del HUB / SQLite transaccional / OOXML.
  - 136 Node y 11 Python del staging anterior (compatibilidad; NO habilitar el antiguo libro oficial de notas).
- Cloudflare confirma el dominio Worker production `gestion-docente.innova-space-edu.cl`, servicio `gestion-docente`. Esto NO confirma login HTTPS E2E o funcionamiento del HUB V2.
- Repo GitHub PR #345 permanece draft. Los archivos del HUB V2 se incorporaron en `integrations/gestion-docente-unified/`; el Worker en `integrations/gestion-docente-worker/worker.mjs`.
- Prototipo HTML autónomo para revisar diseño y flujo con datos falsos: `gestion_docente_unificada_preview.html` adjunto al chat. No es la web en vivo.

## Pendiente antes de una sola publicación
1. Configurar gateway autenticado y ruta de red del Worker al servicio privado Dell, sin exponer la base PostgreSQL ni el almacenamiento al navegador.
2. Implementar backend Dell con PostgreSQL 17 REAL (no SQLite), RLS/roles, transacciones, cuota multi-proceso, auditoría y E2E multi-tenant.
3. Integrar autenticación EDUAI actual + verificación independiente de membresía escolar en Dell; permisos de grupos, supervisión explícita y MFA administrativo, sesiones seguras y CSRF.
4. Integrar ClamAV real, OOXML, bucket cifrado privado, versiones, restauración y backup externo.
5. Poner en marcha correo/notificaciones, Google Drive/Docs/Sheets/Calendar/Gmail solo tras OAuth y consentimientos individuales. Nada de leer correos privados por supervisor.
6. Revisar permisos de tablas y RPC Connect, en especial cualquier política antigua de lectura pública de evaluaciones activas; no compartir contenidos sin autorización.
7. Probar dominio/HTTPS real, login, acciones admin/PIE/UTP/docente, acceso entre colegios, subida y descarga, errores de almacenamiento, backup/rollback y CI.
8. Publicar UNA release revisada con comprobación posterior, sin ensayos sucesivos en producción.

## Advertencias explícitas
- Hoy NO está listo para procesar documentos de alumnos, generar informes oficiales ni enviar correos reales.
- Napsis y proveedores oficiales sólo se verán por APIs autorizadas que aún no se han conectado; no duplicar matrícula, asistencia, notas oficiales, anotaciones ni informes de curso.
- Que el código y las pruebas estén fusionados no significa que el Worker Cloudflare pueda ejecutar Node.js filesystem del Dell. Hace falta gateway/API de Dell, infraestructura y conexión verificada.
- No confundir las 350 pruebas simuladas con E2E real.
