"""Hand-authored transfer tests, never training examples. Exact references are auditable."""
import json

def cases():
    examples=[
      ('fraction-half','¿Cuál es la mitad de tres cuartos? Devuelve solo JSON con resultado como fracción irreducible.','3/8'),
      ('fraction-sum','Calcula un medio más un tercio. Devuelve solo JSON con resultado como fracción irreducible.','5/6'),
      ('percent','Calcula el 15 por ciento de 240. Devuelve solo JSON con resultado numérico.',36),
      ('percent-discount','Un material cuesta 800 y tiene un descuento del 25 por ciento. ¿Cuál es el precio final? Devuelve solo JSON con resultado numérico.',600),
      ('probability','Se extrae al azar una ficha de una bolsa con 3 fichas rojas y 2 azules. ¿Probabilidad de roja? Devuelve solo JSON con resultado como fracción irreducible.','3/5'),
      ('order','Calcula 2 + 3 * 4 respetando la prioridad de operaciones. Devuelve solo JSON con resultado numérico.',14),
      ('negative','Una temperatura pasa de -3 grados a 5 grados. ¿Cuánto aumentó? Devuelve solo JSON con resultado numérico.',8),
      ('ratio','Si cuatro paquetes contienen veinte tarjetas en total, ¿cuántas tarjetas contienen siete paquetes iguales? Devuelve solo JSON con resultado numérico.',35),
      ('mean','Calcula el promedio de 4, 8 y 12. Devuelve solo JSON con resultado numérico.',8),
      ('equation-both','Resuelve 3x + 4 = x + 12. Devuelve solo JSON con resultado numérico para x.',4),
      ('squared','Un cuadrado tiene lado 7. ¿Cuál es su área? Devuelve solo JSON con resultado numérico.',49),
      ('zero-division','¿Cuánto es 12 dividido por cero? Devuelve solo JSON con resultado igual a null si no está definido.',None),
      ('dice-independence','En dos lanzamientos independientes de un dado justo, ¿cuál es la probabilidad de obtener 6 en ambos? Devuelve solo JSON con resultado como fracción irreducible.','1/36'),
      ('linear-sequence','La secuencia aumenta de tres en tres: 2, 5, 8. ¿Qué número sigue? Devuelve solo JSON con resultado numérico.',11),
      ('unit-conversion','Convierte dos horas y media a minutos. Devuelve solo JSON con resultado numérico.',150)
    ]
    rows=[]
    for name,prompt,value in examples:
        expected={'resultado':value}
        rows.append({'id':'challenge-'+name,'family':'authored-transfer:mathematics','category':'transfer_math','origin':'authored_reference','verification':'manual_arithmetic_reference',
                     'messages':[{'role':'system','content':'Eres EDUAI. Resuelve el problema y cumple el formato solicitado.'},{'role':'user','content':prompt},{'role':'assistant','content':json.dumps(expected,ensure_ascii=False)}],
                     'expected':{'kind':'json','value':expected}})
    return rows
