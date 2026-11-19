# EDUAI Gestión Docente + Connect — contrato de fase 1

Estado: base de autorización docente aplicada en Supabase el 19-11-2026. El panel y la arquitectura institucional siguen en borrador. No hay API HTTP externa desplegada ni docentes aprobados. Ver EDUAI_CONNECT_DATABASE_BOUNDARY.sql.

## Alcance de esta entrega

- Ruta privada /gestion-docente: inventario de recursos propios de cada cuenta autenticada (exámenes, planificaciones, documentos). Solo metadatos, paginación, sin service role.
- El catálogo se consulta en origen, no replica archivos ni guarda notas en el Dell.
- No se asignan instituciones por correo, curso textual ni rol de administrador global.
- La API y el libro de calificaciones esperan la estructura institucional y pruebas de aislamiento.

## Modelo académico propuesto (sin aplicar)

- eduai_schools: id, nombre, código externo opcional, estado.
- eduai_school_members: school_id, user_id (auth.users), rol director/UTP/docente, estado, approved_by, approved_at; único school_id + user_id. Alta por administrador institucional verificado; no autoinscripción.
- eduai_academic_years: id, school_id, año, estado; identificador compuesto school_id + id.
- eduai_academic_periods: id, school_id, year_id, nombre, inicio, término, estado; FK compuesta al año.
- eduai_classes: id, school_id, year_id, nivel, grado, sección; único por establecimiento/año/grado/sección.
- eduai_subjects: id, school_id, código curricular, nombre.
- eduai_teaching_assignments: id, school_id, year_id, class_id, subject_id, teacher_id, estado; FKs compuestas al curso, asignatura y miembro.
- eduai_school_enrollments: id, school_id, year_id, class_id, roster_id, estado; no exponer RUT. El roster heredado es global: no vincular por nombre, correo o curso sin revisión del establecimiento. No copiar automáticamente.
- eduai_academic_resources: id, school_id, assignment_id, period_id, source_kind (exam/planning/asset), source_id, owner_id, publication_state; cada vínculo comprueba que el recurso pertenece al docente y que el periodo corresponde al mismo año. Referencias con restricciones, sin duplicar payloads. Evitar enlaces polimórficos sin validación; preferir tablas separadas por tipo o FKs tipadas.
- eduai_grade_publications: school_id, assignment_id, period_id, exam_id, submission_id, enrollment_id, versión, nota revisada, published_by, published_at, estado. Solo evaluaciones publicadas y revisión docente. Distinguir nota provisional, validada y oficial externa; no convertir ausencias en 1,0. Retirar publicación conserva auditoría.
- eduai_integration_apps: id, propietario, nombre, estado, redirect_uris permitidas, autenticación de servidor. Sin secreto en cliente.
- eduai_integration_grants: app_id, school_id, sujeto autorizante, scopes, assignment/course scope, expires_at, revoked_at, purpose; consentimiento/autorización verificable y fundamento de tratamiento.
- eduai_integration_audit: app_id, actor, school_id, acción, recurso, resultado, request_id, timestamp. No tokens, RUT, contenido de documentos ni notas en logs.

Todas las FKs de ámbito deben incluir school_id; no confiar en parámetros enviados por el cliente. Usar RLS con membresías activas y asignaciones explícitas, permisos mínimos por tabla y funciones SECURITY INVOKER. Si una función privilegiada fuera imprescindible, limitarla a esquema privado y revisar acceso. Aislamiento probado con dos instituciones, dos docentes y una integración revocada. No habilitar escrituras de clientes sobre membresías, grants o publicaciones sin el flujo autorizado.

## Integraciones

La API HTTP se desplegará en una aplicación web independiente de EduAI (p. ej. Innova School/Intranet), no en las rutas de EduAI. Base propuesta /api/connect/v1 en el host externo. La aplicación usa la sesión validada del docente de Supabase Auth y las RPC limitadas de la base; nunca recibe service_role. No usar un token de un administrador para consultas de docentes. Primero recursos docentes propios: /documents, /plannings, /exams (solo metadata), /documents/:id/download. Luego /schools, /courses, /subjects, /periods, /grades, /analytics y /students (nómina mínima) con autorización institucional. Separar documents:read, documents:download, plannings:read, exams:read, grades:read, students:read, analytics:read. Nunca incluir respuestas oficiales, códigos, incidentes, RUT ni enlaces Storage permanentes. Identidad OAuth delegada con PKCE y tokens de corta duración; integraciones servidor-servidor con credenciales limitadas, no service_role compartida. Revocación comprobada por petición. Límites de página, validación de parámetros, rate limiting, auditoría y Cache-Control: private, no-store. Archivos privados mediante descarga autorizada o URL firmada breve. No hacer fetch de external_url arbitrarias.

