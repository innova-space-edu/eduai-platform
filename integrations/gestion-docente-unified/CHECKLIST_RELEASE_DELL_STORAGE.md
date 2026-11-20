# Preparación de un único release — Gestión Docente con Dell Storage

Fecha: 2026-11-20
Estado: **BORRADOR / NO DESPLEGAR**.

## Arquitectura definida
- Navegador `gestion-docente.innova-space-edu.cl` → BFF con sesión EDUAI verificada, cookies seguras y CSRF.
- Backend de Gestión Docente → servicio Dell de almacenamiento privado (no nginx estático, sin URLs persistentes de disco).
- Dell SSD interno → objetos por establecimiento cifrados AES-256-GCM, cuarentena de subida privada.
- Dell PostgreSQL 17 → metadatos/ACL/tareas/formularios/evidencias/notificaciones/auditoría, base `gestion_docente` independiente.
- ClamAV ya existente → escaneo INSTREAM por socket Unix o TCP 3310 **en red Docker interna autorizada**. Nunca exponer 3310 al exterior.
- Dell disco externo → respaldo cifrado/versionado, NO montar como directorio público. Complementar con respaldo fuera del servidor.
- Supabase: autenticación EDUAI si procede; **no Supabase Storage para archivos de Gestión Docente**.
- EDUAI Connect: sólo contenidos permitidos; Napsis notas/matrículas/asistencia/informes oficiales se muestran como no verificables hasta tener API comprobada.

## Código desarrollado en staging
- `clamav-adapter.mjs`: scanner para protocolo clamd `zVERSION` y `zINSTREAM`, timeout y detección malware/fallo; endpoints cerrados al host interno `intranet-antivirus:3310`, loopback o socket Unix explicitado. NO probado todavía contra el proceso ClamAV real.
- `clamav-adapter.test.mjs`: socket Unix local simulado, versiones, malware, errores, tamaño, desconexiones.
- `clamav-storage.integration.test.mjs`: servidor de protocolo clamd simulado → escaneo → cifrado AES-256-GCM → validación de descarga. Nunca usa el contenedor ClamAV real.
- `inspect-ooxml.py`: inspector OOXML con biblioteca estándar Python; comprueba límites, ratio descompresión, CRC, macros/ActiveX/OLE, XML externo, DTD y rutas sospechosas. Conservador: puede rechazar documentos legítimos con vínculos externos.
- `ooxml-adapter.mjs`: envoltorio de ejecución fija con `python3 -I -B`, sin shell ni parámetros libres; sólo archivos en cuarentena privada.
- `test_inspect_ooxml.py`, `ooxml-adapter.test.mjs`: DOCX/XLSX válidos y amenazas sintéticas. ClamAV se sigue requiriendo aparte.
- `dell-storage.mjs`: cifrado con metadatos autenticados, permisos 0700/0600, cuotas y protección al arrancar contra objetos cifrados sin manifiesto. Los huérfanos provocan fallo cerrado y exigen reconciliación, nunca se borran automáticamente.
- `hub-router.mjs`: rechaza devolver rutas internas y mensajes de sistema a clientes; descargas reautorizadas.
- `DELL_POSTGRES_GESTION_DRAFT.sql`: propuesta de metadatos locales con RLS fail-closed. NO ejecutado ni validado en PostgreSQL real.

