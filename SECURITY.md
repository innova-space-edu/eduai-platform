# Política interna de seguridad y manejo de datos de EduAI

**Responsable del proyecto:** Innova Space Edu SpA  
**Plataforma:** EduAI Platform  
**Contacto institucional:** contacto@innova-space-edu.cl  
**Última actualización:** 24 de julio de 2026

## 1. Objetivo

Esta política establece las reglas internas mínimas para diseñar, desarrollar, administrar y utilizar EduAI de manera segura.

Su propósito es proteger:

- a estudiantes, docentes, administradores y establecimientos;
- la confidencialidad de los datos personales y académicos;
- la integridad de exámenes, notas, respuestas y recursos educativos;
- la disponibilidad de la plataforma;
- las credenciales, secretos, repositorios e infraestructura;
- el uso responsable de herramientas y proveedores de inteligencia artificial.

Esta política se aplica junto con la Política de Privacidad, la Gobernanza de IA, los Términos de Uso y el procedimiento privado de respuesta a incidentes.

## 2. Alcance

Estas reglas son obligatorias para:

- administradores de EduAI;
- desarrolladores y colaboradores;
- docentes y personal autorizado;
- usuarios con acceso a información académica;
- proveedores o integraciones que procesen información de la plataforma;
- ambientes de producción, pruebas, desarrollo y respaldo.

Las copias, forks, despliegues externos o versiones modificadas por terceros no se consideran administradas por Innova Space Edu SpA, salvo acuerdo expreso.

## 3. Principios internos de seguridad

Toda función de EduAI debe diseñarse y mantenerse bajo los siguientes principios:

1. **Acceso mínimo:** cada persona o servicio debe acceder solamente a lo necesario para cumplir su función.
2. **Privacidad desde el diseño:** la recopilación de datos debe limitarse a una finalidad educativa, técnica o legal definida.
3. **Protección por defecto:** las opciones iniciales deben favorecer la privacidad y restringir la exposición de información.
4. **Separación de funciones:** los permisos de estudiante, docente, administrador y servicio técnico deben mantenerse diferenciados.
5. **Trazabilidad:** las operaciones administrativas y los incidentes relevantes deben poder revisarse mediante registros adecuados.
6. **No exposición:** ningún dato sensible, secreto o contenido privado debe publicarse en repositorios, capturas, demostraciones o canales abiertos.
7. **Revisión humana:** las decisiones académicas o administrativas relevantes no deben depender exclusivamente de una salida automática de IA.
8. **Corrección segura:** una falla de analítica, monitoreo o integración secundaria no debe bloquear funciones educativas esenciales.

## 4. Clasificación interna de la información

### 4.1 Información pública

Puede compartirse públicamente cuando haya sido revisada y autorizada:

- documentación general de la plataforma;
- políticas públicas;
- material demostrativo sin datos reales;
- información institucional publicada oficialmente;
- código fuente que no contenga secretos ni información personal.

### 4.2 Información interna

Debe limitarse al equipo o a usuarios autorizados:

- documentación operacional;
- configuraciones no sensibles;
- métricas agregadas;
- planes de desarrollo;
- procedimientos de soporte;
- información técnica de módulos y agentes.

### 4.3 Información confidencial

Solo puede ser tratada por personas o servicios expresamente autorizados:

- nombres, correos, identificadores de cuenta y RUT;
- cursos, establecimientos y perfiles de usuario;
- notas, evaluaciones, respuestas y retroalimentaciones;
- trabajos, documentos, imágenes, audios o archivos privados;
- reportes de soporte vinculados a una persona;
- registros de actividad que permitan identificar a un usuario;
- información contractual o administrativa no pública.

### 4.4 Información sensible o de protección reforzada

Requiere el mayor nivel de restricción:

- datos de niños, niñas y adolescentes;
- antecedentes PIE, NEE, discapacidad o salud;
- diagnósticos, apoyos educativos o información familiar;
- credenciales, contraseñas, tokens y claves privadas;
- claves de servicio, service-role keys y secretos de proveedores;
- respaldos completos y exportaciones identificables;
- información que pueda causar perjuicio si se filtra, modifica o utiliza fuera de su finalidad.

