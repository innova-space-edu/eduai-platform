# Gestión Docente HUB V2 — Corte de desarrollo 20-11-2026

## Visión (definida por el usuario)
Gestión del trabajo y documentos educativos, archivos y nube, evaluaciones y planificaciones mediante proveedores autorizados. NO sustituye Napsis: nunca crear aquí matrícula, asistencia, anotaciones, libro oficial de notas ni informes oficiales. Esas consultas requerirán APIs de proveedores comprobadas y permisos.

## Prototipo HUB V2 en staging aislado
- hub-core.mjs: grupos (administrativos, PIE, Orientación/Convivencia, UTP, docentes, inspectoria, contabilidad, estudiantes, apoderados, otros), sesiones simuladas con verificador externo, MFA administrativo, establecimientos, membresías y revocaciones, ACL carpetas, archivos con recibos verificados por adaptador, tareas a múltiples grupos/personas, estado por destinatario, formularios, evidencia, entrega, aprobación y devolución, supervisión delegada por alcance, notificaciones, banners, botones de plataformas y búsqueda autorizada.
- hub-ui.mjs: panel de Inicio/Tareas/Archivos/Buscar/Plataformas/Administrar; formulario de crear tareas (solo administrativos), plantillas de entrega (formulario/PDF/mixto), carpetas y carga de archivo, entregas con preguntas y evidencia, panel para revisar, publicar banner y agregar enlaces HTTPS.
- hub-router.mjs: contrato de endpoints GET/POST de la misma página, CSRF/Origin, tamaños y tipos de formularios, acoplamiento con un adaptador de almacenamiento y escaneo **simulado**. No ejecuta servidor público.
- hub-core.test.mjs: 32 pruebas de restricciones y flujo.
- hub-router.test.mjs: 18 pruebas de flujo de interfaz, administración, CSRF, archivos PDF simulados, envío y aprobación.
- source-registry.mjs + source-registry.test.mjs: catálogo de proveedores EDUAI Connect, Google Drive, Docs, Sheets, Gmail, Calendar y Napsis; conexión delegada por ticket validado (ficticio), sincronización de metadatos del propietario, revocación y estados desconectado/desactualizado. **No OAuth ni sincronización real.** Mensajes de correo no son indexados.
- hub-search.mjs + hub-search.test.mjs: búsqueda unificada por metadatos autorizados de tareas, archivos y fuentes personales; seguimiento de pendientes, devoluciones y entregas. Si no hay API Napsis, estado de notas oficiales: NO VERIFICABLE.
- ALCANCE_HUB_V2.md: alcance corregido.
- HUB_V2_PERSISTENCIA_Y_SEGURIDAD.md: propuesta de persistencia y modelo de control, NO aplicada a ninguna base.

## Estado de las pruebas
- 130/130 pruebas Node de HUB V2 aprobadas.
- Compatibilidad de staging anterior: 136/136 Node y 11/11 Python aprobadas, aunque las partes de libro de notas del staging anterior no entran en el alcance nuevo.
- Total de pruebas locales del staging: 350/350 aprobadas. Reproducir con bash run-staging-tests.sh desde esta carpeta.

## Límites actuales
- Nada se desplegó. No se modificó la base Supabase, Cloudflare, Vercel ni la versión pública de EDUAI durante esta etapa.
- No se cargaron archivos reales, ni se instaló antivirus, ni se crearon buckets reales. Los recibos de archivos y PDF en las pruebas son objetos ficticios que simulan una verificación de seguridad.
- No se conectó Google ni Gmail ni Napsis con cuentas reales. No se habilitó correo o envío de notificaciones externas.
- El modelo de identidad del prototipo es en memoria y se inyecta desde un adaptador de prueba. No es servidor de autenticación.
- Falta persistencia transaccional, RLS real comprobada en PostgreSQL aislado, escaneo de archivos, conexión real por OAuth y E2E navegador con cuentas de prueba.
- El acceso a entrega de tareas por supervisor requiere delegación específica de contenido; la búsqueda de pendientes puede delegarse por un alcance independiente.
- Los datos oficiales de notas, asistencia, matrículas e informes no se inventan ni se duplican; solo podrán visualizarse tras firmar y probar las APIs correspondientes.

## Siguientes piezas a desarrollar sin publicar
1. Diseño SQL real para HUB (no la migración de matrícula/notas anterior), ejecutar RLS sobre PostgreSQL aislado y probar 2 escuelas y perfiles.
2. Backend almacenamiento privado real con antivirus y cuotas, respaldos/versiones, retención y descargas seguras.
3. Autenticación EDUAI/Supabase real con MFA, CSRF, permisos de grupos, auditoría de visualizaciones y revocación.
4. Integración de EDUAI Connect y Google OAuth individual; separaciones estrictas: correos privados fuera de supervisión.
5. E2E con tareas, formularios, PDF, revisión, directorio y búsqueda; consolidar una única versión candidata y desplegar solo después de completar la lista de salida.

