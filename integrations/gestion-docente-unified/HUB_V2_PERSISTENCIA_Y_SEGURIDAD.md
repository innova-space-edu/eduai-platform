# Gestión Docente — contrato de persistencia HUB V2 (NO aplicado)
20-11-2026. Se diseña para Supabase/PostgreSQL, pero ningún cambio de producción está autorizado durante la etapa de staging.

## Reemplaza el antiguo diseño de Gestión con matrícula y notas
NO importar tablas de libro de calificaciones, matrícula, asistencia, anotaciones, informes oficiales, ni la migración EDUAI_GESTION_INSTITUTIONAL_DRAFT.sql. Napsis y otras plataformas oficiales serán únicamente fuentes de consulta si existe API licenciada/autorizada y contrato formal.

## Tablas mínimas planteadas
- `gestion_schools`: establecimiento, estado, configuración.
- `gestion_memberships`: (school_id, user_id), grupos, vencimiento, revocación; membresía verificada por administrador, nunca por user_metadata.
- `gestion_oversight_grants`: scope seguimiento:leer/contenido:revisar, propietario concreto o alcance escolar, vigencia y revocación.
- `gestion_folders`: owner_id, school_id, parent_id, nombre, profundidad, retention_policy, deleted_at.
- `gestion_folder_acl`: miembros con viewer/editor, concedido_por, vencimiento, revocación.
- `gestion_file_objects`: metadatos mínimos: id, folder_id, school_id, owner_id, object_key no público, digest SHA-256, MIME validado, tamaño, escaneo AV y versionado. Binarios en bucket privado por tenant con descargas autorizadas (URL firmada corta). Sin URL pública persistente.
- `gestion_tasks`: school_id, title, description, deadline UTC, creator_id, form_schema JSON validado, min_files, plantilla/versionado.
- `gestion_task_recipients`: PK (school_id, task_id, user_id), estado por destinatario, revisión/version, fechas, revisión administrativa.
- `gestion_task_answers`: recipient composite key, respuestas JSON validado contra schema, revisión, historial inmutable. No acceso a otros usuarios sin scope/autoría de tarea.
- `gestion_task_evidence`: recipient composite key, file_id, versión/fecha; same-school/same-owner y permisos, unique.
- `gestion_review_events`: transición, reviewer_id, fecha, reason_code, copia de versión anterior, audit append-only.
- `gestion_notifications`: destinatario, evento, referencia, fecha, leído; cada uno lee solamente los propios.
- `gestion_banners`: audience_groups/establishment, created_by admin, fecha caducidad, sólo lectura destinatarios.
- `gestion_platform_links`: URL HTTPS validada, configuración por establecimiento.
- `gestion_connector_grants`: owner_id, provider, opaque_credential_handle del secret store, scopes, fecha, revocación. Nunca claves OAuth en public ni en logs.
- `gestion_source_index`: metadatos filtrados por proveedor y propietario, updated_at, etag, cursor, estado de sincronización, URL de fuente. No copias de Gmail ni calificaciones oficiales.
- `gestion_audit` (schema privado): quién hizo qué, cuándo, id de recurso, sin texto de respuestas ni tokens ni notas.

## Reglas RLS antes de migración
- Todas las tablas expuestas: RLS habilitada, REVOKE ALL a anon; concesión mínima a authenticated; no escritura directa al frontend en operaciones administrativas.
- Concesión de membresía, grupos, supervisión, tareas, banners y aprobaciones sólo con funciones transaccionales aprobadas, con sesión real + AAL2 de administrativo; bloqueo inmediato de revocaciones en lectura y escritura.
- Comprobar pertenencia a school_id en cada SELECT/UPDATE/INSERT; claves foráneas compuestas con school_id para impedir cruces incluso ante error de código.
- Una carpeta compartida no concede permiso sobre el correo privado ni la nube externa conectada de su propietario.
- Cada estado de tarea es independiente por destinatario; estado validado por transiciones; entrega nunca implica aprobación.
- Cambios simultáneos: `revision` / expected_version (control optimista), transacciones e idempotency_key para POST, historial de versiones.
- Subida de archivo: autorización carpeta antes de subir → stream con cuotas → almacenamiento en cuarentena → verificar MIME, extensión, contenido y antivirus → mover objeto a bucket privado → emitir recibo de servidor → referenciar evidencia. Rechazar/limpiar subidas sin tarea y orfandad.
- No indexar cuerpos de correo; se permitirá correo sincronizado sólo si el usuario consiente expresamente y el proveedor autoriza los scopes mínimos. Supervisión no puede acceder al buzón personal.

## Búsqueda y seguimiento
- `buscar('quién falta')`: filtra obligaciones del HUB que estén assigned/draft/returned, con responsables y vencimientos según permiso de supervisión.
- `buscar('quién falta ingresar notas')`: devolver `no verificable — API oficial no conectada`; si existe tarea de evidencia, informar `pendiente entrega de evidencia` sin equipararla con estado oficial.
- Toda búsqueda por supervisor queda auditada, y el índice no supera la visibilidad del documento de origen ni la del concedente.
- Fuentes con sincronización fallida o vencida se muestran como `sin conexión` / `desactualizada`; no inventar cumplimiento.
- Arquitectura de adaptadores: EDUAI Connect, Google Drive, Docs, Sheets, Calendar, Gmail; otros proveedores sólo si API comprobada y autorización adecuada.

## Diseño de sesión
- El portal futuro empleará sesiones de Supabase verificadas del lado servidor, cookies HttpOnly, Secure, SameSite, CSRF por formulario, rotación y caducidad.
- Roles administrativos no se derivan del texto del perfil editable; usar grants del servidor.
- Los endpoints simulados de hub-router.mjs no son seguros para ser expuestos sin injectar adaptadores reales de autenticación, almacenamiento, escaneo y autorización.
- Las pruebas actuales usan cuentas ficticias y un adaptador de PDF que simula escaneo; **no se ha ejecutado antivirus ni almacenamiento real**.

## Próxima fase ANTES de un único release
1. Base PostgreSQL desechable, migración RLS y fixtures de 2 escuelas, 3 grupos, 2 supervisores, 2 docentes.
2. Implementar funciones transaccionales seguras y pruebas de transiciones concurrentes y auditoría.
3. Seguridad de archivos con bucket privado, antivirus e inspección, límites y conservación.
4. Conectores OAuth sólo tras validar el proveedor y obtener consentimiento, sin copiar credenciales al portal.
5. Probar E2E navegador con perfiles reales de prueba; verificar salida de Connect sin exponer respuestas de exámenes activos.
6. Consolidar en una release única revisada, con respaldo y rollback. No desplegar por cada commit.