## 5. Prohibición de compartir datos sensibles

Está prohibido copiar, enviar, publicar o exponer información confidencial o sensible en:

- Issues, Pull Requests o Discussions públicos;
- repositorios públicos;
- archivos README o documentación abierta;
- capturas de pantalla sin anonimizar;
- redes sociales, chats grupales o mensajería no autorizada;
- formularios públicos;
- prompts enviados a servicios externos cuando el dato no sea indispensable;
- herramientas personales de almacenamiento o cuentas particulares;
- ejemplos de código, pruebas, videos o demostraciones.

Nunca se deben compartir públicamente:

- RUT reales;
- notas o resultados individuales;
- respuestas de estudiantes;
- listados de cursos con identidad;
- antecedentes PIE, NEE, discapacidad o salud;
- contraseñas, tokens, cookies de sesión o códigos de recuperación;
- variables de entorno;
- claves API;
- claves de Supabase, Vercel, GitHub u otros proveedores;
- enlaces privados que permitan acceder sin autorización;
- bases de datos, respaldos o archivos exportados con datos reales.

Cuando sea necesario solicitar soporte, la evidencia debe anonimizarse o reemplazarse por datos ficticios. Si no es posible, debe acordarse previamente un canal privado y restringido.

## 6. Cuentas, autenticación y permisos

- Cada usuario debe utilizar una cuenta individual; no se deben compartir cuentas administrativas.
- Las contraseñas no deben enviarse por correo, chat ni documentos compartidos.
- Las cuentas administrativas deben utilizar autenticación reforzada cuando el proveedor lo permita.
- Los permisos deben revisarse cuando una persona cambia de función o deja de participar en el proyecto.
- Los accesos temporales deben retirarse al finalizar la tarea.
- Las sesiones, enlaces de recuperación y códigos de acceso deben tratarse como credenciales.
- Las operaciones administrativas deben realizarse únicamente desde dispositivos y conexiones razonablemente seguras.
- Ante sospecha de compromiso, la credencial debe revocarse o rotarse de inmediato.

## 7. Repositorio y desarrollo seguro

- La rama `main` debe permanecer protegida.
- Los cambios deben realizarse en ramas separadas y pasar por Pull Request.
- La compilación y los controles configurados deben aprobarse antes de fusionar.
- No se permiten force pushes ni eliminación de la rama principal.
- Los cambios amplios deben dividirse en etapas pequeñas y reversibles.
- Las migraciones de base de datos deben ser revisables y, preferentemente, aditivas.
- No se deben incluir secretos en commits, historial, comentarios, archivos de ejemplo o artefactos.
- Los archivos `.env`, credenciales locales, reportes privados y respaldos deben quedar fuera del control de versiones.
- Las dependencias nuevas deben justificarse, mantenerse actualizadas y proceder de fuentes confiables.
- El código de analítica, monitoreo o soporte debe fallar de forma no bloqueante cuando no sea esencial para la operación educativa.

## 8. Ambientes de producción y pruebas

- Las pruebas destructivas no deben ejecutarse contra producción.
- Las pruebas E2E deben utilizar cuentas, estudiantes, RUT y exámenes ficticios.
- Los datos de prueba deben poder identificarse y eliminarse con facilidad.
- Los ambientes de prueba no deben recibir copias completas de datos reales salvo necesidad autorizada y con medidas equivalentes de protección.
- Las URLs de producción deben bloquearse expresamente en automatizaciones que creen, modifiquen o eliminen información.
- Los despliegues de vista previa deben revisarse antes de fusionar cambios a `main`.

## 9. Bases de datos y almacenamiento

