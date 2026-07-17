import { readFileSync, writeFileSync } from "node:fs"

const path = "data/mineduc/basica/2_basico/lenguaje.json"
const data = JSON.parse(readFileSync(path, "utf8"))

data.metadata = {
  nivel: "Básica",
  curso: "2° Básico",
  asignatura: "Lenguaje y Comunicación",
  fuente: "Currículum Nacional - MINEDUC Chile",
  source_url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/lenguaje-comunicacion/2-basico",
  base_curricular: "Bases Curriculares 1° a 6° Básico",
  estado_verificacion: "verificado_oficial",
  alcance_verificacion: ["oa_contenido"],
  fecha_consulta: "2026-07-17",
  nota: "Los treinta OA de contenido fueron cotejados con la página oficial vigente. La agrupación corresponde a ejes curriculares.",
}

const replacements = {
  "LE02 OA 05": "Demostrar comprensión de las narraciones leídas:\n- extrayendo información explícita e implícita;\n- reconstruyendo la secuencia de las acciones en la historia;\n- identificando y describiendo las características físicas y sentimientos de los distintos personajes;\n- recreando, a través de distintas expresiones (dibujos, modelos tridimensionales u otras), el ambiente en el que ocurre la acción;\n- estableciendo relaciones entre el texto y sus propias experiencias;\n- emitiendo una opinión sobre un aspecto de la lectura.",
  "LE02 OA 07": "Leer independientemente y comprender textos no literarios (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento del mundo:\n- extrayendo información explícita e implícita;\n- comprendiendo la información que aportan las ilustraciones y los símbolos a un texto;\n- formulando una opinión sobre algún aspecto de la lectura.",
  "LE02 OA 17": "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad. Durante este proceso:\n- organizan las ideas en oraciones que comienzan con mayúscula y terminan con punto;\n- utilizan un vocabulario variado;\n- mejoran la redacción del texto a partir de sugerencias de los pares y el docente;\n- corrigen la concordancia de género y número, la ortografía y la presentación.",
  "LE02 OA 21": "Escribir correctamente para facilitar la comprensión por parte del lector, usando de manera apropiada:\n- combinaciones ce-ci, que-qui, ge-gi, gue-gui, güe-güi;\n- r-rr-nr;\n- mayúsculas al iniciar una oración y al escribir sustantivos propios;\n- punto al finalizar una oración;\n- signos de interrogación y exclamación al inicio y final de preguntas y exclamaciones.",
  "LE02 OA 23": "Comprender textos orales (explicaciones, instrucciones, relatos, anécdotas, etc.) para obtener información y desarrollar su curiosidad por el mundo:\n- estableciendo conexiones con sus propias experiencias;\n- identificando el propósito;\n- formulando preguntas para obtener información adicional y aclarar dudas;\n- respondiendo preguntas sobre información explícita e implícita;\n- formulando una opinión sobre lo escuchado.",
  "LE02 OA 25": "Participar activamente en conversaciones grupales sobre textos leídos o escuchados en clases o temas de su interés:\n- manteniendo el foco de la conversación;\n- expresando sus ideas u opiniones;\n- formulando preguntas para aclarar dudas;\n- demostrando interés ante lo escuchado;\n- mostrando empatía frente a situaciones expresadas por otros;\n- respetando turnos.",
  "LE02 OA 26": "Interactuar de acuerdo con las convenciones sociales en diferentes situaciones:\n- presentarse a sí mismo y a otros;\n- saludar;\n- preguntar;\n- expresar opiniones, sentimientos e ideas;\n- situaciones que requieren el uso de fórmulas de cortesía como por favor, gracias, perdón, permiso.",
  "LE02 OA 27": "Expresarse de manera coherente y articulada sobre temas de su interés:\n- presentando información o narrando un evento relacionado con el tema;\n- incorporando frases descriptivas que ilustren lo dicho;\n- utilizando un vocabulario variado;\n- pronunciando adecuadamente y usando un volumen audible;\n- manteniendo una postura adecuada.",
}

for (const unit of data.unidades || []) {
  unit.id ||= `eje-${unit.numero}`
  unit.tipo_agrupacion = "eje_curricular"
  for (const oa of unit.oa || []) {
    if (replacements[oa.codigo_oficial]) oa.descripcion = replacements[oa.codigo_oficial]
  }
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8")
