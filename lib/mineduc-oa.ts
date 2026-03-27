/**
 * lib/mineduc-oa.ts
 *
 * Base de datos de OA oficiales MINEDUC Chile
 * Fuente: Bases Curriculares 1°-6° Básico (Decreto 433/439, 2012)
 *         Bases Curriculares 7°B-2°M (Decreto 369, 2015)
 * Extraída directamente de los PDFs oficiales de curriculumnacional.cl
 *
 * 426+ OAs | 10 cursos | 4 asignaturas principales
 */

export interface OA {
  id: string
  texto: string
}

export type NivelKey = "parvularia" | "basica" | "media"


// ─── EDUCACIÓN BÁSICA 1°-6° ──────────────────────────────────────────────────

const BASICA: Record<string, Record<string, OA[]>> = {

  "1B": {
    "Matemática": [
      { id: "OA1", texto: `Contar números del 0 al 100 de 1 en 1, de 2 en 2, de 5 en 5 y de 10 en 10, hacia adelante y hacia atrás, empezando por cualquier número menor que 100.` },
      { id: "OA2", texto: `Identificar el orden de los elementos de una serie, utilizando números ordinales del primero (1º) al décimo (10º).` },
      { id: "OA3", texto: `Leer números del 0 al 20 y representarlos en forma concreta, pictórica y simbólica.` },
      { id: "OA4", texto: `Comparar y ordenar números del 0 al 20 de menor a mayor y/o viceversa, utilizando material concreto y/o usando software educativo.` },
      { id: "OA5", texto: `Estimar cantidades hasta 20 en situaciones concretas, usando un referente.` },
      { id: "OA6", texto: `Componer y descomponer números del 0 a 20 de manera aditiva, en forma concreta, pictórica y simbólica.` },
      { id: "OA7", texto: `Describir y aplicar estrategias de cálculo mental para las adiciones y las sustracciones hasta 20:` },
      { id: "OA8", texto: `Determinar las unidades y decenas en números del 0 al 20, agrupando de a 10, de manera concreta, pictórica y simbólica.` },
      { id: "OA9", texto: `Demostrar que comprenden la adición y la sustracción de números del 0 al 20 progresivamente, de 0 a 5, de 6 a 10, de 11 a 20 con dos sumandos: manera manual y/o usando software educativo 10 Demostrar que la adición y la sustracción son operaciones inversas, de manera concreta, pictórica y simbólica. 1º básico Ejes Objetivos de Aprendizaje Patrones y 11 Reconocer, describir, crear y continuar patrones repetitivos (son` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Observar, describir y clasificar los vertebrados en mamíferos, aves, reptiles, anfibios y peces, a partir de características como cubierta corporal, presencia de mamas y estructuras para la respiración, entre otras.` },
      { id: "OA2", texto: `Observar, describir y clasificar, por medio de la exploración, las características de los animales sin columna vertebral, como insectos, arácnidos, crustáceos, entre otros, y compararlos con los vertebrados.` },
      { id: "OA3", texto: `Observar y comparar las características de las etapas del ciclo de vida de distintos animales (mamíferos, aves, insectos y anfibios), relacionándolas con su hábitat.` },
      { id: "OA4", texto: `Observar y comparar las características de distintos hábitat, identificando la luminosidad, la humedad y la temperatura necesarias para la supervivencia de los animales que habitan en él.` },
      { id: "OA5", texto: `Observar e identificar algunos animales nativos que se encuentran en peligro de extinción, así como el deterioro de su hábitat, proponiendo medidas para protegerlos.` },
      { id: "OA6", texto: `Identificar y comunicar los efectos de la actividad humana sobre los animales y su hábitat. Cuerpo humano y salud` },
      { id: "OA7", texto: `Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir: corazón, pulmones, estómago, esqueleto y músculos.` },
      { id: "OA8", texto: `Explicar la importancia de la actividad física para el desarrollo de los músculos y el fortalecimiento del corazón, proponiendo formas de ejercitarla e incorporarla en sus hábitos diarios. Ciencias` },
      { id: "OA9", texto: `Observar y describir, por medio de la investigación experimental, algunas características del agua, como: Objetivos de Aprendizaje Ejes 2º básico` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA8", texto: `Reconocer que los mapas y los planos son formas de representar lugares.` },
      { id: "OA9", texto: `Identificar a Chile en mapas, incluyendo la cordillera de los Andes, el océano Pacífico, la ciudad de Santiago, su región, su capital y su localidad. 10 Observar y describir paisajes de su entorno local, utilizando vocabulario geográfico adecuado (país, ciudad, camino, pueblo, construcciones, cordillera, mar, vegetación y desierto) y categorías de ubicación relativa (derecha, izquierda, delante, detrás, entre otros).` },
      { id: "OA1", texto: `Describir los modos de vida de algunos pueblos originarios de Chile en el período precolombino, incluyendo ubicación geográfica, medio natural en que habitaban, vida nómade o sedentaria, roles de hombres y mujeres, herramientas y tecnología, principales actividades, vivienda, costumbres, idioma, creencias, alimentación y fiestas, entre otros.` },
      { id: "OA2", texto: `Comparar el modo de vida y expresiones culturales de pueblos indígenas presentes en Chile actual (como mapuche, aimara, rapa nui) con respecto al periodo precolombino, identificando aspectos de su cultura que se han mantenido hasta el presente y aspectos que han cambiado.` },
      { id: "OA3", texto: `Distinguir los diversos aportes a la sociedad chilena proveniente de los pueblos originarios (palabras, alimentos, tradiciones, cultura, etc.) y de los españoles (idioma, religión, alimentos, cultura, etc.) y reconocer nuestra sociedad como mestiza.` },
      { id: "OA4", texto: `Reconocer y dar ejemplos de la influencia y los aportes de inmigrantes de distintas naciones europeas, orientales, árabes y latinoamericanas a la diversidad de la sociedad chilena, a lo largo de su historia.` },
      { id: "OA5", texto: `Reconocer diversas expresiones del patrimonio cultural del país y de su región, como manifestaciones artísticas, tradiciones folclóricas, leyendas y tradiciones orales, costumbres familiares, creencias, idioma, construcciones, comidas típicas, fiestas, monumentos y sitios históricos. Geografía` },
      { id: "OA6", texto: `Leer y dibujar planos simples de su entorno, utilizando puntos de referencia, categorías de posición relativa y simbología pictórica.` },
      { id: "OA7", texto: `Ubicar Chile, Santiago, la propia región y su capital en el globo terráqueo o en mapas, y describir la ubicación relativa de países limítrofes y de otros países de América del Sur, utilizando los puntos cardinales.` },
      { id: "OA8", texto: `Clasificar y caracterizar algunos paisajes de Chile según su ubicación en la zona norte, centro y sur del país, observando imágenes, y utilizando diversas fuentes y un vocabulario geográfico adecuado (océano, río, cordillera de los Andes y de la Costa, desierto, valle, costa, volcán, archipiélago, isla, fiordo, lago, ciudad y pueblo, entre otros). Objetivos de Aprendizaje Ejes 2º Básico` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Reconocer que los textos escritos transmiten mensajes y que son escritos por alguien para cumplir un propósito.` },
      { id: "OA2", texto: `Reconocer que las palabras son unidades de significado separadas por espacios en el texto escrito.` },
      { id: "OA3", texto: `Identificar los sonidos que componen las palabras (conciencia fonológica), reconociendo, separando y combinando sus fonemas y sílabas.` },
      { id: "OA4", texto: `Leer palabras aisladas y en contexto, aplicando su conocimiento de la correspondencia letrasonido en diferentes combinaciones: sílaba directa, indirecta o compleja, y dígrafos rr-ll-ch-qu.` },
      { id: "OA5", texto: `Leer textos breves en voz alta para adquirir fluidez: ocasiones` },
      { id: "OA6", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA7", texto: `Leer independientemente y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación; por ejemplo:` },
      { id: "OA8", texto: `Demostrar comprensión de narraciones que aborden temas que les sean familiares: (qué, quién, dónde, cuándo, por qué) títeres, dramatizaciones, dibujos o esculturas con la historia Ejes Objetivos de Aprendizaje Lenguaje y Comunicación` },
      { id: "OA9", texto: `Leer habitualmente y disfrutar los mejores poemas de autor y de la tradición oral adecuados a su edad. 10 Leer independientemente y comprender textos no literarios escritos con oraciones simples (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento del mundo: 11 Desarrollar el gusto por la lectura, explorando libros y sus ilustraciones. 12 Asistir habitualmente a la bibli` },
    ],
  },

  "2B": {
    "Matemática": [
      { id: "OA1", texto: `Contar números del 0 al 1 000 de 2 en 2, de 5 en 5, de 10 en 10 y de 100 en 100, hacia adelante y hacia atrás, empezando por cualquier número menor que 1 000.` },
      { id: "OA2", texto: `Leer números del 0 al 100 y representarlos en forma concreta, pictórica y simbólica.` },
      { id: "OA3", texto: `Comparar y ordenar números del 0 al 100 de menor a mayor y viceversa, usando material concreto y monedas nacionales de manera manual y/o por medio de software educativo.` },
      { id: "OA4", texto: `Estimar cantidades hasta 100 en situaciones concretas, usando un referente.` },
      { id: "OA5", texto: `Componer y descomponer números del 0 a 100 de manera aditiva, en forma concreta, pictórica y simbólica.` },
      { id: "OA6", texto: `Describir y aplicar estrategias de cálculo mental para adiciones y sustracciones hasta 20:` },
      { id: "OA7", texto: `Identificar las unidades y decenas en números del 0 al 100, representando las cantidades de acuerdo a su valor posicional, con material concreto, pictórico y simbólico.` },
      { id: "OA8", texto: `Demostrar y explicar de manera concreta, pictórica y simbólica el efecto de sumar y restar 0 a un número.` },
      { id: "OA9", texto: `Demostrar que comprende la adición y la sustracción en el ámbito del 0 al 100: su propia experiencia pictóricas, de manera manual y/o usando software educativo del 0 a 20 sin realizar cálculos Objetivos de Aprendizaje Ejes 2º básico 10 Demostrar que comprende la relación entre la adición y la sustracción al usar la “familia de operaciones” en cálculos aritméticos y la resolución de problemas 11 Demostrar que comprend` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Observar y describir, por medio de la investigación experimental, las necesidades de las plantas y su relación con la raíz, el tallo y las hojas.` },
      { id: "OA2", texto: `Observar, registrar e identificar variadas plantas de nuestro país, incluyendo vegetales autóctonos y cultivos principales a nivel nacional y regional.` },
      { id: "OA3", texto: `Observar y describir algunos cambios de las plantas con flor durante su ciclo de vida (germinación, crecimiento, reproducción, formación de la flor y del fruto), reconociendo la importancia de la polinización y de la dispersión de la semilla.` },
      { id: "OA4", texto: `Describir la importancia de las plantas para los seres vivos, el ser humano y el medioambiente (por ejemplo: alimentación, aire para respirar, productos derivados, ornamentación, uso medicinal), proponiendo y comunicando medidas de cuidado.` },
      { id: "OA5", texto: `Explicar la importancia de usar adecuadamente los recursos, proponiendo acciones y construyendo instrumentos tecnológicos para reutilizarlos, reducirlos y reciclarlos en la casa y en la escuela. Cuerpo humano y salud` },
      { id: "OA6", texto: `Clasificar los alimentos, distinguiendo sus efectos sobre la salud, y proponer hábitos alimenticios saludables.` },
      { id: "OA7", texto: `Proponer, comunicar y ejercitar buenas prácticas de higiene en la manipulación de alimentos para prevenir enfermedades. Ciencias` },
      { id: "OA8", texto: `Distinguir fuentes naturales y artificiales de luz, como el Sol, las ampolletas y el fuego, entre otras.` },
      { id: "OA9", texto: `Investigar experimentalmente y explicar algunas características de la luz; por ejemplo: viaja en línea recta, se refleja, puede ser separada en colores. 10 Investigar experimentalmente y explicar las características del sonido; por ejemplo: viaja en todas las direcciones, se absorbe o se refleja, se transmite por medio de distintos materiales, tiene tono e intensidad. Objetivos de Aprendizaje Ejes 3º básico` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA9", texto: `Reconocer diversas expresiones del patrimonio natural de Chile y de su región, como paisajes, flora y fauna característica, y parques nacionales, entre otros. 10 Ubicar en mapas las zonas habitadas por algunos pueblos originarios de Chile, distinguiendo zonas norte, centro y sur. 11 Relacionar las principales características geográficas (disponibilidad de agua, temperatura y vegetación) de las zonas habitadas por alg` },
      { id: "OA1", texto: `Reconocer aspectos de la vida cotidiana de la civilización griega de la Antigüedad e identificar algunos elementos de su legado a sociedades y culturas del presente; entre ellos, la organización democrática, el desarrollo de la historia, el teatro como forma de expresión, el arte y la escultura, la arquitectura, la mitología, la geometría y la filosofía, la creación del alfabeto y los juegos olímpicos.` },
      { id: "OA2", texto: `Reconocer aspectos de la vida cotidiana de la civilización romana de la Antigüedad e identificar algunos elementos de su legado a sociedades y culturas del presente; entre ellos, el idioma, el derecho y las leyes, el arte y las obras arquitectónicas.` },
      { id: "OA3", texto: `Explicar, con ejemplos concretos, cómo diferentes culturas y pueblos (como griegos y romanos de la Antigüedad) han enfrentado de distintas maneras el desafío de desarrollarse y satisfacer las necesidades comunes a todos los seres humanos.` },
      { id: "OA4", texto: `Comparar modos de vida de la Antigüedad con el propio, considerando costumbres, trabajos y oficios, creencias, vestimentas y características de las ciudades, entre otros.` },
      { id: "OA5", texto: `Investigar sobre algún tema de su interés con relación a las civilizaciones estudiadas (como los héroes, los dioses, las ciudades, las viviendas, la vestimenta, las herramientas tecnológicas y la esclavitud, entre otros) por medio de diferentes fuentes (libros, fuentes gráficas, TICs) y comunicar lo aprendido. Geografía` },
      { id: "OA6", texto: `Ubicar personas, lugares y elementos en una cuadrícula, utilizando líneas de referencia y puntos cardinales.` },
      { id: "OA7", texto: `Distinguir hemisferios, círculo del Ecuador, trópicos, polos, continentes y océanos del planeta en mapas y globos terráqueos.` },
      { id: "OA8", texto: `Identificar y ubicar en mapas las principales zonas climáticas del mundo, y dar ejemplos de distintos paisajes que pueden encontrarse en estas zonas y de cómo las personas han elaborado diferentes estrategias para habitarlos. Objetivos de Aprendizaje Ejes 3º Básico` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Leer textos significativos que incluyan palabras con hiatos y diptongos, con grupos consonánticos y con combinación ce-ci, que-qui, ge-gi, gue-gui, güegüi.` },
      { id: "OA2", texto: `Leer en voz alta para adquirir fluidez: das ocasiones` },
      { id: "OA3", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA4", texto: `Leer independientemente y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación; por ejemplo:` },
      { id: "OA5", texto: `Demostrar comprensión de las narraciones leídas: los distintos personajes sionales u otras), el ambiente en el que ocurre la acción` },
      { id: "OA6", texto: `Leer habitualmente y disfrutar los mejores poemas de autor y de la tradición oral adecuados a su edad. Objetivos de Aprendizaje Ejes Lenguaje y Comunicación` },
      { id: "OA7", texto: `Leer independientemente y comprender textos no literarios (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento del mundo: un texto` },
      { id: "OA8", texto: `Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos.` },
      { id: "OA9", texto: `Asistir habitualmente a la biblioteca para encontrar información y elegir libros, cuidando el material en favor del uso común. 10 Buscar información sobre un tema en una fuente dada por el docente (página de internet, sección del diario, capítulo de un libro, etc.), para llevar a cabo una investigación. 11 Desarrollar la curiosidad por las palabras o expresiones que desconocen y adquirir el hábito de averiguar su sig` },
    ],
  },

  "3B": {
    "Matemática": [
      { id: "OA1", texto: `Contar números del 0 al 1 000 de 5 en 5, de 10 en 10, de 100 en 100: correspondiente` },
      { id: "OA2", texto: `Leer números hasta 1.000 y representarlos en forma concreta, pictórica y simbólica.` },
      { id: "OA3", texto: `Comparar y ordenar números naturales hasta 1.000, utilizando la recta numérica o la tabla posicional de manera manual y/o por medio de software educativo.` },
      { id: "OA4", texto: `Describir y aplicar estrategias de cálculo mental para las adiciones y las sustracciones hasta 100:` },
      { id: "OA5", texto: `Identificar y describir las unidades, las decenas y las centenas en números del 0 al 1.000, representando las cantidades de acuerdo a su valor posicional, con material concreto, pictórico y simbólico.` },
      { id: "OA6", texto: `Demostrar que comprenden la adición y la sustracción de números del 0 al 1.000: operaciones combinadas, en forma concreta, pictórica y simbólica, de manera manual y/o por medio de software educativo hasta cuatro sumandos y en la sustracción de hasta un sustraendo` },
      { id: "OA7", texto: `Demostrar que comprenden la relación entre la adición y la sustracción, usando la “familia de operaciones” en cálculos aritméticos y en la resolución de problemas.` },
      { id: "OA8", texto: `Demostrar que comprenden las tablas de multiplicar hasta el 10 de manera progresiva: Objetivos de Aprendizaje Ejes 3º básico cálculos` },
      { id: "OA9", texto: `Demostrar que comprenden la división en el contexto de las tablas7 de hasta 10 · 10: iguales, con material concreto y pictórico agrupación cálculos 10 Resolver problemas rutinarios en contextos cotidianos, que incluyan dinero e involucren las cuatro operaciones (no combinadas). 11 Demostrar que comprenden las fracciones de uso común: 1 4 , 1 3 , 1 2 , 2 3 , 3 4 : pictórica, simbólica, de forma manual y/o con software` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Reconocer, por medio de la exploración, que un ecosistema está compuesto por elementos vivos (animales, plantas, etc.) y no vivos (piedras, agua, tierra, etc.) que interactúan entre sí.` },
      { id: "OA2", texto: `Observar y comparar adaptaciones de plantas y animales para sobrevivir en los ecosistemas en relación con su estructura y conducta; por ejemplo: cubierta corporal, camuflaje, tipo de hojas, hibernación, entre otras.` },
      { id: "OA3", texto: `Dar ejemplos de cadenas alimentarias, identificando la función de los organismos productores, consumidores y descomponedores, en diferentes ecosistemas de Chile.` },
      { id: "OA4", texto: `Analizar los efectos de la actividad humana en ecosistemas de Chile, proponiendo medidas para protegerlos (parques nacionales y vedas, entre otras). Cuerpo humano y salud` },
      { id: "OA5", texto: `Identificar y describir, usando modelos, estructuras del sistema esquelético y algunas de sus funciones, como protección (costillas y cráneo), soporte (vértebras y columna vertebral) y movimiento (pelvis y fémur).` },
      { id: "OA6", texto: `Explicar, con apoyo de modelos, el movimiento del cuerpo, considerando la acción coordinada de músculos, huesos, tendones y articulación (ejemplo: brazo y pierna), y describir los beneficios de la actividad física para el sistema músculo-esquelético.` },
      { id: "OA7", texto: `Identificar estructuras del sistema nervioso y describir algunas de sus funciones, como conducción de información (médula espinal y nervios) y elaboración y control (cerebro).` },
      { id: "OA8", texto: `Investigar en diversas fuentes y comunicar los efectos que produce el consumo excesivo de alcohol en la salud humana (como descoordinación, confusión y lentitud, entre otras). Ciencias` },
      { id: "OA9", texto: `Demostrar, por medio de la investigación experimental, que la materia tiene masa y ocupa espacio, usando materiales del entorno. 10 Comparar los tres estados de la materia (sólido, líquido y gaseoso) en relación con criterios como la capacidad de fluir y cambiar de forma y volumen, entre otros. Objetivos de Aprendizaje Ejes 4º básico` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA9", texto: `Caracterizar el entorno geográfico de las civilizaciones estudiadas, utilizando vocabulario geográfico adecuado (continente, valle, montaña, océano, río, archipiélago, mares, península, ciudad, construcciones y monumentos, entre otros). 10 Reconocer algunos factores geográficos que influyeron en el desarrollo de las civilizaciones estudiadas (ubicación, relieve y clima, recursos naturales disponibles, importancia del` },
      { id: "OA1", texto: `Describir la civilización maya, considerando ubicación geográfica, organización política, actividades económicas, formas de cultivo y alimentos, organización de la sociedad, roles y oficios de hombres y mujeres, religión y ritos, desarrollo de la astronomía y la matemática, sistemas de escritura, guerras y sacrificios humanos, construcciones, costumbres y vida cotidiana, entre otros.` },
      { id: "OA2", texto: `Describir la civilización azteca, considerando ubicación geográfica, organización política y extensión, la ciudad de Tenochtitlán, formas de cultivo y alimentos, religión y ritos, avances tecnológicos, organización de la sociedad, roles y oficios de hombres y mujeres, construcciones, costumbres y vida cotidiana, entre otros.` },
      { id: "OA3", texto: `Describir la civilización inca, considerando ubicación geográfica, organización política, sistema de caminos y correos, religión y ritos, avances tecnológicos, organización de la sociedad, roles y oficios de hombres y mujeres, formas de cultivo y alimentos, construcciones, costumbres y vida cotidiana, entre otros.` },
      { id: "OA4", texto: `Analizar y comparar las principales características de las civilizaciones americanas (mayas, aztecas e incas).` },
      { id: "OA5", texto: `Investigar en diversas fuentes (imágenes, medios audiovisuales, TICs, gráficos, textos y otras) sobre algunos temas relacionados con el presente de los pueblos indígenas americanos; por ejemplo, el protagonismo que tienen hoy, la influencia de las civilizaciones maya, azteca e inca sobre la cultura y la sociedad de los países actuales situados donde ellos se desarrollaron, y su influencia en las comidas y en la lengu` },
      { id: "OA6", texto: `Ubicar lugares en un mapa, utilizando coordenadas geográficas como referencia (paralelos y meridianos).` },
      { id: "OA7", texto: `Distinguir recursos naturales renovables y no renovables, reconocer el carácter limitado de los recursos naturales y la necesidad de cuidarlos, e identificar recursos presentes en objetos y bienes cotidianos.` },
      { id: "OA8", texto: `Describir distintos paisajes del continente americano, considerando climas, ríos, población, idiomas, países y grandes ciudades, entre otros, y utilizando vocabulario geográfico adecuado. Objetivos de Aprendizaje Ejes 4º Básico` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Leer en voz alta de manera fluida variados textos apropiados a su edad:` },
      { id: "OA2", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA3", texto: `Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación; por ejemplo:` },
      { id: "OA4", texto: `Profundizar su comprensión de las narraciones leídas:` },
      { id: "OA5", texto: `Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos. Objetivos de Aprendizaje Ejes Lenguaje y Comunicación` },
      { id: "OA6", texto: `Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, instrucciones, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión: glosario) para encontrar información específica los pictogramas a un texto previos` },
      { id: "OA7", texto: `Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos.` },
      { id: "OA8", texto: `Asistir habitualmente a la biblioteca para satisfacer diversos propósitos (encontrar información, elegir libros, estudiar o trabajar), cuidando el material en favor del uso común.` },
      { id: "OA9", texto: `Buscar información sobre un tema en libros, internet, diarios, revistas, enciclopedias, atlas, etc., para llevar a cabo una investigación. 10 Determinar el significado de palabras desconocidas, usando claves contextuales o el conocimiento de raíces (morfemas de base), prefijos y sufijos. 11 Determinar el significado de palabras desconocidas, usando el orden alfabético para encontrarlas en un diccionario infantil o il` },
    ],
  },

  "4B": {
    "Matemática": [
      { id: "OA1", texto: `Representar y describir números del 0 al 10 000: aditiva, de acuerdo a su valor posicional` },
      { id: "OA2", texto: `Describir y aplicar estrategias de cálculo mental para determinar las multiplicaciones hasta 10 · 10 y sus divisiones correspondientes:` },
      { id: "OA3", texto: `Demostrar que comprenden la adición y la sustracción de números hasta 1 000: sustracciones sustracción de hasta un sustraendo` },
      { id: "OA4", texto: `Fundamentar y aplicar las propiedades del 0 y del 1 para la multiplicación y la propiedad del 1 para la división.` },
      { id: "OA5", texto: `Demostrar que comprenden la multiplicación de números de tres dígitos por números de un dígito: Objetivos de Aprendizaje Ejes 4º básico` },
      { id: "OA6", texto: `Demostrar que comprenden la división con dividendos de dos dígitos y divisores de un dígito:` },
      { id: "OA7", texto: `Resolver problemas rutinarios y no rutinarios en contextos cotidianos que incluyen dinero, seleccionando y utilizando la operación apropiada.` },
      { id: "OA8", texto: `Demostrar que comprende las fracciones con denominadores 100, 12, 10, 8, 6, 5, 4, 3, 2: elementos y un lugar en la recta numérica 100 , 1 8 , 1 5 , 1 4 , 1 2 ) con material concreto y pictórico` },
      { id: "OA9", texto: `Resolver adiciones y sustracciones de fracciones con igual denominador (denominadores 100, 12, 10, 8, 6, 5, 4, 3, 2) de manera concreta y pictórica en el contexto de la resolución de problemas. 10 Identificar, escribir y representar fracciones propias y los números mixtos hasta el 5 de manera concreta, pictórica y simbólica, en el contexto de la resolución de problemas. 11 Describir y representar decimales (décimos y` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos, órganos y sistemas.` },
      { id: "OA2", texto: `Identificar y describir, por medio de modelos, las estructuras básicas del sistema digestivo (boca, esófago, estómago, hígado, intestino delgado, intestino grueso, recto y ano) y sus funciones en la digestión, la absorción de alimentos y la eliminación de desechos.` },
      { id: "OA3", texto: `Explicar, por medio de modelos, la respiración (inspiración-espiración-intercambio de oxígeno y dióxido de carbono), identificando las estructuras básicas del sistema respiratorio (nariz, tráquea, bronquios, alvéolos, pulmones).` },
      { id: "OA4", texto: `Explicar la función de transporte del sistema circulatorio (sustancias alimenticias, oxígeno y dióxido de carbono), identificando sus estructuras básicas (corazón, vasos sanguíneos y sangre). Cuerpo humano y salud` },
      { id: "OA5", texto: `Analizar el consumo de alimento diario (variedad, tamaño y frecuencia de porciones), reconociendo los alimentos para el crecimiento, la reparación, el desarrollo y el movimiento del cuerpo.` },
      { id: "OA6", texto: `Investigar en diversas fuentes y comunicar los efectos nocivos que produce el cigarrillo (humo del tabaco) en los sistemas respiratorio y circulatorio.` },
      { id: "OA7", texto: `Investigar e identificar algunos microorganismos beneficiosos y dañinos para la salud (bacterias, virus y hongos), y proponer medidas de cuidado e higiene del cuerpo. Ciencias` },
      { id: "OA8", texto: `Reconocer los cambios que experimenta la energía eléctrica al pasar de una forma a otra (eléctrica a calórica, sonora, lumínica, etc.) e investigar los principales aportes de científicos en su estudio a lo largo del tiempo.` },
      { id: "OA9", texto: `Construir un circuito eléctrico simple (cable, ampolleta, interruptor y pila), usarlo para resolver problemas cotidianos y explicar su funcionamiento. Objetivos de Aprendizaje Ejes 5º básico` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA9", texto: `Reconocer y ubicar los principales recursos naturales de América, considerando su distribución geográfica, su uso, y la importancia de cuidarlos en el marco de un desarrollo sostenible. 10 Comparar, mediante la observación en imágenes, mapas y otras fuentes, paisajes de su región con paisajes de América, distinguiendo distintas formas de adaptación y transformación de la población a su ambiente natural. Formación Ciu` },
      { id: "OA1", texto: `Explicar los viajes de descubrimiento de Cristóbal Colón, de Hernando de Magallanes y de algún otro explorador, considerando sus objetivos, las rutas recorridas, los avances tecnológicos que facilitaron la navegación, las dificultades y los desafíos que enfrentaron las tripulaciones y el contexto europeo general en que se desarrollaron.` },
      { id: "OA2", texto: `Describir el proceso de conquista de América y de Chile, incluyendo a los principales actores (Corona española, Iglesia católica y hombres y mujeres protagonistas, entre otros), algunas expediciones y conflictos bélicos, y la fundación de ciudades como expresión de la voluntad de los españoles de quedarse y expandirse, y reconocer en este proceso el surgimiento de una nueva sociedad.` },
      { id: "OA3", texto: `Analizar el impacto y las consecuencias que tuvo el proceso de conquista para Europa y para América, considerando diversos ámbitos.` },
      { id: "OA4", texto: `Investigar sobre los efectos de la conquista sobre los pueblos indígenas americanos, utilizando fuentes dadas por el docente.` },
      { id: "OA5", texto: `Describir algunas dimensiones de la vida colonial en Chile, como organización de la sociedad y grupos sociales, oficios y actividades económicas, costumbres y vida cotidiana, arte y celebraciones.` },
      { id: "OA6", texto: `Explicar aspectos centrales de la Colonia, como la dependencia de las colonias americanas de la metrópoli, el rol de la Iglesia católica y el surgimiento de una sociedad mestiza.` },
      { id: "OA7", texto: `Explicar y dar ejemplos de las distintas formas en las que españoles y mapuches se relacionaron en el período colonial, considerando resistencia mapuche y guerra de Arauco, mestizaje, formas de trabajo (como encomienda y esclavitud), evangelización, vida fronteriza y sistema de parlamentos.` },
      { id: "OA8", texto: `Identificar, en su entorno o en fotografías, elementos del patrimonio colonial de Chile que siguen presentes hoy, como edificios, obras de arte y costumbres, entre otros. Objetivos de Aprendizaje Ejes` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Leer en voz alta de manera fluida variados textos apropiados a su edad:` },
      { id: "OA2", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA3", texto: `Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación; por ejemplo:` },
      { id: "OA4", texto: `Profundizar su comprensión de las narraciones leídas: sonajes` },
      { id: "OA5", texto: `Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos. Objetivos de Aprendizaje Ejes Lenguaje y Comunicación` },
      { id: "OA6", texto: `Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, instrucciones, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión: glosario) para encontrar información específica genes, gráficos, tablas, mapas o diagramas de?, ¿qué sucedería si...? previos` },
      { id: "OA7", texto: `Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos.` },
      { id: "OA8", texto: `Asistir habitualmente a la biblioteca para satisfacer diversos propósitos (encontrar información, elegir libros, estudiar, trabajar o investigar), cuidando el material en favor del uso común.` },
      { id: "OA9", texto: `Buscar y clasificar información sobre un tema en internet, libros, diarios, revistas, enciclopedias, atlas, etc., para llevar a cabo una investigación. 10 Aplicar estrategias para determinar el significado de palabras nuevas: to) 11 Escribir frecuentemente, para desarrollar la creatividad y expresar sus ideas, textos como poemas, diarios de vida, cuentos, anécdotas, cartas, comentarios sobre sus lecturas, noticias, e` },
    ],
  },

  "5B": {
    "Matemática": [
      { id: "OA1", texto: `Representar y describir números naturales de hasta más de 6 dígitos y menores que 1.000 millones: expandida aproximando cantidades` },
      { id: "OA2", texto: `Aplicar estrategias de cálculo mental para la multiplicación:` },
      { id: "OA3", texto: `Demostrar que comprenden la multiplicación de números naturales de dos dígitos por números naturales de dos dígitos:` },
      { id: "OA4", texto: `Demostrar que comprenden la división con dividendos de tres dígitos y divisores de un dígito:` },
      { id: "OA5", texto: `Realizar cálculos que involucren las cuatro operaciones, aplicando las reglas relativas a paréntesis y la prevalencia de la multiplicación y la división por sobre la adición y la sustracción cuando corresponda.` },
      { id: "OA6", texto: `Resolver problemas rutinarios y no rutinarios que involucren las cuatro operaciones y combinaciones de ellas: 10.000 Objetivos de Aprendizaje Ejes 5º básico` },
      { id: "OA7", texto: `Demostrar que comprenden las fracciones propias: manera concreta, pictórica y simbólica, de forma manual y/o con software educativo concreta, pictórica y simbólica` },
      { id: "OA8", texto: `Demostrar que comprenden las fracciones impropias de uso común de denominadores 2, 3, 4, 5, 6, 8, 10, 12 y los números mixtos asociados: con software educativo números mixtos` },
      { id: "OA9", texto: `Resolver adiciones y sustracciones con fracciones propias con denominadores menores o iguales a 12: 10 Determinar el decimal que corresponde a fracciones con denominador 2, 4, 5 y 10. 11 Comparar y ordenar decimales hasta la milésima. 12 Resolver adiciones y sustracciones de decimales, empleando el valor posicional hasta la milésima. 13 Resolver problemas rutinarios y no rutinarios, aplicando adiciones y sustraccione` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Explicar, a partir de una investigación experimental, los requerimientos de agua, dióxido de carbono y energía lumínica para la producción de azúcar y la liberación de oxígeno en la fotosíntesis, comunicando sus resultados y los aportes de científicos en este campo a lo largo del tiempo.` },
      { id: "OA2", texto: `Representar, por medio de modelos, la transferencia de energía y materia desde los organismos fotosintéticos a otros seres vivos por medio de cadenas y redes alimentarias en diferentes ecosistemas.` },
      { id: "OA3", texto: `Analizar los efectos de la actividad humana sobre las redes alimentarias. Cuerpo humano y salud` },
      { id: "OA4", texto: `Identificar y describir las funciones de las principales estructuras del sistema reproductor humano femenino y masculino.` },
      { id: "OA5", texto: `Describir y comparar los cambios que se producen en la pubertad en mujeres y hombres, reconociéndola como una etapa del desarrollo humano.` },
      { id: "OA6", texto: `Reconocer los beneficios de realizar actividad física en forma regular y de cuidar la higiene corporal en el período de la pubertad.` },
      { id: "OA7", texto: `Investigar y comunicar los efectos nocivos de algunas drogas para la salud, proponiendo conductas de protección. Ciencias` },
      { id: "OA8", texto: `Explicar que la energía es necesaria para que los objetos cambien y los seres vivos realicen sus procesos vitales, y que la mayoría de los recursos energéticos proviene directa o indirectamente del Sol, dando ejemplos de ello.` },
      { id: "OA9", texto: `Investigar en forma experimental la transformación de la energía de una forma a otra, dando ejemplos y comunicando sus conclusiones. 10 Demostrar, por medio de la investigación experimental, que el calor fluye de un objeto caliente a uno frío hasta que ambos alcanzan la misma temperatura. 11 Clasificar los recursos naturales energéticos en no renovables y renovables y proponer medidas para el uso responsable de la en` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA9", texto: `Caracterizar las grandes zonas de Chile y sus paisajes (Norte Grande, Norte Chico, Zona Central, Zona Sur y Zona Austral), considerando ubicación, clima (temperatura y precipitaciones), relieve, hidrografía, población y recursos naturales, entre otros. 10 Reconocer y ubicar en mapas recursos naturales significativos de Chile, como cobre, hierro, recursos marítimos y forestales, entre otros; diferenciar recursos renov` },
      { id: "OA1", texto: `Explicar los múltiples antecedentes de la independencia de las colonias americanas y reconocer que la independencia de Chile se enmarca en un proceso continental.` },
      { id: "OA2", texto: `Explicar el desarrollo del proceso de independencia de Chile, considerando actores y bandos que se enfrentaron, hombres y mujeres destacados, avances y retrocesos de la causa patriota, y algunos acontecimientos significativos, como la celebración del cabildo abierto de 1810 y la formación de la Primera Junta Nacional de Gobierno, la elección del primer Congreso Nacional, las batallas de Rancagua, Chacabuco y Maipú, y` },
      { id: "OA3", texto: `Describir algunos hitos y procesos de la organización de la república, incluyendo las dificultades y los desafíos que implicó organizar en Chile una nueva forma de gobierno, el surgimiento de grupos con diferentes ideas políticas (conservadores y liberales), las características de la Constitución de 1833 y el impacto de las reformas realizadas por los liberales en la segunda mitad del siglo XIX.` },
      { id: "OA4", texto: `Investigar sobre algunos aspectos culturales del siglo XIX, como los avances en educación y la fundación de instituciones, el aporte de intelectuales y científicos nacionales (por ejemplo, Diego Barros Arana, Benjamín Vicuña Mackenna, José Victorino Lastarria) y extranjeros (por ejemplo, Andrés Bello, Claudio Gay, Charles Darwin y María Graham), las primeras mujeres en obtener títulos universitarios y el impacto en l` },
      { id: "OA5", texto: `Describir cómo se conformó el territorio de Chile durante el siglo XIX, considerando colonizaciones europeas, la incorporación de Isla de Pascua, la ocupación de la Araucanía, la Guerra del Pacífico y diversos conflictos bélicos, entre otros factores.` },
      { id: "OA6", texto: `Caracterizar los principales aspectos que definieron el período de riqueza aportada por la explotación del salitre, considerando la expansión económica y el inicio de la “cuestión social”.` },
      { id: "OA7", texto: `Explicar y dar ejemplos de la progresiva democratización de la sociedad durante el siglo XX, considerando el acceso creciente al voto, la participación de la mujer en la vida pública y el acceso a la educación y a la cultura, entre otros. Objetivos de Aprendizaje Ejes` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Leer de manera fluida textos variados apropiados a su edad:` },
      { id: "OA2", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA3", texto: `Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural; por ejemplo:` },
      { id: "OA4", texto: `Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión: damentándolas con ejemplos del texto relevantes para el desarrollo de la historia alguno Objetivos de Aprendizaje Ejes Lenguaje y Comunicación` },
      { id: "OA5", texto: `Analizar aspectos relevantes de diversos poemas para profundizar su comprensión: dos, sugiere estados de ánimo y crea imágenes en el lector dentro del poema nante, verso y estrofa)` },
      { id: "OA6", texto: `Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión: cias y conocimientos mas, con el texto en el cual están insertos previos` },
      { id: "OA7", texto: `Evaluar críticamente la información presente en textos de diversa procedencia: mensaje determinada pregunta o cumplir un propósito` },
      { id: "OA8", texto: `Sintetizar y registrar las ideas principales de textos leídos para satisfacer propósitos como estudiar, hacer una investigación, recordar detalles, etc.` },
      { id: "OA9", texto: `Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos. 10 Asistir habitualmente a la biblioteca para satisfacer diversos propósitos (seleccionar textos, investigar sobre un tema, informarse sobre actualidad, etc.), adecuando su comportamiento y cuidando el material para permitir el trabajo y la lectura de los demás. 5º básico 11 Buscar y seleccionar la información más relevante sobre un tema en i` },
    ],
  },

  "6B": {
    "Matemática": [
      { id: "OA1", texto: `Demostrar que comprenden los factores y los múltiplos:` },
      { id: "OA2", texto: `Realizar cálculos que involucren las cuatro operaciones en el contexto de la resolución de problemas, utilizando la calculadora en ámbitos superiores a 10 000.` },
      { id: "OA3", texto: `Demostrar que comprenden el concepto de razón de manera concreta, pictórica y simbólica, en forma manual y/o usando software educativo.` },
      { id: "OA4", texto: `Demostrar que comprenden el concepto de porcentaje de manera concreta, pictórica y simbólica, de forma manual y/o usando software educativo.` },
      { id: "OA5", texto: `Demostrar que comprenden las fracciones y los números mixtos: números mixtos, usando material concreto y representaciones pictóricas de manera manual y/o con software educativo` },
      { id: "OA6", texto: `Resolver adiciones y sustracciones de fracciones propias e impropias y números mixtos con numeradores y denominadores de hasta dos dígitos.` },
      { id: "OA7", texto: `Demostrar que comprenden la multiplicación y la división de decimales por números naturales de un dígito, múltiplos de 10 y decimales hasta la milésima de manera concreta, pictórica y simbólica.` },
      { id: "OA8", texto: `Resolver problemas rutinarios y no rutinarios que involucren adiciones y sustracciones de fracciones propias, impropias, números mixtos o decimales hasta la milésima. Patrones y` },
      { id: "OA9", texto: `Demostrar que comprenden la relación entre los valores de una tabla y aplicarla en la resolución de problemas sencillos: Objetivos de Aprendizaje Ejes 6º básico 10 Representar generalizaciones de relaciones entre números naturales, usando expresiones con letras y ecuaciones. 11 Resolver ecuaciones de primer grado con una incógnita, utilizando estrategias como: de la ecuación y aplicando procedimientos formales de res` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA8", texto: `Comparar diferentes visiones sobre el quiebre de la democracia en Chile, el régimen o dictadura militar y el proceso de recuperación de la democracia a fines del siglo XX, considerando los distintos actores, experiencias y puntos de vista, y el consenso actual con respecto al valor de la democracia.` },
      { id: "OA9", texto: `Explicar y dar ejemplos de aspectos que se mantienen y aspectos que han cambiado o se han desarrollado en la sociedad chilena a lo largo de su historia. Geografía 10 Identificar elementos constitutivos del territorio nacional, considerando la localización de Chile en el mundo y su carácter tricontinental. 11 Caracterizar geográficamente las regiones político-administrativas del país, destacando los rasgos físicos (co` },
    ],
    "Lenguaje y Comunicación": [
      { id: "OA1", texto: `Leer de manera fluida textos variados apropiados a su edad:` },
      { id: "OA2", texto: `Comprender textos, aplicando estrategias de comprensión lectora; por ejemplo:` },
      { id: "OA3", texto: `Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural; por ejemplo:` },
      { id: "OA4", texto: `Analizar aspectos relevantes de las narraciones leídas para profundizar su comprensión: en el desarrollo de la historia motivaciones y las situaciones que viven cando su influencia en las acciones del relato ambienta damentándolas con ejemplos del texto Objetivos de Aprendizaje Ejes Lenguaje y Comunicación alguno` },
      { id: "OA5", texto: `Analizar aspectos relevantes de diversos poemas para profundizar su comprensión: dos, sugiere estados de ánimo y crea imágenes en el lector significado dentro del poema por el poeta refuerzan lo dicho` },
      { id: "OA6", texto: `Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión: cias y conocimientos mas, con el texto en el cual están insertos previos` },
      { id: "OA7", texto: `Evaluar críticamente la información presente en textos de diversa procedencia: mensaje determinada pregunta o cumplir un propósito tintas fuentes` },
      { id: "OA8", texto: `Sintetizar, registrar y ordenar las ideas principales de textos leídos para satisfacer propósitos como estudiar, hacer una investigación, recordar detalles, etc. 6º básico` },
      { id: "OA9", texto: `Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos. 10 Asistir habitualmente a la biblioteca para satisfacer diversos propósitos (seleccionar textos, investigar sobre un tema, informarse sobre actualidad, etc.), adecuando su comportamiento y cuidando el material para permitir el trabajo y la lectura de los demás. 11 Buscar y comparar información sobre un tema, utilizando fuentes como internet,` },
    ],
  },
}


// ─── EDUCACIÓN MEDIA 7°B-2°M ────────────────────────────────────────────────

const MEDIA: Record<string, Record<string, OA[]>> = {

  "7B": {
    "Lengua y Literatura": [
      { id: "OA1", texto: `Leer habitualmente para aprender y recrearse, y seleccionar textos de acuerdo con sus preferencias y propósitos.` },
      { id: "OA2", texto: `Reflexionar sobre las diferentes dimensiones de la experiencia humana, propia y ajena, a partir de la lectura de obras literarias y otros textos que forman parte de nuestras herencias culturales, abordando los temas estipulados para el curso y las obras sugeridas para cada uno1.` },
      { id: "OA3", texto: `Analizar las narraciones leídas para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA4", texto: `Analizar los poemas leídos para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA5", texto: `Leer y comprender romances y obras de la poesía popular, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA6", texto: `Leer y comprender relatos mitológicos, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA7", texto: `Formular una interpretación de los textos literarios, considerando:` },
      { id: "OA8", texto: `Analizar y evaluar textos con finalidad argumentativa, como columnas de opinión, cartas y discursos, considerando:` },
      { id: "OA9", texto: `Analizar y evaluar textos de los medios de comunicación, como noticias, reportajes, cartas al director, textos publicitarios o de las redes sociales, considerando:` },
      { id: "OA10", texto: `Leer y comprender textos no literarios para contextualizar y complementar las lecturas literarias realizadas en clases.` },
      { id: "OA11", texto: `Aplicar estrategias de comprensión de acuerdo con sus propósitos de lectura:` },
      { id: "OA12", texto: `Expresarse en forma creativa por medio de la escritura de textos de diversos géneros (por ejemplo, cuentos, crónicas, diarios de vida, cartas, poemas, etc.), escogiendo libremente:` },
      { id: "OA13", texto: `Escribir, con el propósito de explicar un tema, textos de diversos géneros (por ejemplo, artículos, informes, reportajes, etc.), caracterizados por:` },
      { id: "OA14", texto: `Escribir, con el propósito de persuadir, textos breves de diversos géneros (por ejemplo, cartas al director, editoriales, críticas literarias, etc.), caracterizados por:` },
      { id: "OA15", texto: `Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito:` },
      { id: "OA16", texto: `Aplicar los conceptos de oración, sujeto y predicado con el fin de revisar y mejorar sus textos:` },
      { id: "OA17", texto: `Usar en sus textos recursos de correferencia léxica:` },
      { id: "OA18", texto: `Utilizar adecuadamente, al narrar, los tiempos verbales del indicativo, manteniendo una adecuada secuencia de tiempos verbales.` },
      { id: "OA19", texto: `Escribir correctamente para facilitar la comprensión al lector:` },
      { id: "OA20", texto: `Comprender, comparar y evaluar textos orales y audiovisuales tales como exposiciones, discursos, documentales, noticias, reportajes, etc., considerando:` },
      { id: "OA21", texto: `Dialogar constructivamente para debatir o explorar ideas:` },
      { id: "OA22", texto: `Expresarse frente a una audiencia de manera clara y adecuada a la situación, para comunicar temas de su interés:` },
      { id: "OA23", texto: `Usar conscientemente los elementos que influyen y configuran los textos orales:` },
      { id: "OA24", texto: `Realizar investigaciones sobre diversos temas para complementar sus lecturas o responder interrogantes relacionadas con el lenguaje y la literatura:` },
      { id: "OA25", texto: `Sintetizar, registrar y ordenar las ideas principales de textos escuchados o leídos para satisfacer propósitos como estudiar, hacer una investigación, recordar detalles, etc. Investigación sobre lengua y literatura 55 Bases Curriculares 2015 | 7° básico a 2° medio | Lengua y Literatura Octavo básico 55` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Explicar los aspectos biológicos, afectivos y sociales que se integran en la sexualidad, considerando:` },
      { id: "OA2", texto: `Explicar la formación de un nuevo individuo, considerando:` },
      { id: "OA3", texto: `Describir, por medio de la investigación, las características de infecciones de transmisión sexual (ITS), como sida y herpes, entre otros, considerando sus:` },
      { id: "OA4", texto: `Desarrollar modelos que expliquen las barreras defensivas (primaria, secundaria y terciaria) del cuerpo humano, considerando:` },
      { id: "OA5", texto: `Comparar, usando modelos, microorganismos como virus, bacterias y hongos, en relación con:` },
      { id: "OA6", texto: `Investigar y explicar el rol de microorganismos (bacterias y hongos) en la biotecnología, como en la:` },
      { id: "OA7", texto: `Planificar y conducir una investigación experimental para proveer evidencias que expliquen los efectos de las fuerzas gravitacional, de roce y elástica, entre otras, en situaciones cotidianas.` },
      { id: "OA8", texto: `Explorar y describir cualitativamente la presión, considerando sus efectos en:` },
      { id: "OA9", texto: `Explicar, con el modelo de la tectónica de placas, los patrones de distribución de la actividad geológica (volcanes y sismos), los tipos de interacción entre las placas (convergente, divergente y transformante) y su importancia en la teoría de la deriva continental.` },
      { id: "OA10", texto: `Explicar, sobre la base de evidencias y por medio de modelos, la actividad volcánica y sus consecuencias en la naturaleza y la sociedad.` },
      { id: "OA11", texto: `Crear modelos que expliquen el ciclo de las rocas, la formación y modificación de las rocas ígneas, metamórficas y sedimentarias, en función de la temperatura, la presión y la erosión.` },
      { id: "OA12", texto: `Demostrar, por medio de modelos, que comprenden que el clima en la Tierra, tanto local como global, es dinámico y se produce por la interacción de múltiples variables, como la presión, la temperatura y la humedad atmosférica, la circulación de la atmósfera y del agua, la posición geográfica, la rotación y la traslación de la Tierra.` },
    ],
  },

  "8B": {
    "Lengua y Literatura": [
      { id: "OA1", texto: `Leer habitualmente para aprender y recrearse, y seleccionar textos de acuerdo con sus preferencias y propósitos.` },
      { id: "OA2", texto: `Reflexionar sobre las diferentes dimensiones de la experiencia humana, propia y ajena, a partir de la lectura de obras literarias y otros textos que forman parte de nuestras herencias culturales, abordando los temas estipulados para el curso y las obras sugeridas para cada uno2.` },
      { id: "OA3", texto: `Analizar las narraciones leídas para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA4", texto: `Analizar los poemas leídos para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA5", texto: `Analizar los textos dramáticos leídos o vistos, para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA6", texto: `Leer y comprender fragmentos de epopeya, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA7", texto: `Leer y comprender comedias teatrales, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA8", texto: `Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, considerando:` },
      { id: "OA9", texto: `Analizar y evaluar textos con finalidad argumentativa como columnas de opinión, cartas y discursos, considerando:` },
      { id: "OA10", texto: `Analizar y evaluar textos de los medios de comunicación, como noticias, reportajes, cartas al director, textos publicitarios o de las redes sociales, considerando:` },
      { id: "OA11", texto: `Leer y comprender textos no literarios para contextualizar y complementar las lecturas literarias realizadas en clases.` },
      { id: "OA12", texto: `Aplicar estrategias de comprensión de acuerdo con sus propósitos de lectura:` },
      { id: "OA13", texto: `Expresarse en forma creativa por medio de la escritura de textos de diversos géneros (por ejemplo, cuentos, crónicas, diarios de vida, cartas, poemas, etc.), escogiendo libremente:` },
      { id: "OA14", texto: `Escribir, con el propósito de explicar un tema, textos de diversos géneros (por ejemplo, artículos, informes, reportajes, etc.) caracterizados por:` },
      { id: "OA15", texto: `Escribir, con el propósito de persuadir, textos breves de diversos géneros (por ejemplo, cartas al director, editoriales, críticas literarias, etc.), caracterizados por:` },
      { id: "OA16", texto: `Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito:` },
      { id: "OA17", texto: `Usar adecuadamente oraciones complejas:` },
      { id: "OA18", texto: `Construir textos con referencias claras:` },
      { id: "OA19", texto: `Conocer los modos verbales, analizar sus usos y seleccionar el más apropiado para lograr un efecto en el lector, especialmente al escribir textos con finalidad persuasiva.` },
      { id: "OA20", texto: `Escribir correctamente para facilitar la comprensión por parte del lector:` },
      { id: "OA21", texto: `Comprender, comparar y evaluar textos orales y audiovisuales, tales como exposiciones, discursos, documentales, noticias, reportajes, etc., considerando:` },
      { id: "OA22", texto: `Dialogar constructivamente para debatir o explorar ideas:` },
      { id: "OA23", texto: `Expresarse frente a una audiencia de manera clara y adecuada a la situación para comunicar temas de su interés:` },
      { id: "OA24", texto: `Usar conscientemente los elementos que influyen y configuran los textos orales:` },
      { id: "OA25", texto: `Realizar investigaciones sobre diversos temas para complementar sus lecturas o responder interrogantes relacionadas con el lenguaje y la literatura:` },
      { id: "OA26", texto: `Sintetizar, registrar y ordenar las ideas principales de textos escuchados o leídos para satisfacer propósitos como estudiar, hacer una investigación, recordar detalles, etc. Investigación sobre lengua y literatura 61 Bases Curriculares 2015 | 7° básico a 2° medio | Lengua y Literatura 61 Primero medio` },
    ],
    "Matemática": [
      { id: "OA1", texto: `Mostrar que comprenden la adición y la sustracción de números enteros:` },
      { id: "OA2", texto: `Explicar la multiplicación y la división de fracciones positivas:` },
      { id: "OA3", texto: `Resolver problemas que involucren la multiplicación y la división de fracciones y de decimales positivos de manera concreta, pictórica y simbólica (de forma manual y/o con software educativo).` },
      { id: "OA4", texto: `Mostrar que comprenden el concepto de porcentaje:` },
      { id: "OA5", texto: `Utilizar potencias de base 10 con exponente natural:` },
      { id: "OA17", texto: `Mostrar que comprenden las medidas de tendencia central y el rango:` },
      { id: "OA18", texto: `Explicar las probabilidades de eventos obtenidos por medio de experimentos de manera manual y/o con software educativo:` },
      { id: "OA19", texto: `Comparar las frecuencias relativas de un evento obtenidas al repetir un experimento de forma manual y/o con software educativo, con la probabilidad obtenida de manera teórica, usando diagramas de árbol, tablas o gráficos. 110 Bases Curriculares 2015 | 7° básico a 2° medio | Matemática 111 Bases Curriculares 2015 | 7° básico a 2° medio | Matemática 111 Octavo básico 112 Bases Curriculares 2015 | 7° básico a 2° medio |` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: `Explicar el proceso de hominización, reconociendo las principales etapas de la evolución de la especie humana, la influencia de factores geográficos, su dispersión en el planeta y las distintas teorías del poblamiento americano.` },
      { id: "OA2", texto: `Explicar que el surgimiento de la agricultura, la domesticación de animales, la sedentarización, la acumulación de bienes y el desarrollo del comercio fueron procesos de larga duración que revolucionaron la forma en que los seres humanos se relacionaron con el espacio geográfico.` },
      { id: "OA3", texto: `Explicar que, en las primeras civilizaciones, la formación de estados organizados y el ejercicio del poder estuvieron marcados por la centralización de la administración, la organización en torno a ciudades, la estratificación social, la formación de sistemas religiosos y el desarrollo de técnicas de contabilidad y escritura.` },
      { id: "OA4", texto: `Caracterizar el surgimiento de las primeras civilizaciones ( por ejemplo, sumeria, egipcia, china, india, minoica, fenicia, olmeca y chavín, entre otras), reconociendo que procesos similares se desarrollaron en distintos lugares y tiempos. Organizadores temáticos 192 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales Civilizaciones que confluyen en la conformación de la cultura a` },
      { id: "OA5", texto: `Caracterizar el mar Mediterráneo como ecúmene y como espacio de circulación e intercambio, e inferir cómo sus características geográficas (por ejemplo, clima, relieve, recursos naturales, entre otros) influyeron en el desarrollo de la ciudad-estado griega y de la república romana.` },
      { id: "OA6", texto: `Analizar las principales características de la democracia en Atenas, considerando el contraste con otras formas de gobierno del mundo antiguo, y su importancia para el desarrollo de la vida política actual y el reconocimiento de los derechos de los ciudadanos.` },
      { id: "OA7", texto: `Relacionar las principales características de la civilización romana (derecho, organización burocrática y militar, infraestructura, esclavitud, entre otras) con la extensión territorial de su imperio, la relación con los pueblos conquistados, el proceso de romanización y la posterior expansión del cristianismo.` },
      { id: "OA8", texto: `Analizar, apoyándose en fuentes, el canon cultural que se constituyó en la Antigüedad clásica, considerando la centralidad del ser humano y la influencia de esta cultura en diversos aspectos de las sociedades del presente (por ejemplo, escritura alfabética, filosofía, ciencias, historia, noción de sujeto de derecho, relaciones de género, ideal de belleza, deporte, teatro, poesía y artes, entre otros). La Edad Media y` },
      { id: "OA9", texto: `Explicar que la civilización europea se conforma a partir de la fragmentación de la unidad imperial de Occidente y la confluencia de las tradiciones grecorromana, judeocristiana y germana, e identificar a la Iglesia Católica como el elemento que articuló esta síntesis y que legitimó el poder político.` },
      { id: "OA10", texto: `Caracterizar algunos rasgos distintivos de la sociedad medieval, como la visión cristiana del mundo, el orden estamental, las relaciones de fidelidad, los roles de género, la vida rural y el declive de la vida urbana.` },
      { id: "OA11", texto: `Analizar ejemplos de relaciones de influencia, convivencia y conflicto entre el mundo europeo, el bizantino y el islámico durante la Edad Media, considerando la división del cristianismo y las relaciones de frontera entre la cristiandad y el islam en la península ibérica, entre otros.` },
      { id: "OA12", texto: `Analizar las transformaciones que se producen en Europa a partir del siglo XII, considerando el renacimiento de la vida urbana, los cambios demográficos, las innovaciones tecnológicas, el desarrollo del comercio y el surgimiento de las universidades. Civilizaciones americanas` },
      { id: "OA13", texto: `Identificar las principales características de las civilizaciones maya y azteca, considerando las tecnologías utilizadas para transformar el territorio que habitaban (urbanización, canales, acueductos y calzadas, formas de cultivo, entre otras) y el desarrollo de una red comercial que vinculaba al área mesoamericana. 193 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales` },
      { id: "OA14", texto: `Caracterizar el Imperio inca, y analizar los factores que posibilitaron la dominación y unidad del imperio (por ejemplo, red de caminos y sistema de comunicaciones, sistemas de cultivo, organización social, administración, ejército, mita y yanaconaje, sometimiento de pueblos y lengua oficial, entre otros).` },
      { id: "OA15", texto: `Describir las principales características culturales de las civilizaciones maya, azteca e inca (por ejemplo, arte, lengua, tradiciones, relaciones de género, sistemas de medición del tiempo, ritos funerarios y creencias religiosas), e identificar aquellos elementos que persisten hasta el presente.` },
      { id: "OA16", texto: `Reconocer en expresiones culturales latinoamericanas del presente la confluencia del legado de múltiples civilizaciones, como la maya, azteca, inca, griega, romana y europea. Formación ciudadana: el legado del mundo antiguo` },
      { id: "OA17", texto: `Identificar los principios, mecanismos e instituciones que permitieron que en Atenas y en Roma se limitara el ejercicio del poder y se respetaran los derechos ciudadanos (por ejemplo, a través del equilibrio de poderes, del principio de elegibilidad, de la temporalidad de los cargos, de la ley y una cultura de la legalidad, de las magistraturas y del Senado romano, entre otros), reconociendo elementos de continuidad ` },
      { id: "OA18", texto: `Comparar los conceptos de ciudadanía, democracia, derecho, república, municipio y gremio del mundo clásico y medieval con la sociedad contemporánea.` },
      { id: "OA19", texto: `Reconocer el valor de la diversidad como una forma de enriquecer culturalmente a las sociedades, identificando, a modo de ejemplo, los aportes que las distintas culturas existentes en el mundo antiguo y medieval (árabes, judeocristianos, germanos, eslavos, etc.) hicieron a las sociedades europeas, considerando el lenguaje, la religión y las ciencias, entre otros.` },
      { id: "OA20", texto: `Reconocer distintas formas de convivencia y conflicto entre culturas en las civilizaciones estudiadas, y debatir sobre la importancia que tienen el respeto, la tolerancia y las estrategias de resolución pacífica de conflictos, entre otros, para la convivencia entre distintos pueblos y culturas. Ser humano y medio` },
      { id: "OA21", texto: `Reconocer procesos de adaptación y transformación que se derivan de la relación entre el ser humano y el medio, e identificar factores que inciden en el asentamiento de las sociedades humanas (por ejemplo, disponibilidad de recursos, cercanía a zonas fértiles, fragilidad del medio ante la acción humana, o la vulnerabilidad de la población ante las amenazas del entorno).` },
      { id: "OA22", texto: `Reconocer y explicar formas en que la acción humana genera impactos en el medio y formas en las que el medio afecta a la población, y evaluar distintas medidas para propiciar efectos positivos y mitigar efectos negativos sobre ambos.` },
      { id: "OA23", texto: `Investigar sobre problemáticas medioambientales relacionadas con fenómenos como el calentamiento global, los recursos energéticos, la sobrepoblación, entre otros, y analizar y evaluar su impacto a escala local. 194 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales 195 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales Octavo básico 195 196 B` },
    ],
    "Ciencias Naturales": [
      { id: "OA1", texto: `Explicar que los modelos de la célula han evolucionado sobre la base de evidencias, como las aportadas por científicos como Hooke, Leeuwenhoek, Virchow, Schleiden y Schwann.` },
      { id: "OA2", texto: `Desarrollar modelos que expliquen la relación entre la función de una célula y sus partes, considerando:` },
      { id: "OA3", texto: `Explicar, por medio de la experimentación, los mecanismos de intercambio de partículas entre la célula (en animales y plantas) y su ambiente por difusión y osmosis.` },
      { id: "OA4", texto: `Crear modelos que expliquen que las plantas tienen estructuras especializadas para responder a estímulos del medioambiente, similares a las del cuerpo humano, considerando los procesos de transporte de sustancia e intercambio de gases. *Experimental(es), no experimental(es) o documental(es), entre otras. Ejes temáticos 152 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales` },
      { id: "OA5", texto: `Explicar, basándose en evidencias, la interacción de sistemas del cuerpo humano organizados por estructuras especializadas que contribuyen a su equilibrio, considerando:` },
      { id: "OA6", texto: `Investigar experimentalmente y explicar las características de los nutrientes (carbohidratos, proteínas, grasas, vitaminas, minerales y agua) en los alimentos y sus efectos para la salud humana.` },
      { id: "OA7", texto: `Analizar y evaluar, basándose en evidencias, los factores que contribuyen a mantener un cuerpo saludable, proponiendo un plan que considere:` },
      { id: "OA8", texto: `Analizar las fuerzas eléctricas, considerando:` },
      { id: "OA9", texto: `Investigar, explicar y evaluar las tecnologías que permiten la generación de energía eléctrica, como ocurre en pilas o baterías, en paneles fotovoltaicos y en generadores (eólicos, hidroeléctricos o nucleares, entre otros).` },
      { id: "OA10", texto: `Analizar un circuito eléctrico domiciliario y comparar experimentalmente los circuitos eléctricos, en serie y en paralelo, en relación con la:` },
      { id: "OA11", texto: `Desarrollar modelos e investigaciones experimentales que expliquen el calor como un proceso de transferencia de energía térmica entre dos o más cuerpos que están a diferentes temperaturas, o entre una fuente térmica y un objeto, considerando:` },
      { id: "OA12", texto: `Investigar y analizar cómo ha evolucionado el conocimiento de la constitución de la materia, considerando los aportes y las evidencias de:` },
      { id: "OA13", texto: `Investigar experimentalmente y explicar el comportamiento de gases ideales en situaciones cotidianas, considerando:` },
      { id: "OA14", texto: `Investigar experimentalmente y explicar la clasificación de la materia en sustancias puras y mezclas (homogéneas y heterogéneas), los procedimientos de separación de mezclas (decantación, filtración, tamizado y destilación), considerando su aplicación industrial en la metalurgia, la minería y el tratamiento de aguas servidas, entre otros.` },
      { id: "OA15", texto: `Investigar experimentalmente los cambios de la materia y argumentar con evidencia empírica que estos pueden ser físicos o químicos. 148 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales 149 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales Octavo básico 149 150 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales Observar y plantear preguntas a. Observar y describir ` },
      { id: "OA16", texto: `Investigar y explicar sobre la investigación astronómica en Chile y el resto del mundo, considerando aspectos como:` },
      { id: "OA17", texto: `Investigar experimentalmente y explicar, usando evidencias, que la fermentación, la combustión provocada por un motor y un calefactor, y la oxidación de metales, entre otras, son reacciones químicas presentes en la vida diaria, considerando:` },
      { id: "OA18", texto: `Desarrollar un modelo que describa cómo el número total de átomos no varía en una reacción química y cómo la masa se conserva aplicando la ley de la conservación de la materia.` },
      { id: "OA19", texto: `Explicar la formación de compuestos binarios y ternarios, considerando las fuerzas eléctricas entre partículas y la nomenclatura inorgánica correspondiente.` },
      { id: "OA20", texto: `Establecer relaciones cuantitativas entre reactantes y productos en reacciones químicas (estequiometría) y explicar la formación de compuestos útiles para los seres vivos, como la formación de la glucosa en la fotosíntesis. 161 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales 161 Segundo medio 162 Bases Curriculares 2015 | 7° básico a 2° medio | Ciencias Naturales Observar y plantear preguntas a. O` },
    ],
  },

  "1M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: `Leer habitualmente para aprender y recrearse, y seleccionar textos de acuerdo con sus preferencias y propósitos.` },
      { id: "OA2", texto: `Reflexionar sobre las diferentes dimensiones de la experiencia humana, propia y ajena, a partir de la lectura de obras literarias y otros textos que forman parte de nuestras herencias culturales, abordando los temas estipulados para el curso y las obras sugeridas para cada uno3.` },
      { id: "OA3", texto: `Analizar las narraciones leídas para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA4", texto: `Analizar los poemas leídos para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA5", texto: `Analizar los textos dramáticos leídos o vistos, para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA6", texto: `Comprender la visión de mundo que se expresa a través de las tragedias leídas, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA7", texto: `Comprender la relevancia de las obras del Romanticismo, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA8", texto: `Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, considerando:` },
      { id: "OA9", texto: `Analizar y evaluar textos con finalidad argumentativa, como columnas de opinión, cartas, discursos y ensayos, considerando:` },
      { id: "OA10", texto: `Analizar y evaluar textos de los medios de comunicación, como noticias, reportajes, cartas al director, propaganda o crónicas, considerando:` },
      { id: "OA11", texto: `Leer y comprender textos no literarios para contextualizar y complementar las lecturas literarias realizadas en clases.` },
      { id: "OA12", texto: `Aplicar flexiblemente y creativamente las habilidades de escritura adquiridas en clases como medio de expresión personal y cuando se enfrentan a nuevos géneros:` },
      { id: "OA13", texto: `Escribir, con el propósito de explicar un tema, textos de diversos géneros (por ejemplo, artículos, informes, reportajes, etc.) caracterizados por:` },
      { id: "OA14", texto: `Escribir, con el propósito de persuadir, textos de diversos géneros, en particular ensayos sobre los temas o lecturas propuestos para el nivel, caracterizados por:` },
      { id: "OA15", texto: `Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito:` },
      { id: "OA16", texto: `Usar consistentemente el estilo directo y el indirecto en textos escritos y orales:` },
      { id: "OA17", texto: `Usar en sus textos recursos de correferencia léxica compleja, empleando adecuadamente la metáfora y la metonimia para este fin.` },
      { id: "OA18", texto: `Escribir correctamente para facilitar la comprensión al lector:` },
      { id: "OA19", texto: `Comprender, comparar y evaluar textos orales y audiovisuales, tales como exposiciones, discursos, documentales, noticias, reportajes, etc., considerando:` },
      { id: "OA20", texto: `Resumir un discurso argumentativo escuchado, explicando y evaluando los argumentos usados por el emisor.` },
      { id: "OA21", texto: `Dialogar constructivamente para debatir o explorar ideas:` },
      { id: "OA22", texto: `Expresarse frente a una audiencia de manera clara y adecuada a la situación para comunicar temas de su interés:` },
      { id: "OA23", texto: `Analizar los posibles efectos de los elementos lingüísticos, paralingüísticos y no lingüísticos que usa un hablante en una situación determinada.` },
      { id: "OA24", texto: `Realizar investigaciones sobre diversos temas para complementar sus lecturas o responder interrogantes relacionadas con el lenguaje y la literatura:` },
    ],
    "Matemática": [
      { id: "OA1", texto: `Mostrar que comprenden la multiplicación y la división de números enteros:` },
      { id: "OA2", texto: `Utilizar las operaciones de multiplicación y división con los números racionales en el contexto de la resolución de problemas:` },
      { id: "OA3", texto: `Explicar la multiplicación y la división de potencias de base natural y exponente natural hasta 3, de manera concreta, pictórica y simbólica.` },
      { id: "OA4", texto: `Mostrar que comprenden las raíces cuadradas de números naturales:` },
      { id: "OA5", texto: `Resolver problemas que involucran variaciones porcentuales en contextos diversos, usando representaciones pictóricas y registrando el proceso de manera simbólica; por ejemplo: el interés anual del ahorro. Ejes temáticos 114 Bases Curriculares 2015 | 7° básico a 2° medio | Matemática Álgebra y funciones` },
      { id: "OA6", texto: `Mostrar que comprenden la operatoria de expresiones algebraicas:` },
      { id: "OA7", texto: `Mostrar que comprenden la noción de función por medio de un cambio lineal:` },
      { id: "OA8", texto: `Modelar situaciones de la vida diaria y de otras asignaturas, usando ecuaciones lineales de la forma: ax = b; x/a = b, a ≠ 0; ax + b = c; x/a + b = c; ax = b + cx; a(x+b) = c; ax + b = cx + d | (a, b, c, d, e ∈ Q).` },
      { id: "OA9", texto: `Resolver inecuaciones lineales con coeficientes racionales en el contexto de la resolución de problemas, por medio de representaciones gráficas, simbólicas, de manera manual y/o con software educativo.` },
      { id: "OA10", texto: `Mostrar que comprenden la función afín:` },
      { id: "OA11", texto: `Desarrollar las fórmulas para encontrar el área de superficies y el volumen de prismas rectos con diferentes bases y cilindros:` },
      { id: "OA12", texto: `Explicar, de manera concreta, pictórica y simbólica, la validez del teorema de Pitágoras y aplicar a la resolución de problemas geométricos y de la vida cotidiana, de manera manual y/o con software educativo.` },
      { id: "OA13", texto: `Describir la posición y el movimiento (traslaciones, rotaciones y reflexiones) de figuras 2D, de manera manual y/o con software educativo, utilizando:` },
      { id: "OA14", texto: `Componer rotaciones, traslaciones y reflexiones en el plano cartesiano y en el espacio, de manera manual y/o con software educativo, y aplicar a la simetría de polígonos y poliedros y a la resolución de problemas geométricos relacionados con el arte. Probabilidad y estadística` },
      { id: "OA15", texto: `Mostrar que comprenden las medidas de posición, percentiles y cuartiles:` },
      { id: "OA16", texto: `Evaluar la forma en que los datos están presentados:` },
      { id: "OA17", texto: `Explicar el principio combinatorio multiplicativo:` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: `Analizar, apoyándose en diversas fuentes, la centralidad del ser humano y su capacidad de transformar el mundo en las expresiones culturales del humanismo y del Renacimiento.` },
      { id: "OA2", texto: `Comparar la sociedad medieval y moderna, considerando los cambios que implicó la ruptura de la unidad religiosa de Europa, el surgimiento del Estado centralizado, el impacto de la imprenta en la difusión del conocimiento y de las ideas, la revolución científica y el nacimiento de la ciencia moderna, entre otros.` },
      { id: "OA3", texto: `Caracterizar el Estado moderno considerando sus principales rasgos, como la concentración del poder en la figura del rey, el desarrollo de la burocracia y de un sistema fiscal centralizado, la expansión del territorio, la creación de ejércitos profesionales y el monopolio del comercio internacional, y contrastar con la fragmentación del poder que caracterizó a la Edad Media.` },
      { id: "OA4", texto: `Caracterizar la economía mercantilista del siglo XVI, considerando fenómenos económicos como la acumulación y circulación de metales preciosos, la ampliación de rutas comerciales, la expansión mundial de la economía europea, la revolución de los precios y el aumento de la competencia, entre otros. Organizadores temáticos 198 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales El c` },
      { id: "OA5", texto: `Argumentar por qué la llegada de los europeos a América implicó un enfrentamiento entre culturas, considerando aspectos como la profundidad de las diferencias culturales, la magnitud del escenario natural americano y la desarticulación de la cosmovisión de las sociedades indígenas.` },
      { id: "OA6", texto: `Analizar los factores que explican la rapidez de la conquista y la caída de los grandes imperios americanos, considerando aspectos como la organización política, las diferencias en la forma de hacer la guerra, los intereses de los conquistadores y la catástrofe demográfica.` },
      { id: "OA7", texto: `Analizar y evaluar el impacto de la conquista de América en la cultura europea, considerando la ampliación del mundo conocido, el desafío de representar una nueva realidad y los debates morales relacionados con la condición humana de los indígenas. Formación de la sociedad americana y de los principales rasgos del Chile colonial` },
      { id: "OA8", texto: `Analizar el rol de la ciudad en la administración del territorio del Imperio español, considerando las instituciones que concentraba, la relación con la metrópoli, el monopolio del comercio y la consolidación del poder local de las elites criollas.` },
      { id: "OA9", texto: `Caracterizar el Barroco a través de distintas expresiones culturales de la sociedad colonial, como el arte, la arquitectura, la música, el teatro y las ceremonias, entre otras.` },
      { id: "OA10", texto: `Explicar la importancia de los mercados americanos en el comercio atlántico de los siglos XVII y XVIII, considerando el monopolio comercial, la exportación de materias primas, las distintas regiones productivas, el tráfico y empleo masivo de mano de obra esclava y el desarrollo de rutas comerciales.` },
      { id: "OA11", texto: `Analizar el proceso de formación de la sociedad colonial americana considerando elementos como la evangelización, la esclavitud y otras formas de trabajo no remunerado (por ejemplo, encomienda y mita), los roles de género, la transculturación, el mestizaje, la sociedad de castas, entre otros.` },
      { id: "OA12", texto: `Analizar y evaluar las formas de convivencia y los tipos de conflicto que surgen entre españoles, mestizos y mapuches como resultado del fracaso de la conquista de Arauco, y relacionarlo con el consiguiente desarrollo de una sociedad de frontera durante la Colonia en Chile.` },
      { id: "OA13", texto: `Analizar el rol de la hacienda en la conformación de los principales rasgos del Chile colonial, considerando el carácter rural de la economía, el desarrollo de un sistema de inquilinaje, la configuración de una elite terrateniente y de una sociedad con rasgos estamentales, y reconocer la proyección de estos elementos en los siglos XIX y XX. Nuevos principios que configuran el mundo occidental: Ilustración, revolución` },
      { id: "OA14", texto: `Caracterizar la Ilustración como corriente de pensamiento basada en la razón, considerando sus principales ideas, como el ordenamiento constitucional, la separación y el equilibrio de poderes del Estado, los principios de libertad, igualdad y soberanía popular y la secularización, y fundamentar su rol en la crítica al absolutismo y en la promoción del ideario republicano. 199 Bases Curriculares 2015 | 7° básico a 2° ` },
      { id: "OA15", texto: `Analizar cómo las ideas ilustradas se manifestaron en los procesos revolucionarios de fines del siglo XVIII y comienzos del siglo XIX, considerando la independencia de Estados Unidos, la Revolución francesa y las independencias de las colonias españolas en Latinoamérica.` },
      { id: "OA16", texto: `Explicar la independencia de las colonias hispanoamericanas como un proceso continental, marcado por la crisis del sistema colonial, la apropiación de las ideas ilustradas y la opción por el modelo republicano, y analizar en este marco el proceso de independencia de Chile. Formación ciudadana: una nueva concepción de los derechos individuales como fundamento de la política moderna` },
      { id: "OA17", texto: `Contrastar las distintas posturas que surgieron en el debate sobre la legitimidad de la conquista durante el siglo XVI, y fundamentar la relevancia de este debate para la concepción de los derechos humanos en la actualidad.` },
      { id: "OA18", texto: `Explicar el concepto de Derechos del Hombre y del Ciudadano difundido en el marco de la Ilustración y la Revolución francesa, y reconocer su vigencia actual en los derechos humanos.` },
      { id: "OA19", texto: `Evaluar las principales transformaciones y desafíos que generó la independencia de Chile, como la conformación de un orden republicano, la constitución de una ciudadanía inspirada en la soberanía popular y la formación de un Estado nacional, y fundamentar la relevancia de estas transformaciones para el Chile de la actualidad. Sociedad y territorio: la región en Chile y América` },
      { id: "OA20", texto: `Explicar los criterios que definen a una región, considerando factores físicos y humanos que la constituyen (por ejemplo, vegetación, suelo, clima, lengua común, religión, historia, entre otros), y dar ejemplos de distintos tipos de regiones en Chile y en América (culturales, geográficas, económicas, políticoadministrativas, etc.).` },
      { id: "OA21", texto: `Analizar y evaluar problemáticas asociadas a la región en Chile —como los grados de conexión y de aislamiento (considerando redes de transporte y comunicaciones, acceso a bienes, servicios e información, entre otros), índices demográficos y migración— y su impacto en diversos ámbitos (mercado laboral, servicios de salud, relación campo-ciudad y centro-periferia, entre otros).` },
      { id: "OA22", texto: `Aplicar el concepto de desarrollo para analizar diversos aspectos de las regiones en Chile, considerando el índice de desarrollo humano, la diversidad productiva, de intercambio y de consumo, las ventajas comparativas, la inserción en los mercados internacionales, y el desarrollo sustentable. 200 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales 201 Bases Curriculares 2015 | 7° ` },
    ],
  },

  "2M": {
    "Lengua y Literatura": [
      { id: "OA1", texto: `Leer habitualmente para aprender y recrearse, y seleccionar textos de acuerdo con sus preferencias y propósitos.` },
      { id: "OA2", texto: `Reflexionar sobre las diferentes dimensiones de la experiencia humana, propia y ajena, a partir de la lectura de obras literarias y otros textos que forman parte de nuestras herencias culturales, abordando los temas estipulados para el curso y las obras sugeridas para cada uno4.` },
      { id: "OA3", texto: `Analizar las narraciones leídas para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA4", texto: `Analizar los poemas leídos para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA5", texto: `Analizar los textos dramáticos leídos o vistos, para enriquecer su comprensión, considerando, cuando sea pertinente:` },
      { id: "OA6", texto: `Comprender la relevancia de las obras del Siglo de Oro, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA7", texto: `Leer y comprender cuentos latinoamericanos modernos y contemporáneos, considerando sus características y el contexto en el que se enmarcan.` },
      { id: "OA8", texto: `Formular una interpretación de los textos literarios leídos o vistos, que sea coherente con su análisis, considerando:` },
      { id: "OA9", texto: `Analizar y evaluar textos con finalidad argumentativa, como columnas de opinión, cartas al director, discursos y ensayos, considerando:` },
      { id: "OA10", texto: `Analizar y evaluar textos de los medios de comunicación, como noticias, reportajes, cartas al director, propaganda o crónicas, considerando:` },
      { id: "OA11", texto: `Leer y comprender textos no literarios para contextualizar y complementar las lecturas literarias realizadas en clases.` },
      { id: "OA12", texto: `Aplicar flexiblemente y creativamente las habilidades de escritura adquiridas en clases como medio de expresión personal y cuando se enfrentan a nuevos géneros:` },
      { id: "OA13", texto: `Escribir, con el propósito de explicar un tema, textos de diversos géneros (por ejemplo, artículos, informes, reportajes, etc.) caracterizados por:` },
      { id: "OA14", texto: `Escribir, con el propósito de persuadir, textos de diversos géneros, en particular ensayos sobre los temas o lecturas propuestos para el nivel, caracterizados por:` },
      { id: "OA15", texto: `Planificar, escribir, revisar, reescribir y editar sus textos en función del contexto, el destinatario y el propósito:` },
      { id: "OA16", texto: `Usar consistentemente el estilo directo y el indirecto en textos escritos y orales:` },
      { id: "OA17", texto: `Emplear frases nominales complejas como recurso para compactar la información y establecer correferencia en textos con finalidad expositiva y argumentativa.` },
      { id: "OA18", texto: `Escribir correctamente para facilitar la comprensión al lector:` },
      { id: "OA19", texto: `Comprender, comparar y evaluar textos orales y audiovisuales, tales como exposiciones, discursos, documentales, noticias, reportajes, etc., considerando:` },
      { id: "OA20", texto: `Evaluar el punto de vista de un emisor, su razonamiento y uso de recursos retóricos (vocabulario, organización de las ideas, desarrollo y progresión de los argumentos, etc.).` },
      { id: "OA21", texto: `Dialogar constructivamente para debatir o explorar ideas:` },
      { id: "OA22", texto: `Expresarse frente a una audiencia de manera clara y adecuada a la situación para comunicar temas de su interés:` },
      { id: "OA23", texto: `Analizar los posibles efectos de los elementos lingüísticos, paralingüísticos y no lingüísticos que usa un hablante en una situación determinada. Comunicación oral 73 Bases Curriculares 2015 | 7° básico a 2° medio | Lengua y Literatura` },
      { id: "OA24", texto: `Realizar investigaciones sobre diversos temas para complementar sus lecturas o responder interrogantes relacionadas con el lenguaje y la literatura:` },
    ],
    "Matemática": [
      { id: "OA1", texto: `Calcular operaciones con números racionales en forma simbólica.` },
      { id: "OA2", texto: `Mostrar que comprenden las potencias de base racional y exponente entero:` },
      { id: "OA3", texto: `Desarrollar los productos notables de manera concreta, pictórica y simbólica:` },
      { id: "OA4", texto: `Resolver sistemas de ecuaciones lineales (2x2) relacionados con problemas de la vida diaria y de otras asignaturas, mediante representaciones gráficas y simbólicas, de manera manual y/o con software educativo.` },
      { id: "OA5", texto: `Graficar relaciones lineales en dos variables de la forma f (x,y) = ax+by; por ejemplo: un haz de rectas paralelas en el plano cartesiano, líneas de nivel en planos inclinados (techo), propagación de olas en el mar y la formación de algunas capas de rocas:` },
      { id: "OA6", texto: `Desarrollar la fórmula de los valores del área y del perímetro de sectores y segmentos circulares respectivamente, a partir de ángulos centrales de 60°, 90°, 120° y 180°, por medio de representaciones concretas.` },
      { id: "OA7", texto: `Desarrollar las fórmulas para encontrar el área de la superficie y el volumen del cono:` },
      { id: "OA8", texto: `Mostrar que comprenden el concepto de homotecia:` },
      { id: "OA9", texto: `Desarrollar el teorema de Tales mediante las propiedades de la homotecia, para aplicarlo en la resolución de problemas.` },
      { id: "OA10", texto: `Aplicar propiedades de semejanza y de proporcionalidad a modelos a escala y otras situaciones de la vida diaria y otras asignaturas.` },
      { id: "OA11", texto: `Representar el concepto de homotecia de forma vectorial, relacionándolo con el producto de un vector por un escalar, de manera manual y/o con software educativo. Probabilidad y estadística` },
      { id: "OA12", texto: `Registrar distribuciones de dos características distintas, de una misma población, en una tabla de doble entrada y en una nube de puntos.` },
      { id: "OA13", texto: `Comparar poblaciones mediante la confección de gráficos “xy” para dos atributos de muestras, de manera concreta y pictórica:` },
      { id: "OA14", texto: `Desarrollar las reglas de las probabilidades , la regla aditiva , la regla multiplicativa y la combinación de ambas, de manera concreta, pictórica y simbólica, de manera manual y/o con software educativo, en el contexto de la resolución de problemas.` },
      { id: "OA15", texto: `Mostrar que comprenden el concepto de azar:` },
    ],
    "Historia, Geografía y Cs. Sociales": [
      { id: "OA1", texto: `Explicar las ideas republicanas y liberales y su relación con las transformaciones políticas y económicas de América y de Europa durante el siglo XIX, considerando, por ejemplo, el parlamentarismo como modelo de representatividad, el constitucionalismo, el movimiento abolicionista, la libre asociación, el libre mercado, la ampliación de la ciudadanía, entre otros.` },
      { id: "OA2", texto: `Caracterizar la cultura burguesa, su ideal de vida y valores durante el siglo XIX (por ejemplo, modelo de familia, roles de género, ética del trabajo, entre otros), y explicar el protagonismo de la burguesía en las principales transformaciones políticas, sociales y económicas del período. Organizadores temáticos 204 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales` },
      { id: "OA3", texto: `Analizar cómo durante el siglo XIX la geografía política de América Latina y de Europa se reorganizó con el surgimiento del Estado-nación, caracterizado por la unificación de territorios y de tradiciones culturales (por ejemplo, lengua e historia) según el principio de soberanía y el sentido de pertenencia a una comunidad política. La idea del progreso indefinido y sus contradicciones: de la industrialización a la gu` },
      { id: "OA4", texto: `Reconocer que el siglo XIX latinoamericano y europeo está marcado por la idea de progreso indefinido, que se manifestó en aspectos como el desarrollo científico y tecnológico, el dominio de la naturaleza, el positivismo y el optimismo histórico, entre otros.` },
      { id: "OA5", texto: `Caracterizar el proceso de industrialización y analizar sus efectos sobre la economía, la población y el territorio, considerando la expansión del trabajo asalariado, las transformaciones en los modos de producción, el surgimiento del proletariado y la consolidación de la burguesía, el desarrollo de la ciudad contemporánea (por ejemplo, expansión urbana, explosión demográfica, marginalidad) y la revolución del transp` },
      { id: "OA6", texto: `Analizar el imperialismo europeo del siglo XIX, considerando su incidencia en la reconfiguración del mapa mundial, su impacto en los pueblos colonizados y su influencia en la ampliación de los mercados y en la expansión del capitalismo, entre otros.` },
      { id: "OA7", texto: `Analizar el impacto de la Primera Guerra Mundial en la sociedad civil, considerando la movilización general, el cambio en la forma y la percepción de la guerra y la entrada masiva de la mujer al mundo laboral y al espacio público, y evaluar sus consecuencias en el orden geopolítico mundial (por ejemplo, en el rediseño del mapa de Europa, en el surgimiento de la URSS, en la creciente influencia de Estados Unidos y en ` },
      { id: "OA8", texto: `Analizar el período de formación de la República de Chile como un proceso que implicó el enfrentamiento de distintas visiones sobre el modo de organizar al país, y examinar los factores que explican la relativa estabilidad política alcanzada a partir de la Constitución de 1833.` },
      { id: "OA9", texto: `Caracterizar la consolidación de la República en Chile, considerando la defensa del territorio nacional, el voto censitario, la institucionalización del debate político (por ejemplo, la estructuración del sistema de partidos, la discusión parlamentaria, la prensa política, etc.) y la persistencia de conflictos como la crítica al centralismo y el debate sobre las atribuciones del Ejecutivo y del Legislativo.` },
      { id: "OA10", texto: `Explicar que Chile durante el siglo XIX se insertó en los procesos de industrialización del mundo atlántico y en los mercados internacionales mediante la explotación y exportación de recursos naturales, reconociendo la persistencia de una economía tradicional y rural basada en la hacienda y el inquilinaje.` },
      { id: "OA11", texto: `Analizar cómo el desarrollo de espacios de expresión de la opinión pública (prensa, historiografía, literatura y movilización política) y del sistema educacional contribuyeron a expandir y profundizar la idea de nación durante el siglo XIX en Chile. 205 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales Configuración del territorio chileno y sus dinámicas geográficas en el siglo ` },
      { id: "OA12", texto: `Describir los procesos de exploración y reconocimiento del territorio que impulsó el Estado para caracterizar su población, desarrollar sus recursos, organizar su administración y delimitar sus fronteras, entre otros, considerando el rol que cumplieron las ciencias (misiones científicas, censos, entre otros) e instituciones como la Universidad de Chile.` },
      { id: "OA13", texto: `Describir el proceso de ocupación de Valdivia, Llanquihue, Chiloé y el estrecho de Magallanes, y analizar su importancia estratégica para el Estado, destacando el rol de la inmigración europea y las relaciones con los pueblos originarios que habitaban esos lugares.` },
      { id: "OA14", texto: `Explicar que la ocupación de la Araucanía fue una política de Estado que afectó profundamente a la sociedad mapuche, considerando la acción militar, la fundación de ciudades, la extensión del ferrocarril, la repartición de tierras y la reubicación de la población mapuche en reducciones.` },
      { id: "OA15", texto: `Analizar la guerra del Pacífico considerando el conflicto económico en torno al salitre, el impacto de la guerra en múltiples ámbitos de la sociedad chilena y la ampliación del territorio nacional, y evaluar su proyección en las relaciones con los países vecinos. El orden liberal y las transformaciones políticas y sociales de fin de siglo en Chile` },
      { id: "OA16", texto: `Analizar el orden político liberal y parlamentario de la segunda mitad del siglo XIX, considerando las reformas constitucionales y su impacto en el aumento de las facultades del poder legislativo, el proceso de secularización de las instituciones, la consolidación del sistema de partidos, y la ampliación del derecho a voto y las libertades públicas.` },
      { id: "OA17", texto: `Caracterizar las principales transformaciones generadas por las riquezas del salitre, reconociendo el crecimiento del ingreso fiscal de los distintos sectores productivos y de las inversiones públicas en infraestructura y en educación.` },
      { id: "OA18", texto: `Analizar las principales transformaciones de la sociedad en el cambio de siglo, considerando los factores que originaron la cuestión social y sus características, la emergencia de nuevas demandas de los sectores populares y las nuevas formas de lucha obrera, la transformación ideológica de los partidos políticos y el creciente protagonismo de los sectores medios. Formación económica: las personas y el funcionamiento ` },
      { id: "OA19", texto: `Explicar el problema económico de la escasez y las necesidades ilimitadas con ejemplos de la vida cotidiana, y de las relaciones económicas (por ejemplo, compra y venta de bienes y servicios, pago de remuneraciones y de impuestos, importaciones-exportacione s) que se dan entre los distintos agentes (personas, familias, empresas, Estado y resto del mundo).` },
      { id: "OA20", texto: `Explicar el funcionamiento del mercado (cómo se determinan los precios y la relación entre oferta y demanda) y los factores que pueden alterarlo: por ejemplo, el monopolio, la colusión, la inflación y la deflación, la fijación de precios y de aranceles, entre otros. 206 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales` },
      { id: "OA21", texto: `Caracterizar algunos instrumentos financieros de inversión y ahorro, como préstamos, líneas y tarjetas de crédito, libretas de ahorro, cajas vecinas, acciones en la bolsa, previsión, entre otros, y evaluar los riesgos y beneficios que se derivan de su uso.` },
      { id: "OA22", texto: `Evaluar situaciones de consumo informado y responsable, considerando los derechos del consumidor, los compromisos financieros, el sentido del ahorro y del endeudamiento, entre otros. Formación ciudadana: sociedad contemporánea: diversidad, convivencia y medioambiente` },
      { id: "OA23", texto: `Explicar que los problemas de una sociedad generan distintas respuestas políticas, ejemplificando mediante las posturas que surgieron frente a la “cuestión social” (por ejemplo, liberalismo, socialismo, anarquismo, comunismo y socialcristianismo) y de otras situaciones conflictivas de la actualidad.` },
      { id: "OA24", texto: `Evaluar, por medio del uso de fuentes, las relaciones de conflicto y convivencia con los pueblos indígenas (aymara, colla, rapa nui, mapuche, quechua, atacameño, kawéskar, yagán, diaguita), tanto en el pasado como en el presente, y reflexionar sobre el valor de la diversidad cultural en nuestra sociedad.` },
      { id: "OA25", texto: `Analizar el impacto del proceso de industrialización en el medioambiente y su proyección en el presente, y relacionarlo con el debate actual en torno a la necesidad de lograr un desarrollo sostenible. 207 Segundo medio 208 Bases Curriculares 2015 | 7° básico a 2° medio | Historia, Geografía y Ciencias Sociales Pensamiento temporal y espacial a. Establecer y fundamentar periodizaciones históricas mediante líneas de ti` },
    ],
  },
}


// ─── PARVULARIA (BCEP 2018) ──────────────────────────────────────────────────
const PARVULARIA: Record<string, Record<string, OA[]>> = {
  "NT1": {
    "Identidad y Autonomía": [
      { id: "OA1", texto: "Reconocer y comunicar sus características personales, preferencias e intereses, apreciándose a sí mismo como persona." },
      { id: "OA2", texto: "Manifestar sus emociones y sentimientos con confianza y seguridad, desarrollando su autoestima." },
      { id: "OA3", texto: "Manifestar iniciativa para resguardar el autocuidado, la salud y la seguridad personal." },
      { id: "OA4", texto: "Llevar a cabo sus actividades con mayor grado de independencia y autonomía." },
      { id: "OA5", texto: "Manifestar disposición y confianza para relacionarse con adultos y pares en diversas situaciones." },
      { id: "OA6", texto: "Reconocer progresivamente requerimientos, habilidades y características propias de su género." },
      { id: "OA7", texto: "Distinguir y respetar las normas y acuerdos de convivencia del grupo." },
      { id: "OA8", texto: "Comprender y apreciar el significado de valores como la verdad, la justicia, el respeto y el bien común." },
    ],
    "Convivencia y Ciudadanía": [
      { id: "OA1", texto: "Participar en actividades solidarias que integren sus grupos de pertenencia: familia, centro educativo y comunidad." },
      { id: "OA2", texto: "Reconocer, apreciar y respetar las diferencias individuales y de las distintas culturas." },
      { id: "OA3", texto: "Identificar y apreciar la diversidad de las personas, familias y comunidades." },
      { id: "OA4", texto: "Respetar y hacer respetar las normas de convivencia del grupo, participando en su construcción." },
      { id: "OA5", texto: "Participar en la construcción de acuerdos y normas que promuevan el bien común." },
      { id: "OA6", texto: "Valorar la vida en democracia, practicando el respeto por los derechos propios y ajenos." },
    ],
    "Lenguaje Verbal": [
      { id: "OA1", texto: "Manifestar interés y disposición por comunicarse oralmente en lengua materna, con variados propósitos." },
      { id: "OA2", texto: "Comprender textos orales como poemas, cuentos y fábulas, identificando personajes, hechos y lugares." },
      { id: "OA3", texto: "Reconocer que los textos escritos transmiten mensajes e ideas y son escritos por alguien." },
      { id: "OA4", texto: "Iniciarse en la lectura, reconociendo el principio alfabético y la relación entre sonidos y letras." },
      { id: "OA5", texto: "Manifestar interés y motivación por crear textos orales y escritos para comunicar ideas." },
      { id: "OA6", texto: "Escuchar activamente relatos, noticias y conversaciones, reconociendo su propósito." },
      { id: "OA7", texto: "Expresarse en forma oral con claridad, usando vocabulario variado y adecuado a la situación." },
      { id: "OA8", texto: "Describir oralmente imágenes, láminas, sucesos y lugares con vocabulario variado." },
    ],
    "Pensamiento Matemático": [
      { id: "OA1", texto: "Contar y comparar colecciones de objetos del 0 al 20." },
      { id: "OA2", texto: "Resolver adiciones y sustracciones simples con números del 0 al 10 usando material concreto." },
      { id: "OA3", texto: "Identificar y describir figuras geométricas básicas: círculo, triángulo, cuadrado, rectángulo." },
      { id: "OA4", texto: "Describir la posición de objetos en el espacio usando conceptos de ubicación espacial." },
      { id: "OA5", texto: "Comparar y ordenar objetos según longitud, peso y capacidad." },
      { id: "OA6", texto: "Identificar y completar patrones simples de objetos y figuras." },
      { id: "OA7", texto: "Recolectar y registrar datos en tablas simples." },
      { id: "OA8", texto: "Representar números del 0 al 20 de diversas formas: concreta, pictórica y simbólica." },
    ],
    "Exploración del Entorno Natural": [
      { id: "OA1", texto: "Explorar y describir características de seres vivos y elementos del entorno natural." },
      { id: "OA2", texto: "Identificar semejanzas y diferencias entre seres vivos de su entorno." },
      { id: "OA3", texto: "Manifestar curiosidad por explorar el entorno natural y sus cambios." },
      { id: "OA4", texto: "Reconocer cambios en el entorno producidos por la acción humana y el paso del tiempo." },
      { id: "OA5", texto: "Participar en actividades que promuevan el cuidado y respeto por el medioambiente." },
    ],
  },
  "NT2": {
    "Identidad y Autonomía": [
      { id: "OA1", texto: "Reconocer sus características personales, preferencias y capacidades, desarrollando su autoestima." },
      { id: "OA2", texto: "Manifestar sus emociones con vocabulario que las describa, en distintas situaciones cotidianas." },
      { id: "OA3", texto: "Manifestar hábitos de autocuidado, higiene y cuidado de la salud en su vida cotidiana." },
      { id: "OA4", texto: "Demostrar autonomía progresiva en la toma de decisiones y resolución de situaciones cotidianas." },
      { id: "OA5", texto: "Establecer relaciones de colaboración, empatía y respeto con sus pares y adultos." },
      { id: "OA6", texto: "Reconocer el rol que cumplen los adultos en su entorno familiar, escolar y comunitario." },
      { id: "OA7", texto: "Comprender y cumplir normas de convivencia, participando en su formulación." },
      { id: "OA8", texto: "Aplicar valores de honestidad, respeto y responsabilidad en situaciones cotidianas." },
    ],
    "Lenguaje Verbal": [
      { id: "OA1", texto: "Comunicarse oralmente expresando ideas, emociones y experiencias con vocabulario variado." },
      { id: "OA2", texto: "Comprender y disfrutar textos literarios: cuentos, poemas y fábulas, identificando sus elementos." },
      { id: "OA3", texto: "Reconocer el principio alfabético: que las letras representan sonidos del habla." },
      { id: "OA4", texto: "Leer palabras simples aplicando conciencia fonológica y reconocimiento de letras." },
      { id: "OA5", texto: "Escribir su nombre y palabras conocidas, usando letras del alfabeto." },
      { id: "OA6", texto: "Escuchar activamente y comprender textos orales de diverso tipo y propósito." },
      { id: "OA7", texto: "Participar en conversaciones y debates, respetando turnos y puntos de vista ajenos." },
      { id: "OA8", texto: "Narrar experiencias personales, cuentos e historias con secuencia lógica." },
    ],
    "Pensamiento Matemático": [
      { id: "OA1", texto: "Contar, leer y escribir números del 0 al 20 y representarlos de diversas formas." },
      { id: "OA2", texto: "Resolver problemas de adición y sustracción con números hasta el 20." },
      { id: "OA3", texto: "Identificar, describir y reproducir patrones con figuras y objetos." },
      { id: "OA4", texto: "Identificar figuras geométricas planas y cuerpos geométricos en el entorno." },
      { id: "OA5", texto: "Comparar y ordenar objetos según longitud, peso y capacidad con unidades no estandarizadas." },
      { id: "OA6", texto: "Recolectar datos y representarlos en tablas y pictogramas simples." },
      { id: "OA7", texto: "Resolver problemas concretos usando el pensamiento matemático." },
      { id: "OA8", texto: "Describir posición y desplazamiento de objetos en el espacio." },
    ],
  },
}
PARVULARIA["NT2"]["Convivencia y Ciudadanía"] = PARVULARIA["NT1"]["Convivencia y Ciudadanía"]
PARVULARIA["NT2"]["Exploración del Entorno Natural"] = PARVULARIA["NT1"]["Exploración del Entorno Natural"]


// ─── Helpers ─────────────────────────────────────────────────────────────────

export function cursoToKey(curso: string): string {
  const c = curso.toLowerCase()
  if (c.includes("nt1") || c.includes("pre kinder"))         return "NT1"
  if (c.includes("nt2") || c.includes("kinder"))             return "NT2"
  if (c.includes("sala cuna") || c.includes("nivel medio"))  return "NT1"
  const n = (c.match(/^(\d+)/) || [])[1] || ""
  if (c.includes("básico") || c.includes("basico"))          return `${n}B`
  if (c.includes("medio"))                                   return `${n}M`
  return n ? `${n}B` : "3B"
}

export function normalizeAsignatura(asig: string, nivel: NivelKey): string {
  const a = asig.toLowerCase()
  if (nivel === "basica") {
    if (a.includes("lenguaje") || a.includes("comunicaci"))  return "Lenguaje y Comunicación"
    if (a.includes("matemát") || a.includes("matematica"))  return "Matemática"
    if (a.includes("ciencias nat"))                          return "Ciencias Naturales"
    if (a.includes("historia") || a.includes("geograf"))    return "Historia, Geografía y Cs. Sociales"
  }
  if (nivel === "media") {
    if (a.includes("lengua") || a.includes("literatura"))   return "Lengua y Literatura"
    if (a.includes("matemát") || a.includes("matematica"))  return "Matemática"
    if (a.includes("historia") || a.includes("geograf"))    return "Historia, Geografía y Cs. Sociales"
    if (a.includes("ciencias nat") || a.includes("ciencias para")) return "Ciencias Naturales"
    if (a.includes("biolog"))  return "Biología"
    if (a.includes("química")) return "Química"
    if (a.includes("física"))  return "Física"
  }
  return asig
}

export function getOAs(nivel: NivelKey, curso: string, asignatura: string): OA[] {
  const k    = cursoToKey(curso)
  const asig = normalizeAsignatura(asignatura, nivel)
  if (nivel === "parvularia") return PARVULARIA[k]?.[asig] || PARVULARIA[k]?.[asignatura] || []
  if (nivel === "basica")     return BASICA[k]?.[asig]     || BASICA[k]?.[asignatura]     || []
  if (nivel === "media")      return MEDIA[k]?.[asig]      || MEDIA[k]?.[asignatura]      || []
  return []
}

export function getOA(nivel: NivelKey, curso: string, asignatura: string, numero: number): OA | null {
  return getOAs(nivel, curso, asignatura).find(o => o.id === `OA${numero}`) ?? null
}

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
    if (oa) return header + `${oa.id}: ${oa.texto}\n`
  }
  return header + oas.map(o => `${o.id}: ${o.texto}`).join("\n")
}