## Hallazgo a resolver antes de abrir Connect

En la inspección de metadatos del 19-11-2026, teacher_exams conserva política SELECT "Public read active exams" (status = 'active') y GRANT SELECT para anon/authenticated. El código guarda la pauta en questions. Esto representa riesgo de acceso a la pauta por la Data API si la tabla está expuesta. Verificar de forma controlada sin leer/exfiltrar respuestas reales; auditar consumidores actuales, sustituir lectura pública por endpoint de proyección segura, luego retirar política y grants innecesarios. No retirar en caliente: los flujos de ingreso a exámenes deben probarse primero. El panel de fase 1 filtra siempre teacher_id = usuario, selecciona únicamente campos de inventario y no cambia la política existente.

student_roster no tiene school_id; las políticas y el uso de roster deben auditarse antes de cualquier integración. No mostrar nombres de estudiantes ni notas por ahora. Las planificaciones tienen campos curso/asignatura y variantes legacy; exam_submissions tiene grade y student_roster_id; no deducir automáticamente asignatura o semestre de topic/settings sin verificación docente.

## Criterios de aceptación siguientes

1. Crear migración versionada y ensayarla en DB de prueba, con grants explícitos y RLS. Sin datos reales en fixtures.
2. Importar nóminas y vincular documentos/evaluaciones mediante selección confirmada de establecimiento, año, curso, asignatura, periodo y docente.
3. Publicar notas revisadas, conservar historial, exportar solo filas autorizadas. Calcular promedio con pesos/reglas declarados y sin imputar datos faltantes.
4. API con autorización de recurso, paginación, respuestas mínimas, pruebas 401/403/404, IDOR, revocación y expiración.
5. Integración Dell con BFF, asociación de identidad autenticada, secretos en servidor, no por igualdad de correo. Registrar compose.eduai.yaml mediante innova-portal-deploy register --overlay compose.eduai.yaml y desplegar mediante comando protegido. No registrar secretos ficticios ni cambiar credenciales CEO.
6. Validar seguridad, privacidad, carga y compatibilidad antes de un único despliegue de producción.

## Fase 1: pruebas de aceptación del panel

- Sin sesión: redirección a login.
- Cuenta A no puede obtener inventario B (incluidos assets públicos y exámenes activos de B).
- Consultas explícitas de columnas, no incluyen questions/settings, respuestas, rutas internas, RUT ni notas.
- Paginación acotada a 25 registros por fuente; error visible por fuente y no confundir error con ausencia.
- Datos de ejemplo no se mezclan con registros reales.
- El panel no modifica ni descarga documentos y no crea tokens. Las autorizaciones de Connect se almacenan en tablas separadas con RLS.

## Base de datos Connect aplicada

Migración eduai_connect_teacher_only_boundary. Dos tablas con RLS y aprobación exclusivamente desde administración de confianza; el usuario no puede insertar, cambiar ni revocar sus autorizaciones directamente. Tres funciones SECURITY INVOKER con search_path vacío y EXECUTE revocado a anon/PUBLIC/service_role. La cuenta debe ser docente adulta, no restringida, con aprobación vigente y scope explícito; no basta el perfil autodeclarado. El contenido requiere autorización individual del recurso y propiedad vigente. La lista de exámenes y planificaciones propios usa scope de categoría; los documentos genéricos solo aparecen con permiso de recurso. Los exámenes activos no devuelven preguntas ni claves, y el contenido de evaluaciones se limita a cerradas. La RPC de documentos solo lee texto; no permite archivos binarios, URLs permanentes ni respuestas/nota individual. El gateway externo deberá implementar sesiones, registro de apps, revocación por app, rate limiting, auditoría y no-store. Una autorización docente es por usuario en esta fase, no por aplicación: no afirmar aislamiento entre apps hasta implementar su vinculación. Las RPC son accesibles con JWT de un docente aprobado, no una ruta HTTP nueva de EduAI; las políticas existentes del uso normal de la plataforma permanecen separadas.

Verificación real: 0 aprobaciones de docentes y recursos, RLS activo, sin SELECT anónimo ni INSERT/UPDATE del usuario sobre permisos, sin EXECUTE anónimo. Prueba transaccional con identidad sintética autenticada sin aprobación rechaza catálogo y lectura. Falta prueba positiva y de aislamiento con dos docentes autorizados en entorno controlado. Auditoría de seguridad no señaló los nuevos objetos (no equivale a auditoría completa). La política de lectura pública de exámenes activos sigue pendiente de cambio coordinado: confirmar el flujo público real con códigos y servicio de servidor antes de retirarla; no leer pautas reales para probar exposición.
