# Diseño y estado de los consentimientos granulares — EDUAI

**Versión propuesta:** 2026-10-11-v1. **Estado:** implementación en PR, no desplegada ni auditada.

## 1. Condiciones necesarias
Se presenta al usuario, previamente al inicio de sesión, una aceptación expresa de los términos vigentes y la información de privacidad. La aceptación de términos o la recepción de la información de privacidad **no equivale por sí sola a consentimiento general** para tratamientos distintos. Las actividades necesarias para contrato, obligación legal u otra base de licitud se documentarán bajo su fundamento específico.

## 2. Advertencia sobre datos proporcionados por el usuario
Se explica con ejemplos qué son datos identificables y sensibles (RUT, notas nominativas, información familiar, PIE/NEE, salud, discapacidades). Los asistentes no solicitan deliberadamente esos antecedentes para la generación general. Si la persona los introduce de forma voluntaria o accidental, pueden incorporarse a los datos transmitidos al proveedor. Aceptar la advertencia no demuestra conocimiento jurídico de cada categoría ni exime de obligaciones a Innova o a la institución.

## 3. Preferencias opcionales independientes
Las cuatro opciones iniciales son:
- `ai_generation`: generación de contenidos con modelos externos.
- `ai_documents`: envío de fragmentos de archivos a proveedores de IA para funciones solicitadas.
- `ai_voice`: voz y transcripción con proveedores de IA. Micrófono y clonación de voz tienen permisos adicionales.
- `optional_analytics`: estadísticas no indispensables; métricas de seguridad siguen otra base jurídica.

**Valores iniciales: false.** No se pueden exigir todas como condición para obtener una cuenta. La negativa a un uso opcional debe impedir su activación técnica, sin afectar funciones básicas. Una aceptación de IA general no autoriza acceso a datos de terceros, difusión pública ni tratamiento sensible indiscriminado.

## 4. Casos fuera de estas casillas
- Datos académicos oficiales y registros de alumnos conforme a instrucciones institucionales.
- Publicación pública de fotografías, videos, proyectos y productos de estudiantes: autorización separada, puntual y documentada.
- Clonación de voz: autorización especial, con sus propias verificaciones.
- Datos personales sensibles: régimen legal específico.
- Menores de 14 años: procedimiento verificable de responsables legales o habilitación legal; no basta un checkbox.
- Datos sensibles de adolescentes menores de 16: autorización de representantes en los casos exigidos por ley.

## 5. Implementación propuesta en el PR
- UI compartida `components/legal/PrivacyConsentPanel.tsx` integrada en login y registro.
- Tabla `eduai_privacy_choices` para estado actual de permisos por cuenta.
- Tabla `eduai_privacy_choice_events` con historial de versiones, marcas de tiempo y cambios.
- RPC `record_eduai_privacy_choices` autenticado, RLS de lectura por titular y escritura limitada a función.
- Pantalla de configuración para consultar, revocar y modificar opciones.
- Cuentas identificadas como menores por fecha autodeclarada: permisos opcionales bloqueados mientras no exista un proceso de autorización separado.

## 6. Pendientes imprescindibles antes de producción
1. Aplicar migración en ambiente de prueba y comprobar RLS, RPC, reintentos, revocación e historial.
2. Auditar **todas** las rutas de modelos, chat, imágenes, documentos, audio, editor, telemetría y proveedores.
3. Bloquear del lado servidor las capacidades opcionales sin permiso vigente. La presencia de un checkbox no basta; los controles de UI son el primer paso.
4. Definir sistema de identidad/edad y validación de representantes legalmente autorizados; los datos autodeclarados no permiten probar identidad ni edad.
5. Diseñar transición de usuarios registrados antes de esta versión, incluyendo información y nueva selección. Si no hay elección verificable, las finalidades opcionales deben permanecer inactivas.
6. Definir una base jurídica distinta para procesos necesarios; no abusar del consentimiento agrupado.
7. Validar retención y eliminación de eventos de consentimiento sin perder prueba necesaria para reclamaciones.
8. Evaluar incorporación al flujo institucional de cada colegio y sus acuerdos DPA.
9. Probar despliegue, accesibilidad móvil, rechazo de permisos, recuperación y no interrupción injustificada del acceso básico.
10. Documentar contrato/DPA real y términos de cada proveedor de IA.

## Referencias
- [Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272) (arts. 12, 15 bis, 16 y 16 quáter).
- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/profile/settings/page.tsx`.
- `supabase/migrations/202610110001_eduai_granular_privacy_choices.sql`.

**Nota:** esta implementación aún no constituye sistema desplegado ni asegura técnicamente que las preferencias se respeten en todas las herramientas. No activar en producción hasta completar las pruebas de control de acceso y evaluación jurídica.
