# Gobernanza de Inteligencia Artificial — EduAI

**Organización:** Innova Space Edu SpA  
**Producto:** EduAI Platform  
**Versión:** 1.1 (revisión de alcance IA propuesta)  
**Fecha:** 11 de octubre de 2026

## 1. Propósito

Este documento establece el marco interno para diseñar, evaluar, aprobar, desplegar y supervisar agentes, modelos y proveedores de inteligencia artificial en EduAI.

No ejecuta código ni modifica el comportamiento de la plataforma. Es una política documental que orienta decisiones técnicas, pedagógicas, administrativas y de seguridad.

## 2. Alcance

Aplica a:

- agentes de estudio y agentes especializados;
- modelos de texto, imagen, audio, video, traducción y embeddings;
- prompts de sistema y herramientas automáticas;
- proveedores externos y modelos propios;
- funciones de evaluación, planificación, generación y recomendación;
- datos utilizados para probar, supervisar o mejorar los agentes.

## 3. Principios

1. Finalidad educativa legítima.
2. Supervisión humana significativa.
3. Minimización de datos.
4. Transparencia y explicabilidad proporcional.
5. Seguridad y privacidad desde el diseño.
6. Protección reforzada de niños, niñas y adolescentes.
7. Equidad, inclusión y accesibilidad.
8. Trazabilidad y control de versiones.
9. Responsabilidad definida.
10. Mejora continua y posibilidad de suspensión.

## 4. Roles

### Responsable de producto

- define finalidad y alcance;
- aprueba cambios de alto impacto;
- garantiza recursos para seguridad y cumplimiento.

### Responsable técnico

- mantiene integraciones, secretos, controles y registros;
- documenta proveedor, modelo y versión;
- habilita mecanismos de desactivación y reversión.

### Responsable pedagógico

- revisa pertinencia curricular y nivel;
- valida rúbricas, correcciones y actividades;
- define cuándo la revisión docente es obligatoria.

### Administrador institucional

- administra usuarios y permisos;
- atiende reportes y solicitudes;
- comunica incidentes según el procedimiento aplicable.

### Usuarios

- verifican las salidas antes de utilizarlas;
- evitan aportar datos sensibles innecesarios;
- reportan errores, sesgos o resultados perjudiciales.

## 5. Inventario mínimo de modelos

Cada integración debe registrar:

- proveedor;
- nombre y versión del modelo;
- finalidad;
- módulos donde se utiliza;
- categorías de datos recibidos;
- región o modalidad de procesamiento, cuando esté disponible;
- retención declarada por el proveedor;
- uso o exclusión para entrenamiento;
- controles de moderación;
- fecha de evaluación;
- propietario interno;
- alternativa o procedimiento ante falla;
- riesgo asignado.

## 6. Clasificación de riesgo

### Riesgo bajo

- borradores creativos sin datos personales;
- recomendaciones generales;
- reformulación o traducción de contenido no sensible.

### Riesgo medio

- tutoría personalizada;
- análisis de documentos del usuario;
- generación de preguntas o retroalimentación;
- procesamiento de voz o imágenes identificables.

### Riesgo alto

- calificaciones oficiales;
- información PIE, NEE, salud o discapacidad;
- decisiones que afecten oportunidades o disciplina;
- perfiles de estudiantes;
- tratamiento masivo de datos de menores;
- uso de identificadores directos con proveedores externos.

Los usos de riesgo alto requieren aprobación, evaluación de impacto, acceso restringido, pruebas y revisión humana obligatoria.

## 7. Revisión humana

No se adoptarán exclusivamente mediante IA:

- decisiones disciplinarias;
- diagnósticos médicos, psicológicos o educativos;
- calificaciones de alto impacto sin posibilidad de revisión;
- decisiones de exclusión, admisión o asignación de oportunidades;
- inferencias sobre datos sensibles.

## 8. Datos y privacidad

- No enviar RUT, notas, respuestas, antecedentes de salud o datos familiares cuando no sean necesarios.
- Preferir datos anónimos o seudonimizados.
- Limitar prompts y archivos al contenido requerido.
- No utilizar información identificable de estudiantes para entrenamiento externo sin base válida y autorización específica.
- Documentar transferencias y subencargados.
- Definir retención y eliminación por categoría de datos.

## 8.1. Finalidad delimitada de las integraciones con modelos externos (declaración de diseño)

EduAI integra modelos de IA como **herramientas auxiliares para la creación de contenido educativo y las consultas generales de información**. Entre sus finalidades previstas están: elaborar planificaciones, redactar materiales, explicar conceptos, generar propuestas de ejercicios, resumir materiales no sensibles y responder consultas.

