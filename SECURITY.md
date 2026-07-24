# Política de seguridad

## Versiones soportadas

EduAI mantiene soporte de seguridad sobre la versión desplegada en producción y sobre la rama principal del repositorio. Las versiones antiguas, forks o despliegues modificados por terceros pueden no recibir correcciones.

## Cómo reportar una vulnerabilidad

No publiques detalles explotables en Issues, Discussions, redes sociales, chats grupales ni repositorios públicos.

Envía el reporte de forma privada a:

- **Correo:** contacto@innova-space-edu.cl
- **Asunto:** `SEGURIDAD EDUAI — reporte privado`

Incluye, cuando sea posible:

1. descripción del problema;
2. ruta, módulo o endpoint afectado;
3. pasos mínimos para reproducirlo;
4. impacto observado o potencial;
5. capturas o evidencia sin datos personales innecesarios;
6. versión, fecha y navegador utilizados;
7. recomendación de mitigación, si existe.

No incluyas contraseñas, tokens, claves privadas, service-role keys, RUT, notas, respuestas de estudiantes ni datos sensibles reales. Si la evidencia requiere información delicada, indícalo primero para acordar un canal apropiado.

## Tiempos objetivo

- Acuse de recibo: hasta 3 días hábiles.
- Evaluación inicial: hasta 7 días hábiles.
- Actualizaciones: según gravedad y complejidad.
- Divulgación: coordinada después de aplicar una mitigación razonable.

Estos plazos son objetivos operacionales y pueden variar según la gravedad, disponibilidad de antecedentes y participación de proveedores.

## Investigación responsable

Se solicita:

- evitar acceder, modificar o descargar información ajena;
- detener la prueba si aparecen datos personales o credenciales;
- no afectar disponibilidad, evaluaciones o cuentas reales;
- no utilizar ingeniería social;
- no realizar ataques de denegación de servicio;
- no exigir pago ni amenazar con divulgar datos;
- conservar la información de manera confidencial hasta la corrección.

## Alcance prioritario

- autenticación y autorización;
- exposición de datos personales;
- fallas de RLS o acceso entre usuarios;
- controles administrativos;
- exámenes, calificaciones y respuestas;
- carga y procesamiento de archivos;
- filtración de secretos;
- inyección, ejecución o acceso no autorizado;
- integraciones de inteligencia artificial;
- almacenamiento y enlaces privados.

## Fuera de alcance habitual

- resultados incorrectos de IA sin impacto de seguridad;
- recomendaciones generales de endurecimiento sin vulnerabilidad demostrable;
- fallas de proveedores externos ya conocidas y sin configuración propia vulnerable;
- problemas que requieren acceso físico o credenciales previamente comprometidas, salvo que exista escalamiento adicional.

## Protección de menores

Un incidente que involucre datos de niños, niñas o adolescentes, notas, respuestas, RUT, antecedentes PIE/NEE o salud debe tratarse como confidencial y de prioridad elevada. No adjuntes datos reales en el reporte salvo que sea estrictamente necesario y exista un canal acordado.

## Procedimiento interno

Los detalles operacionales de contención, contactos, credenciales, proveedores y recuperación se mantienen en un procedimiento privado de respuesta a incidentes. El repositorio solo contiene una plantilla sin secretos en `docs/INCIDENT_RESPONSE_PRIVATE_TEMPLATE.md`.
