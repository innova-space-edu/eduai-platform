/**
 * lib/mineduc-oa.ts
 *
 * Base de datos de Objetivos de Aprendizaje (OA) oficiales del MINEDUC Chile.
 * Fuente: Bases Curriculares 2012-2023 (mineduc.cl)
 *
 * Estructura: OA_DB[nivel][curso][asignatura] = OA[]
 * Cada OA tiene: id (ej. "OA1"), texto oficial, habilidades, indicadores clave.
 */

export interface OA {
  id: string         // "OA1", "OA2", etc.
  texto: string      // Enunciado oficial
  habilidades?: string[]
  ejes?: string[]    // Eje temático (ej. "Lectura", "Números y operaciones")
}

export type NivelKey      = "parvularia" | "basica" | "media"
export type CursoKey      = string   // "1B", "2B", ... "7B", "8B", "1M", ..., "4M", "NT1", "NT2"
export type AsignaturaKey = string

export type OADatabase = Record<NivelKey, Record<CursoKey, Record<AsignaturaKey, OA[]>>>

// ─── PARVULARIA (BCEP 2018) ───────────────────────────────────────────────────
const PARVULARIA: Record<string, Record<string, OA[]>> = {
  NT1: {
    "Identidad y Autonomía": [
      { id: "OA1", texto: "Reconocer y comunicar sus características personales, preferencias e intereses, apreciándose a sí mismo como persona.", habilidades: ["Comunicar", "Reconocer"] },
      { id: "OA2", texto: "Reconocer y valorar sus capacidades y características personales, identificando sus logros.", habilidades: ["Reconocer", "Valorar"] },
      { id: "OA3", texto: "Manifestar iniciativa para resguardar el autocuidado, la salud y la seguridad personal.", habilidades: ["Resguardar", "Manifestar"] },
      { id: "OA4", texto: "Comunicar sus emociones y sentimientos, utilizando estrategias diversas.", habilidades: ["Comunicar"] },
      { id: "OA5", texto: "Manifestar disposición y confianza para relacionarse con adultos y pares.", habilidades: ["Relacionarse"] },
      { id: "OA6", texto: "Reconocer y apreciar la diversidad de las personas.", habilidades: ["Reconocer", "Apreciar"] },
      { id: "OA7", texto: "Manifestar progresiva autonomía en la realización de sus actividades.", habilidades: ["Manifestar", "Realizar"] },
      { id: "OA8", texto: "Distinguir y respetar las normas y acuerdos de convivencia.", habilidades: ["Respetar"] },
    ],
    "Convivencia y Ciudadanía": [
      { id: "OA1", texto: "Participar en actividades solidarias que integren sus grupos de pertenencia, familia, centro educativo y comunidad.", habilidades: ["Participar"] },
      { id: "OA2", texto: "Reconocer, apreciar y respetar las diferencias individuales y de las distintas culturas.", habilidades: ["Reconocer", "Respetar"] },
      { id: "OA3", texto: "Manifestar valoración por la democracia y sus principales características.", habilidades: ["Valorar"] },
      { id: "OA4", texto: "Identificar algunas características de la vida en democracia.", habilidades: ["Identificar"] },
      { id: "OA5", texto: "Participar en la construcción de acuerdos y normas.", habilidades: ["Participar", "Construir"] },
      { id: "OA6", texto: "Respetar y hacer respetar a otros las normas de convivencia.", habilidades: ["Respetar"] },
    ],
    "Lenguaje Verbal": [
      { id: "OA1", texto: "Manifestar interés y disposición por comunicarse oralmente en lengua materna y en inglés como segunda lengua.", habilidades: ["Comunicarse"] },
      { id: "OA2", texto: "Participar en conversaciones, narrando y describiendo situaciones de la vida cotidiana.", habilidades: ["Narrar", "Describir"] },
      { id: "OA3", texto: "Comprender textos orales simples como poemas, cuentos, fábulas, identificando personajes, hechos y lugares.", habilidades: ["Comprender", "Identificar"] },
      { id: "OA4", texto: "Reconocer que los textos escritos transmiten mensajes e ideas.", habilidades: ["Reconocer"] },
      { id: "OA5", texto: "Iniciarse en la lectura, reconociendo el principio alfabético.", habilidades: ["Leer", "Reconocer"] },
      { id: "OA6", texto: "Descubrir en contextos lúdicos características del sistema de escritura.", habilidades: ["Descubrir"] },
      { id: "OA7", texto: "Manifestar interés y motivación por crear textos literarios y no literarios.", habilidades: ["Crear"] },
      { id: "OA8", texto: "Escuchar con atención y respeto las ideas y argumentos de otros.", habilidades: ["Escuchar"] },
    ],
    "Pensamiento Matemático": [
      { id: "OA1", texto: "Comprender los números del 0 al 20 y sus representaciones.", habilidades: ["Comprender", "Representar"], ejes: ["Números"] },
      { id: "OA2", texto: "Contar y comparar colecciones de objetos hasta el 20.", habilidades: ["Contar", "Comparar"], ejes: ["Números"] },
      { id: "OA3", texto: "Resolver adiciones y sustracciones simples con números del 0 al 10.", habilidades: ["Resolver"], ejes: ["Números"] },
      { id: "OA4", texto: "Identificar y describir figuras geométricas: círculo, triángulo, cuadrado, rectángulo.", habilidades: ["Identificar", "Describir"], ejes: ["Geometría"] },
      { id: "OA5", texto: "Describir la posición de objetos en el espacio.", habilidades: ["Describir"], ejes: ["Geometría"] },
      { id: "OA6", texto: "Comparar y ordenar objetos según longitud, peso y capacidad.", habilidades: ["Comparar", "Ordenar"], ejes: ["Medición"] },
      { id: "OA7", texto: "Identificar y completar patrones simples.", habilidades: ["Identificar", "Completar"], ejes: ["Álgebra"] },
      { id: "OA8", texto: "Recolectar y registrar datos concretos en tablas simples.", habilidades: ["Recolectar", "Registrar"], ejes: ["Datos y probabilidad"] },
    ],
    "Exploración del Entorno Natural": [
      { id: "OA1", texto: "Explorar y descubrir las características y atributos de los elementos del entorno natural.", habilidades: ["Explorar", "Descubrir"] },
      { id: "OA2", texto: "Identificar semejanzas y diferencias entre seres vivos.", habilidades: ["Identificar"] },
      { id: "OA3", texto: "Manifestar curiosidad e interés por explorar y conocer seres vivos.", habilidades: ["Explorar"] },
      { id: "OA4", texto: "Reconocer cambios en el entorno producidos por la acción humana.", habilidades: ["Reconocer"] },
      { id: "OA5", texto: "Participar en actividades que promuevan el cuidado del medioambiente.", habilidades: ["Participar", "Cuidar"] },
    ],
  },
  NT2: {}, // Mismos OA que NT1 con mayor complejidad — se heredan en el agente
}
PARVULARIA.NT2 = PARVULARIA.NT1 // NT2 comparte estructura con NT1, el agente aclara la complejidad

