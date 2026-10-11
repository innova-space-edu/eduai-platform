# Autorizaciones familiares verificables — EDUAI y Sello Tecnológico

**Estado:** propuesta técnica en PR, sin migraciones aplicadas y sin efectos contractuales hasta validación.  
**Versión del cuestionario:** `family-2026-10-v1`.  
**Responsable corporativo:** Innova Space Edu SpA (RUT 78.220.699-0), representante informado: Iván Eduardo Morales Sandoval.  
**Domicilio informado:** Libertad 514, Vallenar, Región de Atacama, CP 1611076, Chile.

## 1. Fundamento jurídico y límites

La Ley N.º 21.719, con vigencia general desde el 1-12-2026, exige consentimiento libre, específico, informado, previo e inequívoco cuando éste sea la base de licitud; permite revocarlo mediante medios equivalentes. El art. 16 quáter establece reglas especiales para menores de 14 años y datos sensibles de adolescentes menores de 16. No exige que todos los tratamientos de toda persona menor de 18 sean autorizados por sus padres; puede haber bases legales y regímenes distintos. El objetivo de este formulario es gestionar **finalidades opcionales** y autorizaciones institucionalmente pertinentes, no reemplazar la ley.

La Ley N.º 19.799 reconoce la firma electrónica simple y avanzada con efectos y fuerza probatoria diferentes. Una firma escrita en un formulario, un enlace enviado a un teléfono y la recepción de correo **no prueban por sí solos** la identidad ni la representación del adulto.

### ClaveÚnica

ClaveÚnica es una autenticación estatal y **no una firma de consentimiento por sí misma**. La Resolución 733 Exenta de 2025 limita su uso a entidades habilitadas normativamente; no se deben utilizar credenciales ni simular el login de ClaveÚnica en sitios privados. Una integración futura exigiría habilitación, convenio, credenciales y análisis jurídico de su disponibilidad. La Firma Electrónica Avanzada solo podrá integrarse a través de un prestador acreditado y con evidencia criptográfica real. Este PR **no** integra ninguna de estas opciones.

Fuentes:
- https://www.bcn.cl/leychile/navegar?idNorma=1209272
- https://www.bcn.cl/leychile/navegar?idNorma=196640
- https://www.entidadacreditadora.gob.cl/
- https://www.claveunica.gob.cl/instituciones
- https://wikiguias.digital.gob.cl/es/Estrategias/identidad-digital

## 2. Flujo propuesto

1. **Cuenta restringida:** la institución vincula una cuenta identificable al estudiante, pero las funciones optativas no quedan habilitadas por ese solo hecho. El bloqueo total para menores es una opción de despliegue sujeta a revisión, porque existen tratamientos escolares que no requieren este consentimiento.
2. **Invitación:** un administrador autentificado, autorizado y auditado emite un enlace con token aleatorio de un solo uso, válido inicialmente por 7 días y almacenado solo mediante su hash SHA-256. La invitación se vincula al ID de cuenta, servicio e institución.
3. **Transporte:** el sistema prepara un mensaje sin nombre/RUT de estudiante para compartir mediante correo electrónico, WhatsApp u otro canal aprobado. No envía automáticamente. Debe comprobarse el destinatario y el uso legítimo de su contacto.
4. **Cuestionario:** la persona indica nombre del menor, nombre y correo del firmante, vínculo declarado y decisiones **Sí/No individuales** para cada finalidad. No hay permiso global por omisión.
5. **Firma simple:** la persona escribe su nombre completo, ratifica su declaración legal y confirma que desea firmar electrónicamente el conjunto de elecciones. Se conservan versión, fecha, opciones y resumen criptográfico del acto. No se anuncia FEA ni validación de identidad mediante ClaveÚnica.
6. **Aprobación institucional:** un administrador verifica fuera del mero enlace la identidad y la legitimación para firmar (por ejemplo, antecedentes del establecimiento), indica método y referencia a evidencia privada, y aprueba o rechaza.
7. **Activación técnica:** solo los permisos aprobados pueden considerarse vigentes. La pantalla o la existencia de una firma no habilitan operaciones sensibles. Las rutas deben validar permiso vigente **del lado servidor**.
8. **Revocación:** el firmante puede utilizar el mismo enlace privado, correo y nombre de firma para retirar permisos; administración también dispone de revocación. La revocación se registra sin efectos retroactivos. Deben bloquearse envíos/publicaciones posteriores y evaluarse despublicación de material ya divulgado.
9. **Revisión anual:** al cierre escolar se notificará, exportará y eliminará/anomizará contenido según política aprobada, sin borrar evidencia contractual que aún deba conservarse por una finalidad lícita claramente documentada.

