# Plazo fijo, dólar o inflación

Comparador histórico argentino: "si en tal mes ponía $100.000 en plazo fijo, en dólares o en nada, ¿cuánto tenía en tal otro mes?". Sale del [issue #6](https://github.com/fnguerrero/working-folder-auto/issues/6). **No es asesoramiento financiero.**

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/plazo-fijo-vs-dolar/ (o abrir `index.html` en local).

## Estado: en curso

Funciona con datos oficiales de 2004-01 a 2026-09. Falta:

- Dólar blue (sin publicación oficial).
- Inflación alternativa 2007-01 a 2012-07 (la candidata es el IPC de San Luis).

Las dos se pueden cargar en la página con un CSV propio. Detalle en [FUENTES.md](FUENTES.md).

## Qué tiene

- Simulador: mes de entrada y salida, monto, tres modos de plazo fijo, mezcla, pesos nominales y de hoy.
- Gráfico SVG de las curvas (lineal o logarítmico, con puntero o teclado).
- Ventanas de 1 mes a 10 años: quién ganó, cuántas veces, por década y en qué tandas.
- [ANALISIS.md](ANALISIS.md).

## Archivos

| Archivo | Qué es |
|---|---|
| `datos/*.csv` | Series, una fila por mes con su fuente |
| `datos/cotejo/` | Segundas lecturas para controlar la transcripción |
| `datos/ejemplo-INVENTADO.csv` | Formato de carga. **Valores inventados** |
| `lib.js` | Las cuentas (navegador y Node) |
| `actualizar.js` | Agrega meses desde un CSV de la fuente y regenera `datos.js` |
| `datos.js` | Generado: permite abrir la página sin servidor |

## Cómo se calcula

- Plazo fijo: cada mes rinde TNA promedio × 30/365. Entrando en X y saliendo en Y se aplican las tasas de X a Y−1.
- Dólar: se compra al promedio del mes de entrada y se valúa al promedio del mes de salida.
- Pesos de hoy: resultado × inflación desde el mes de salida hasta el último mes cargado.
- Contra la inflación: se compara con la acumulada entre entrada y salida. Si falta un mes, no se calcula.
- Ventanas: gana quien termina con más pesos; el margen es contra el segundo.

## Pruebas

```
node --test
```

Cubren las cuentas, la carga de CSV, `actualizar.js`, la integridad de las series y los cotejos.

Probado además en Edge sin ventana a 360 px y 1280 px.

## No probado

- En un celular real ni en otros navegadores.
- Con lector de pantalla.
- `actualizar.js` con archivos reales bajados de las fuentes (solo con casos armados).
- La página publicada en GitHub Pages.
