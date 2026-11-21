# Gestión Docente — almacenamiento principal en Dell (diseño sin deploy)
Fecha: 20-11-2026. Estado: prototipo de adaptador probado en /workspace, NO conectado al host ni a producción.

## Decisión
- **Binarios y metadatos de archivos:** Dell Server.
- **Tareas, formularios, entregas, permisos y auditoría:** Dell PostgreSQL 17 en una base de datos propia y aislada `gestion_docente`, con cuentas y funciones de privilegio mínimo.
- **Supabase EDUAI:** sólo para identidad/autenticación si se mantiene el contrato actual; evitar almacenar archivos o duplicar datos personales en Supabase.
- **Napsis:** nunca crear aquí matrícula/asistencia/notas oficiales. Consultar por API autorizada cuando exista.
- **Google y EDUAI Connect:** metadatos y contenidos permitidos mediante conectores que respeten dueño, scopes, revocación y actualizaciones.

## Verificación de infraestructura del Dell (instantánea de observabilidad)
- Disco interno con ~144.58 GiB libres de ~206.71 GiB.
- Disco externo montado en `/mnt/intranet-backup-disk`: ~663.97 GiB libres de ~931.51 GiB.
- Docker: 19 contenedores en marcha. `intranet-antivirus` (clamav/clamav:stable) healthy.
- `innova-storage-gateway-innova-storage-authorizer-1` healthy: servicio existente asociado a la infraestructura de almacenamiento de Innova. Su compatibilidad, rutas, audiencias, cuentas y segregación de CreaLab aún **no han sido auditadas**; no modificarlo ni considerarlo automáticamente reutilizable.
- `intranet-db` PostgreSQL 17 healthy. NO crear nueva base ni tocar la existente hasta la ventana de despliegue revisada.

## Rutas propuestas — NO creadas en host
- Primario: `/srv/innova-gestion/storage/` en SSD interno; propietario exclusivo servicio gestion-storage (0700), nunca servir con nginx estático.
- `/srv/innova-gestion/storage/quarantine`: subida pendiente (0700). El prototipo almacena temporalmente texto claro durante escaneo; en producción, usar tmpfs cifrado o volumen con cifrado en reposo y limpieza segura. Cuota y expiración de cuarentena.
- `/srv/innova-gestion/storage/objects/{school_uuid}/{file_uuid}.enc`: archivos cifrados con AES-256-GCM y permisos 0600, nada de nombres de estudiantes en rutas.
- Metadatos, versiones y transiciones de tarea en PostgreSQL 17 dedicado. El prototipo actual guarda manifiestos JSON locales `{file_uuid}.json` solo para validar comportamiento, NO es un sustituto transaccional definitivo.
- Respaldos: `/mnt/intranet-backup-disk/INNOVA_GESTION_BACKUPS/`, **a crear únicamente durante publicación aprobada**; cifrar los archivos respaldados y la copia de metadatos. El disco externo no constituye copia fuera de sitio.

## Secuencia de subida
1. El navegador inicia sesión en Gestión Docente. El backend verifica token EDUAI, membresía vigente, permisos de carpeta/tarea y CSRF.
2. El usuario elige archivo. Sólo la API privada del Dell recibe bytes; se rechazan rutas, formatos y tamaños incompatibles.
3. Escribir en cuarentena de acceso exclusivo con límites; verificar firma y tipo reales. DOCX/XLSX requieren inspector OOXML estricto antes de habilitarse; el prototipo los RECHAZA sin inspector.
4. Escaneo real por ClamAV. Si está caído, no registra el archivo (**fail closed**). Las pruebas usaron un escáner SIMULADO que devuelve el contrato, no ClamAV real.
5. Cifrado AES-256-GCM (IV aleatorio y metadatos vinculados criptográficamente AAD); objeto con nombre UUID en directorio de establecimiento.
6. Registrar objeto, checksum, propietario, política de retención y revisión en Dell PostgreSQL (transacción con reserva de cuota). Recibo de servidor temporal, no modificable por navegador.
7. Referenciar objeto desde carpeta o evidencia de tarea. Una entrega NO queda aprobada hasta revisión por Administración.

## Descarga
- Nunca URL pública a /srv ni enlaces permanentes a disco.
- La API Dell autentica cada GET, consulta la ACL y el permiso específico, verifica que el archivo pertenece al mismo establecimiento y sólo entonces descifra y envía con Content-Disposition: attachment y no-store.
- Revocar usuario, compartir carpeta o supervisión cambia la autorización en la próxima solicitud. El PDF no es público y no se permite listar directorios del host.
- Para consultar otro usuario, autorización explícita `contenido:revisar`, vencimiento, revocación y registro de acceso. Ni siquiera Administrativos obtiene lectura de carpetas privadas por su rol únicamente.

## Cuotas iniciales (ajustables antes de publicar)
- Límite de archivo en el prototipo: 20 MiB; recomendado revisar necesidades de videos/escaneos antes de activar.
- Escuela: 5 GiB de almacenamiento activo de arranque; ampliaciones desde administración.
- Techo total de almacenamiento lógico V1: 80 GiB, conservando margen en SSD para sistema, modelos y bases.
- Cuotas de usuario, número de objetos y reservas concurrentes se implementarán mediante transacciones PostgreSQL. El mutex de pruebas sirve sólo para un proceso y NO es un mecanismo suficiente de producción.
- Eliminar archivos con retención, papelera, revisión de referencias, y limpieza de huérfanos; nunca borrar datos directamente al reemplazar una versión.