// ─── EDUCACIÓN BÁSICA ─────────────────────────────────────────────────────────
const BASICA: Record<string, Record<string, OA[]>> = {

  "1B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Reconocer que los textos escritos transmiten mensajes e ideas, y que son escritos por alguien para otros.", habilidades: ["Reconocer"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Reconocer y leer palabras a nivel de decodificación, aplicando el principio alfabético.", habilidades: ["Leer", "Decodificar"], ejes: ["Lectura"] },
      { id: "OA3", texto: "Leer textos breves en voz alta para adquirir fluidez: poemas, canciones, trabalenguas, chistes y otros.", habilidades: ["Leer"], ejes: ["Lectura"] },
      { id: "OA4", texto: "Comprender textos aplicando estrategias de comprensión lectora.", habilidades: ["Comprender", "Aplicar"], ejes: ["Lectura"] },
      { id: "OA5", texto: "Leer independientemente y comprender textos literarios y no literarios breves.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA6", texto: "Escribir oraciones y textos breves con una finalidad determinada.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA7", texto: "Escribir con letra legible, separando las palabras con espacios.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA8", texto: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas.", habilidades: ["Comprender", "Disfrutar"], ejes: ["Literatura"] },
      { id: "OA9", texto: "Escuchar activamente la lectura de textos literarios y no literarios.", habilidades: ["Escuchar"], ejes: ["Oralidad"] },
      { id: "OA10", texto: "Desarrollar el vocabulario activo y pasivo a través de la lectura.", habilidades: ["Desarrollar"], ejes: ["Vocabulario"] },
      { id: "OA11", texto: "Participar en conversaciones y debates, escuchando y haciendo comentarios.", habilidades: ["Participar"], ejes: ["Oralidad"] },
      { id: "OA12", texto: "Comprender la idea general de textos orales.", habilidades: ["Comprender"], ejes: ["Oralidad"] },
      { id: "OA13", texto: "Relacionar el lenguaje verbal con representaciones no verbales.", habilidades: ["Relacionar"], ejes: ["Comunicación no verbal"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Contar números del 0 al 100 de 1 en 1, de 2 en 2, de 5 en 5 y de 10 en 10.", habilidades: ["Contar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Leer y escribir números del 0 al 100.", habilidades: ["Leer", "Escribir"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Identificar el orden de los números del 0 al 100 y usar los símbolos <, >, =.", habilidades: ["Identificar", "Comparar"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Componer y descomponer números del 0 al 20 de diversas formas.", habilidades: ["Componer", "Descomponer"], ejes: ["Números y operaciones"] },
      { id: "OA5", texto: "Demostrar que comprende la adición y la sustracción con números del 0 al 20.", habilidades: ["Demostrar", "Comprender"], ejes: ["Números y operaciones"] },
      { id: "OA6", texto: "Calcular adiciones y sustracciones de forma mental y con apoyo concreto.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA7", texto: "Resolver problemas de adición y sustracción en contextos concretos.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA8", texto: "Identificar, describir y continuar patrones con figuras y números.", habilidades: ["Identificar", "Describir"], ejes: ["Patrones y álgebra"] },
      { id: "OA9", texto: "Identificar y describir figuras geométricas (triángulo, cuadrado, rectángulo, círculo).", habilidades: ["Identificar", "Describir"], ejes: ["Geometría"] },
      { id: "OA10", texto: "Describir la posición de objetos usando conceptos de ubicación espacial.", habilidades: ["Describir"], ejes: ["Geometría"] },
      { id: "OA11", texto: "Medir y comparar la longitud de objetos usando unidades no estandarizadas.", habilidades: ["Medir", "Comparar"], ejes: ["Medición"] },
      { id: "OA12", texto: "Leer la hora en punto y media hora en relojes análogos y digitales.", habilidades: ["Leer"], ejes: ["Medición"] },
      { id: "OA13", texto: "Recolectar y registrar datos en tablas de frecuencia simple.", habilidades: ["Recolectar", "Registrar"], ejes: ["Datos y probabilidad"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Observar y describir características externas de animales y plantas del entorno cercano.", habilidades: ["Observar", "Describir"], ejes: ["Biología"] },
      { id: "OA2", texto: "Clasificar animales y plantas según sus características.", habilidades: ["Clasificar"], ejes: ["Biología"] },
      { id: "OA3", texto: "Reconocer las necesidades básicas de los seres vivos.", habilidades: ["Reconocer"], ejes: ["Biología"] },
      { id: "OA4", texto: "Identificar los sentidos del ser humano y su función.", habilidades: ["Identificar"], ejes: ["Biología"] },
      { id: "OA5", texto: "Identificar materiales y sus propiedades (sólidos, líquidos, gases).", habilidades: ["Identificar"], ejes: ["Física y Química"] },
      { id: "OA6", texto: "Reconocer el sol como fuente de luz y calor.", habilidades: ["Reconocer"], ejes: ["Física y Química"] },
      { id: "OA7", texto: "Observar y describir cambios en el tiempo meteorológico.", habilidades: ["Observar", "Describir"], ejes: ["Ciencias de la Tierra"] },
      { id: "OA8", texto: "Describir características del día y la noche.", habilidades: ["Describir"], ejes: ["Ciencias de la Tierra"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Reconocerse como parte de grupos de pertenencia: familia, curso, escuela, barrio.", habilidades: ["Reconocer"], ejes: ["Historia"] },
      { id: "OA2", texto: "Describir las características de su vida cotidiana.", habilidades: ["Describir"], ejes: ["Historia"] },
      { id: "OA3", texto: "Reconocer y respetar semejanzas y diferencias entre personas.", habilidades: ["Reconocer", "Respetar"], ejes: ["Formación ciudadana"] },
      { id: "OA4", texto: "Ubicarse en el espacio inmediato usando conceptos de orientación espacial.", habilidades: ["Ubicar"], ejes: ["Geografía"] },
      { id: "OA5", texto: "Representar el espacio conocido mediante dibujos y planos simples.", habilidades: ["Representar"], ejes: ["Geografía"] },
    ],
  },

  "2B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Leer en voz alta de manera fluida y comprensiva variados textos.", habilidades: ["Leer"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Comprender textos aplicando estrategias de comprensión lectora: inferir, predecir, visualizar.", habilidades: ["Comprender", "Inferir"], ejes: ["Lectura"] },
      { id: "OA3", texto: "Leer y comprender textos no literarios: instrucciones, cartas, noticias.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA4", texto: "Leer y comprender textos literarios: cuentos, poemas, fábulas.", habilidades: ["Leer", "Comprender"], ejes: ["Literatura"] },
      { id: "OA5", texto: "Escribir párrafos breves con oraciones relacionadas, usando puntuación básica.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA6", texto: "Emplear estrategias de escritura: planificación, escritura, revisión.", habilidades: ["Planificar", "Revisar"], ejes: ["Escritura"] },
      { id: "OA7", texto: "Conocer y usar vocabulario nuevo a partir de los textos leídos.", habilidades: ["Usar"], ejes: ["Vocabulario"] },
      { id: "OA8", texto: "Demostrar comprensión de narraciones que aborden temas como la amistad, la familia.", habilidades: ["Demostrar"], ejes: ["Literatura"] },
      { id: "OA9", texto: "Expresarse oralmente con claridad y fluidez en diversas situaciones comunicativas.", habilidades: ["Expresar"], ejes: ["Oralidad"] },
      { id: "OA10", texto: "Reconocer conectores básicos: y, pero, porque, entonces.", habilidades: ["Reconocer"], ejes: ["Gramática"] },
      { id: "OA11", texto: "Usar ortografía básica: mayúsculas, punto final, coma.", habilidades: ["Usar"], ejes: ["Ortografía"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Contar, leer y escribir números del 0 al 1000.", habilidades: ["Contar", "Leer", "Escribir"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Identificar el valor posicional de los dígitos en números hasta 999.", habilidades: ["Identificar"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Comparar y ordenar números hasta 1000 usando <, >, =.", habilidades: ["Comparar", "Ordenar"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Demostrar comprensión de la adición y sustracción con números hasta 100.", habilidades: ["Demostrar"], ejes: ["Números y operaciones"] },
      { id: "OA5", texto: "Calcular adiciones y sustracciones con reagrupación.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA6", texto: "Demostrar comprensión de la multiplicación como adición repetida.", habilidades: ["Demostrar"], ejes: ["Números y operaciones"] },
      { id: "OA7", texto: "Memorizar tablas de multiplicar del 2 y del 5.", habilidades: ["Memorizar"], ejes: ["Números y operaciones"] },
      { id: "OA8", texto: "Resolver problemas de adición, sustracción y multiplicación.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA9", texto: "Identificar y continuar patrones numéricos y geométricos.", habilidades: ["Identificar"], ejes: ["Patrones y álgebra"] },
      { id: "OA10", texto: "Identificar y describir figuras y cuerpos geométricos.", habilidades: ["Identificar", "Describir"], ejes: ["Geometría"] },
      { id: "OA11", texto: "Medir y comparar la longitud de objetos usando el metro y el centímetro.", habilidades: ["Medir", "Comparar"], ejes: ["Medición"] },
      { id: "OA12", texto: "Leer y registrar la hora en horas y medias horas.", habilidades: ["Leer", "Registrar"], ejes: ["Medición"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Describir ciclos de vida de animales.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA2", texto: "Explicar la función de las plantas y sus partes.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA3", texto: "Identificar la cadena alimentaria simple.", habilidades: ["Identificar"], ejes: ["Biología"] },
      { id: "OA4", texto: "Describir características del cuerpo humano y órganos principales.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA5", texto: "Identificar fuentes de energía (luz, calor, electricidad).", habilidades: ["Identificar"], ejes: ["Física y Química"] },
      { id: "OA6", texto: "Describir propiedades de materiales (textura, color, forma).", habilidades: ["Describir"], ejes: ["Física y Química"] },
      { id: "OA7", texto: "Describir las estaciones del año y sus características.", habilidades: ["Describir"], ejes: ["Ciencias de la Tierra"] },
    ],
  },

  "3B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Leer en voz alta de manera fluida textos del nivel.", habilidades: ["Leer"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Comprender textos aplicando estrategias: inferir significados, releer, visualizar.", habilidades: ["Comprender", "Inferir"], ejes: ["Lectura"] },
      { id: "OA3", texto: "Leer y comprender textos no literarios: noticias, enciclopedias, instrucciones.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA4", texto: "Analizar aspectos relevantes de narraciones leídas.", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA5", texto: "Escribir narraciones de experiencias personales o imaginarias.", habilidades: ["Escribir", "Narrar"], ejes: ["Escritura"] },
      { id: "OA6", texto: "Escribir cartas, noticias y descripciones.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA7", texto: "Planificar, escribir, revisar y editar sus escritos.", habilidades: ["Planificar", "Revisar", "Editar"], ejes: ["Escritura"] },
      { id: "OA8", texto: "Usar ortografía: separación de sílabas, acento diacrítico básico.", habilidades: ["Usar"], ejes: ["Ortografía"] },
      { id: "OA9", texto: "Participar en conversaciones y exposiciones orales.", habilidades: ["Participar"], ejes: ["Oralidad"] },
      { id: "OA10", texto: "Reconocer sustantivos, verbos y adjetivos en contextos de lectura.", habilidades: ["Reconocer"], ejes: ["Gramática"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Contar, leer y escribir números del 0 al 10.000.", habilidades: ["Contar", "Leer", "Escribir"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Identificar el orden y el valor posicional de los dígitos en números hasta 10.000.", habilidades: ["Identificar"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Demostrar que comprende la adición y la sustracción con números hasta 10.000.", habilidades: ["Demostrar"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Calcular adiciones y sustracciones con y sin reagrupación.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA5", texto: "Demostrar que comprende la multiplicación y la división en contextos concretos.", habilidades: ["Demostrar"], ejes: ["Números y operaciones"] },
      { id: "OA6", texto: "Memorizar las tablas de multiplicar del 2 al 10.", habilidades: ["Memorizar"], ejes: ["Números y operaciones"] },
      { id: "OA7", texto: "Calcular multiplicaciones de un dígito por otro.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA8", texto: "Resolver problemas de adición, sustracción, multiplicación y división.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA9", texto: "Identificar fracciones como partes de un entero.", habilidades: ["Identificar"], ejes: ["Números y operaciones"] },
      { id: "OA10", texto: "Identificar y completar patrones numéricos más complejos.", habilidades: ["Identificar"], ejes: ["Patrones y álgebra"] },
      { id: "OA11", texto: "Identificar y describir ángulos rectos, agudos y obtusos.", habilidades: ["Identificar", "Describir"], ejes: ["Geometría"] },
      { id: "OA12", texto: "Medir con unidades de longitud estándar (cm, m).", habilidades: ["Medir"], ejes: ["Medición"] },
      { id: "OA13", texto: "Registrar y representar datos en pictogramas y gráficos de barras.", habilidades: ["Registrar", "Representar"], ejes: ["Datos y probabilidad"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Describir los niveles de organización de los seres vivos: célula, tejido, órgano, sistema.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA2", texto: "Describir el sistema locomotor humano.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA3", texto: "Explicar la fotosíntesis como proceso que realizan las plantas.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA4", texto: "Describir adaptaciones de animales a su entorno.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA5", texto: "Identificar mezclas y soluciones en la vida cotidiana.", habilidades: ["Identificar"], ejes: ["Física y Química"] },
      { id: "OA6", texto: "Describir el ciclo del agua.", habilidades: ["Describir"], ejes: ["Ciencias de la Tierra"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Describir la vida de las culturas originarias de Chile (Mapuche, Aymara, Rapa Nui, etc.).", habilidades: ["Describir"], ejes: ["Historia"] },
      { id: "OA2", texto: "Reconocer el proceso de conquista española de América.", habilidades: ["Reconocer"], ejes: ["Historia"] },
      { id: "OA3", texto: "Ubicar en el mapa de Chile las regiones y sus capitales.", habilidades: ["Ubicar"], ejes: ["Geografía"] },
      { id: "OA4", texto: "Describir las zonas geográficas de Chile: norte, centro, sur, extremos.", habilidades: ["Describir"], ejes: ["Geografía"] },
      { id: "OA5", texto: "Identificar derechos y deberes de los niños y ciudadanos.", habilidades: ["Identificar"], ejes: ["Formación ciudadana"] },
    ],
  },

  "4B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Leer textos literarios y no literarios con fluidez y comprensión.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Analizar textos narrativos: personajes, ambiente, conflicto y resolución.", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA3", texto: "Comprender textos no literarios: identificar idea principal e ideas secundarias.", habilidades: ["Comprender", "Identificar"], ejes: ["Lectura"] },
      { id: "OA4", texto: "Escribir cuentos y otros textos narrativos con inicio, desarrollo y desenlace.", habilidades: ["Escribir", "Narrar"], ejes: ["Escritura"] },
      { id: "OA5", texto: "Escribir textos expositivos breves (informes, descripciones).", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA6", texto: "Usar estrategias de escritura: planificar, borradores, revisar.", habilidades: ["Planificar", "Revisar"], ejes: ["Escritura"] },
      { id: "OA7", texto: "Usar vocabulario variado y preciso.", habilidades: ["Usar"], ejes: ["Vocabulario"] },
      { id: "OA8", texto: "Conjugar verbos en distintos tiempos verbales.", habilidades: ["Conjugar"], ejes: ["Gramática"] },
      { id: "OA9", texto: "Exponer ideas y argumentos orales con claridad.", habilidades: ["Exponer"], ejes: ["Oralidad"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Leer, escribir y ordenar números hasta 1.000.000.", habilidades: ["Leer", "Escribir", "Ordenar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Demostrar comprensión de la multiplicación y la división con números naturales.", habilidades: ["Demostrar"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Calcular multiplicaciones de dos dígitos.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Calcular divisiones con divisor de un dígito.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA5", texto: "Resolver problemas que involucran las cuatro operaciones.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA6", texto: "Reconocer fracciones propias, impropias y mixtas.", habilidades: ["Reconocer"], ejes: ["Números y operaciones"] },
      { id: "OA7", texto: "Comparar y ordenar fracciones.", habilidades: ["Comparar", "Ordenar"], ejes: ["Números y operaciones"] },
      { id: "OA8", texto: "Calcular la suma de fracciones de igual denominador.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA9", texto: "Identificar y describir ángulos y sus características.", habilidades: ["Identificar", "Describir"], ejes: ["Geometría"] },
      { id: "OA10", texto: "Calcular perímetro de figuras simples.", habilidades: ["Calcular"], ejes: ["Medición"] },
      { id: "OA11", texto: "Leer y representar datos en gráficos de barras y línea.", habilidades: ["Leer", "Representar"], ejes: ["Datos y probabilidad"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Explicar los sistemas del cuerpo humano: digestivo, respiratorio y circulatorio.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA2", texto: "Describir el ciclo de vida de los seres vivos.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA3", texto: "Investigar adaptaciones de plantas y animales al clima.", habilidades: ["Investigar"], ejes: ["Biología"] },
      { id: "OA4", texto: "Identificar propiedades de la materia: masa, volumen, densidad.", habilidades: ["Identificar"], ejes: ["Física y Química"] },
      { id: "OA5", texto: "Describir cambios de estado de la materia.", habilidades: ["Describir"], ejes: ["Física y Química"] },
      { id: "OA6", texto: "Describir el sistema solar y las características de los planetas.", habilidades: ["Describir"], ejes: ["Ciencias de la Tierra"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Describir las sociedades aborígenes de América antes de la llegada de los europeos.", habilidades: ["Describir"], ejes: ["Historia"] },
      { id: "OA2", texto: "Describir la colonización española en Chile.", habilidades: ["Describir"], ejes: ["Historia"] },
      { id: "OA3", texto: "Localizar Chile en el mapa de Sudamérica y en el planisferio.", habilidades: ["Localizar"], ejes: ["Geografía"] },
      { id: "OA4", texto: "Describir el relieve y climas de Chile.", habilidades: ["Describir"], ejes: ["Geografía"] },
      { id: "OA5", texto: "Reconocer los símbolos patrios y su significado.", habilidades: ["Reconocer"], ejes: ["Formación ciudadana"] },
    ],
  },

  "5B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Leer con fluidez y comprender textos narrativos, poéticos y no literarios.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Analizar los recursos literarios de los textos: metáfora, comparación, personificación.", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA3", texto: "Evaluar la información de textos no literarios según propósito y fuente.", habilidades: ["Evaluar"], ejes: ["Lectura"] },
      { id: "OA4", texto: "Escribir ensayos breves con argumento central y evidencias.", habilidades: ["Escribir", "Argumentar"], ejes: ["Escritura"] },
      { id: "OA5", texto: "Planificar y escribir textos con un propósito comunicativo específico.", habilidades: ["Planificar", "Escribir"], ejes: ["Escritura"] },
      { id: "OA6", texto: "Usar ortografía acentual: tildes en palabras agudas, graves y esdrújulas.", habilidades: ["Usar"], ejes: ["Ortografía"] },
      { id: "OA7", texto: "Realizar presentaciones orales estructuradas con material de apoyo.", habilidades: ["Presentar"], ejes: ["Oralidad"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Leer, escribir y comparar números naturales hasta 100.000.000.", habilidades: ["Leer", "Escribir", "Comparar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Calcular la potenciación de números naturales.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Resolver divisiones con divisor de dos dígitos.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Operar fracciones: suma, resta con distinto denominador.", habilidades: ["Operar"], ejes: ["Números y operaciones"] },
      { id: "OA5", texto: "Comprender y usar decimales hasta milésimas.", habilidades: ["Comprender", "Usar"], ejes: ["Números y operaciones"] },
      { id: "OA6", texto: "Operar con decimales: suma y resta.", habilidades: ["Operar"], ejes: ["Números y operaciones"] },
      { id: "OA7", texto: "Calcular porcentajes.", habilidades: ["Calcular"], ejes: ["Números y operaciones"] },
      { id: "OA8", texto: "Resolver problemas con fracciones, decimales y porcentajes.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA9", texto: "Identificar y calcular área de figuras simples.", habilidades: ["Identificar", "Calcular"], ejes: ["Geometría"] },
      { id: "OA10", texto: "Interpretar y crear gráficos estadísticos.", habilidades: ["Interpretar", "Crear"], ejes: ["Datos y probabilidad"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Describir los sistemas nervioso, endocrino y reproductor humano.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA2", texto: "Explicar la pubertad y los cambios que conlleva.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA3", texto: "Describir ecosistemas y relaciones entre organismos.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA4", texto: "Identificar cambios físicos y químicos en la materia.", habilidades: ["Identificar"], ejes: ["Física y Química"] },
      { id: "OA5", texto: "Describir la estructura interna de la Tierra.", habilidades: ["Describir"], ejes: ["Ciencias de la Tierra"] },
    ],
  },

  "6B": {
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: "Leer con fluidez y comprensión textos literarios y no literarios de mayor complejidad.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Analizar la estructura de textos narrativos complejos (subgéneros).", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA3", texto: "Escribir textos argumentativos con tesis, argumentos y conclusión.", habilidades: ["Escribir", "Argumentar"], ejes: ["Escritura"] },
      { id: "OA4", texto: "Usar conectores de argumentación: sin embargo, por lo tanto, en conclusión.", habilidades: ["Usar"], ejes: ["Gramática"] },
      { id: "OA5", texto: "Debatir tomando posición, fundamentando con argumentos y escuchando al otro.", habilidades: ["Debatir", "Argumentar"], ejes: ["Oralidad"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Identificar y operar con números enteros positivos y negativos.", habilidades: ["Identificar", "Operar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Operar con fracciones y decimales: multiplicación y división.", habilidades: ["Operar"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Resolver problemas con razones y proporciones.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA4", texto: "Usar variables para representar relaciones.", habilidades: ["Usar", "Representar"], ejes: ["Patrones y álgebra"] },
      { id: "OA5", texto: "Calcular área y perímetro de triángulos y cuadriláteros.", habilidades: ["Calcular"], ejes: ["Geometría"] },
      { id: "OA6", texto: "Calcular el volumen de prismas rectangulares.", habilidades: ["Calcular"], ejes: ["Geometría"] },
      { id: "OA7", texto: "Calcular probabilidades de eventos simples.", habilidades: ["Calcular"], ejes: ["Datos y probabilidad"] },
    ],
  },

  // ENSEÑANZA MEDIA
  "7B": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Leer y comprender textos literarios: cuentos, novelas breves, poemas.", habilidades: ["Leer", "Comprender"], ejes: ["Lectura"] },
      { id: "OA2", texto: "Analizar recursos literarios: narrador, tiempo narrativo, punto de vista.", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA3", texto: "Escribir textos de forma cohesionada y coherente.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA4", texto: "Argumentar en forma oral y escrita sobre temas de interés.", habilidades: ["Argumentar"], ejes: ["Oralidad y escritura"] },
      { id: "OA5", texto: "Analizar textos no literarios: noticias, crónicas, ensayos breves.", habilidades: ["Analizar"], ejes: ["Lectura no literaria"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Operar con números enteros y racionales.", habilidades: ["Operar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Resolver problemas con porcentajes, razones y proporciones.", habilidades: ["Resolver"], ejes: ["Números y operaciones"] },
      { id: "OA3", texto: "Trabajar con expresiones algebraicas simples.", habilidades: ["Operar", "Simplificar"], ejes: ["Álgebra"] },
      { id: "OA4", texto: "Resolver ecuaciones de primer grado.", habilidades: ["Resolver"], ejes: ["Álgebra"] },
      { id: "OA5", texto: "Calcular área y perímetro de figuras planas.", habilidades: ["Calcular"], ejes: ["Geometría"] },
      { id: "OA6", texto: "Interpretar y construir tablas y gráficos estadísticos.", habilidades: ["Interpretar", "Construir"], ejes: ["Estadística y probabilidad"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Explicar las civilizaciones de la Antigüedad: Mesopotamia, Egipto, Grecia, Roma.", habilidades: ["Explicar"], ejes: ["Historia"] },
      { id: "OA2", texto: "Describir la Edad Media y sus principales características.", habilidades: ["Describir"], ejes: ["Historia"] },
      { id: "OA3", texto: "Analizar el proceso de expansión europea y sus consecuencias.", habilidades: ["Analizar"], ejes: ["Historia"] },
      { id: "OA4", texto: "Ubicar y describir grandes regiones geográficas del mundo.", habilidades: ["Ubicar", "Describir"], ejes: ["Geografía"] },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: "Explicar la célula como unidad básica de la vida.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA2", texto: "Describir la reproducción celular: mitosis y meiosis.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA3", texto: "Explicar la herencia genética y la variabilidad.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA4", texto: "Describir fuerzas y movimiento en la física.", habilidades: ["Describir"], ejes: ["Física"] },
      { id: "OA5", texto: "Identificar elementos de la tabla periódica y sus propiedades básicas.", habilidades: ["Identificar"], ejes: ["Química"] },
    ],
  },

  "8B": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Analizar obras literarias de distintos géneros y épocas.", habilidades: ["Analizar"], ejes: ["Literatura"] },
      { id: "OA2", texto: "Escribir ensayos argumentativos con citas y fuentes.", habilidades: ["Escribir", "Argumentar"], ejes: ["Escritura"] },
      { id: "OA3", texto: "Analizar el lenguaje en distintos contextos comunicativos.", habilidades: ["Analizar"], ejes: ["Oralidad"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Operar con potencias y raíces.", habilidades: ["Operar"], ejes: ["Números y operaciones"] },
      { id: "OA2", texto: "Resolver ecuaciones de primer y segundo grado.", habilidades: ["Resolver"], ejes: ["Álgebra"] },
      { id: "OA3", texto: "Graficar funciones lineales en el plano cartesiano.", habilidades: ["Graficar"], ejes: ["Álgebra y funciones"] },
      { id: "OA4", texto: "Aplicar el Teorema de Pitágoras.", habilidades: ["Aplicar"], ejes: ["Geometría"] },
      { id: "OA5", texto: "Calcular volumen y superficie de cuerpos geométricos.", habilidades: ["Calcular"], ejes: ["Geometría"] },
      { id: "OA6", texto: "Calcular medidas de tendencia central: media, mediana, moda.", habilidades: ["Calcular"], ejes: ["Estadística"] },
    ],
  },

  "1M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Leer y analizar obras literarias completas de distintos géneros.", habilidades: ["Leer", "Analizar"], ejes: ["Literatura"] },
      { id: "OA2", texto: "Escribir textos argumentativos complejos con coherencia y cohesión.", habilidades: ["Escribir", "Argumentar"], ejes: ["Escritura"] },
      { id: "OA3", texto: "Debatir en forma fundamentada respetando puntos de vista distintos.", habilidades: ["Debatir", "Argumentar"], ejes: ["Oralidad"] },
      { id: "OA4", texto: "Analizar el contexto de producción de textos literarios.", habilidades: ["Analizar"], ejes: ["Literatura"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Resolver sistemas de ecuaciones lineales.", habilidades: ["Resolver"], ejes: ["Álgebra"] },
      { id: "OA2", texto: "Analizar funciones lineales y cuadráticas.", habilidades: ["Analizar"], ejes: ["Álgebra y funciones"] },
      { id: "OA3", texto: "Aplicar razones trigonométricas en triángulos rectángulos.", habilidades: ["Aplicar"], ejes: ["Geometría"] },
      { id: "OA4", texto: "Calcular probabilidades condicionales.", habilidades: ["Calcular"], ejes: ["Probabilidad"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Explicar los procesos de la Modernidad: Renacimiento, Reforma y Revoluciones.", habilidades: ["Explicar"], ejes: ["Historia"] },
      { id: "OA2", texto: "Analizar las Revoluciones Atlánticas y sus consecuencias.", habilidades: ["Analizar"], ejes: ["Historia"] },
      { id: "OA3", texto: "Describir procesos de industrialización y sus impactos sociales.", habilidades: ["Describir"], ejes: ["Historia"] },
    ],
    "Biología": [
      { id: "OA1", texto: "Explicar mecanismos de la evolución: selección natural, deriva genética.", habilidades: ["Explicar"], ejes: ["Biología"] },
      { id: "OA2", texto: "Describir la expresión génica y su regulación.", habilidades: ["Describir"], ejes: ["Biología"] },
      { id: "OA3", texto: "Analizar el impacto de la biotecnología en la sociedad.", habilidades: ["Analizar"], ejes: ["Biología"] },
    ],
  },

  "2M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Leer y analizar novelas y obras dramáticas completas.", habilidades: ["Leer", "Analizar"], ejes: ["Literatura"] },
      { id: "OA2", texto: "Escribir textos con propósitos variados dominando registros formales e informales.", habilidades: ["Escribir"], ejes: ["Escritura"] },
      { id: "OA3", texto: "Analizar textos multimodales (publicidades, noticias digitales).", habilidades: ["Analizar"], ejes: ["Lectura no literaria"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Resolver ecuaciones e inecuaciones de primer y segundo grado.", habilidades: ["Resolver"], ejes: ["Álgebra"] },
      { id: "OA2", texto: "Graficar y analizar funciones cuadráticas.", habilidades: ["Graficar", "Analizar"], ejes: ["Álgebra y funciones"] },
      { id: "OA3", texto: "Aplicar la trigonometría a situaciones reales.", habilidades: ["Aplicar"], ejes: ["Geometría"] },
    ],
  },

  "3M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Analizar críticamente textos literarios y no literarios.", habilidades: ["Analizar"], ejes: ["Lectura crítica"] },
      { id: "OA2", texto: "Producir textos para distintos propósitos y audiencias.", habilidades: ["Producir"], ejes: ["Escritura"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Aplicar propiedades de los números reales.", habilidades: ["Aplicar"], ejes: ["Números"] },
      { id: "OA2", texto: "Operar con logaritmos y potencias.", habilidades: ["Operar"], ejes: ["Álgebra"] },
      { id: "OA3", texto: "Analizar funciones exponenciales y logarítmicas.", habilidades: ["Analizar"], ejes: ["Álgebra y funciones"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Analizar procesos de la historia de Chile en el siglo XX.", habilidades: ["Analizar"], ejes: ["Historia"] },
      { id: "OA2", texto: "Evaluar el rol de los actores sociales en los cambios políticos de Chile.", habilidades: ["Evaluar"], ejes: ["Historia"] },
    ],
  },

  "4M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: "Leer, analizar e interpretar obras literarias de la tradición universal y latinoamericana.", habilidades: ["Leer", "Analizar", "Interpretar"], ejes: ["Literatura"] },
      { id: "OA2", texto: "Producir textos académicos con rigor argumentativo.", habilidades: ["Producir"], ejes: ["Escritura"] },
    ],
    "Matemática": [
      { id: "OA1", texto: "Modelar situaciones del mundo real con funciones.", habilidades: ["Modelar"], ejes: ["Álgebra y funciones"] },
      { id: "OA2", texto: "Interpretar y analizar datos estadísticos complejos.", habilidades: ["Interpretar", "Analizar"], ejes: ["Estadística"] },
      { id: "OA3", texto: "Aplicar conceptos de probabilidad a situaciones reales.", habilidades: ["Aplicar"], ejes: ["Probabilidad"] },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: "Analizar el mundo contemporáneo: globalización, geopolítica y desafíos actuales.", habilidades: ["Analizar"], ejes: ["Historia y actualidad"] },
      { id: "OA2", texto: "Evaluar la democracia, los derechos humanos y la participación ciudadana.", habilidades: ["Evaluar"], ejes: ["Formación ciudadana"] },
    ],
  },
}

// ─── Función principal: obtener OAs relevantes ────────────────────────────────

/**
 * Mapear el nombre del curso al key del DB
 * Ej: "3° Básico" → "3B", "1° Medio" → "1M", "NT2 - Kinder" → "NT2"
 */
export function cursoToKey(curso: string): string {
  const c = curso.toLowerCase()
  if (c.includes("nt1") || c.includes("pre kinder"))  return "NT1"
  if (c.includes("nt2") || c.includes("kinder"))      return "NT2"
  if (c.includes("sala cuna") || c.includes("nivel medio")) return "NT1" // fallback parvularia
  const numMatch = c.match(/(\d+)[°oa\s]/)
  const num      = numMatch ? numMatch[1] : ""
  if (c.includes("básico") || c.includes("basico"))   return `${num}B`
  if (c.includes("medio"))                            return `${num}M`
  return num ? `${num}B` : "3B" // fallback
}

/**
 * Normalizar nombre de asignatura para buscar en la DB
 */
export function normalizeAsignatura(asig: string, nivel: NivelKey): string {
  const a = asig.toLowerCase()
  if (nivel === "media") {
    if (a.includes("lenguaje") || a.includes("lengua") || a.includes("literatura")) return "Lengua y Literatura"
    if (a.includes("matemát") || a.includes("math"))  return "Matemática"
    if (a.includes("historia") || a.includes("geograf"))  return "Historia, Geografía y Cs. Sociales"
    if (a.includes("biolog"))  return "Biología"
    if (a.includes("química"))  return "Química"
    if (a.includes("física"))  return "Física"
  }
  if (nivel === "basica") {
    if (a.includes("lenguaje") || a.includes("comunicaci"))  return "Lenguaje y Comunicación"
    if (a.includes("matemát"))  return "Matemática"
    if (a.includes("ciencias naturales") || a.includes("ciencias nat"))  return "Ciencias Naturales"
    if (a.includes("historia") || a.includes("geograf"))  return "Historia, Geografía y Cs. Sociales"
  }
  return asig // retornar tal cual si no hay match
}

/**
 * Obtener los OA de una asignatura y curso específico.
 * Retorna array vacío si no hay datos para ese curso/asignatura.
 */
export function getOAs(nivel: NivelKey, curso: string, asignatura: string): OA[] {
  const cursoKey = cursoToKey(curso)
  const asigKey  = normalizeAsignatura(asignatura, nivel)

  const db = nivel === "parvularia" ? PARVULARIA : BASICA

  return db[cursoKey]?.[asigKey] || db[cursoKey]?.[asignatura] || []
}

/**
 * Obtener un OA específico por número
 * Ej: getOA("basica", "3° Básico", "Matemática", 5) → OA5
 */
export function getOA(nivel: NivelKey, curso: string, asignatura: string, numero: number): OA | null {
  const oas = getOAs(nivel, curso, asignatura)
  return oas.find(oa => oa.id === `OA${numero}`) || null
}

/**
 * Construir bloque de texto con los OA para el system prompt del agente.
 * Si se pide un OA específico, retorna solo ese con detalle.
 * Si no, retorna todos los OA del curso/asignatura.
 */
export function buildOAContext(
  nivel: NivelKey,
  curso: string,
  asignatura: string,
  oaNumero?: number
): string {
  const oas = getOAs(nivel, curso, asignatura)
  if (!oas.length) return ""

  const header = `\nOBJETIVOS DE APRENDIZAJE OFICIALES MINEDUC — ${asignatura} ${curso}:\n`

  if (oaNumero) {
    const oa = oas.find(o => o.id === `OA${oaNumero}`)
    if (oa) {
      return header +
        `${oa.id}: ${oa.texto}\n` +
        (oa.habilidades ? `Habilidades: ${oa.habilidades.join(", ")}\n` : "") +
        (oa.ejes ? `Eje temático: ${oa.ejes.join(", ")}\n` : "")
    }
  }

  return header + oas.map(oa =>
    `${oa.id}: ${oa.texto}${oa.ejes ? ` [${oa.ejes.join(", ")}]` : ""}`
  ).join("\n")
}

export const OA_DATABASE = { PARVULARIA, BASICA }