- El acceso a las tablas debe controlarse mediante autenticación, autorización y políticas RLS cuando corresponda.
- Las service-role keys solo deben utilizarse en el servidor y nunca exponerse al navegador.
- Las consultas administrativas deben validar de forma independiente que el usuario posee permisos de administrador.
- Las exportaciones identificables deben limitarse a usuarios autorizados y a una finalidad definida.
- Los reportes generales deben utilizar datos agregados, anonimizados o seudonimizados según el caso.
- Los respaldos deben mantenerse fuera del acceso público y protegidos con controles equivalentes a los datos originales.
- Los datos no deben conservarse indefinidamente sin una finalidad vigente.
- La eliminación debe considerar registros principales, archivos, enlaces compartidos y respaldos según el procedimiento aplicable.

## 10. Exámenes, calificaciones y respuestas

- Los exámenes, códigos de acceso, respuestas y calificaciones son información confidencial.
- Un estudiante no debe poder acceder a información de otro estudiante.
- Un docente debe acceder únicamente a evaluaciones y grupos que le correspondan.
- Las correcciones automáticas deben permitir revisión humana.
- Las notas no deben publicarse en enlaces abiertos, logs, capturas o reportes generales.
- Los incidentes de integridad, suplantación, acceso indebido o modificación de resultados deben informarse inmediatamente.
- Las pruebas automatizadas deben utilizar exámenes creados específicamente para E2E y nunca evaluaciones reales en curso.

## 11. Uso de inteligencia artificial

- Antes de enviar información a un proveedor de IA se debe evaluar si el contenido es necesario para la tarea.
- Deben eliminarse o reemplazarse identificadores directos siempre que sea posible.
- No deben enviarse RUT, diagnósticos, información PIE/NEE, antecedentes de salud ni datos familiares a modelos externos cuando no sean indispensables.
- Las notas, respuestas o información identificable de menores no deben utilizarse para entrenar modelos externos sin una base, autorización y resguardos específicos.
- Los prompts y respuestas vinculados a una cuenta deben tratarse como datos personales cuando permitan identificar a una persona.
- Los resultados de IA pueden contener errores y deben revisarse antes de utilizarlos en decisiones importantes.
- No se deben adoptar medidas disciplinarias, diagnósticos ni decisiones académicas de alto impacto basándose exclusivamente en IA.
- Los proveedores, modelos y cambios relevantes deben documentarse dentro de la gobernanza de IA del proyecto.

## 12. Archivos, imágenes, audio y contenido aportado

- Todo archivo cargado debe considerarse privado hasta que su propietario decida compartirlo.
- No se debe asumir que una imagen, audio o documento carece de datos personales.
- Los nombres de archivo, metadatos y contenido pueden contener información identificable.
- Los archivos deben validarse por tipo, tamaño y finalidad antes de procesarse.
- Los enlaces de descarga deben restringirse cuando el contenido no sea público.
- Los archivos de soporte deben revisarse y anonimizarse antes de ser enviados a terceros.
- El contenido eliminado por el usuario debe seguir el proceso de eliminación definido por la plataforma y sus proveedores.

## 13. Analítica, registros y monitoreo

- La analítica debe recopilar el mínimo de información necesario para operación, seguridad y mejora del servicio.
- No debe guardar prompts completos, respuestas de estudiantes, contenido de archivos, RUT ni datos PIE/NEE.
- Las rutas y metadatos técnicos deben limitarse y sanitizarse.
- Los reportes destinados a análisis general deben excluir identificadores directos.
- Los registros no deben utilizarse para vigilancia ajena a la finalidad educativa, técnica o de seguridad informada.
- El acceso a logs administrativos debe restringirse.
- Los errores registrados no deben incluir secretos, cuerpos completos de solicitudes ni contenido sensible.

## 14. Proveedores e integraciones

Antes de activar una integración se debe revisar, según su riesgo:

- qué información recibe;
- para qué la utiliza;
- dónde puede almacenarla o procesarla;
- durante cuánto tiempo la conserva;
- si utiliza los datos para entrenamiento;
- qué controles de acceso y seguridad ofrece;
- cómo se revocan sus credenciales;
- cómo se eliminan los datos;
- cómo notifica incidentes.

Las claves de proveedores deben mantenerse en variables de entorno o administradores de secretos. Una integración secundaria no debe recibir acceso amplio a toda la base de datos si solo necesita una función limitada.

## 15. Gestión de incidentes

