# Plantilla privada de respuesta a incidentes

> **Importante:** esta plantilla no contiene secretos. Debe copiarse a un repositorio privado o sistema documental con acceso restringido antes de completar contactos, credenciales, infraestructura o procedimientos internos.

## 1. Control del documento

- Propietario:
- Responsable suplente:
- Versión:
- Fecha de aprobación:
- Próxima revisión:
- Ubicación privada oficial:

## 2. Contactos internos

- Dirección / representante legal:
- Responsable técnico:
- Responsable de privacidad:
- Responsable pedagógico:
- Comunicaciones:
- Asesoría jurídica:
- Proveedor de nube:
- Proveedor de base de datos:
- Proveedores de IA:

## 3. Clasificación

### Severidad 1 — Crítica

- exposición confirmada de datos sensibles o datos masivos de menores;
- acceso administrativo no autorizado;
- alteración de notas, evaluaciones o respuestas;
- interrupción grave o ransomware;
- claves privilegiadas comprometidas.

### Severidad 2 — Alta

- acceso no autorizado limitado;
- vulnerabilidad explotable con impacto importante;
- exposición de datos personales acotada;
- falla sistemática de un agente con efecto relevante.

### Severidad 3 — Media

- incidente contenido sin exposición confirmada;
- errores repetidos con impacto moderado;
- abuso de cuenta individual.

### Severidad 4 — Baja

- evento informativo;
- intento bloqueado;
- falla menor sin impacto en datos o continuidad.

## 4. Registro inicial

- ID del incidente:
- Fecha y hora de detección:
- Persona o sistema que detectó:
- Descripción:
- Servicios afectados:
- Usuarios potencialmente afectados:
- Categorías de datos:
- ¿Involucra menores?:
- Severidad inicial:
- Evidencias preservadas:

## 5. Contención inmediata

- [ ] Aislar componente o proveedor afectado.
- [ ] Revocar sesiones comprometidas.
- [ ] Rotar claves y secretos.
- [ ] Desactivar función, modelo o endpoint.
- [ ] Restringir permisos.
- [ ] Preservar logs y evidencia.
- [ ] Evitar eliminación o alteración accidental de registros.
- [ ] Activar alternativa operacional.

## 6. Investigación

- Vector de entrada:
- Fecha probable de inicio:
- Cuentas involucradas:
- Datos accedidos, modificados o eliminados:
- Alcance confirmado:
- Proveedores involucrados:
- Causa raíz preliminar:
- Nivel de confianza:

## 7. Evaluación de datos personales

- Titulares afectados:
- Cantidad estimada:
- Datos de identificación:
- Datos académicos:
- RUT:
- Notas y respuestas:
- Datos sensibles / PIE / NEE / salud:
- Riesgo de daño o discriminación:
- Riesgo de reidentificación:
- Medidas para reducir el daño:

## 8. Obligaciones y comunicaciones

- Evaluación jurídica realizada por:
- Autoridades potencialmente aplicables:
- Establecimientos que deben ser informados:
- Titulares o apoderados que deben ser informados:
- Proveedores que deben ser notificados:
- Fecha y medio de comunicación:
- Mensaje aprobado por:

## 9. Recuperación

- [ ] Vulnerabilidad corregida.
- [ ] Secretos rotados.
- [ ] Datos restaurados y verificados.
- [ ] Permisos revisados.
- [ ] Pruebas de regresión completadas.
- [ ] Monitoreo reforzado habilitado.
- [ ] Servicio restablecido.
- [ ] Usuarios informados cuando corresponde.

## 10. Cierre y mejora

- Causa raíz definitiva:
- Línea de tiempo:
- Controles que fallaron:
- Controles que funcionaron:
- Acciones correctivas:
- Responsable de cada acción:
- Fecha comprometida:
- Verificación de cierre:
- Lecciones aprendidas:

## 11. Evidencia

La evidencia debe mantenerse en almacenamiento privado y con control de acceso. No incluir en repositorios públicos:

- tokens o claves;
- volcados de base de datos;
- RUT, notas o respuestas;
- información de menores;
- direcciones IP completas asociadas a personas;
- capturas con datos personales;
- arquitectura detallada que facilite explotación.
