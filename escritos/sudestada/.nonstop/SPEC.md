# Sudestada — SPEC

Pedido: issue #14 (`noche`, `grande`). Novela corta de suspenso psicológico, original, en castellano, publicada para leer desde la vitrina.

## Objetivo

Una novela corta de 35.000 a 45.000 palabras en 18 capítulos, con tensión que crece, información dosificada y un giro final sembrado en capítulos anteriores. Lector web por capítulos, versión completa descargable (HTML para imprimir y EPUB), y verificación automática de que cada pista aparece en el capítulo que indica la escaleta.

## Premisa

Verónica Aldao (44) es perita calígrafa en Tribunales: vive de decir si una firma es de quien dice ser. Un martes a la noche su hermano Martín (38), que vive solo en la casa familiar de una isla del Delta del Tigre, la llama: «Necesito que vengas. No por teléfono». Cuando Verónica llega el jueves, la lancha de Martín no está, la puerta está abierta y en la cocina hay una mujer que dice ser su pareja desde hace cuatro meses. Verónica nunca oyó hablar de ella. Esa noche entra la sudestada: el río sube, no sale ninguna lancha, el teléfono no toma señal, y las dos mujeres quedan encerradas en una casa sobre pilotes con el agua subiendo por la escalera, cada una convencida de que la otra es la que le hizo algo a Martín.

Es una novela sobre leer: Verónica lee documentos, trazos, presiones del lápiz, y cree que leer gente es lo mismo. Lo que no puede leer es su propio lugar en la vida de su hermano.

## Dónde y cuándo, y por qué

**Delta del Tigre, primera sección, un arroyo chico (el arroyo del Fraile, inventado), en octubre, en una sudestada.** Elegido porque:

- Es Argentina de verdad y no de decorado: la lancha colectiva, la escuela de islas, los pilotes, el muelle, la Prefectura, los isleños, los desarrolladores que compran lotes para «barrios náuticos». Todo eso existe y le da peso al conflicto de la venta de la casa.
- La sudestada es un encierro natural y verosímil: el viento del sudeste frena el desagüe del Río de la Plata, el agua sube uno o dos metros en horas, las lanchas no salen, se corta la señal y la luz. Sirve para la unidad de lugar y tiempo del thriller (cuatro días, una casa) sin recurrir a un «hotel en la montaña».
- El agua es amenaza física real, no metafórica: la corriente, los troncos que bajan, el frío. Las dos escenas de peligro físico pasan en el río.
- Octubre: la primavera trae sudestadas y es creíble que haya un plazo legal (la escritura) entre medio.
- No se nombra el año. Los días de la semana y las fechas internas son coherentes entre sí (el primer sábado de cada mes cae 7/6, 5/7, 2/8, 6/9 y 4/10; el presente va del jueves 9 al domingo 12 de octubre, con epílogo el martes 14).

## Voz y forma

- Primera persona, Verónica, pasado, salvo el último capítulo en presente. Narradora **confiable en los hechos y poco confiable sobre sí misma**: no miente nunca; no se ve.
- Prosa literaria, concreta, con escenas y diálogo. Habla rioplatense creíble: voseo, «che» con medida, isleños que hablan como isleños, una maestra de Zárate, un desarrollador de Tigre con camisa náutica.
- Alternancia de tensión y respiro: cada capítulo de peligro va seguido de uno de conversación, recuerdo o trabajo con las manos.
- Cada capítulo lleva número y título, y debajo el día y la hora en que arranca.
- Diálogos con raya (—), comillas latinas (« ») para citas dentro del texto, sin comillas inglesas.

## Estructura del giro

Hay dos giros, uno a mitad y otro al final, y el del final resignifica todo lo leído:

