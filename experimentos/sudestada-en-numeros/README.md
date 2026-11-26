# La sudestada en números

Simulador de juguete del Río de la Plata: se mueve el viento, la marea y la descarga de los ríos y se ve cómo sube el nivel
en Tigre, San Fernando, el Riachuelo y La Plata, y cuánta agua entra a una casa sobre pilotes como la de Martín, de la novela
[Sudestada](../../escritos/sudestada/). Pedido: https://github.com/fnguerrero/working-folder-auto/issues/17

**Ver:** https://fnguerrero.github.io/working-folder-auto/experimentos/sudestada-en-numeros/

**Estado:** en curso (2026-11-25). Se puede usar entero; la validación contra datos publicados es floja (ver abajo).

**No sirve para decidir nada.** Ante una crecida valen los avisos del Servicio de Hidrografía Naval, el SMN y Prefectura.

## Qué hay

- Mapa esquemático animado, rosa de vientos, reloj y corte longitudinal.
- Curvas en los cuatro puntos, con viento y con marea sola.
- La casa sobre pilotes (1,80 m, de la novela; la altura del terreno es inventada).
- Cuatro casos históricos (1989, 2013, 2014, 2023) con el dato publicado al lado del modelo, y un cálculo inverso
  («cuánto viento haría falta»).
- `logica.js` (modelo, sin dependencias), `casos.js` (datos y fuentes), `index.html` (interfaz). Abre también como archivo local.

## El modelo

Aguas poco profundas en una dimensión, 320 km de Punta Rasa a la cabecera, 80 tramos, paso de 120 s, esquema escalonado
adelante-atrás con fricción semi-implícita. No incluye la advección de cantidad de movimiento.

| Parámetro | Valor | De dónde sale |
|---|---|---|
| Largo y anchos | 320 km; 220 km en la boca a 12 km | Redondeo propio; largo y boca comparables con Wikipedia (325 km, 219 km) |
| Profundidades | 15 m a 4,5 m | Supuestas (Wikipedia da media 13 m, mínima 0,6 m, máxima 25 m) |
| Arrastre del viento | tipo Wu (1982), tope 0,0028 | Fórmula conocida, citada de memoria: no se abrió la publicación |
| Fricción de fondo | 0,0022 | Supuesta |
| Respuesta del océano en la boca | 0,8 m/Pa, 9 h de demora, máximo con viento de 150° | Supuesta por completo |
| Marea en la boca | 0,28 m semidiurna más 25 % diurna | Ajustada para que Buenos Aires quede en el rango habitual publicado (0,30 a 1,29 m, Es Nota) |
| Cero | 0,55 m más el efecto del caudal | Ajustado por lo mismo |

Los parámetros de viento, océano y fricción se fijaron antes de comparar con los casos y no se retocaron para acercarlos.
Sí se ajustaron la marea y el cero (con el rango habitual).

## Comparación con lo publicado

Viento supuesto en 1989, 2014 y 2023. El rango sale de mover la hora de la pleamar, que no está cargada.

| Caso y lugar | Publicado | Modelo |
|---|---|---|
| 1989, Buenos Aires | 4,06 / 4,07 m | 4,29 a 4,55 m |
| 2013, Bernal | 2,91 m | 1,10 m (falla) |
| 2014, San Fernando | más de 3,40 m | 2,76 a 2,96 m |
| 2014, Aeroparque (contra Riachuelo) | 3,20 m | 2,59 a 2,76 m |
| 2014, Tigre | 2,80 m | 2,82 a 3,03 m |
| 2023, Buenos Aires | 3,62 m | 2,97 a 3,12 m |
| 2023, San Fernando | 3,60 m | 3,18 a 3,36 m |
| 2023, La Plata | 3,50 m | 2,43 a 2,57 m |

Cómo leerlo:

- Donde el viento es supuesto, la coincidencia de orden de magnitud **no valida** el modelo: 5 km/h cambian el pico cerca de medio metro.
- En 2013, con el viento medido en la costa de Bernal (flojo, del sur y sudoeste), el modelo casi no sube. Es la única prueba con
  viento publicado y la reprueba. Hipótesis (no probada): el forzante venía de la plataforma y del estuario exterior, y el nivel ya
  estaba alto al empezar la ventana.
- Con vientos muy fuertes sostenidos exagera (a 90 km/h pasa los 7 m): no hay llanura de inundación que reciba el agua.
- Cada mareógrafo tiene su cero; el modelo usa uno solo.

## Fuentes abiertas y usadas

- D'Onofrio, Fiore y Pousa (2008), J. Coastal Research 24(1A): 1989, 4,06 m y temporal del sudeste.
  https://api.naturalis.fcnym.unlp.edu.ar/server/api/core/bitstreams/7d262cd0-f66a-4ed4-aa6a-45447d42f505/content
- Falco y otros, «Anticipando la crecida, segundo capítulo» (IFRH 2014): tabla de crecidas (1989: 4,07 m), nivel crítico de
  2,5 m, y gráficos de septiembre de 2013. https://www.ina.gob.ar/ifrh-2014/Eje3/3.36.pdf
- La Nación, 2/11/2014. https://www.lanacion.com.ar/buenos-aires/el-rio-de-la-plata-crecio-hasta-los-340-metros-por-una-sudestada-nid1740677/
- Infobae, 19/12/2023. https://www.infobae.com/america/medio-ambiente/2023/12/19/la-mayor-sudestada-en-los-ultimos-13-anos-provoco-que-el-rio-de-la-plata-llegara-a-los-362-metros/
- Es Nota, 19/12/2023. https://www.esnotadiario.com/2023/12/19/en-una-crecida-record-por-la-sudestada-el-rio-de-la-plata-llego-a-los-362-metros-de-altura/
- Santamaría-Aguilar y otros (2017), Frontiers in Marine Science 4:380 (contexto de marea y caudal).
  https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2017.00380/pdf
- Wikipedia, Río de la Plata (dimensiones). https://es.wikipedia.org/wiki/R%C3%ADo_de_la_Plata

La serie de 2013 (nivel, intensidad y dirección) se leyó de los píxeles de la figura de Falco y otros: error estimado de unos
3 km/h y 0,05 m; la dirección es la de cada punto dibujado y es muy ruidosa. Los 3,0 m de Buenos Aires y los 3,1 m del alerta del
SHN se leyeron a ojo de otra figura del mismo trabajo. Las cifras de La Nación e Infobae se leyeron mediante una herramienta que
resume la página: conviene un cotejo a ojo.

## Cómo se prueba

```bash
node --test
```

desde esta carpeta (16 pruebas: reposo, conservación de masa, pendiente de equilibrio analítica, celeridad de onda larga,
estabilidad en los extremos, convergencia de malla, sentido físico y casos). La interfaz se revisó en Edge headless a 360 px y
1366 px: sin errores de consola ni desborde horizontal.

## Qué quedó afuera

- Validación en serio: falta viento sobre el estuario (reanálisis tipo ERA5) y series horarias de nivel del SHN o del INA, para
  forzar 1989, 2014 y 2023 con datos y calibrar con unos casos y probar con otros.
- Duración e intensidad publicadas del viento en 1989, 2014 y 2023; la de 1940 (4,44 m) no se cargó por no tener viento.
- Partes de Prefectura y alertas originales del SHN: no se abrió ninguno directamente.
- Borde oceánico basado en datos, dos dimensiones, Coriolis, Delta ramificado, lluvia y presión.
- Probar en un celular real (táctil) y revisar la geografía del mapa con alguien que conozca el río.