Se considera incidente de seguridad cualquier situación que pueda afectar la confidencialidad, integridad o disponibilidad de EduAI, incluyendo:

- acceso no autorizado;
- exposición de datos;
- filtración de secretos;
- pérdida o modificación de información;
- fallas de permisos o RLS;
- suplantación de identidad;
- abuso de funciones administrativas;
- indisponibilidad relevante;
- uso indebido de una integración o modelo de IA.

Ante un incidente se debe:

1. evitar ampliar la exposición;
2. preservar evidencia técnica sin copiar datos innecesarios;
3. informar por el canal interno definido;
4. revocar sesiones, enlaces o credenciales comprometidas;
5. contener la función afectada;
6. evaluar si existen menores o datos sensibles involucrados;
7. documentar decisiones y acciones;
8. recuperar el servicio de forma controlada;
9. revisar la causa raíz y aplicar medidas correctivas.

Los detalles de contactos, proveedores, infraestructura, credenciales y recuperación se mantienen en el procedimiento privado basado en `docs/INCIDENT_RESPONSE_PRIVATE_TEMPLATE.md`.

## 16. Prioridad de incidentes con menores

Todo incidente que involucre estudiantes menores de edad, RUT, notas, respuestas, antecedentes PIE/NEE, discapacidad, salud o información familiar debe considerarse de prioridad elevada.

En estos casos:

- se debe limitar inmediatamente el acceso;
- no se deben reenviar los datos por canales informales;
- las capturas y evidencias deben anonimizarse;
- se debe identificar qué personas, establecimientos o proveedores estuvieron involucrados;
- se debe evaluar la necesidad de comunicación y medidas adicionales conforme al procedimiento interno y la normativa aplicable.

## 17. Reportes de fallas y vulnerabilidades

Las fallas funcionales pueden enviarse mediante el centro de soporte de EduAI.

Las vulnerabilidades o sospechas de exposición deben comunicarse de forma privada a:

- **Correo:** contacto@innova-space-edu.cl
- **Asunto:** `SEGURIDAD EDUAI — reporte privado`

El reporte debe incluir solamente la información necesaria: descripción, módulo afectado, pasos mínimos, impacto y evidencia anonimizada.

No se deben publicar detalles explotables en Issues, Discussions, Pull Requests públicos, redes sociales o repositorios abiertos.

## 18. Conductas prohibidas

Está prohibido:

- acceder a cuentas o datos ajenos;
- descargar bases de datos sin autorización;
- compartir credenciales;
- desactivar controles de seguridad sin aprobación;
- utilizar datos reales para pruebas públicas;
- ejecutar ataques, escaneos agresivos o denegación de servicio sobre producción;
- modificar notas, exámenes o respuestas fuera de un procedimiento autorizado;
- utilizar información de estudiantes para fines comerciales, personales o no informados;
- copiar datos a herramientas no aprobadas;
- ocultar deliberadamente una filtración o incidente;
- conservar información que debía eliminarse;
- utilizar permisos administrativos para una finalidad distinta de la autorizada.

## 19. Revisión y cumplimiento

Esta política debe revisarse cuando:

- se agregue un nuevo módulo o proveedor;
- cambie el tratamiento de datos;
- se habilite una nueva función de IA;
- ocurra un incidente relevante;
- cambie la normativa aplicable;
- se modifiquen los roles, permisos o infraestructura.

El incumplimiento puede originar la suspensión de accesos, revocación de credenciales, revisión del incidente y aplicación de medidas contractuales, administrativas o legales según corresponda.

## 20. Documentos relacionados

- Política pública de privacidad: `/privacidad`
- Política pública de seguridad: `/seguridad`
- Gobernanza de IA: `/gobernanza-ia`
- Términos de uso: `/terminos`
- Procedimiento privado de incidentes: `docs/INCIDENT_RESPONSE_PRIVATE_TEMPLATE.md`

Esta política no debe incluir contraseñas, secretos, contactos personales de emergencia ni detalles operacionales que faciliten un ataque. Esa información debe mantenerse exclusivamente en documentación privada y con acceso restringido.
