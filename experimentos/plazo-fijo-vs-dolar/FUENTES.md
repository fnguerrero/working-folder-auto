# Fuentes

Todo se leyó el **2026-11-26** en publicaciones oficiales, con una herramienta de lectura web que devuelve el contenido convertido a texto. No se bajaron las planillas: los valores se **transcribieron** a los CSV (redondeados a 4 decimales en tasa y dólar), y por eso están los cotejos de más abajo.

## Series que usa la página

| Archivo | Qué es | Cobertura | Origen |
|---|---|---|---|
| `datos/plazo_fijo.csv` | Tasa de plazo fijo de 30 a 59 días, % nominal anual, promedio mensual (BCRA) | 2004-01 a 2026-09 | [datos.gob.ar, serie `89.1_TIPF35D_0_0_35`](https://apis.datos.gob.ar/series/api/series/?ids=89.1_TIPF35D_0_0_35&start_date=2004-01-01&format=json) |
| `datos/dolar.csv` (`oficial`) | Dólar mayorista de referencia, Com. "A" 3500 (BCRA), promedio mensual | 2004-01 a 2026-09 | [datos.gob.ar, serie `168.1_T_CAMBI500_D_0_0_17`](https://apis.datos.gob.ar/series/api/series/?ids=168.1_T_CAMBI500_D_0_0_17&collapse=month&collapse_aggregation=avg&start_date=2004-01-01&format=json) |
| `datos/inflacion_indec.csv` | Inflación mensual que publica el BCRA (cifras del INDEC), % con un decimal | 2004-01 a 2026-10 | [API BCRA v4.0, variable 27](https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/27?desde=2004-01-01&hasta=2026-10-31&limit=400) |
| `datos/ipc_caba.csv` | IPC Ciudad de Buenos Aires, nivel general (índice), IDECBA | 2012-07 a 2016-12 | [datos.gob.ar, serie `193.1_NIVEL_GENERAL_JULI_0_13`](https://apis.datos.gob.ar/series/api/series/?ids=193.1_NIVEL_GENERAL_JULI_0_13&end_date=2016-12-31&limit=60&format=json) |
| `datos/ipc_nacional.csv` | IPC nacional, nivel general, base dic-2016 = 100, INDEC | 2016-12 a 2026-10 | [datos.gob.ar, serie `148.3_INIVELNAL_DICI_M_26`](https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=2016-12-01&limit=200&format=json) |

La metadata de la serie `89.1` no aclara la moneda; se toma como pesos porque de 2004 a mediados de 2009 coincide exactamente con la serie `174.1_T_INTERD_0_0_41`, que sí dice "de moneda nacional".

## Cómo se arma la inflación "de referencia"

| Tramo | Se usa |
|---|---|
| 2004-01 a 2006-12 | INDEC (`inflacion_indec.csv`) |
| **2007-01 a 2012-07** | **Nada: hueco** |
| 2012-08 a 2016-12 | IPC CABA (variación calculada desde el índice) |
| 2017-01 en adelante | IPC nacional INDEC |

El hueco **no se rellenó**. La otra opción de la página, "INDEC oficial completa", usa `inflacion_indec.csv` de punta a punta, incluidos 2007-2015, años en que esas cifras fueron muy cuestionadas por subestimar la inflación. Es una opción explícita y con aviso.

## Lo que falta

1. **Dólar blue (todo el período).** No se encontró una publicación oficial. El issue sugiere Ámbito, que es una fuente privada y quedó fuera de esta tanda.
2. **Inflación alternativa 2007-01 a 2012-07.** La candidata es el IPC de la provincia de San Luis, que su [Dirección de Estadística](https://estadistica.sanluis.gov.ar/Categorias/economia/precios/ipc-sanluis) publica en informes PDF. En esa página solo se vieron enlazados informes de 2016 en adelante. Hace falta la serie mensual 2007-2012 (variación % del nivel general).
3. **Octubre de 2026** en tasa y dólar: las series mensuales usadas llegaban hasta septiembre.

Para cargar 1 y 2 desde la página: CSV con `mes,dolar_blue,inflacion_alt_pct` (ver `datos/ejemplo-INVENTADO.csv`, cuyos valores **son inventados**).

## Cotejos (se repiten con `node --test`)

| Qué | Contra qué | Resultado |
|---|---|---|
| Dólar, 273 meses | [serie `175.1_DR_REFE500_0_0_25`](https://apis.datos.gob.ar/series/api/series/?ids=175.1_DR_REFE500_0_0_25&collapse=month&collapse_aggregation=avg&start_date=2004-01-01&format=json) | Diferencia máxima 0,33 % (2008-10); le siguen 2012-06 (0,17 %), 2016-11 y 2006-05 (menos de 0,1 %). El resto coincide salvo redondeo |
| Dólar, enero 2014 (más el cierre del 2013-12-30) y septiembre 2026 | [API BCRA, variable 5](https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/5?desde=2026-09-01&hasta=2026-09-30), diaria | El promedio **por día corrido** (fines de semana repiten el viernes) reproduce la serie mensual. El promedio solo de días hábiles da 0,6 % más en enero 2014 |
| Tasa, 268 meses | [serie `174.1_T_INTERD_0_0_41`](https://apis.datos.gob.ar/series/api/series/?ids=174.1_T_INTERD_0_0_41&start_date=2004-01-01&limit=300&format=json) | Iguales hasta 2009-06. Después difieren: máximo 8,4 % relativo (2011-11). Son dos compilaciones; con cualquiera de las dos, el ganador de las ventanas de 12 meses comparables (256) es el mismo |
| Tasa, enero 2014 y septiembre 2026 | [API BCRA, variable 12](https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/12?desde=2026-09-01&hasta=2026-09-30) (depósitos a 30 días, otra definición) | A menos de 5 % (2 % y 4,1 %) |
| INDEC 2004-2006 | [serie `96.3_INGV_2008_M_20`](https://apis.datos.gob.ar/series/api/series/?ids=96.3_INGV_2008_M_20&start_date=2004-01-01&end_date=2006-12-31&format=json) | Coinciden al redondeo de un decimal |
| IPC CABA | La misma serie pedida como variación porcentual | Coinciden. Detecta errores de transcripción, no es una segunda fuente |
| IPC nacional 2017-2026 | API BCRA, variable 27 | Coinciden al redondeo salvo **2017-01 (1,59 vs 1,3), 02 (2,07 vs 2,5), 04 (2,66 vs 2,6) y 05 (1,43 vs 1,3)**. La causa no se verificó; la referencia usa el índice nacional |

**Sin segunda fuente:** IPC CABA (solo control interno) e inflación del BCRA 2007-2016, incluidos noviembre 2015 a abril 2016.

## Agregar meses

Bajar a mano el CSV de la fuente y correr, desde esta carpeta:

```
node actualizar.js dolar "ruta/al/archivo.csv" --columna nombre_de_columna --diario --fuente "URL y fecha"
node actualizar.js plazo_fijo "ruta/al/archivo.csv" --columna nombre_de_columna --fuente "URL y fecha"
node actualizar.js ipc_nacional "ruta/al/archivo.csv" --columna nombre_de_columna --fuente "URL y fecha"
node --test
```

No pisa meses existentes sin `--pisar` y no acepta dejar huecos. Los tests que comparan cifras del análisis siguen valiendo para los meses viejos; si se agregan meses, hay que actualizar la cantidad de ventanas en el test y en `ANALISIS.md`.
