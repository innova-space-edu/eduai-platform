# Optimización del planificador completo

## Cambios

- Parvularia construye la coordinación entre jornadas con datos locales (referencias, núcleo, horizonte y organización). Se elimina la llamada de IA dedicada al blueprint. Cada jornada sigue usando el mismo generador estructurado y conserva su presupuesto de salida, currículo, profundidad, reglas de seguridad y validación completa.
- El mensaje de generación de la interfaz deja de duplicar todos los OA/OAT enviados en config. Se corrige la contradicción anterior entre 100–180 caracteres en el cliente y 350–650 en el servidor. La redacción por jornada recibe ahora explícitamente contexto y solicitud actual de la educadora.
- Ajustes que mencionan una o dos jornadas conservan las restantes. Una petición explícita de cambiar solo recursos, evaluación u otro campo usa un schema limitado a esos campos. El servidor aplica una lista permitida y conserva el resto, incluso si el modelo intenta entregar otros campos.
- La optimización parcial solo se activa si el documento previo coincide exactamente en nivel, fechas, horizonte, núcleos y textos completos de todos los OA/OAT. Cambios curriculares o globales usan el flujo completo. La validación se mantiene sobre el documento final completo. Si el documento base exige cambios fuera de lo solicitado, el ajuste no se aplica ni se sustituye por un fallback que modifique otros campos.
- Una corrección de estructura identifica todas las jornadas citadas en el error, no solo la primera. La revisión de diversidad informa cuáles fallan; una jornada válida se conserva. En ajustes parciales no se confunden experiencias que deben conservarse con repeticiones nuevas.
- Los ajustes sin cambios de experiencias omiten recuperación del banco y búsqueda web; si cambian experiencias, la búsqueda solo atiende las jornadas que se están modificando.
- Planificador Curricular (Básica/Media y demás niveles) conserva la solicitud en el mensaje de usuario sin repetirla en el sistema; las unidades declaradas también se incluyen una sola vez. Se preservan los OA completos y el formato solicitado. La reutilización privada existente sigue evitando generaciones idénticas cuando corresponde.
- El indicador de progreso consulta cada tres segundos en lugar de cada 900 ms y pausa mientras la pestaña está oculta. No es una reducción de llamadas a modelos, sino de solicitudes HTTP/consultas de estado.
- Las respuestas incluyen gatewayRequests, freshResults e inputCharacters del flujo de redacción. Los tokens reales siguen en ai_generation_requests cuando el proveedor los informa. Las búsquedas web tienen su propio registro. Estos contadores no equivalen a todos los intentos HTTP de proveedores alternativos.

## Presupuesto estructural de llamadas

Sin búsqueda web, errores ni reintentos de proveedor:

| Caso | Antes | Después |
|---|---:|---:|
| Planificación completa Parvularia | 4 (blueprint + 3 jornadas) | 3 jornadas |
| Solo recursos/evaluación de una jornada compatible | 4 (blueprint + 3 jornadas) | 1 campo/jornada |
| Básica/Media, documento nuevo | 1, más reparación si falla | 1, más reparación si falla |
| Documento compatible reutilizado de Básica/Media | 0 | 0 |

No se reducen los límites de salida para simular ahorro. El porcentaje de tokens y la calidad pedagógica comparada requieren muestras nuevas de uso: los registros históricos anteriores no tienen tokens y no permiten afirmar un ahorro observado. La evidencia automatizada verifica estructura, conservación exacta de campos y restricciones, no una evaluación ciega de calidad pedagógica por educadoras.

## Pruebas

node scripts/test-planning-efficiency.mjs cubre selección de jornadas y campos, cambios globales, conservación exacta, rechazo de OA inyectados, compatibilidad de currículo/período y reparaciones de diversidad limitadas. Se mantienen las regresiones de banco, seguridad estructural y memoria privada, además de TypeScript y builds en CI. El script de mantenimiento de Gateway reconoce la instrumentación sin reescribirla.