## Seguridad y despliegue futuro
- Host expuesto al navegador sólo por Cloudflare Tunnel + Zero Trust/Access o gateway autenticado equivalente, con HTTPS, verificación de audiencia del token, rate limiting, origen cerrado y sin publicar 5432 ni puertos de almacenamiento.
- El Dell no debe aceptar `service_role` de Supabase ni credenciales de usuario suministradas como cadena libre por el frontend. Validar JWT/usuario real y reautorizar cada operación.
- Clave de cifrado de 32 bytes desde secret store del host, NO en GitHub, logs ni backup de datos; versión/rotación y recuperación segura de clave por procedimiento independiente.
- La instantánea del disco externo podría requerir tratamiento especial de permisos si usa NTFS. Verificar tipo de sistema de archivos y montajes antes de preparar copias y no asumir chmod POSIX en NTFS.
- Respaldo nocturno cifrado + copias incrementales + verificación SHA256 + ensayo de restauración, y copia fuera de sitio adicional para protección contra pérdida física del Dell.
- Escaneo ClamAV real, protección contra malware OOXML, pruebas RLS reales PostgreSQL, seguridad de compartir, restauración, cuotas concurrentes entre varios procesos y E2E dos colegios antes de publicar.
- Reutilizar el gateway Innova existente SÓLO si sus políticas permiten una aplicación aislada por tenant, audience y clave; no tocar CreaLab ni exponer rutas antiguas por conveniencia.

## Código preparado en staging aislado
- `dell-storage.mjs`: adaptador local de cifrado, cuarentena, límites, verificador externo de ClamAV, recibos vinculados a owner/school/folder, descifrado sólo con autorización, recuperación de metadatos tras reinicio.
- `dell-storage.test.mjs`: pruebas de cifrado, MIME, escaneo simulado, tamper, cuotas, backup cifrado restaurado y fuga de metadatos.
- `dell-hub.integration.test.mjs`: flujo end-to-end simulado desde interfaz: PDF → cifrado Dell → carpeta → tarea → entrega → aprobación → descarga autorizada; bloqueo de administración sin ACL, revocación inmediata, error antivirus.
- `hub-router.mjs`: descarga protegida `/files/:fileId/download` + subida `/files/upload` y `/tasks/:id/upload`, todavía con adaptadores inyectados, NO servidor público.
- `DELL_POSTGRES_GESTION_DRAFT.sql`: diseño de esquema **sin ejecutar**. RLS fail-closed sin políticas de acceso hasta una revisión con PostgreSQL local aislado.
- `dell-postgres-static.test.mjs`: verificación estática de tablas/permisos; NO equivale a pruebas de funcionamiento SQL real.

**Estado:** implementado y probado en /workspace, no instalado en la ruta del host ni publicado; no se cargaron documentos institucionales ni se modificaron servicios activos.

## Validación adicional en staging (20-11-2026)
La conexión para escaneo clamd `zVERSION`+`zINSTREAM` quedó desarrollada con `clamav-adapter.mjs`, usando un socket Unix simulado en las pruebas. Almacenar solamente si retorna `stream: OK`; las firmas `FOUND`, `ERROR`, timeouts y respuestas inválidas se rechazan.
La inspección ZIP/OOXML con Python estándar ahora admite `docx` y `xlsx` seguros en el adaptador de prueba. Se bloquean macros, ActiveX, OLE, relaciones externas y ZIPs con expansión sospechosa. Ambos controles son acumulativos: OOXML nunca sustituye a ClamAV.
El almacenamiento comprueba permisos privados POSIX en las carpetas de servicio y detiene su inicialización si encuentra objetos cifrados sin manifiesto. Estos casos requieren reparación supervisada (sin purga automática). No hay persistencia de registros de tareas en PostgreSQL todavía.
Pruebas locales totales **321/321** (130 Node HUB + 14 Python OOXML + 136 Node anteriores + 11 Python anteriores). La conectividad ClamAV real, la semántica PostgreSQL/RLS, las reservas de cuotas entre procesos y el gateway de CreaLab continúan pendientes. Ver `CHECKLIST_RELEASE_DELL_STORAGE.md`.

## Persistencia y cuotas — contrato nuevo (20-11-2026)
Diseño en `DELL_TRANSACCIONES_CONTRATO.md`. El banco de pruebas `hub-metadata-sqlite.py` usa transacciones entre conexiones/procesos y demuestra reintentos idempotentes, contención de cuotas por establecimiento, liberación de reservas vencidas, permisos de carpeta, creación de tareas sólo por administrativos con AAL2, estados de evidencia por destinatario y revisión con número de versión. NO ejecutar SQLite en producción para reemplazar Dell PostgreSQL.
La migración `DELL_POSTGRES_RESERVAS_STAGE.sql` sigue como candidato, NO se aplicó ni validó contra un motor PostgreSQL. Para iniciar producción son bloqueantes RLS real, procedimientos autorizados, cuotas reservadas multi-proceso, reconciliación de filesystem/BD y recuperación de claves.
