import assert from "node:assert/strict"
import { detectToolFromMessage, isMusicListeningRequest } from "../lib/superagent/tool-registry"

const nonMusicalRequests = [
  "Quiero solicitar una reunión de trabajo a la directora para abordar IA, carros de tablet que llegan el 9 de noviembre, servidor propio, presupuesto para tecnologías y proyectos de la sala de música.",
  "Quiero solicitar una reunión de trabajo a la directora con respecto a todo lo que podría hacer: esta reunión quiero para abordar diferentes temas como: IA para uso del colegio, carros de tablet llegan el 9 de noviembre, servidor propio, no comprar notebook tendríamos un presupuesto grande para hacer tecnologias, que tecnologías o cosas podríamos abarcar según su criterio para el colegio. ademas, los proyectos de la sala de música o otros que se podrían llevar a cabo.",
  "Necesito redactar un correo para pedir una reunión con la directora por la sala de música",
  "Tenemos que renovar la sala de música y priorizar el presupuesto",
  "Estamos diseñando un proyecto de música para el colegio",
  "Evaluemos alternativas tecnológicas para el área de música",
  "Quiero preparar una presentación para la profesora de música",
  "La reunión trata sobre el aula de música y el servidor",
  "¿Cuáles son los beneficios de estudiar música?",
  "Cómo mejorar la concentración de los estudiantes con tecnología",
  "Pomodoro de 25 minutos y cinco de descanso",
  "Necesito un plan de concentración para docentes",
  "Explica cómo funciona EduAI Music",
  "Crea un presupuesto para la sala de música",
  "Quiero analizar el valor de la música en el currículo",
  "Sugiere mejoras para la sala de música",
  "Dame una propuesta de equipamiento musical para el aula",
  "Planifiquemos la infraestructura de una sala de música y su acústica",
  "Mejoremos el mobiliario del departamento de música",
]

const genuineMusicRequests = [
  "Recomiéndame música para estudiar",
  "Dame una playlist lo-fi para concentrarme",
  "Pon música instrumental mientras trabajo",
  "Quiero escuchar canciones relajantes",
  "¿Qué música me recomiendas para descansar?",
  "Necesito música de fondo",
  "Busco una playlist para estudiar",
  "Reproduce una canción tranquila",
  "Estudiar con música",
  "Sugiéreme una playlist para concentrarme",
  "Recomienda canciones para una clase",
  "Estamos planificando la sala de música: recomiéndame canciones para ambientarla",
  "Reproduce lo-fi durante veinte minutos",
  "Me gustaría música para estudiar",
  "Busco música instrumental",
]

for (const input of nonMusicalRequests) {
  assert.equal(isMusicListeningRequest(input), false, `No era una petición musical: ${input}`)
  assert.notEqual(detectToolFromMessage(input), "recommend_focus_music", `Herramienta musical incorrecta para: ${input}`)
}

for (const input of genuineMusicRequests) {
  assert.equal(isMusicListeningRequest(input), true, `La intención musical no se detectó: ${input}`)
  assert.equal(detectToolFromMessage(input), "recommend_focus_music", `No se activó Música: ${input}`)
}

console.log(`[claw-intent] ${nonMusicalRequests.length} solicitudes NO musicales y ${genuineMusicRequests.length} musicales verificadas`)