## Checklist bloqueante — antes de despliegue
[ ] 1. Confirmar vía lectura del host la red real, socket, modo TCP y `clamd.conf` del contenedor `intranet-antivirus`; comprobar versión de firmas, MaxFileSize y el límite `StreamMaxLength`. No modificar contenedores existentes.
[ ] 2. Validar acceso del nuevo servicio a ClamAV en red aislada, con las políticas adecuadas. Usar un archivo inofensivo de prueba y prueba controlada de detección; no introducir muestras maliciosas reales ni archivos institucionales.
[ ] 3. Auditar API y audiencia del `innova-storage-authorizer` para decidir si se reutiliza, con separación total de CreaLab; no reconfigurarlo de forma experimental.
[ ] 4. Crear base Dell `gestion_docente` SOLO durante publicación aprobada y transaccional. Ejecutar SQL de prueba en PostgreSQL 17 aislado, revisar nombres/resolución y RLS con dos colegios, tres perfiles y revocaciones.
[ ] 5. Sustituir `#receipts`, `#used` y ACL en memoria por transacciones Postgres, locks de cuota globales, identificadores de operación e idempotencia. No publicar el adaptador actual multi-proceso.
[ ] 6. Verificar puesta en cuarentena, lectura OOXML/ClamAV, tipo MIME real, recursos/CPU/memoria, expiración de temporales y limpieza de abortos. Sin scanner, sin guardar archivos.
[ ] 7. Implementar claves cifradas versionadas y restaurables fuera del volumen de archivos; protección del secreto, rotación, respaldos y acceso por servicio exclusivo.
[ ] 8. Revisar seguridad de endpoints de descargar/subir: autenticación EDUAI real, sesión HttpOnly Secure SameSite, CSRF, ACL por establecimiento y carpeta, alcance de supervisor, rate limiting y auditoría de descargas.
[ ] 9. Probar fallos disco lleno, reinicio, directorio symlink, daño de manifiesto, cuotas concurrentes ENTRE PROCESOS, base PostgreSQL no disponible, rotura de enlace antivirus y restore en otro servidor.
[ ] 10. Verificar backup cifrado + restauración de archivos y Postgres; una copia fuera del Dell.
[ ] 11. Pruebas E2E navegador con cuentas reales de prueba autorizadas, 2 colegios y cuatro roles. No documentos de alumnos reales.
[ ] 12. Preparar rollback y ventana única de release. Backup antes del cambio, verificar salud y reversibilidad. No desplegar por cada modificación.

## Estado de infraestructura observado
- ClamAV `intranet-antivirus`: HEALTHY, últimos logs observados muestran `SelfCheck: Database status OK`. La salud del contenedor no prueba conectividad INSTREAM desde otro servicio.
- `innova-storage-gateway-innova-storage-authorizer-1`: HEALTHY, contrato de reutilización aún pendiente de auditoría.
- Dell PostgreSQL contenedor `intranet-db`: HEALTHY, no se creó la base de Gestión Docente.
- Disco interno: ~144.58 GiB libres. Disco externo: ~663.97 GiB libres según instantánea. Validar nuevos valores inmediatamente antes del release.
- Pruebas de este turno se ejecutaron únicamente en `/workspace` aislado, con archivos sintéticos y servidor clamd simulado; no hubo despliegue ni alteración del sistema anfitrión.

## Comandos reproducibles en staging
`bash run-staging-tests.sh`
`node --test clamav-adapter.test.mjs clamav-storage.integration.test.mjs ooxml-adapter.test.mjs dell-storage.test.mjs`
`python3 -B -m unittest -v test_inspect_ooxml`

## Restricciones críticas
- No reemplazar las funciones académicas de Napsis con matrícula, notas oficiales, asistencia o anotaciones nuevas.
- Sólo administrativos pueden crear tareas; cada grupo puede completar formularios y subir evidencias; aprobación solo con revisión autorizada.
- No enviar PDFs, certificados o información de alumnos a un servicio de pruebas remoto.
- No reutilizar una credencial global para autorizar automáticamente otras aplicaciones.

## Preparación documental adicional — 20-11-2026
- [x] Prototipo transaccional SQLite aislado de cuotas, reintentos y tareas; 22 pruebas aprobadas.
- [x] Extensión del esquema candidato Dell PG con cuota y reserva `FOR UPDATE` especificado; 8 verificaciones estáticas.
- [x] Recibos cifrados de DellStorage incorporan metadata de antivirus server-side para futuro commit.
- [ ] Migrar lógica a PostgreSQL y ejecutar realmente pruebas SQL/RLS en base desechable; no asumir equivalencia SQLite→PG.
- [ ] Revisar `innova-storage-authorizer` (fuente/configuración autorizada) y ClamAV real antes de integrar.
- [ ] Comprobar reconciliación de reserva cuando el objeto cifrado está presente pero la transacción DB se interrumpió.
