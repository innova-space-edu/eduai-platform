# EDUAI Gestión Docente + Connect — contrato de fase 1

Estado: borrador para revisión. No aplica migraciones, no expone una API externa y no habilita acceso institucional en producción.

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

Base propuesta /api/connect/v1. Primero recursos docentes propios: /documents, /plannings, /exams (solo metadata), /documents/:id/download. Luego /schools, /courses, /subjects, /periods, /grades, /analytics y /students (nómina mínima) con autorización institucional. Separar documents:read, documents:download, plannings:read, exams:read, grades:read, students:read, analytics:read. Nunca incluir respuestas oficiales, códigos, incidentes, RUT ni enlaces Storage permanentes. Identidad OAuth delegada con PKCE y tokens de corta duración; integraciones servidor-servidor con credenciales limitadas, no service_role compartida. Revocación comprobada por petición. Límites de página, validación de parámetros, rate limiting, auditoría y Cache-Control: private, no-store. Archivos privados mediante descarga autorizada o URL firmada breve. No hacer fetch de external_url arbitrarias.

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
- El panel no crea tablas, no modifica ni descarga documentos, y no crea tokens.
