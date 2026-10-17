# Asado para cuántos

Decís cuántos vienen (adultos, comilones, chicos, vegetarianos), qué va a la parrilla (cortes, achuras,
provoleta), qué se toma, si es a carbón o a leña y si la juntada es corta, normal o larga, y te dice
**cuánto comprar** de cada cosa (carne por corte, chorizos y morcillas por unidad, pan, ensaladas, verduras
para los vegetarianos, bebidas redondeadas al envase, hielo, carbón), **a qué hora prender y en qué orden
poner cada corte** para que la entrada salga primero y lo principal termine todo junto, la **lista de
compras** para copiar y mandar al grupo, y **cuánto pone cada uno** con los precios de tu carnicería
(se guardan en el navegador).

**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/asado/

**Estado:** terminado.

## De dónde salen los números

450 g de carne por adulto entre cortes y achuras, 650 g por comilón, 250 g por chico; +15 % si es larga,
−10 % si es corta. Un chorizo por adulto (1,5 por comilón, 0,5 por chico), una morcilla cada dos, 80 g de
chinchulines/mollejas/riñón por persona; las achuras se descuentan del total hasta un 40 % y el resto se
reparte en partes iguales entre los cortes (mínimo 500 g por corte; el pollo lleva 25 % más por el
hueso). Provoleta una cada cuatro (una cada dos para vegetarianos, más 400 g de verduras cada uno), pan
1,2 por persona, ensaladas 160 g por persona. Bebidas por adulto: 700 ml de cerveza, 250 ml de vino,
400 ml de gaseosa, 300 ml de agua, 80 ml de fernet; chicos, gaseosa y agua. Carbón 1,1 kg por kilo de
carne (mínimo 3 kg, 45 min antes); leña el doble (60 min antes). Tiempos por corte en `logica.js`
(`CORTES`): la entrada sale cuando está el chorizo (25 min) y lo principal entra escalonado para terminar
junto, nunca antes de 40 minutos después de la entrada. Son las cuentas de costumbre, pensadas para no
quedarse corto.

## Cómo se prueba

```bash
node --test apps/asado/tests/logica.test.js
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' apps/asado/index.html | sed '1d;$d')
node apps/asado/tests/e2e.js          # Chromium headless a 360×740 y 1280×720
```

Ocho tests de la lógica (cantidades por tipo de comensal, duración, reparto entre cortes, bebidas y
envases, leña vs carbón, el plan de la parrilla, la lista en texto y el costo) y un e2e que recorre
contadores, chips, tabla, plan, copiar la lista, precios con total y por persona, y que todo se guarda al
recargar. `localStorage` va dentro de try/catch. No se pudo probar contra un asador de verdad: los tiempos
son orientativos y el que mira la parrilla manda.
