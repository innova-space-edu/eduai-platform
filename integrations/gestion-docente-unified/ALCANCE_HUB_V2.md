# Gestión Docente — HUB V2: alcance corregido (20-11-2026)
**Documento local de desarrollo. NO desplegar.**

## Propósito
Un espacio de gestión de trabajo pedagógico que FEDERA documentos e información desde EDUAI y otras plataformas autorizadas. No duplicar Napsis. Gestión Docente conserva metadatos, entregas, vínculos, tareas, evidencia y auditoría de contenidos.

## Módulos activos
1. Inicio personalizado, accesos directos y banners administrativos.
2. Mis carpetas, subcarpetas y archivos (creación por cualquier miembro activo). Compartir con usuarios/grupos autorizados. No acceso cruzado por defecto.
3. Documentos y nube: carga en almacenamiento segregado por establecimiento, propietario, política de retención y verificación del archivo; mostrar solo contenido permitido. Este prototipo NO guarda bytes reales.
4. Tareas: **SOLO** perfiles administrativos (dirección/administración/administrador) con sesión MFA y nombramiento vigente pueden crear/asignar tareas. Docentes, UTP, PIE, orientación, inspectoría, etc., pueden cumplir sus tareas. Una tarea asignada a un grupo debe tener un estado independiente por destinatario.
5. Evidencias: cada destinatario adjunta archivos propios o compartidos explícitamente, entrega y recibe aprobación/devolución por administrativo. Entrega ≠ aprobación. Cambios registrados.
6. Supervisión: solo personas con privilegio institucional explícito `seguimiento:leer` o `contenido:revisar` pueden ver registros y contenidos de otros. La pertenencia a un rol NO desbloquea los contenidos privados automáticamente.
7. Buscador global con RBAC: metadatos de archivos, planificaciones, evaluaciones, tareas, responsables, vencimientos, origen y estado. Filtro por establecimiento, permisos de visibilidad y permisos de supervisión. No índice de mensajes de correo privados.
8. Conectores: EDUAI Connect, Google Drive/Docs/Sheets, Gmail/Calendar, otras aplicaciones. Instalar OAuth individual, consentimiento, scopes mínimos, revocación, progreso incremental, marcadores de sincronización y detección de errores ANTES de afirmar conexión.
9. Correo y notificaciones: bandeja interna de tareas y recordatorios. Envío de correo externo únicamente con consentimiento, permisos y proveedor conectado; supervisores nunca obtienen acceso a mensajes privados del docente.
10. Acceso rápido a plataformas y catálogo de herramientas.

## Fuera de alcance nativo
- Matrículas, asistencia, anotaciones, notas oficiales, libros y reportes oficiales por curso **no se crearán como registros propios**.
- Solo podrán consultarse a través de APIs externas verificadas; sin API, mostrar `Sin conexión` o `No verificable`.
- Una tarea «subir notas» mide entrega de evidencias en el HUB, NO prueba que las notas oficiales estén ingresadas en Napsis.

## Matriz de acceso
- Todo usuario activo: crear carpetas personales, adjuntar archivos, consultar sus recursos, cumplir tareas, ver sus notificaciones.
- Un miembro con permisos de colaboración en una carpeta: agregar archivos en esa carpeta; sin permiso, no.
- Administración: crear tareas, asignar por usuario o grupo, revisar entregas, enviar banners y definir enlaces institucionales. MFA.
- Supervisión autorizada: revisar informes/tareas o contenido de personas específicas según permisos, periodo y establecimiento. Registro de consultas.
- Un usuario puede tener varios grupos, pero sus permisos derivan de membresía aprobada y autorizaciones vigentes, nunca de formulario o preferencias locales.

## Seguridad y pendientes
- Borrador de dominio y pruebas en memoria solamente. Requiere RLS por tenant y ACL, almacenamiento de objetos, antivirus, límites y tipos de archivo, protección CSRF, autenticación real, auditoría y pruebas con dos establecimientos.
- Sin deploy intermedio. La antigua rama `gestion-docente-gradebook-pilot` queda **archivada fuera del alcance**; no fusionarla. Tampoco aplicar su SQL.
- No conectar cuentas ni consultar correo real por ahora. No exponer las credenciales/tokens de conectores a supervisores.
- Revisión institucional de finalidad, conservación, compartición de contenidos y datos de estudiantes antes de activar usuarios reales.

## Estado de integraciones
- EDUAI Connect: backend de permisos para docentes creado previamente, falta verificación positiva E2E y aislamiento de app externa.
- Google Drive/Docs/Sheets/Gmail/Calendar: conectores planificados, todavía no integrados en esta web.
- Napsis y otros: únicamente futuras integraciones API autorizadas. No se suponen endpoints ni disponibilidad.