**No es finalidad de esos modelos** recopilar o analizar expedientes personales o sensibles, identificar o perfilar estudiantes, inferir condiciones de salud o discapacidad, evaluar a una persona por características protegidas ni adoptar decisiones individuales sobre su trayectoria académica. Los modelos tampoco deben usarse para entrenar/fine-tuning con datos identificables de estudiantes por defecto.

### Diferenciar finalidad de tratamiento técnico

- Esta declaración es la finalidad que debe orientar el diseño y el uso, **no prueba** que actualmente todos los prompts, historiales y adjuntos estén desidentificados.
- Los módulos de chat, redacción y resumen pueden remitir al proveedor el texto ingresado por el usuario o extraído de archivos. Si contiene nombres, RUT, calificaciones o información sensible, puede haber tratamiento de esos datos aunque esa no sea la finalidad pedagógica.
- Los datos que EduAI conserva para autenticación, roles, almacenamiento, exámenes y administración son tratamientos **diferentes** de la función generativa de IA; deben permanecer en el inventario de tratamientos y en los contratos correspondientes.
- No declarar que proveedores externos no retienen ni utilizan entradas para entrenamiento sin documentación vigente, configuración concreta y evidencia contractual verificable.

### Controles obligatorios por verificar antes de certificar el alcance

1. Inventariar proveedor, modelo, endpoint, ruta, módulo, payload recibido, región, retención, condiciones de entrenamiento y subencargados.
2. Prevenir el envío de campos de perfiles, nombres de menores, RUT, calificaciones individualizadas, PIE/NEE, salud y otros datos sensibles en solicitudes de generación general. Para documentos, validar categorías y revisar o desidentificar contenido antes de enviarlo.
3. Verificar que los prompts y fragmentos del usuario no incorporen conversaciones o documentos de otras cuentas o instituciones.
4. Probar los flujos de texto, imágenes, voz, documentos y agentes antes de declarar que no transmiten identificadores. Registrar resultados sin reproducir datos reales.
5. Diseñar controles de rechazo, advertencia o derivación segura cuando se detecte información no pertinente. No considerar una simple instrucción al modelo como barrera suficiente.
6. Definir en el DPA qué ocurre en tratamientos institucionales excepcionales y qué módulos pueden utilizarse con información protegida, si existe base de licitud y autorización documentada.
7. Ante una exposición accidental, contener el flujo, documentar destinatario y alcance y activar el procedimiento de incidentes con el responsable institucional.

Hasta cerrar esta verificación, la redacción pública correcta es **"los modelos no están destinados a tratar datos personales o sensibles"**, no **"ningún modelo puede recibir ni procesar datos personales"**.

## 9. Pruebas antes de producción

Cada agente debe probarse con escenarios representativos:

- exactitud y consistencia;
- instrucciones adversariales;
- filtración de información;
- contenido inapropiado;
- sesgo y discriminación;
- accesibilidad;
- lenguaje chileno y contexto curricular;
- degradación o caída del proveedor;
- límites de tiempo, costo y tokens.

Las pruebas no deben utilizar datos reales sensibles salvo que exista necesidad, autorización y un entorno controlado.

## 10. Cambios

Los cambios relevantes de proveedor, modelo, permisos, prompt de sistema o categorías de datos deben:

1. registrarse;
2. revisarse;
3. probarse;
4. desplegarse mediante vista previa o función desactivable cuando sea posible;
5. contar con plan de reversión.

## 11. Incidentes de IA

Se consideran incidentes, entre otros:

- exposición de información;
- respuesta perjudicial o discriminatoria;
- error sistemático de corrección;
- salida que elude controles;
- uso no autorizado de datos;
- cambio inesperado del proveedor;
- costos o consumo anómalos.

El incidente debe registrarse con fecha, módulo, modelo, impacto, usuarios potencialmente afectados, contención, corrección y responsable.

## 12. Revisión

Este documento se revisará al menos una vez al año o cuando exista:

- un cambio normativo relevante;
- un nuevo proveedor de alto riesgo;
- una nueva categoría de datos;
- un incidente grave;
- una modificación sustancial de EduAI.

## 13. Referencias

- Ley N.º 19.628 sobre protección de la vida privada.
- Ley N.º 21.719 sobre protección y tratamiento de datos personales.
- Ley N.º 21.430 sobre garantías y protección integral de la niñez y adolescencia.
- Recomendación de UNESCO sobre la ética de la inteligencia artificial.
