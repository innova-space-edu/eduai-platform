# Gestión Docente — contrato de transacciones Dell PostgreSQL
**Diseño sin ejecutar; no implica migración instalada en Dell.** Fecha: 20-11-2026.

## No sustituir Napsis
Este esquema almacena únicamente carpetas, objetos, formularios, tareas, evidencias, auditoría y permisos. Las notas oficiales, asistencia, matrícula, anotaciones y reportes de curso quedan fuera del almacenamiento propio y sólo se consultarán por una API externa autorizada cuando exista.

## Identidad y permisos
El BFF de Gestión Docente validará sesiones de EDUAI de forma criptográfica, verificará identidad, AAL2 de Administración, institución, membresía vigente y autorización específica en cada request. Ningún rol se derivará de un campo editable. No publicar roles de DB ni credenciales en navegador. No aceptar \`user_id\` o \`school_id\` arbitrario como autoridad. En Dell PG se permitirá el acceso sólo a procedimientos de servidor auditados, sin políticas RLS abiertas al cliente; las tablas de los dos borradores siguen sin políticas y no pueden utilizarse todavía.

## Reserva de cuota (transacción serializable o READ COMMITTED + bloqueo de fila)
1. \`BEGIN\`; verificar sesión/ACL vigente del servidor dentro de la operación de DB (evitar TOCTOU).
2. \`SELECT ... FROM gestion.storage_quotas WHERE school_id=$1 FOR UPDATE;\`
3. Buscar \`(school_id,owner_id,idempotency_key)\` y comparar **todos** los parámetros. Si existe, devolver el mismo resultado o conflicto. El mismo idempotency key nunca puede significar otra subida.
4. Vencer y reconciliar reservas caducadas del colegio con bloqueo (actualizar estado, devolver bytes reservados). Una tarea periódica hará este barrido también sin solicitudes nuevas.
5. Verificar \`used_bytes + reserved_bytes + requested_bytes <= hard_limit_bytes\`. Rechazar de forma atómica si no cabe.
6. Registrar reserva con UUID y TTL breve. Incrementar \`reserved_bytes\`. \`COMMIT\`. La cuarentena y el antivirus se ejecutan **fuera** de la transacción para no bloquear la base con IO de archivos.

## Finalizar subida (dos sistemas: Dell filesystem + PostgreSQL)
1. El scanner confiable confirma un resultado real ClamAV limpio y el archivo OOXML está inspeccionado cuando corresponda.
2. El servicio guarda ciphertext AES-256-GCM + manifiesto y emite un recibo con \`id,school_id,owner_id,folder_id,size,sha256\`. El recibo NO proviene del navegador.
3. \`BEGIN\`; obtener cuota \`FOR UPDATE\`, reserva \`FOR UPDATE\`. Volver a verificar membresía, ACL y parámetros. Si ya está confirmado, devolver el mismo file_id; si está vencido o cancelado, rechazar.
4. Insertar \`file_objects\` con comprobantes de AV, versión de clave y objeto. Cambiar reserva a \`ready\` y mover contadores desde reservado a usado. Registrar evento de auditoría. \`COMMIT\`.
5. El evento confirmado debe ser durable ANTES de responder éxito. Ante fallo, no eliminar automáticamente el objeto cifrado; registrar discrepancia para reconciliar de forma supervisada.

## Tareas y formularios
- Sólo \`administrativos\` con sesión AAL2 y pertenencia vigente crean/asignan tareas. Asignaciones separadas por usuario y establecimiento, sin estados globales ambiguos.
- Operaciones de entrega requieren \`expected_revision\`; \`UPDATE ... WHERE school_id=? AND task_id=? AND user_id=? AND revision=? AND state IN ('assigned','draft','returned')\` y comprobar que \`rowcount=1\`.
- Entrega exige respuesta válida para campos obligatorios y evidencia perteneciente al propio usuario, misma institución y estado listo. Nunca usar archivo sólo porque el navegador entregó un UUID.
- Revisión/retorno/aceptación requieren permisos administrativos (AAL2) y transición permitida. Cada transición anexa un evento de auditoría sin el cuerpo de respuestas ni datos personales.
- **Entregada no significa aprobada**; y **evidencia de subir notas no certifica que Napsis tenga notas oficiales completas**.

## Recuperación y resiliencia
- Reserva \`expired\` libera cuota, pero conserva clave de idempotencia como lápida; el cliente debe enviar nueva clave si reinicia.
- Si quedan archivos cifrados sin registro, o viceversa, detener las operaciones afectadas, identificar y reconciliar sin borrado ciego.
- Guardar manifest JSON solamente en staging; en producción metadatos en PostgreSQL, con dos fases y recuperación definida.
- Realizar respaldos cifrados de la base y ciphertext, copia externa fuera del Dell y ensayo de restauración de clave.
- Verificar cuotas desde **múltiples procesos** y operaciones idempotentes. SQLite demuestra la lógica de serialización pero NO prueba sintaxis, RLS, locks ni transacciones PostgreSQL.
- Revisar el tamaño en disco de los objetos y la expansión del contenido tras inspección, no sólo la longitud enviada.

## Código actual y brecha
- \`hub-metadata-sqlite.py\`: prototipo local transaccional con WAL y \`BEGIN IMMEDIATE\`, cuotas por colegio, reservas, reintentos y tareas. **No apto para producción ni enlazado a navegador**.
- \`test_hub_metadata_sqlite.py\`: casos de aislamiento, permisos, cuotas simultáneas en procesos separados, idempotencia, revocación, entregas y revisiones.
- \`DELL_POSTGRES_GESTION_DRAFT.sql\` + \`DELL_POSTGRES_RESERVAS_STAGE.sql\`: DDL candidatas **sin ejecutar**; falta revisión semántica, RLS, roles SQL, operaciones de escritura y tests de PostgreSQL 17 real en base desechable.
- El gateway Innova storage existente no pudo auditarse por código. La salud de Docker no autoriza reutilizar sus credenciales o servicios.
- El escaneo ClamAV del host tampoco está comprobado desde este servicio; el protocolo fue validado contra un simulador.

## Criterios de release único
Primero verificación de política institucional de datos, autentificación real, almacenamiento antivirus real, base aislada PG 17 con RLS, permisos y tests, contención de concurrencia entre procesos, respaldos y restauración; después ventana de publicación una sola vez, con plan de rollback.
