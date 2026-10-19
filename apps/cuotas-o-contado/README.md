# ¿Cuotas o contado?

La cuenta argentina de siempre. Ponés el precio de contado (con el descuento, si te lo hacen) y el plan de
cuotas (valor de la cuota o total financiado, cuántas, si la primera es hoy o a los 30 días con la tarjeta),
elegís qué harías con la plata del contado y te dice:

- **La tasa escondida en las cuotas:** la TEM que hace que las cuotas traídas a hoy valgan lo mismo que el
  contado (y su TNA y TEA). «12 cuotas sin interés» con 10 % de descuento por pagar contado esconden una TNA
  del 20 %: lo mismo que paga un plazo fijo.
- **Las cuotas en plata de hoy:** cada cuota descontada por la inflación esperada.
- **Si ponés la plata a rendir:** simulación mes a mes de no pagar contado, poner esa plata al plazo fijo o
  FCI y pagar cada cuota de ahí: cuánto te sobra (o te falta) al final.
- **El veredicto** («Conviene en cuotas», «Conviene contado», «Da lo mismo») según la situación: la plata la
  tengo y la pongo a rendir (se compara contra la tasa), la tengo pero queda quieta (peso contra peso), o
  no la tengo y pago cada cuota con el sueldo (se compara contra la inflación). Con la cuota de equilibrio
  y el contado que daría vuelta el resultado, la tabla con las tres miradas, y cuota por cuota.

**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/cuotas-o-contado/

**Estado:** terminado.

## Supuestos por defecto

Inflación mensual 1,9 % (INDEC, septiembre de 2026) y TNA 20 % (plazo fijo a 30 días en octubre de 2026,
entre 16 y 23 % según el banco). Los dos se cambian en la página y quedan guardados en el navegador. La TNA
se pasa a tasa de 30 días como la liquida un plazo fijo (TNA × 30 / 365). No entran impuestos, costos de la
tarjeta ni el riesgo de que las tasas o la inflación cambien en el camino; la página lo dice.

## Cómo se prueba

```bash
node --test apps/cuotas-o-contado/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' apps/cuotas-o-contado/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node apps/cuotas-o-contado/tests/e2e.js          # Chromium headless a 360×740 y 1280×720
```

Diez tests de la cuenta (conversión de tasas, valor presente, tasa implícita con casos conocidos y sin
solución, simulación de la inversión contra la fórmula cerrada, las tres situaciones, cuota de equilibrio,
veredicto y formato) y un e2e que recorre el veredicto por defecto, las tres situaciones, el modo «total
financiado», los atajos de cuotas, la primera cuota hoy, que todo se guarda al recargar y que no hay
pedidos a otros dominios. `localStorage` va dentro de try/catch.