## 3. Finalidades diferenciadas

**EDUAI:** IA para texto y creación pedagógica, documentos en IA, imágenes IA, voz/transcripción, proyectos almacenados, fotografías/video internos y públicos, colaboración, investigación externa, métricas opcionales y comunicaciones adicionales.

**Sello Tecnológico:** proyectos y evidencias, fotografías/video internos, vitrina pública, encuestas opcionales, colaboración y mensajería, divulgación en redes externas, IA, métricas opcionales y comunicaciones adicionales.

**Fuera del permiso general:** atención clínica o médica, fichas PIE/NEE sensibles, diagnóstico, clonación de voz, perfiles biométricos y nuevos proveedores/categorías no informados. Requieren evaluación específica y habilitación diferenciada cuando corresponda.

## 4. Estados y evidencias

- `invited`: enlace emitido, no firmado.
- `submitted`: declaración y firma simple registradas, **sin verificación**.
- `approved`: identidad y autoridad verificadas por responsable autorizado, con referencia a evidencia.
- `rejected`: rechazo por institución.
- `revoked`: retirada del permiso.
- `expired`: estado previsto; vencimiento se aplica por fecha aunque no exista tarea de transición automática.

La firma simple registra el nombre, declaración, elecciones, versión y digest SHA-256. Los documentos que acrediten identidad o cuidado personal se custodian en repositorio privado separado y no deben almacenarse en el código ni enviarse por WhatsApp público.

## 5. Datos y protección

Datos mínimos: ID de estudiante, correo del adulto, nombre declarado, vínculo legal, decisiones, fechas, firma simple y evidencia de validación institucional. El token nunca se guarda en texto claro; solo se muestra al emitirlo al administrador. El proyecto Supabase está en `us-west-2` (Estados Unidos), por lo que las solicitudes también requieren revisión de transferencia internacional y acuerdos DPA.

### Seguridad por completar antes de publicar

- [ ] Revisar jurídicamente la capacidad de cada adulto y custodia de documentación de familia.
- [ ] Incorporar comprobación independiente del correo/teléfono (OTP, proveedor de identidad permitido o proceso institucional equivalente). El enlace solo permite entregar el formulario.
- [ ] Completar protección contra abuso: límites por IP/intentos, revocación de enlace filtrado, alertas, auditoría y mecanismo de recuperación.
- [ ] Aplicar migraciones en **ambiente de prueba** y probar RLS/roles, emisión, vencimiento, firma, aprobación, rechazo, revocación y concurrencia.
- [ ] Auditar y vincular los permisos con **todas** las API capaces de tratar, subir o divulgar datos (no solo páginas y dashboard).
- [ ] Definir qué se permite a adolescentes de 14–17 por su propia autorización conforme a la ley, y cuándo se exige representante legal.
- [ ] Verificar instituciones y administradores autorizados: el administrador de producto no debe aprobar indiscriminadamente representación sin evidencia.
- [ ] Configurar notificaciones con proveedor de correo autorizado y DPA; WhatsApp funciona en esta etapa como enlace de compartición manual, no envío automático.
- [ ] Implementar comprobante descargable con contenido íntegro/versionado y firma verificable cuando el análisis probatorio lo requiera.
- [ ] Definir períodos legales de custodia de comprobantes, registros de consentimiento y su eliminación; el borrado anual escolar no puede suprimir pruebas todavía legítimamente necesarias.
- [ ] Considerar consentimiento/autoridad de más de un tutor cuando resulte jurídicamente pertinente; corregir duplicados o conflictos por estudiante.
- [ ] Diseño móvil, accesibilidad, antifraude, tests y comunicación a familias antes de producción.
- [ ] No activar variables de bloqueo para cuentas actuales antes del período de regularización y alternativas de acceso legal.

## 6. Referencia técnica

- `*/family-consent/config.ts`, `*/family-consent/server.ts`: finalidades y utilidad segura.
- `*/api/family-consent/route.ts`: consulta y firma por token, revocación privada.
- `*/api/family-consent/admin/route.ts`: emisión, consulta, aprobación y revocación con autenticación administrativa.
- `*/autorizacion-familiar/[token]/page.tsx`: cuestionario.
- `*/admin/autorizaciones-familiares/page.tsx`: emisión y revisión.
- Migración `supabase/migrations/20261011*_family_authorization_requests.sql`.

**La implementación es una primera etapa. No representa firma electrónica avanzada ni validación automatizada de representación parental.** Hasta finalizar pruebas y auditoría, permanecer en PR sin desplegar.
