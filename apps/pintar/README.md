# Para pintar

Cargás los ambientes (largo, ancho, alto, cuántas puertas y ventanas, y qué se hace: repintar sobre color claro u
oscuro, revoque nuevo, techo, exterior, carpintería, zócalo, piso nuevo) y te dice **qué comprar**: litros de látex
interior y exterior, cielorraso, fijador, enduido y esmalte sintético, con un 10 % de margen y **en qué latas
conviene** (elige la combinación más barata con el precio por litro típico de cada envase: a veces conviene la de
20 L aunque hagan falta 17); el piso en cajas con el desperdicio (10 %, 15 % en diagonal), el pegamento en bolsas y
la pastina por la junta; los metros de zócalo; rodillos, pinceles, cinta de papel, bandeja, lija, polietileno y
aguarrás. Ponés los precios de tu pinturería (quedan guardados) y ves **cuánto sale**, copiás la lista para mandarla
al grupo, y te dice **cuánto tiempo lleva** (horas y jornadas de 6 h para una persona, sin contar el secado) y **en
qué orden** se hace (piso, enduido y fijador, techo, paredes, carpintería, la cinta). Tres modelos para arrancar:
monoambiente, depto de 2 ambientes, casa de 3 dormitorios con frente exterior.

**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/pintar/

**Estado:** terminado.

## De dónde salen los números

Paredes: perímetro × alto menos puertas (0,80 × 2,05 m) y ventanas (1,20 × 1,10 m); con ancho 0 es una sola pared
(un frente, una medianera). Carpintería: 4 m² por puerta y 2 m² por ventana (las dos caras y el marco). Litros = m²
× manos ÷ rendimiento: látex interior 10 m²/L por mano, exterior 8, cielorraso 10, fijador 12, sintético 12; dos
manos sobre color claro, tres sobre oscuro, revoque nuevo lleva enduido (1 kg/m² en dos capas finas), fijador y dos
manos. Piso: pegamento 4 kg/m² (cerámico) o 5 (porcelanato) en bolsas de 30 kg; pastina = metros de junta por m²
× junta × espesor × 1,7 kg/dm³ más 15 % (unos 0,2 kg/m² con piezas de 45 × 45 y junta de 3 mm). Zócalo: perímetro
menos puertas, más 5 %. Tiempo: 12 m²/h por mano con rodillo (el techo un 30 % más lento), 4 m²/h a pincel, 2 m²/h
colocando piso. Todo editable en «Supuestos». Son los rendimientos que dicen las latas argentinas y las cuentas de
costumbre, pensadas para no quedarse corto.

## Cómo se prueba

```bash
node --test apps/pintar/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' apps/pintar/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node apps/pintar/tests/e2e.js          # Chromium headless a 360×740 y 1280×800
```

Seis tests de la lógica (superficies con aberturas y pared única, manos y rendimientos por estado, revoque nuevo,
sintético por abertura, piso con desperdicio, cajas, pegamento, pastina y separadores, zócalo, la elección de latas
para 90 cantidades distintas, la lista completa con precios, horas y jornadas, el orden de trabajo y la lista en
texto) y un e2e que recorre el modelo por defecto, cambiar un ambiente a revoque nuevo con sintético, piso nuevo,
precios con subtotal y total, un supuesto, agregar, renombrar, duplicar y quitar ambientes, copiar la lista, la
memoria al recargar y el modelo de la casa con frente exterior. `localStorage` va dentro de try/catch. No se pudo
probar contra una pinturería de verdad: los precios relativos de las latas son los típicos, y si tu pinturería
tiene otros, la lata grande puede no convenir.