## Adición: almacenamiento Dell Server — desarrollo sin publicación
- Se descartó el uso de Supabase Storage para Gestión Docente. El diseño separa disco SSD Dell (binarios cifrados) + PostgreSQL Dell (metadatos y tareas) + disco externo Dell (backup cifrado). Supabase sólo para identidad si mantiene el contrato de autenticación.
- Observabilidad Dell: SSD ~144,58 GiB libres; externo ~663,97 GiB libres; ClamAV healthy y `innova-storage-authorizer` healthy. No se ha auditado ni modificado el gateway existente.
- Se creó `dell-storage.mjs`: almacenamiento de prueba cifrado AES-256-GCM, anti-tampering AAD, cuarentena, validación de tipos, recibos por usuario/escuela/carpeta, cuota por establecimiento, rechazo ante antivirus caído o positivo, limpieza de temporales y restauración cifrada.
- `dell-hub.integration.test.mjs`: interfaz → PDF simulado → Dell cifrado → carpeta/tarea → entrega → aprobación → descarga segura; la revocación de permisos bloquea inmediatamente las descargas.
- `hub-router.mjs` incorpora GET protegido para descarga; el blob nunca sale como ruta pública ni usa Supabase Storage.
- `DELL_POSTGRES_GESTION_DRAFT.sql`: esquema candidato de metadatos/tareas dedicado a PostgreSQL Dell, SIN EJECUTAR. RLS activado en borrador sin políticas de acceso; requiere pruebas SQL reales y procedimientos seguros.
- `DELL_STORAGE_ARCHITECTURE.md`: rutas propuestas, límites, antivirus, cifrado, protección del directorio, respaldos y plan de despliegue único.
- Se ejecutaron 130/130 pruebas del HUB, 136/136 del staging heredado y 11/11 Python: **350/350 aprobadas**.
- Todos los archivos probados fueron sintéticos. El antivirus de estas pruebas fue simulado: el ClamAV existente en el host NO fue contactado ni modificamos sus contenedores.
- NO crear rutas de producción, servicios, cuentas, bases de datos o respaldos reales hasta la publicación única con revisión y rollback.

## 20-11-2026 — ClamAV INSTREAM y validación de DOCX/XLSX
- `clamav-adapter.mjs`: protocolo oficial de INSTREAM por Unix socket o red interna cerrada, con versión/firmas, timeout y rechazo de detección/errores.
- `inspect-ooxml.py` + `ooxml-adapter.mjs`: inspección de documentos OOXML contra macros/ActiveX/relaciones externas/ZIP peligroso; soporte de DOCX y XLSX en el almacenamiento cifrado.
- `clamav-storage.integration.test.mjs`: prueba del recorrido scanner → cifrado → descarga con autorización usando un servidor simulado del protocolo real.
- `dell-storage.mjs`: verificación de rutas privadas, objetos sin manifiesto y permisos POSIX, falla cerrado al detectar huérfanos; no se borran sin reconciliación.
- `hub-router.mjs`: errores internos y rutas del servidor nunca se devuelven al navegador.
- `CHECKLIST_RELEASE_DELL_STORAGE.md`: lista bloqueante para conectar ClamAV real, persistencia PostgreSQL y release único.
- Suite validada: **130/130 Node HUB, 14/14 Python OOXML, 136/136 Node anterior, 11/11 Python anterior = 350/350**.
- No hubo conexión efectiva al ClamAV del host, instalación, SQL en Dell real ni despliegues. El simulador de protocolo y documentos sintéticos no sustituyen E2E con infraestructura autorizada.

## 20-11-2026 — Persistencia transaccional sin despliegue
- `hub-metadata-sqlite.py`: simulador persistente con transacciones, WAL, bloqueo `BEGIN IMMEDIATE`, membresías, ACL de carpetas, cuotas por colegio, reservas, expiración, recibos verificados, tareas por grupos, control de revisiones, aprobación y auditoría. **SQLite es sólo banco de pruebas; no se utiliza como base definitiva de Gestión Docente**.
- `test_hub_metadata_sqlite.py`: 22 pruebas, incluidas dos conexiones/procesos independientes compitiendo por una misma cuota, idempotencia y protección contra duplicados, expiración/reap de reservas, revocación y persistencia tras reinicio.
- `DELL_POSTGRES_RESERVAS_STAGE.sql`: nueva propuesta PostgreSQL Dell para cuotas, reservas atómicas, auditoría de revisión, casos de reconciliación, unicidad de claves y RLS fail-closed; aún NO aplicada ni ejecutada en PostgreSQL real.
- `dell-postgres-reservations-static.test.mjs`: 8 comprobaciones estáticas de integridad y autorización mínima. No equivalen a pruebas de sintaxis/RLS PostgreSQL.
- `DELL_TRANSACCIONES_CONTRATO.md`: protocolo `FOR UPDATE`, idempotencia, revocación, commit de recibo antivirus y reparación de huérfanos.
- `dell-storage.mjs` entrega recibos server-side con metadata ClamAV y versión de firmas para enlazar con el registro transaccional; `hub-core.mjs` acepta estos metadatos sólo desde el adaptador de servidor.
- Suite total actual: **350/350** (138 Node HUB + 36 Python HUB, 136 Node heredadas + 11 Python heredadas), sin fallas.

### Permanecen pendientes
- La conexión y escaneo **real** por ClamAV en el host Dell, aún no probados por el ambiente aislado.
- Acceso al código/configuración de `innova-storage-authorizer` para analizar si puede reutilizarse, sin afectar CreaLab.
- Migración real y pruebas PostgreSQL 17 + RLS usando una instancia desechable. No hay cliente `psql` ni servidor PostgreSQL en el contenedor aislado actual.
- Autenticación real EDUAI, claves, almacenamiento de metadatos con procedimientos de escritura seguros, restauración y pruebas E2E con roles autorizados.
- No crear rutas del host ni desplegar servicios antes del release único revisado.

## Unificación — 20-11-2026
Ahora hay una sola aplicación candidata que enlaza Worker EDUAI Login/Connect con HUB V2 en /workspace. Archivo de entrada `gestion-unificada.mjs`, prueba `gestion-unificada.test.mjs` y comprobaciones de estado `configuration-probes.mjs`. Suite completa 350/350. PR #345 draft, sin despliegue, E2E real pendiente. Ver `PLATAFORMA_UNICA.md`.
