# La tormenta de reintentos

Un simulador de resiliencia: 200 pedidos por segundo contra un servicio que tiene un incidente, con la
política de reintentos, timeout y circuit breaker que elijas. Muestra cuánta carga extra le cae al
servicio, cuántos pedidos salen bien, p50 y p99, cuánto tarda en recuperarse y cuánto trabajo se tira,
lo compara contra tres políticas fijas y arma el código de `Microsoft.Extensions.Http.Resilience`.
Todo corre en el navegador, sin dependencias.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/tormenta-de-reintentos/

**Estado:** terminado (issue #11).

## Qué hay

- Tres incidentes de un toque (caída de 15 s, servicio lento, fallas sueltas) y tres políticas
  (sin reintentos, reintentos ingenuos, backoff + jitter + breaker). Todo lo demás se puede tocar.
- Gráficos de intentos por segundo, resultado de los pedidos y p99, con el incidente sombreado.
- Diagnóstico en criollo, tabla comparativa con el mismo tráfico, "Otra tirada" y link con el escenario.

## Cómo se prueba

```
node --test tests/logica.test.js
```

15 tests: casos conocidos (sin fallas no hay reintentos; con todo fallando hay 1 + N intentos), backoff
exponencial contra fijo, breaker (abre, prueba, cierra y reabre), mismo tráfico entre políticas y snippet.

La página se miró en un navegador a 360 px y en escritorio, sin errores de consola.

## Qué no se probó

- El snippet de C# no se compiló.
- No hay prueba de extremo a extremo automatizada.
- Celular real, Safari y Firefox.
- El modelo no se contrastó contra mediciones de Polly: sirve para comparar políticas, no para predecir
  un sistema real. El jitter es "full jitter", distinto del de Polly.