1. **Mitad (cap. 7):** en el taller aparece un boleto de compraventa de la isla con la firma de Verónica. Ella no firmó nunca. Alguien que le conoce la mano la falsificó. Verónica decide que fue Ana, y la novela se vuelve «dos mujeres encerradas y una de ellas falsificó y quizás mató».
2. **Final (cap. 14 a 16):** la falsificó Martín, el hermano al que ella le enseñó a firmar; Martín no está muerto, está escondido a trescientos metros, en el galpón de Elías, sin poder cruzar a enfrentarla; y «ella», la mujer de la que Martín escribe con miedo en sus libretas, no es Ana: es Verónica. Cada entrada con «ella» está fechada en los días en que Verónica lo visitaba (el primer sábado de cada mes), y habla de «la bolsa», de «las pastillas contadas» y de «no dejarme ir».

Nada de esto se oculta con trampa: Verónica lee las libretas delante del lector y las fecha; cuenta que visita el primer sábado de cada mes; cuenta que le lleva las pastillas; nota que la firma falsa tiene «el arrastre de un zurdo» y que Martín es zurdo; ve a Ana cortar el pan con la derecha. Todo lo que hace falta para adelantarse está en el texto. La lista completa, con capítulo de siembra y de resolución, está en `PISTAS.md` y en `pistas.json` (verificado por `tests/pistas.test.js`).

## Criterios de terminado (verificables)

- [ ] 18 capítulos completos en `capitulos/NN.md`; `node tests/palabras.test.js` informa un total entre 35.000 y 45.000 palabras.
- [ ] `index.html` (lector): índice con sinopsis, anterior/siguiente, recuerda capítulo y posición (localStorage con try/catch), tema oscuro (sistema y botón), tamaño de letra, cómodo a 360 px, sin dependencias. E2e con Playwright a 360 y 1280 px en `tests/lector.e2e.js`.
- [ ] `sudestada.html` (novela entera, para imprimir, con saltos de página) y `sudestada.epub` (EPUB 3, válido estructuralmente) generados por `build.js` y `epub.py`.
- [ ] `node tests/pistas.test.js` pasa: cada pista de `pistas.json` aparece textual en el capítulo que indica.
- [ ] Pasada de continuidad final: nombres, fechas, quién sabe qué y cuándo (`CONTINUIDAD.md` con la tabla de conocimiento por capítulo).
- [ ] Entrada en `proyectos.json` con sinopsis sin spoilers, README del proyecto, tabla del README raíz, bitácora.

## Decisiones técnicas

- Los capítulos se escriben en Markdown mínimo (`#` título, `*cursiva*`, `---` separador de escena, párrafos) y `build.js` (Node, sin dependencias) genera `index.html` con los capítulos embebidos (así anda abierto en local y en Pages), `sudestada.html` y los archivos del EPUB; `epub.py` (Python, solo stdlib) arma el `.epub`.
- El lector usa el hash (`#cap-3`) para la navegación, guarda `{capitulo, scroll}` en `localStorage` dentro de try/catch.
- Sin fuentes externas: serif del sistema (Georgia / Noto Serif).

## Supuestos (decisiones tomadas sin preguntar)

- Título: **Sudestada**. Slug: `sudestada`.
- 18 capítulos de 2.000 a 2.600 palabras. Último capítulo en presente, más corto.
- Narradora en primera persona, poco confiable sobre sí misma, no sobre los hechos. El pedido lo dejaba como opción.
- El año no se nombra. Las fechas internas son coherentes (ver arriba).
- Lo legal es verosímil sin ser un manual: un boleto de compraventa es un instrumento privado, la seña se devuelve doble si el vendedor se arrepiente (arras), la escritura exige que los dos condóminos firmen ante escribano, y falsificar la firma de la hermana en un boleto es falsificación de instrumento privado. No se entra en artículos del Código.
- El Delta se describe con nombres reales de lugares grandes (Tigre, estación fluvial, río Sarmiento, Paraná de las Palmas, Villa Paranacito) y un arroyo inventado para la casa, así no hay errores de geografía fina.
- Marcas y remedios: se nombra «clonazepam» y no una marca comercial; no se nombran marcas de lanchas ni de motores salvo genéricos.
- Versión descargable: las dos (HTML para imprimir y EPUB), ya que las dos salen del mismo build.
