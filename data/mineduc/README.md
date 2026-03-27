# Base Curricular MINEDUC - Innova Space Education

Este directorio contiene la estructura para almacenar los Objetivos de Aprendizaje (OA)
según las Bases Curriculares oficiales del Ministerio de Educación de Chile.

## ⚠️ IMPORTANTE
- NO inventar OA
- SOLO usar información oficial de:
  https://www.curriculumnacional.cl/

---

## 📚 Estructura General

### Niveles:
- Educación Parvularia
- Educación Básica
- Educación Media

---

## 👶 Parvularia
Se organiza en:

- Tramos: NT1, NT2
- Ámbitos:
  - Desarrollo personal y social
  - Comunicación integral
  - Interacción y comprensión del entorno
- Núcleos
- OA Transversales
- OA de Contenido

---

## 🏫 Básica y Media
Se organiza en:

- Curso
- Asignatura
- Unidad
- Objetivos de Aprendizaje (OA)

---

## 🎯 Uso en el sistema

Este archivo es usado por:

- lib/mineduc-oa.ts
- lib/planificador-curriculum.ts
- app/educador/page.tsx

Permite:

- mostrar OA automáticamente
- seleccionar múltiples OA
- generar planificación con IA basada en el currículum real

---

## 🚀 Próximo paso

Completar la base curricular oficial:

- Parvularia completa
- 1° a 8° básico
- 1° a 4° medio
- Todas las asignaturas

---

## 🧠 Recomendación

Separar por archivos en el futuro:

data/mineduc/parvularia.json  
data/mineduc/basica/1_basico.json  
data/mineduc/media/1_medio.json  

---

## ✨ Objetivo final

Construir un sistema educativo que:

- automatice planificación docente
- use IA con base curricular real
- sea útil para docentes en Chile
