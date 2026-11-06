# Auditoría curricular de enseñanza media — 6 de noviembre de 2026

El catálogo del planificador tenía 19 combinaciones de curso y asignatura, aunque el registro de progreso declaraba completos los cuatro cursos. Ahora se registran 108 combinaciones: se incorporan las asignaturas faltantes del plan general, las opciones de formación general electiva y las 27 asignaturas de profundización HC en ambos cursos.

## Cobertura

| Curso | Selectores | OA registrados | Organización |
|---|---:|---:|---|
| 1° medio | 13 | 154 | 10 asignaturas; Ciencias Naturales también se ofrece por sus tres ejes |
| 2° medio | 13 | 147 | 10 asignaturas; Ciencias Naturales también se ofrece por sus tres ejes |
| 3° medio | 41 | 258 | 6 de formación general, 8 opciones de formación general electiva y 27 de profundización HC |
| 4° medio | 41 | 256 | 6 de formación general, 8 opciones de formación general electiva y 27 de profundización HC |

Los 815 registros corresponden a **550 códigos distintos**, no a 815 objetivos nacionales únicos: los electivos de 3°/4° comparten objetivos y los ejes científicos se ofrecen también como alias. Los cuatro módulos de Ciencias para la Ciudadanía conservan su numeración independiente; no se asignan artificialmente a un año determinado.

### Los 27 electivos HC

| Área | Asignaturas |
|---|---|
| Artes | Artes visuales, audiovisuales y multimediales; Creación y composición musical; Diseño y arquitectura; Interpretación musical; Interpretación y creación en danza; Interpretación y creación en teatro |
| Ciencias | Biología celular y molecular; Biología de los ecosistemas; Ciencias de la salud; Física; Química |
| Educación Física | Ciencias del ejercicio físico y deportivo; Expresión corporal; Promoción de estilos de vida activos y saludables |
| Filosofía | Estética; Filosofía política; Seminario de filosofía |
| Historia | Comprensión histórica del presente; Economía y sociedad; Geografía, territorio y desafíos socioambientales |
| Lengua y Literatura | Lectura y escritura especializadas; Participación y argumentación en democracia; Taller de literatura |
| Matemática | Geometría 3D; Límites, derivadas e integrales; Pensamiento computacional y programación; Probabilidades y estadística descriptiva e inferencial |

La formación general electiva comprende Artes Visuales, Danza, Música, Teatro, Educación Física y Salud 1 y 2, Mundo Global y Chile y la Región Latinoamericana. Se mantiene separada del plan de profundización mediante `metadata.plan`.

## Correcciones verificadas

- Se agregan 89 archivos curriculares y se actualizan los 19 anteriores.
- Se depuran o actualizan 17 registros anteriores. Trece contenían el pie del portal (teléfono, ayuda, privacidad o redes sociales) dentro del OA. Los otros cambios corresponden a redacción o notas de la fuente oficial. El detalle íntegro antes/después está en `data/mineduc/references/media-2026-audit.json`.
- Se conservan todos los identificadores anteriores para que las planificaciones guardadas puedan seguir identificando sus OA.
- Se corrige la búsqueda por número para códigos `OAC-01`. Cuando el número es ambiguo entre módulos, se exige selección específica en vez de devolver el primer resultado.
- El registro de la aplicación y los metadatos de asignaturas se generan desde los mismos archivos; agregar solamente un JSON ya no deja un electivo fuera de la aplicación.
- El índice y el progreso reflejan la cobertura real, con las limitaciones descritas abajo.

## Fuentes y tratamiento de discrepancias

Fuente principal: fichas específicas de asignatura y OA de [Currículum Nacional](https://www.curriculumnacional.cl/curriculum/3o-4o-medio). Se usan los códigos del portal, diferenciando la propuesta de Inglés (`EN`) del currículum de 1°/2° medio (`IN`). El catálogo guarda la URL por archivo y por objetivo.

Fuentes normativas de contraste, publicadas por MINEDUC y transcritas en Ley Chile:

- [Anexo de las bases 7° básico a 2° medio, Decreto 614](https://www.bcn.cl/leychile/navegar?i=1060374).
- [Decreto 369: Tecnología, Artes Visuales, Música y Orientación](https://www.bcn.cl/leychile/navegar?i=1084868).
- [Complementación de Orientación](https://www.bcn.cl/leychile/navegar?idNorma=1093403).
- [Decreto 193: bases 3° y 4° medio](https://www.bcn.cl/leychile/navegar?idNorma=1136078).

La transcripción del Decreto 193 repite contenido de Estética bajo Filosofía Política y presenta el encabezado de Seminario de Filosofía como Filosofía Política. Se contrastaron las fichas específicas de [Filosofía Política](https://www.curriculumnacional.cl/curriculum/3o-4o-medio/filosofia-politica/3-medio-hc) y [Seminario de Filosofía](https://www.curriculumnacional.cl/curriculum/3o-4o-medio/seminario-filosofia/3-medio-hc). No se copiaron estos errores al catálogo.

Las consultas individuales que devolvían solo un enunciado terminado en dos puntos no se aceptaron como descripción completa: se conservaron los subapartados del texto normativo. Los separadores y notas al pie no deben suprimir la continuación de una lista. Los ejes organizan la selección; no se presentan como las unidades oficiales de los programas de estudio.

Se archivan los extractos consultados en `data/mineduc/references/`, con las líneas normativas de procedencia, las fichas del portal, el estado anterior y un manifiesto de cobertura. Fecha de consulta: 2026-11-06. Las líneas se refieren a esas copias archivadas, no a una paginación normativa.

## Alcance y límites

Esta revisión cubre los **OA de contenido** de educación media regular general y HC. Las especialidades técnico-profesionales y los programas confesionales de Religión requieren sus propios catálogos y no se declaran incluidos. Los marcos de la formación diferenciada artística tampoco se sustituyen por los electivos artísticos HC.

Se incorporan 410 apariciones de objetivos de habilidades en las secciones cuya numeración se verificó explícitamente. Las habilidades restantes y las actitudes necesitan una auditoría específica; no se declara completa esa dimensión. No se modifica el currículum de Básica ni Parvularia.

## Reproducción y validación

```bash
npm run curriculum:media:rebuild
npm run test:curriculum
npm run test:curriculum:media
```

La reconstrucción usa las fuentes archivadas y es reproducible sin red. **No consulta automáticamente una versión nueva del currículum.** Para una nueva revisión, actualizar las copias de fuentes y revisar diferencias antes de cambiar la fecha. Los dos nombres históricos `sync-mineduc-media.py` y `run-sync-mineduc-media.py` ejecutan esa misma reconstrucción completa; ya no sobrescriben solamente los 19 archivos antiguos.

La prueba ejecuta el registro y las funciones reales del planificador: 108 selecciones, cantidades y códigos, 27/8 electivos por curso, estabilidad de IDs anteriores, separación de ejes, coherencia entre módulos, normalización de asignaturas y ausencia de navegación web en las descripciones. La validación general revisa 194 archivos, sin errores ni advertencias en esta revisión. La compilación completa se verifica adicionalmente en CI; la prueba local no sustituye esa compilación ni una prueba de la sesión autenticada en producción.
