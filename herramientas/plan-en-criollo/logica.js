/* Plan en criollo: lógica pura. Parsea el XML de un plan de ejecución de SQL Server (.sqlplan),
   arma el árbol de operadores, calcula costos y filas, y produce un diagnóstico en castellano.
   Anda en el navegador (window.PlanCriollo) y en Node (module.exports). Sin dependencias. */
(function (raiz, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else raiz.PlanCriollo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* XML mínimo                                                          */
  /* ------------------------------------------------------------------ */

  const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

  function decodificar(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === "#") {
        const cod = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isNaN(cod) ? m : String.fromCodePoint(cod);
      }
      return Object.prototype.hasOwnProperty.call(ENTIDADES, e) ? ENTIDADES[e] : m;
    });
  }

  function sinPrefijo(nombre) {
    const i = nombre.indexOf(":");
    return i >= 0 ? nombre.slice(i + 1) : nombre;
  }

  /** Parsea XML a un árbol { nombre, atributos, hijos, texto }. Tira Error con mensaje en castellano. */
  function parsearXml(texto) {
    if (typeof texto !== "string") throw new Error("No hay nada para analizar.");
    let s = texto.replace(/^﻿/, "");
    const n = s.length;
    const raizDoc = { nombre: "#doc", atributos: {}, hijos: [], texto: "" };
    const pila = [raizDoc];
    let i = 0;
    const error = (msg, pos) => {
      const cerca = s.slice(Math.max(0, pos - 20), pos + 40).replace(/\s+/g, " ");
      throw new Error(`${msg} (cerca de «${cerca}»)`);
    };
    while (i < n) {
      const lt = s.indexOf("<", i);
      if (lt < 0) {
        const resto = s.slice(i);
        if (resto.trim() && pila.length > 1) pila[pila.length - 1].texto += decodificar(resto);
        break;
      }
      if (lt > i && pila.length > 1) {
        const t = s.slice(i, lt);
        if (t.trim()) pila[pila.length - 1].texto += decodificar(t);
      }
      i = lt;
      if (s.startsWith("<?", i)) { const f = s.indexOf("?>", i); if (f < 0) error("Instrucción de procesamiento sin cerrar", i); i = f + 2; continue; }
      if (s.startsWith("<!--", i)) { const f = s.indexOf("-->", i); if (f < 0) error("Comentario sin cerrar", i); i = f + 3; continue; }
      if (s.startsWith("<![CDATA[", i)) { const f = s.indexOf("]]>", i); if (f < 0) error("CDATA sin cerrar", i); if (pila.length > 1) pila[pila.length - 1].texto += s.slice(i + 9, f); i = f + 3; continue; }
      if (s.startsWith("<!", i)) { const f = s.indexOf(">", i); if (f < 0) error("Declaración sin cerrar", i); i = f + 1; continue; }
      if (s.startsWith("</", i)) {
        const f = s.indexOf(">", i);
        if (f < 0) error("Etiqueta de cierre sin «>»", i);
        const nombre = sinPrefijo(s.slice(i + 2, f).trim());
        if (pila.length < 2) error(`Cierre de <${nombre}> sin apertura`, i);
        const abierto = pila.pop();
        if (abierto.nombre !== nombre) error(`Se cierra <${nombre}> pero estaba abierto <${abierto.nombre}>`, i);
        i = f + 1;
        continue;
      }
      // Apertura
      let j = i + 1;
      while (j < n && !/[\s/>]/.test(s[j])) j++;
      const nombre = sinPrefijo(s.slice(i + 1, j));
      if (!nombre) error("Etiqueta sin nombre", i);
      const el = { nombre, atributos: {}, hijos: [], texto: "" };
      // Atributos
      for (;;) {
        while (j < n && /\s/.test(s[j])) j++;
        if (j >= n) error("Etiqueta sin cerrar", i);
        if (s[j] === ">") { j++; pila[pila.length - 1].hijos.push(el); pila.push(el); break; }
        if (s[j] === "/") { if (s[j + 1] !== ">") error("Se esperaba «/>»", j); j += 2; pila[pila.length - 1].hijos.push(el); break; }
        let k = j;
        while (k < n && !/[\s=/>]/.test(s[k])) k++;
        const nombreAttr = sinPrefijo(s.slice(j, k));
        while (k < n && /\s/.test(s[k])) k++;
        if (s[k] !== "=") { el.atributos[nombreAttr] = ""; j = k; continue; }
        k++;
        while (k < n && /\s/.test(s[k])) k++;
        const comilla = s[k];
        if (comilla !== '"' && comilla !== "'") error(`El atributo ${nombreAttr} no tiene el valor entre comillas`, k);
        const fin = s.indexOf(comilla, k + 1);
        if (fin < 0) error(`El atributo ${nombreAttr} no cierra las comillas`, k);
        el.atributos[nombreAttr] = decodificar(s.slice(k + 1, fin));
        j = fin + 1;
      }
      i = j;
    }
    if (pila.length > 1) throw new Error(`El XML termina con <${pila[pila.length - 1].nombre}> sin cerrar. ¿Se cortó al copiar?`);
    return raizDoc;
  }

  const hijo = (el, nombre) => el ? el.hijos.find((h) => h.nombre === nombre) : undefined;
  const hijosDe = (el, nombre) => el ? el.hijos.filter((h) => h.nombre === nombre) : [];
  function buscar(el, nombre) {
    if (!el) return undefined;
    if (el.nombre === nombre) return el;
    for (const h of el.hijos) { const r = buscar(h, nombre); if (r) return r; }
    return undefined;
  }
  function buscarTodos(el, nombre, salida = []) {
    if (!el) return salida;
    if (el.nombre === nombre) salida.push(el);
    for (const h of el.hijos) buscarTodos(h, nombre, salida);
    return salida;
  }
  const num = (v, def = 0) => { if (v === undefined || v === null || v === "") return def; const x = Number(v); return isNaN(x) ? def : x; };
  const bool = (v) => v === "1" || v === "true";

  /* ------------------------------------------------------------------ */
  /* Nombres de columnas y objetos                                       */
  /* ------------------------------------------------------------------ */

  const sinCorchetes = (s) => (s || "").replace(/^\[|\]$/g, "");

  function nombreColumna(cr) {
    const a = cr.atributos;
    const col = sinCorchetes(a.Column || "");
    const tabla = sinCorchetes(a.Alias || a.Table || "");
    return tabla ? `${tabla}.${col}` : col;
  }

  function leerObjeto(obj) {
    if (!obj) return null;
    const a = obj.atributos;
    const o = {
      base: sinCorchetes(a.Database), esquema: sinCorchetes(a.Schema), tabla: sinCorchetes(a.Table),
      indice: sinCorchetes(a.Index), alias: sinCorchetes(a.Alias), tipoIndice: a.IndexKind || "", almacenamiento: a.Storage || "",
    };
    o.esTemporal = /^#/.test(o.tabla); o.esVariable = /^@/.test(o.tabla);
    o.nombre = (o.esquema ? `${o.esquema}.` : "") + o.tabla;
    o.nombreCompleto = o.nombre + (o.indice ? ` (${o.indice})` : "") + (o.alias && o.alias !== o.tabla ? ` como ${o.alias}` : "");
    return o;
  }

  function columnasDe(el, soloDeTablas) {
    return buscarTodos(el, "ColumnReference")
      .filter((cr) => !soloDeTablas || ((cr.atributos.Table || cr.atributos.Alias) && !/^@/.test(cr.atributos.Column || "") && !/^(Expr|Opt_Bitmap|Bmk|Uniq|Chk|Segment|WindowCount|RowNumber|Partition|Union|IsBaseRow|Act)\d*/.test(cr.atributos.Column || "")))
      .map(nombreColumna).filter((c, i, arr) => arr.indexOf(c) === i);
  }
  /** Saca los PROBE([Opt_Bitmap…]) de un predicado: son filtros internos del hash join, no del usuario. */
  function sinBitmap(pred) {
    return (pred || "").replace(/PROBE\(\[Opt_Bitmap\d+\][^)]*\)(\s*AND\s*)?/gi, "").replace(/\s*AND\s*$/i, "").trim();
  }

  /* ------------------------------------------------------------------ */
  /* Operadores: nombres en castellano                                   */
  /* ------------------------------------------------------------------ */

  const OPERADORES = {
    "Clustered Index Seek": ["Búsqueda en índice agrupado", "acceso", "Va directo a las filas que cumplen la condición usando la clave del índice agrupado (la tabla misma, ordenada). Es lo mejor que puede pasar cuando filtrás por la clave."],
    "Index Seek": ["Búsqueda en índice", "acceso", "Va directo al rango de filas que cumple la condición en un índice no agrupado. Si el índice no tiene todas las columnas que pide la consulta, después hace falta un Key Lookup por cada fila."],
    "Clustered Index Scan": ["Recorrido del índice agrupado", "acceso", "Lee la tabla entera (el índice agrupado ES la tabla) y se queda con las filas que cumplen el filtro. Sobre tablas chicas es normal; sobre tablas grandes con un WHERE selectivo, suele faltar un índice."],
    "Index Scan": ["Recorrido de índice", "acceso", "Lee un índice no agrupado completo. Pasa cuando el índice tiene las columnas que hacen falta pero la condición no sirve para buscar (LIKE '%x', función sobre la columna, conversión implícita) o cuando se quiere el orden del índice."],
    "Table Scan": ["Recorrido de tabla (heap)", "acceso", "Lee toda una tabla sin índice agrupado (heap). En tablas grandes casi siempre conviene un índice agrupado o uno sobre las columnas del filtro."],
    "RID Lookup": ["RID Lookup", "acceso", "Por cada fila que encontró un índice, va al heap a buscar el resto de las columnas. Como el Key Lookup, pero sobre una tabla sin índice agrupado."],
    "Columnstore Index Scan": ["Recorrido de índice columnar", "acceso", "Lee un índice columnstore, de a lotes (batch mode). Ideal para agregaciones sobre millones de filas."],
    "Columnstore Index Seek": ["Búsqueda en índice columnar", "acceso", "Busca en un índice columnar usando la eliminación de segmentos."],
    "Nested Loops": ["Bucles anidados", "join", "Por cada fila del lado de arriba (externo) ejecuta el lado de abajo (interno). Barato si el externo tiene pocas filas y el interno es una búsqueda por índice; carísimo si el interno es un recorrido y se repite miles de veces."],
    "Hash Match": ["Coincidencia por hash", "join", "Arma una tabla hash en memoria con un lado y la recorre con el otro. Es el join (o el GROUP BY) elegido para volúmenes grandes sin orden. Necesita memoria: si se la estimó mal, derrama a tempdb (spill)."],
    "Merge Join": ["Merge join", "join", "Une dos entradas que ya vienen ordenadas por la clave de join, leyéndolas a la par. Muy eficiente cuando el orden viene de los índices; si hace falta un Sort antes, el Sort es lo que cuesta."],
    "Adaptive Join": ["Join adaptativo", "join", "Decide en tiempo de ejecución entre hash y bucles anidados según cuántas filas llegan de verdad. Aparece con batch mode (SQL Server 2017+)."],
    "Sort": ["Ordenamiento", "orden", "Ordena las filas (ORDER BY, o para preparar un Merge Join, un DISTINCT, una función de ventana). Necesita memoria proporcional a las filas: si llegan más de las estimadas, derrama a tempdb. Un índice con ese orden lo evita."],
    "Stream Aggregate": ["Agregado por flujo", "agregado", "Calcula COUNT, SUM, MAX, etc. sobre filas que ya vienen ordenadas por la clave de agrupación. Barato."],
    "Compute Scalar": ["Cálculo escalar", "otro", "Calcula expresiones (sumas, concatenaciones, conversiones, funciones). Casi gratis, salvo que llame a una función escalar definida por el usuario: ahí se ejecuta una vez por fila y bloquea el paralelismo."],
    "Filter": ["Filtro", "otro", "Descarta filas que no cumplen una condición que no se pudo aplicar al leer (por ejemplo, un HAVING, o un WHERE sobre una expresión calculada)."],
    "Top": ["Top", "otro", "Devuelve solo las primeras N filas. Con ORDER BY, lo que cuesta es el Sort de antes (o un Top N Sort)."],
    "Parallelism": ["Paralelismo", "paralelo", "Reparte filas entre hilos (Distribute/Repartition Streams) o las vuelve a juntar (Gather Streams). Que haya paralelismo no es malo: significa que la consulta superó el umbral de costo (cost threshold for parallelism)."],
    "Table Spool": ["Spool de tabla", "spool", "Guarda una copia temporal de las filas en tempdb para reutilizarlas (Lazy: a medida que las necesita; Eager: todas de una). En el lado interno de un Nested Loops indica que el optimizador no tenía un índice cómodo."],
    "Index Spool": ["Spool de índice", "spool", "El optimizador se armó un índice temporal en tempdb porque no existía uno adecuado y lo iba a necesitar muchas veces. Es la señal más clara de que falta un índice sobre esas columnas."],
    "Row Count Spool": ["Spool de conteo", "spool", "Guarda solo cuántas filas hay, para EXISTS o NOT EXISTS."],
    "Window Spool": ["Spool de ventana", "spool", "Sostiene las filas de la ventana (OVER ... ROWS BETWEEN) para las funciones de ventana."],
    "Window Aggregate": ["Agregado de ventana", "agregado", "Calcula funciones de ventana (ROW_NUMBER, SUM OVER, LAG) en batch mode, mucho más rápido que Segment + Sequence Project."],
    "Sequence Project": ["Proyección de secuencia", "agregado", "Calcula ROW_NUMBER, RANK, DENSE_RANK y compañía sobre filas ordenadas y segmentadas."],
    "Segment": ["Segmento", "agregado", "Marca dónde empieza cada grupo (PARTITION BY) de una función de ventana."],
    "Constant Scan": ["Lectura de constantes", "otro", "Produce filas que no vienen de ninguna tabla (VALUES, una fila vacía para un INSERT, rangos para un seek)."],
    "Table-valued function": ["Función con valores de tabla", "acceso", "Ejecuta una función que devuelve una tabla (o un CROSS APPLY con OPENJSON, STRING_SPLIT, etc.). Las de varias sentencias (multi-statement TVF) tienen estimaciones fijas (100 filas en 2014+, 1 antes) y suelen errar."],
    "Concatenation": ["Concatenación", "otro", "Junta las filas de varias entradas una después de otra (UNION ALL)."],
    "Assert": ["Verificación", "otro", "Verifica una condición (una subconsulta que devuelve más de una fila, una restricción CHECK, una FK) y tira error si falla."],
    "Bitmap": ["Mapa de bits", "join", "Arma un filtro de bits con las claves del lado build de un hash join para descartar filas temprano en el otro lado. Buena señal en planes paralelos."],
    "Merge Interval": ["Intervalo combinado", "otro", "Combina rangos superpuestos antes de un seek con varios valores (IN, BETWEEN con variables)."],
    "Clustered Index Insert": ["Inserción en índice agrupado", "modificacion", "Inserta las filas en la tabla (su índice agrupado)."],
    "Clustered Index Update": ["Actualización de índice agrupado", "modificacion", "Actualiza filas en la tabla (su índice agrupado). Si cambian columnas indexadas, también se actualizan esos índices."],
    "Clustered Index Delete": ["Borrado en índice agrupado", "modificacion", "Borra filas de la tabla."],
    "Clustered Index Merge": ["MERGE en índice agrupado", "modificacion", "Aplica un MERGE sobre la tabla."],
    "Table Insert": ["Inserción en tabla", "modificacion", "Inserta filas en un heap (tabla sin índice agrupado) o en una variable de tabla."],
    "Table Update": ["Actualización de tabla", "modificacion", "Actualiza filas de un heap."],
    "Table Delete": ["Borrado en tabla", "modificacion", "Borra filas de un heap."],
    "Index Insert": ["Inserción en índice", "modificacion", "Mantiene un índice no agrupado por la inserción."],
    "Index Update": ["Actualización de índice", "modificacion", "Mantiene un índice no agrupado por la actualización."],
    "Index Delete": ["Borrado en índice", "modificacion", "Mantiene un índice no agrupado por el borrado."],
    "Collapse": ["Colapso", "modificacion", "Junta un borrado y una inserción de la misma clave en una sola actualización (claves únicas)."],
    "Split": ["División", "modificacion", "Divide una actualización en borrado + inserción para mantener claves únicas."],
    "Sequence": ["Secuencia", "otro", "Ejecuta varias ramas en orden y devuelve la última (típico en planes de modificación con varios índices)."],
    "Switch": ["Conmutador", "otro", "Elige una de varias ramas según una condición."],
    "UDX": ["Operador XML", "otro", "Operaciones de XML (FOR XML, nodes(), value())."],
    "Remote Query": ["Consulta remota", "acceso", "Ejecuta una consulta en otro servidor (linked server). El costo real suele estar en lo que viaja por la red."],
    "Remote Scan": ["Recorrido remoto", "acceso", "Lee una tabla remota completa."],
    "Batch Hash Table Build": ["Armado de tabla hash (batch)", "join", "Arma la tabla hash en batch mode."],
    "Key Lookup": ["Key Lookup", "acceso", "Por cada fila que encontró un índice no agrupado, va a la tabla (índice agrupado) a buscar las columnas que al índice le faltan. Uno o dos no molestan; miles por consulta sí."],
    "Print": ["Print", "otro", "PRINT."],
    "Hash Match Aggregate": ["Agregado por hash", "agregado", "GROUP BY o DISTINCT por hash, para entradas sin orden."],
  };

  const LOGICOS = {
    "Inner Join": "join interno", "Left Outer Join": "left join", "Right Outer Join": "right join", "Full Outer Join": "full join",
    "Left Semi Join": "EXISTS/IN", "Right Semi Join": "EXISTS/IN", "Left Anti Semi Join": "NOT EXISTS/NOT IN", "Right Anti Semi Join": "NOT EXISTS/NOT IN",
    "Aggregate": "agregado", "Partial Aggregate": "agregado parcial", "Union": "UNION", "Flow Distinct": "DISTINCT al vuelo", "Distinct Sort": "DISTINCT ordenando",
    "TopN Sort": "Top N ordenado", "Gather Streams": "juntar hilos", "Repartition Streams": "redistribuir entre hilos", "Distribute Streams": "repartir en hilos",
    "Lazy Spool": "spool perezoso", "Eager Spool": "spool ansioso", "Inner Apply": "APPLY", "Outer Apply": "OUTER APPLY", "Compute Scalar": "", "Sort": "",
    "Clustered Index Seek": "", "Index Seek": "", "Clustered Index Scan": "", "Index Scan": "", "Table Scan": "", "Filter": "", "Top": "", "Insert": "INSERT", "Update": "UPDATE", "Delete": "DELETE", "Merge": "MERGE",
    "Left Outer Join (Adaptive)": "left join adaptativo", "Inner Join (Adaptive)": "join adaptativo", "Cross Join": "producto cartesiano", "Segment": "", "Compute Sequence": "secuencia", "Window Aggregate": "", "Assert": "", "Concatenation": "", "Constant Scan": "", "Bitmap Create": "crear mapa de bits", "Key Lookup": "", "RID Lookup": "", "Table-valued function": "", "Remote Query": "",
  };

  const RAZONES_NO_PARALELO = {
    MaxDOPSetToOne: "el MAXDOP está en 1 (en la consulta, la base o el servidor)",
    EstimatedDOPIsOne: "la estimación de grado de paralelismo dio 1",
    NoParallelPlansInDesktopOrExpressEdition: "la edición Express no hace planes paralelos",
    TSQLUserDefinedFunctionsNotParallelizable: "hay una función escalar T-SQL definida por el usuario, y esas no se paralelizan",
    NonParallelizableIntrinsicFunction: "hay una función del sistema que no se paraleliza (por ejemplo, OBJECT_NAME, ERROR_NUMBER o @@TRANCOUNT)",
    TableVariableTransactionsDoNotSupportParallelNestedTransaction: "se modifica una variable de tabla, y eso no se paraleliza",
    DMLQueryReturnsOutputToClient: "la modificación devuelve filas al cliente (OUTPUT)",
    CouldNotGenerateValidParallelPlan: "el optimizador no encontró un plan paralelo válido",
    NoParallelWithRemoteQuery: "hay una consulta remota (linked server)",
    NoParallelDynamicCursor: "hay un cursor dinámico", NoParallelFastForwardCursor: "hay un cursor fast forward", NoParallelCursorFetchByBookmark: "hay un cursor por bookmark",
    NoParallelCreateIndexInNonEnterpriseEdition: "crear índices en paralelo requiere Enterprise",
    NoParallelForMemoryOptimizedTables: "hay tablas en memoria (In-Memory OLTP)", NoParallelForDmlOnMemoryOptimizedTable: "se modifica una tabla en memoria",
    ParallelismDisabledByTraceFlag: "hay un trace flag que apaga el paralelismo", NoRangePartitioning: "no hay particionado por rango",
    MixedSerialAndParallelOnlineIndexBuildNotSupported: "índice online con partes seriales",
    NoParallelForPlanGuide: "una guía de plan lo impide", NoParallelForNativelyCompiledModule: "es un módulo compilado nativamente",
  };

  const ESPERAS = {
    ASYNC_NETWORK_IO: "el cliente tardó en consumir las filas: resultado muy grande, o el programa procesa fila por fila mientras lee (DataReader lento, ToList() de cientos de miles de filas).",
    PAGEIOLATCH_SH: "esperó a que las páginas se leyeran del disco: datos que no estaban en memoria. Menos páginas leídas (mejores índices) o más RAM.",
    PAGEIOLATCH_EX: "esperó lecturas de disco para modificar páginas.", PAGEIOLATCH_UP: "esperó lecturas de disco para actualizar páginas.",
    PAGELATCH_EX: "contención en memoria sobre la misma página (inserciones concurrentes al final de un índice, tempdb).", PAGELATCH_SH: "contención en memoria sobre páginas compartidas.",
    LCK_M_S: "esperó un bloqueo compartido: otra sesión tenía la fila o la tabla bloqueada para escribir.", LCK_M_X: "esperó un bloqueo exclusivo: otra sesión estaba leyendo o escribiendo lo mismo.",
    LCK_M_U: "esperó un bloqueo de actualización.", LCK_M_IX: "esperó un bloqueo intencional exclusivo.", LCK_M_IS: "esperó un bloqueo intencional compartido.", LCK_M_SCH_S: "esperó por un cambio de esquema en curso (ALTER, truncate, recompilación).", LCK_M_SCH_M: "esperó para modificar el esquema.",
    RESOURCE_SEMAPHORE: "esperó a que hubiera memoria para la concesión (memory grant) de la consulta: hay demasiadas consultas pidiendo mucha memoria a la vez, o esta pide de más.",
    RESOURCE_SEMAPHORE_QUERY_COMPILE: "esperó memoria para compilar: muchas compilaciones grandes a la vez.",
    SOS_SCHEDULER_YIELD: "cedió la CPU porque se le acabó el turno (4 ms): consulta que usa mucha CPU o CPUs saturadas.",
    CXPACKET: "coordinación entre hilos paralelos: en sí no es un problema, salvo que algún hilo haga todo el trabajo (reparto desparejo).",
    CXCONSUMER: "un hilo consumidor esperó filas de los productores: parte normal del paralelismo.", CXSYNC_PORT: "sincronización entre hilos paralelos al abrir o cerrar el intercambio.", CXSYNC_CONSUMER: "sincronización entre hilos consumidores.",
    WRITELOG: "esperó a que se escribiera el log de transacciones en disco (commit).", LOGBUFFER: "esperó por el búfer del log.",
    IO_COMPLETION: "operaciones de E/S que no son lecturas de datos: típicamente derrames (spills) a tempdb u ordenamientos grandes.",
    MEMORY_ALLOCATION_EXT: "reservas de memoria del sistema operativo; normal en consultas con hash y sort grandes.", RESERVED_MEMORY_ALLOCATION_EXT: "reservas de memoria; normal en consultas con hash y sort grandes.",
    HTBUILD: "armado de tabla hash en paralelo.", HTDELETE: "limpieza de tablas hash en paralelo.", HTREPARTITION: "repartición de tablas hash en paralelo.", HTMEMO: "memoria para tablas hash en paralelo.",
    BPSORT: "ordenamiento en batch mode en paralelo.", LATCH_EX: "contención en estructuras internas (no páginas).", LATCH_SH: "contención compartida en estructuras internas.",
    PREEMPTIVE_OS_WRITEFILEGATHER: "crecimiento de archivos (datos, log o tempdb).", PREEMPTIVE_OS_AUTHENTICATIONOPS: "autenticación contra Windows/AD.",
    THREADPOOL: "no había hilos disponibles: el servidor está saturado de sesiones.", WAIT_XTP_RECOVERY: "recuperación de In-Memory OLTP.",
    EXECSYNC: "sincronización entre operadores paralelos (spools, por ejemplo).", MSQL_XP: "ejecución de un procedimiento extendido.", OLEDB: "esperó a un proveedor OLE DB (linked server, BULK INSERT, DBCC).",
  };

  /* ------------------------------------------------------------------ */
  /* Lectura del plan                                                    */
  /* ------------------------------------------------------------------ */

  const NO_OPERADOR = new Set(["OutputList", "Warnings", "MemoryFractions", "RunTimeInformation", "RunTimePartitionSummary", "InternalInfo"]);

  function leerAvisos(wEl, destino) {
    if (!wEl) return;
    const a = wEl.atributos;
    if (bool(a.NoJoinPredicate)) destino.push({ tipo: "NoJoinPredicate", texto: "Join sin predicado: producto cartesiano." });
    if (bool(a.SpatialGuess)) destino.push({ tipo: "SpatialGuess", texto: "Estimación espacial a ciegas." });
    if (bool(a.UnmatchedIndexes)) destino.push({ tipo: "UnmatchedIndexes", texto: "Hay índices filtrados que no se pudieron usar por la parametrización." });
    if (bool(a.FullUpdateForOnlineIndexBuild)) destino.push({ tipo: "FullUpdateForOnlineIndexBuild", texto: "Actualización completa por índice online." });
    for (const h of wEl.hijos) {
      const b = h.atributos;
      switch (h.nombre) {
        case "SpillToTempDb": destino.push({ tipo: "SpillToTempDb", nivel: num(b.SpillLevel), hilos: num(b.SpilledThreadCount), texto: `Derrame a tempdb (nivel ${b.SpillLevel || "?"}${b.SpilledThreadCount ? `, ${b.SpilledThreadCount} hilo(s)` : ""}).` }); break;
        case "SpillOccurred": destino.push({ tipo: "SpillOccurred", texto: "Hubo un derrame a tempdb." }); break;
        case "ColumnsWithNoStatistics": destino.push({ tipo: "ColumnsWithNoStatistics", columnas: columnasDe(h), texto: `Columnas sin estadísticas: ${columnasDe(h).join(", ")}.` }); break;
        case "PlanAffectingConvert": destino.push({ tipo: "PlanAffectingConvert", problema: b.ConvertIssue || "", expresion: b.Expression || "", texto: `Conversión implícita que afecta ${b.ConvertIssue === "Seek Plan" ? "la posibilidad de usar un índice" : "la estimación de filas"}: ${b.Expression || ""}` }); break;
        case "Wait": destino.push({ tipo: "Wait", espera: b.WaitType, ms: num(b.WaitTime), texto: `Espera ${b.WaitType} de ${b.WaitTime} ms.` }); break;
        case "MemoryGrantWarning": destino.push({ tipo: "MemoryGrantWarning", clase: b.GrantWarningKind, pedida: num(b.RequestedMemory), concedida: num(b.GrantedMemory), usada: num(b.MaxUsedMemory), texto: `Concesión de memoria ${b.GrantWarningKind === "Excessive Grant" ? "excesiva" : b.GrantWarningKind}: pidió ${fmtKB(num(b.RequestedMemory))}, usó ${fmtKB(num(b.MaxUsedMemory))}.` }); break;
        case "ExchangeSpillDetails": destino.push({ tipo: "ExchangeSpill", texto: "Derrame en el intercambio paralelo." }); break;
        case "HashSpillDetails": destino.push({ tipo: "HashSpillDetails", texto: `Detalle del derrame del hash: ${fmtKB(num(b.WritesToTempDb) * 8)} escritos.` }); break;
        case "SortSpillDetails": destino.push({ tipo: "SortSpillDetails", texto: `Detalle del derrame del sort: ${fmtKB(num(b.WritesToTempDb) * 8)} escritos.` }); break;
        default: destino.push({ tipo: h.nombre, texto: h.nombre });
      }
    }
  }

  function leerTiemposReales(rti) {
    if (!rti) return null;
    const hilos = hijosDe(rti, "RunTimeCountersPerThread");
    if (!hilos.length) return null;
    const r = { filas: 0, filasLeidas: null, ejecuciones: 0, lecturasLogicas: null, lecturasFisicas: null, lecturasAnticipadas: null, lobLogicas: null, msTranscurridos: null, msCpu: null, hilos: 0, modo: "", rebinds: null, rewinds: null, memoriaUsadaKB: null, memoriaConcedidaKB: null, lotes: 0 };
    const acumular = (campo, attr, modo) => {
      let total = null;
      for (const h of hilos) {
        if (h.atributos[attr] === undefined) continue;
        const v = num(h.atributos[attr]);
        total = total === null ? v : (modo === "max" ? Math.max(total, v) : total + v);
      }
      if (total !== null) r[campo] = total;
    };
    for (const h of hilos) {
      r.filas += num(h.atributos.ActualRows);
      r.ejecuciones += num(h.atributos.ActualExecutions);
      r.lotes += num(h.atributos.Batches);
      if (h.atributos.ActualExecutionMode) r.modo = h.atributos.ActualExecutionMode;
      if (num(h.atributos.ActualRows) > 0 || num(h.atributos.ActualExecutions) > 0 || hilos.length === 1) r.hilos++;
    }
    acumular("filasLeidas", "ActualRowsRead", "suma");
    acumular("lecturasLogicas", "ActualLogicalReads", "suma");
    acumular("lecturasFisicas", "ActualPhysicalReads", "suma");
    acumular("lecturasAnticipadas", "ActualReadAheads", "suma");
    acumular("lobLogicas", "ActualLobLogicalReads", "suma");
    acumular("msTranscurridos", "ActualElapsedms", "max");
    acumular("msCpu", "ActualCPUms", "suma");
    acumular("rebinds", "ActualRebinds", "suma");
    acumular("rewinds", "ActualRewinds", "suma");
    acumular("memoriaUsadaKB", "UsedMemoryGrant", "suma");
    acumular("memoriaConcedidaKB", "InputMemoryGrant", "suma");
    return r;
  }

  function hijosRelOp(el, salida = []) {
    for (const h of el.hijos) {
      if (h.nombre === "RelOp") salida.push(h);
      else hijosRelOp(h, salida);
    }
    return salida;
  }

  function textoPredicado(el) {
    const so = hijo(el, "ScalarOperator");
    return so ? (so.atributos.ScalarString || "") : "";
  }

  function leerSeek(seekPreds) {
    const partes = [];
    if (!seekPreds) return partes;
    for (const sp of buscarTodos(seekPreds, "SeekKeys")) {
      const prefijo = hijo(sp, "Prefix");
      if (prefijo) {
        const cols = columnasDe(hijo(prefijo, "RangeColumns"));
        const exprs = buscarTodos(hijo(prefijo, "RangeExpressions"), "ScalarOperator").map((s) => s.atributos.ScalarString || "");
        partes.push(cols.map((c, i) => `${c} = ${exprs[i] || "?"}`).join(" y "));
      }
      const desde = hijo(sp, "StartRange"), hasta = hijo(sp, "EndRange");
      if (desde || hasta) {
        const col = columnasDe(hijo(desde || hasta, "RangeColumns"))[0] || "?";
        const op = (r) => ({ GT: ">", GE: ">=", LT: "<", LE: "<=", EQ: "=" })[r.atributos.ScanType] || r.atributos.ScanType;
        const expr = (r) => (buscarTodos(hijo(r, "RangeExpressions"), "ScalarOperator")[0] || { atributos: {} }).atributos.ScalarString || "?";
        const trozos = [];
        if (desde) trozos.push(`${col} ${op(desde)} ${expr(desde)}`);
        if (hasta) trozos.push(`${col} ${op(hasta)} ${expr(hasta)}`);
        partes.push(trozos.join(" y "));
      }
    }
    return partes;
  }

  function leerNodo(relEl, sentencia, padre) {
    const a = relEl.atributos;
    const n = {
      id: num(a.NodeId, -1), fisico: a.PhysicalOp || "?", logico: a.LogicalOp || "", filasEst: num(a.EstimateRows), filasLeidasEst: a.EstimatedRowsRead !== undefined ? num(a.EstimatedRowsRead) : null,
      filasSinMetaEst: a.EstimateRowsWithoutRowGoal !== undefined ? num(a.EstimateRowsWithoutRowGoal) : null,
      ioEst: num(a.EstimateIO), cpuEst: num(a.EstimateCPU), tamFila: num(a.AvgRowSize), costoSubarbol: num(a.EstimatedTotalSubtreeCost), paralelo: bool(a.Parallel),
      rebindsEst: num(a.EstimateRebinds), rewindsEst: num(a.EstimateRewinds), modoEst: a.EstimatedExecutionMode || "", cardinalidadTabla: a.TableCardinality !== undefined ? num(a.TableCardinality) : null,
      objeto: null, esLookup: false, predicadoSeek: [], predicado: "", salida: [], avisos: [], real: null, hijos: [], padre, detalle: {}, operador: "", costoPropio: 0, porcentaje: 0,
    };
    n.ejecucionesEst = 1 + n.rebindsEst + n.rewindsEst;
    n.filasEstTotales = n.filasEst * n.ejecucionesEst;
    n.salida = columnasDe(hijo(relEl, "OutputList"));
    leerAvisos(hijo(relEl, "Warnings"), n.avisos);
    n.real = leerTiemposReales(hijo(relEl, "RunTimeInformation"));
    const opEl = relEl.hijos.find((h) => !NO_OPERADOR.has(h.nombre));
    if (opEl) {
      n.operador = opEl.nombre;
      const b = opEl.atributos;
      const obj = hijo(opEl, "Object");
      if (obj) n.objeto = leerObjeto(obj);
      if (opEl.nombre === "IndexScan" || opEl.nombre === "TableScan") {
        n.esLookup = bool(b.Lookup);
        if (b.Ordered !== undefined) n.detalle.ordenado = bool(b.Ordered);
        if (b.ScanDirection) n.detalle.direccion = b.ScanDirection === "BACKWARD" ? "hacia atrás" : "hacia adelante";
        if (bool(b.ForcedIndex) || bool(b.ForceSeek) || bool(b.ForceScan)) n.detalle.forzado = true;
        n.predicadoSeek = leerSeek(hijo(opEl, "SeekPredicates") || hijo(opEl, "SeekPredicateNew"));
        n.predicado = textoPredicado(hijo(opEl, "Predicate"));
        n.columnasPredicado = columnasDe(hijo(opEl, "Predicate"), true);
        n.predicadoUsuario = sinBitmap(n.predicado);
      }
      if (n.fisico === "RID Lookup") n.esLookup = true;
      if (opEl.nombre === "NestedLoops") { n.detalle.referenciasExternas = columnasDe(hijo(opEl, "OuterReferences")); n.predicado = textoPredicado(hijo(opEl, "Predicate")); if (bool(b.Optimized)) n.detalle.optimizado = true; if (bool(b.WithUnorderedPrefetch) || bool(b.WithOrderedPrefetch)) n.detalle.prefetch = true; }
      if (opEl.nombre === "Hash") { n.detalle.clavesBuild = columnasDe(hijo(opEl, "HashKeysBuild")); n.detalle.clavesProbe = columnasDe(hijo(opEl, "HashKeysProbe")); n.predicado = textoPredicado(hijo(opEl, "ProbeResidual")); if (bool(b.BitmapCreator)) n.detalle.creaBitmap = true; }
      if (opEl.nombre === "AdaptiveJoin") { n.detalle.clavesBuild = columnasDe(hijo(opEl, "HashKeysBuild")); n.detalle.clavesProbe = columnasDe(hijo(opEl, "HashKeysProbe")); n.detalle.umbralAdaptativo = num(b.AdaptiveThresholdRows); n.detalle.joinReal = b.ActualJoinType || ""; n.detalle.referenciasExternas = columnasDe(hijo(opEl, "OuterReferences")); }
      if (opEl.nombre === "Merge") { n.detalle.clavesExternas = columnasDe(hijo(opEl, "OuterSideJoinColumns")); n.detalle.clavesInternas = columnasDe(hijo(opEl, "InnerSideJoinColumns")); n.detalle.muchosAMuchos = bool(b.ManyToMany); n.predicado = textoPredicado(hijo(opEl, "Residual")); }
      if (opEl.nombre === "Sort" || opEl.nombre === "TopSort") {
        n.detalle.ordenPor = buscarTodos(hijo(opEl, "OrderBy"), "OrderByColumn").map((c) => `${columnasDe(c)[0] || "?"}${bool(c.atributos.Ascending) ? "" : " desc"}`);
        if (bool(b.Distinct)) n.detalle.distinct = true;
        if (opEl.nombre === "TopSort") n.detalle.topN = num(b.Rows);
      }
      if (opEl.nombre === "Filter") n.predicado = textoPredicado(hijo(opEl, "Predicate"));
      if (opEl.nombre === "Top") { n.detalle.top = textoPredicado(hijo(opEl, "TopExpression")); if (bool(b.WithTies)) n.detalle.conEmpates = true; if (bool(b.IsPercent)) n.detalle.porcentaje = true; }
      if (opEl.nombre === "StreamAggregate" || opEl.nombre === "Hash" || opEl.nombre === "WindowAggregate") n.detalle.agrupaPor = columnasDe(hijo(opEl, "GroupBy"));
      if (opEl.nombre === "ComputeScalar" || opEl.nombre === "StreamAggregate" || opEl.nombre === "Hash" || opEl.nombre === "WindowAggregate") {
        n.detalle.expresiones = buscarTodos(hijo(opEl, "DefinedValues"), "ScalarOperator").map((s) => s.atributos.ScalarString || "").filter(Boolean).slice(0, 12);
      }
      if (opEl.nombre === "Parallelism") { n.detalle.particion = b.PartitioningType || ""; n.detalle.columnasParticion = columnasDe(hijo(opEl, "PartitionColumns")); }
      if (opEl.nombre === "Spool") { if (bool(b.Stack)) n.detalle.pila = true; if (b.PrimaryNodeId !== undefined) n.detalle.nodoPrimario = num(b.PrimaryNodeId); }
      if (opEl.nombre === "Update" || opEl.nombre === "SimpleUpdate") { n.detalle.setea = buscarTodos(hijo(opEl, "SetPredicate"), "ScalarOperator").map((s) => s.atributos.ScalarString || "").slice(0, 8); }
      if (opEl.nombre === "ConstantScan") n.detalle.filasConstantes = hijosDe(hijo(opEl, "Values"), "Row").length;
      if (opEl.nombre === "TableValuedFunction") n.detalle.funcion = (hijo(opEl, "Object") || { atributos: {} }).atributos.Table || "";
    }
    if (n.esLookup && n.fisico !== "RID Lookup") n.fisico = "Key Lookup";
    const nombres = OPERADORES[n.fisico] || (n.fisico === "Hash Match" ? OPERADORES["Hash Match"] : null);
    n.nombreEs = nombres ? nombres[0] : n.fisico;
    n.clase = nombres ? nombres[1] : "otro";
    if (n.fisico === "Hash Match" && /Aggregate/.test(n.logico)) { n.nombreEs = "Agregado por hash"; n.clase = "agregado"; }
    if (n.fisico === "Sort" && n.logico === "TopN Sort") n.nombreEs = "Top N ordenado";
    if (n.fisico === "Sort" && n.logico === "Distinct Sort") n.nombreEs = "DISTINCT ordenando";
    if (n.fisico === "Parallelism") n.nombreEs = { "Gather Streams": "Juntar hilos (Gather Streams)", "Repartition Streams": "Redistribuir entre hilos", "Distribute Streams": "Repartir en hilos" }[n.logico] || n.nombreEs;
    if (n.fisico === "Table Spool" || n.fisico === "Index Spool") n.nombreEs += n.logico === "Eager Spool" ? " (ansioso)" : n.logico === "Lazy Spool" ? " (perezoso)" : "";
    n.logicoEs = LOGICOS[n.logico] !== undefined ? LOGICOS[n.logico] : n.logico;
    if (n.fisico === "Parallelism" || /Spool$/.test(n.fisico) || (n.fisico === "Hash Match" && /Aggregate/.test(n.logico)) || /Sort$/.test(n.logico)) n.logicoEs = "";
    for (const h of hijosRelOp(relEl)) n.hijos.push(leerNodo(h, sentencia, n));
    sentencia.nodos.push(n);
    return n;
  }

  function leerIndicesFaltantes(qp) {
    const salida = [];
    for (const g of buscarTodos(hijo(qp, "MissingIndexes"), "MissingIndexGroup")) {
      for (const mi of hijosDe(g, "MissingIndex")) {
        const a = mi.atributos;
        const f = { impacto: num(g.atributos.Impact), base: sinCorchetes(a.Database), esquema: sinCorchetes(a.Schema), tabla: sinCorchetes(a.Table), igualdad: [], desigualdad: [], incluidas: [] };
        for (const cg of hijosDe(mi, "ColumnGroup")) {
          const cols = hijosDe(cg, "Column").map((c) => sinCorchetes(c.atributos.Name));
          if (cg.atributos.Usage === "EQUALITY") f.igualdad.push(...cols); else if (cg.atributos.Usage === "INEQUALITY") f.desigualdad.push(...cols); else f.incluidas.push(...cols);
        }
        f.script = scriptIndice(f.esquema, f.tabla, f.igualdad.concat(f.desigualdad), f.incluidas);
        salida.push(f);
      }
    }
    return salida;
  }

  function scriptIndice(esquema, tabla, claves, incluidas, opciones) {
    const nombre = `IX_${tabla}_${claves.join("_")}`.replace(/[^\w]/g, "").slice(0, 120);
    const q = (c) => `[${c}]`;
    let s = `CREATE NONCLUSTERED INDEX [${nombre}]\n  ON [${esquema || "dbo"}].[${tabla}] (${claves.map(q).join(", ")})`;
    if (incluidas && incluidas.length) s += `\n  INCLUDE (${incluidas.map(q).join(", ")})`;
    if (opciones) s += `\n  WITH (${opciones})`;
    return s + ";";
  }

  function leerSentencia(stEl, qpEl) {
    const a = stEl.atributos;
    const s = {
      id: num(a.StatementId), tipo: a.StatementType || stEl.nombre.replace(/^Stmt/, ""), texto: a.StatementText || "", costo: num(a.StatementSubTreeCost), filasEst: num(a.StatementEstRows),
      nivelOptimizacion: a.StatementOptmLevel || "", abortoTemprano: a.StatementOptmEarlyAbortReason || "", versionCE: a.CardinalityEstimationModelVersion ? num(a.CardinalityEstimationModelVersion) : null,
      hashConsulta: a.QueryHash || "", hashPlan: a.QueryPlanHash || "", desdeCache: a.RetrievedFromCache === "true", parametrizacion: a.StatementParameterizationType ? num(a.StatementParameterizationType) : null,
      textoParametrizado: a.ParameterizedText || "", nodos: [], raiz: null, plan: null, elemento: stEl.nombre,
    };
    if (!qpEl) return s;
    const q = qpEl.atributos;
    const mgi = hijo(qpEl, "MemoryGrantInfo");
    const memoria = {};
    if (mgi) for (const k of Object.keys(mgi.atributos)) memoria[k] = /^(Is|LastRequested)/.test(k) ? mgi.atributos[k] : num(mgi.atributos[k]);
    const qts = hijo(qpEl, "QueryTimeStats");
    const tiempos = qts ? { transcurridoMs: num(qts.atributos.ElapsedTime), cpuMs: num(qts.atributos.CpuTime), udfTranscurridoMs: qts.atributos.UdfElapsedTime !== undefined ? num(qts.atributos.UdfElapsedTime) : null, udfCpuMs: qts.atributos.UdfCpuTime !== undefined ? num(qts.atributos.UdfCpuTime) : null } : null;
    const esperas = hijosDe(hijo(qpEl, "WaitStats"), "Wait").map((w) => ({ tipo: w.atributos.WaitType, ms: num(w.atributos.WaitTimeMs), veces: num(w.atributos.WaitCount), significado: ESPERAS[w.atributos.WaitType] || (/^LCK_/.test(w.atributos.WaitType) ? "esperó un bloqueo de otra sesión." : /^PAGEIOLATCH/.test(w.atributos.WaitType) ? "esperó lecturas de disco." : /^CX/.test(w.atributos.WaitType) ? "coordinación entre hilos paralelos." : /^PREEMPTIVE/.test(w.atributos.WaitType) ? "llamada al sistema operativo." : "") })).sort((x, y) => y.ms - x.ms);
    const avisosPlan = [];
    leerAvisos(hijo(qpEl, "Warnings"), avisosPlan);
    const parametros = hijosDe(hijo(qpEl, "ParameterList"), "ColumnReference").map((p) => ({ nombre: p.atributos.Column || "", tipo: p.atributos.ParameterDataType || "", compilado: p.atributos.ParameterCompiledValue, ejecucion: p.atributos.ParameterRuntimeValue }));
    s.plan = {
      dop: q.DegreeOfParallelism !== undefined ? num(q.DegreeOfParallelism) : null, razonNoParalelo: q.NonParallelPlanReason || "", memoriaKB: q.MemoryGrant !== undefined ? num(q.MemoryGrant) : null,
      tamanoCacheKB: num(q.CachedPlanSize), compilacionMs: num(q.CompileTime), compilacionCpuMs: num(q.CompileCPU), compilacionKB: num(q.CompileMemory), memoria, tiempos, esperas, avisos: avisosPlan, parametros,
      indicesFaltantes: leerIndicesFaltantes(qpEl),
      indicesNoUsados: buscarTodos(hijo(qpEl, "UnmatchedIndexes"), "Object").map((o) => leerObjeto(o)).filter((o) => o && o.indice),
      estadisticasUsadas: buscarTodos(hijo(qpEl, "OptimizerStatsUsage"), "StatisticsInfo").length,
      hardware: (hijo(qpEl, "OptimizerHardwareDependentProperties") || { atributos: {} }).atributos,
    };
    const raizRel = hijo(qpEl, "RelOp");
    if (raizRel) s.raiz = leerNodo(raizRel, s, null);
    s.esReal = s.nodos.some((n) => n.real);
    // Adaptive Join: tiene tres hijos; el tercero es la rama alternativa (bucles anidados) que solo corre si elige NestedLoops
    const marcarNoEjecutado = (n) => { n.noEjecutado = true; n.hijos.forEach(marcarNoEjecutado); };
    for (const n of s.nodos) {
      if (n.fisico === "Adaptive Join" && n.hijos.length === 3) {
        const eligioLoops = n.detalle.joinReal === "NestedLoops" || (s.esReal && n.hijos[2].real && n.hijos[2].real.ejecuciones > 0 && !(n.hijos[1].real && n.hijos[1].real.ejecuciones > 0));
        n.hijos[eligioLoops ? 1 : 2].ramaAlternativa = true;
        if (s.esReal || n.detalle.joinReal) marcarNoEjecutado(n.hijos[eligioLoops ? 1 : 2]);
      }
      if (s.esReal && n.real && n.real.ejecuciones === 0 && n.real.filas === 0) n.noEjecutado = true;
    }
    // Costos propios y porcentajes
    const costoRef = s.raiz ? Math.max(s.raiz.costoSubarbol, s.costo) : s.costo;
    for (const n of s.nodos) {
      const costoHijos = n.hijos.filter((h) => !h.ramaAlternativa).reduce((acc, h) => acc + h.costoSubarbol, 0);
      n.costoPropio = Math.max(0, n.costoSubarbol - costoHijos);
      n.porcentaje = costoRef > 0 ? Math.round((n.costoPropio / costoRef) * 1000) / 10 : 0;
    }
    for (const n of s.nodos) if (n.ramaAlternativa) { const cero = (x) => { x.porcentaje = 0; x.hijos.forEach(cero); }; cero(n); }
    // Con metas de filas (TOP, EXISTS) el costo del padre puede ser menor que la suma de los hijos: se normaliza a 100
    const totalPct = s.nodos.reduce((acc, n) => acc + n.porcentaje, 0);
    if (totalPct > 100) for (const n of s.nodos) n.porcentaje = Math.round((n.porcentaje * 100 / totalPct) * 10) / 10;
    s.lecturasLogicas = s.nodos.reduce((acc, n) => acc + (n.real && n.real.lecturasLogicas ? n.real.lecturasLogicas : 0), 0);
    s.lecturasFisicas = s.nodos.reduce((acc, n) => acc + (n.real && n.real.lecturasFisicas ? n.real.lecturasFisicas : 0) + (n.real && n.real.lecturasAnticipadas ? n.real.lecturasAnticipadas : 0), 0);
    s.filasReales = null;
    if (s.esReal) { let n = s.raiz; while (n && !n.real && n.hijos.length === 1) n = n.hijos[0]; if (n && n.real) s.filasReales = n.real.filas; }
    s.hallazgos = diagnosticar(s);
    s.resumen = resumir(s);
    return s;
  }

  function recolectarSentencias(el, salida) {
    if (!el) return;
    for (const h of el.hijos) {
      if (/^Stmt/.test(h.nombre)) {
        const qp = hijo(h, "QueryPlan");
        if (qp) salida.push(leerSentencia(h, qp));
        else if (h.nombre === "StmtCursor") {
          for (const op of buscarTodos(h, "Operation")) { const qpc = hijo(op, "QueryPlan"); if (qpc) { const s = leerSentencia(h, qpc); s.tipo = `CURSOR ${op.atributos.OperationType || ""}`.trim(); salida.push(s); } }
        } else if (h.nombre === "StmtCond") {
          recolectarSentencias(hijo(h, "Condition"), salida); recolectarSentencias(hijo(h, "Then"), salida); recolectarSentencias(hijo(h, "Else"), salida);
        } else if (h.nombre === "StmtSimple" && !/^SET /.test(h.atributos.StatementType || "")) {
          // Sentencia sin plan (SET, USE, DECLARE, EXEC envolvente): se lista pero no se analiza
          salida.push(Object.assign(leerSentencia(h, null), { sinPlan: true }));
        }
      } else recolectarSentencias(h, salida);
    }
  }

  /** Punto de entrada: texto XML → { version, build, sentencias[], conPlan[] } */
  function analizar(texto) {
    const doc = parsearXml(texto);
    let raizPlan = buscar(doc, "ShowPlanXML");
    if (!raizPlan) {
      if (buscar(doc, "RelOp") || buscar(doc, "QueryPlan")) raizPlan = doc;
      else throw new Error("No parece un plan de ejecución de SQL Server: no encontré <ShowPlanXML>. Guardá el plan desde SSMS (clic derecho en el plan → Save Execution Plan As…) o copiá el XML completo.");
    }
    const sentencias = [];
    recolectarSentencias(raizPlan, sentencias);
    const conPlan = sentencias.filter((s) => s.plan);
    if (!conPlan.length) throw new Error("El XML tiene la forma de un plan pero ninguna sentencia trae un QueryPlan (¿era solo un SET o un USE?).");
    conPlan.forEach((s, i) => { s.orden = i + 1; });
    return { version: raizPlan.atributos.Version || "", build: raizPlan.atributos.Build || "", versionServidor: versionDesdeBuild(raizPlan.atributos.Build), sentencias, conPlan, esReal: conPlan.some((s) => s.esReal) };
  }

  function versionDesdeBuild(build) {
    if (!build) return "";
    const mayor = parseInt(build.split(".")[0], 10);
    return { 9: "SQL Server 2005", 10: "SQL Server 2008/2008 R2", 11: "SQL Server 2012", 12: "SQL Server 2014", 13: "SQL Server 2016", 14: "SQL Server 2017", 15: "SQL Server 2019", 16: "SQL Server 2022", 17: "SQL Server 2025" }[mayor] || (mayor >= 12 && mayor <= 13 && /^12\.0\.2/.test(build) ? "Azure SQL" : "");
  }

  /* ------------------------------------------------------------------ */
  /* Formato                                                             */
  /* ------------------------------------------------------------------ */

  function fmtNum(x, dec) {
    if (x === null || x === undefined || isNaN(x)) return "–";
    const d = dec !== undefined ? dec : (Math.abs(x) >= 100 || Number.isInteger(x) ? 0 : Math.abs(x) >= 10 ? 1 : 2);
    return x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtKB(kb) {
    if (kb === null || kb === undefined) return "–";
    if (kb >= 1024 * 1024) return `${fmtNum(kb / 1024 / 1024, 1)} GB`;
    if (kb >= 1024) return `${fmtNum(kb / 1024, 1)} MB`;
    return `${fmtNum(kb, 0)} KB`;
  }
  const fmtPaginas = (p) => `${fmtNum(p, 0)} páginas (${fmtKB(p * 8)})`;
  function fmtMs(ms) {
    if (ms === null || ms === undefined) return "–";
    if (ms >= 60000) return `${fmtNum(ms / 60000, 1)} min`;
    if (ms >= 1000) return `${fmtNum(ms / 1000, 1)} s`;
    return `${fmtNum(ms, 0)} ms`;
  }
  function plural(n, palabra, plural) { const r = Math.round(n); return `${fmtNum(r, 0)} ${r === 1 ? palabra : (plural || palabra + "s")}`; }
  function fmtCosto(c) { return c >= 100 ? fmtNum(c, 0) : c >= 1 ? fmtNum(c, 2) : fmtNum(c, 4); }
  function nombreNodo(n) { return `${n.nombreEs}${n.objeto ? ` sobre ${n.objeto.nombreCompleto}` : ""}`; }

  /* ------------------------------------------------------------------ */
  /* Diagnóstico                                                         */
  /* ------------------------------------------------------------------ */

  const GRAVEDAD = { alta: 0, media: 1, baja: 2, info: 3 };
  const esScan = (n) => /Scan$/.test(n.fisico) && n.fisico !== "Constant Scan" && n.fisico !== "Remote Scan" && !/Columnstore/.test(n.fisico);
  const esSeek = (n) => /Seek$/.test(n.fisico) && !n.esLookup;
  const filasReales = (n) => (n.real ? n.real.filas : null);
  const ejecuciones = (n) => (n.real ? Math.max(n.real.ejecuciones, 1) : Math.max(1, Math.round(n.ejecucionesEst)));
  const RE_FUNCION_SOBRE_COLUMNA = /\b(upper|lower|ltrim|rtrim|trim|isnull|coalesce|datepart|datediff|dateadd|year|month|day|substring|left|right|convert|cast|replace|len|datalength|abs|round|floor|ceiling|charindex|patindex|format|try_convert|try_cast|iif)\s*\(\s*(\[[^\]]+\]\.)*\[[^\]]+\]/i;

  function diagnosticar(s) {
    const H = [];
    const agregar = (gravedad, titulo, que, hacer, extra = {}) => H.push(Object.assign({ gravedad, titulo, que, hacer, nodos: [] }, extra));
    const p = s.plan;
    const nodos = s.nodos.filter((n) => !n.noEjecutado);
    const real = s.esReal;

    // 0. Plan estimado
    if (!real) agregar("info", "Es un plan estimado, sin filas reales", "No tiene información de ejecución (filas reales, lecturas, tiempos), así que todo lo que sigue sale de las estimaciones del optimizador. Si las estimaciones están mal, el diagnóstico también.", "Para el plan real: en SSMS, «Include Actual Execution Plan» (Ctrl+M) y ejecutá la consulta; desde código, `SET STATISTICS XML ON` antes de la consulta devuelve el plan como un resultado más. Guardalo con clic derecho → Save Execution Plan As… y volvé a pegarlo acá.");

    // 1. Índices faltantes
    for (const f of p.indicesFaltantes) {
      const grav = f.impacto >= 70 && s.costo >= 0.5 ? "alta" : f.impacto >= 30 ? "media" : "baja";
      const cols = f.igualdad.concat(f.desigualdad);
      agregar(grav, `Falta un índice sobre ${f.esquema}.${f.tabla} (${cols.join(", ")})`,
        `El optimizador calcula que con un índice sobre ${cols.map((c) => `«${c}»`).join(" y ")}${f.incluidas.length ? ` que además incluya ${f.incluidas.join(", ")}` : ""} esta consulta costaría un ${fmtNum(f.impacto, 0)} % menos. Hoy tiene que leer de más para encontrar esas filas.`,
        `Antes de crearlo fijate si ya existe un índice parecido al que se le pueda agregar una columna (más índices = inserciones y actualizaciones más lentas). El orden de las columnas importa: primero las de igualdad, después las de desigualdad. Si te convence, el script está abajo.`,
        { codigo: f.script, nodos: nodos.filter((n) => n.objeto && n.objeto.tabla === f.tabla && esScan(n)).map((n) => n.id) });
    }

    // 2. Key / RID lookups
    for (const n of nodos.filter((x) => x.esLookup)) {
      const ej = ejecuciones(n);
      const grav = ej >= 10000 ? "alta" : ej >= 1000 ? "media" : ej >= 100 ? "baja" : "info";
      const padre = n.padre; const hermano = padre ? padre.hijos.find((h) => h !== n && h.objeto && n.objeto && h.objeto.tabla === n.objeto.tabla) : null;
      const colsLookup = n.salida.map((c) => c.split(".").pop()).filter((c, i, arr) => arr.indexOf(c) === i);
      const colsSeek = hermano ? hermano.predicadoSeek.map((t) => t.split(" ")[0].split(".").pop()).filter(Boolean) : [];
      const codigo = hermano && hermano.objeto && colsSeek.length && n.objeto ? scriptIndice(n.objeto.esquema, n.objeto.tabla, colsSeek, colsLookup, hermano.objeto.indice ? "DROP_EXISTING = ON" : null).replace(/\[IX_[^\]]+\]/, hermano.objeto.indice ? `[${hermano.objeto.indice}]` : "$&") : null;
      agregar(grav, `${n.fisico === "RID Lookup" ? "RID Lookup" : "Key Lookup"} sobre ${n.objeto ? n.objeto.nombre : "la tabla"}: ${fmtNum(ej, 0)} ${ej === 1 ? "vez" : "veces"}`,
        `${hermano ? `El índice ${hermano.objeto && hermano.objeto.indice ? `«${hermano.objeto.indice}»` : "usado"} encuentra las filas, pero no tiene ${colsLookup.length ? `las columnas ${colsLookup.join(", ")}` : "todas las columnas que pide la consulta"}, así que` : "El índice que encuentra las filas no tiene todas las columnas que pide la consulta, así que"} por cada fila hay un viaje extra a la tabla${n.predicado ? ", y encima el filtro «" + recortar(n.predicado, 90) + "» se evalúa recién ahí" : ""}. ${real ? `Fueron ${fmtNum(ej, 0)} viajes${n.real.lecturasLogicas ? ` y ${fmtPaginas(n.real.lecturasLogicas)} leídas` : ""}` : `Se estiman ${fmtNum(ej, 0)} viajes`}, y este operador se lleva el ${fmtNum(n.porcentaje, 0)} % del costo.`,
        ej >= 100 ? `Hacé que el índice cubra la consulta: agregá las columnas que faltan con INCLUDE (o sacalas del SELECT si no hacen falta). ${n.predicado ? "La columna del filtro conviene que vaya en la clave del índice, no solo en INCLUDE. " : ""}Con pocas filas, un lookup es barato y no vale la pena tocar nada.` : "Con tan pocas ejecuciones no molesta. Solo revisalo si la consulta corre miles de veces por minuto.",
        { nodos: [n.id].concat(hermano ? [hermano.id] : []), codigo });
    }

    // 3. Recorridos (scans) grandes con filtro
    for (const n of nodos.filter(esScan)) {
      if (n.objeto && (n.objeto.esTemporal || n.objeto.esVariable)) continue;
      const leidas = n.real && n.real.filasLeidas !== null ? n.real.filasLeidas : (n.real ? n.real.filas : (n.filasLeidasEst !== null ? n.filasLeidasEst : n.cardinalidadTabla));
      const devueltas = n.real ? n.real.filas : n.filasEstTotales;
      const padreFiltro = n.padre && n.padre.fisico === "Filter";
      const predicado = n.predicadoUsuario !== undefined ? n.predicadoUsuario : n.predicado;
      const tieneFiltro = !!predicado || padreFiltro;
      const ej = ejecuciones(n);
      const ejNoParalelas = n.real ? Math.max(1, Math.round(ej / Math.max(n.real.hilos, 1))) : Math.round(n.ejecucionesEst);
      const yaReportado = p.indicesFaltantes.some((f) => n.objeto && f.tabla === n.objeto.tabla);
      if (!tieneFiltro && ejNoParalelas <= 1) {
        if (leidas >= 100000 && n.porcentaje >= 20) agregar("info", `Lee ${n.objeto ? n.objeto.nombre : "una tabla"} completa (${fmtNum(leidas, 0)} filas)`, `${nombreNodo(n)} recorre todo sin filtro: la consulta pide realmente todas esas filas (o las necesita para un join, un agregado o un orden). Es el ${fmtNum(n.porcentaje, 0)} % del costo.`, "Si de verdad hacen falta todas, no hay mucho que hacer en el plan: revisá si se puede paginar, filtrar por fecha o precalcular. Para agregaciones sobre millones de filas, un índice columnstore cambia todo.", { nodos: [n.id] });
        continue;
      }
      if (!tieneFiltro) continue;
      const proporcion = leidas > 0 ? devueltas / leidas : 1;
      const totalLeidas = n.real ? leidas : leidas * ej;
      if (totalLeidas < 5000 || proporcion > 0.3) continue;
      const grav = totalLeidas >= 1000000 ? "alta" : totalLeidas >= 100000 ? "media" : "baja";
      const cols = (n.columnasPredicado || []).map((c) => c.split(".").pop()).filter((c, i, arr) => arr.indexOf(c) === i);
      const comodin = /like\s+N?'%/i.test(predicado);
      const funcion = RE_FUNCION_SOBRE_COLUMNA.test(predicado);
      const conversion = /CONVERT_IMPLICIT/i.test(predicado);
      if (conversion && p.avisos.concat(nodos.flatMap((x) => x.avisos)).some((a) => a.tipo === "PlanAffectingConvert")) continue; // ya lo explica el hallazgo de conversión
      let causa = "";
      if (comodin) causa = " El filtro tiene un LIKE que empieza con «%»: ningún índice sobre esa columna sirve para buscar, solo para recorrer.";
      else if (conversion) causa = " El filtro tiene una conversión implícita (CONVERT_IMPLICIT) sobre la columna: el tipo del parámetro no coincide con el de la columna y eso impide usar el índice para buscar.";
      else if (funcion) causa = " El filtro aplica una función sobre la columna, y eso impide usar un índice para buscar (no es «sargable»).";
      agregar(grav, `Recorre ${fmtNum(totalLeidas, 0)} filas de ${n.objeto ? n.objeto.nombre : "una tabla"} para quedarse con ${fmtNum(devueltas, 0)}`,
        `${nombreNodo(n)} lee ${fmtNum(totalLeidas, 0)} filas${ejNoParalelas > 1 ? ` en ${fmtNum(ejNoParalelas, 0)} ejecuciones` : ""}${n.real && n.real.hilos > 1 ? ` (${n.real.hilos} hilos)` : ""} y devuelve ${fmtNum(devueltas, 0)} (${fmtNum(proporcion * 100, proporcion * 100 < 1 ? 2 : 1)} %)${real && n.real.lecturasLogicas ? `, ${fmtPaginas(n.real.lecturasLogicas)}` : ""}. El filtro${cols.length ? ` sobre ${cols.join(", ")}` : ""} se aplica fila por fila después de leer.${causa}${yaReportado ? " El optimizador ya lo marcó como índice faltante (ver arriba)." : ""}`,
        comodin ? "Si la búsqueda es «contiene», un índice común no alcanza: pensá en Full-Text Search, en una columna normalizada para buscar por prefijo, o en aceptar el recorrido si la tabla es chica." : conversion ? "Igualá los tipos: si la columna es varchar, mandá el parámetro como varchar (en Dapper, `new DbString { IsAnsi = true }`; en EF Core, `.IsUnicode(false)` o `HasColumnType(\"varchar(…)\")`; en ADO.NET, `SqlDbType.VarChar`)." : funcion ? "Reescribí el filtro para que la columna quede sola de un lado: `Fecha >= @desde AND Fecha < @hasta` en lugar de `CAST(Fecha AS date) = @dia`; `Email = @e` en lugar de `UPPER(Email) = UPPER(@e)` (la collation ya es case-insensitive). Si no se puede, una columna calculada persistida e indexada." : `Un índice sobre ${cols.length ? cols.join(", ") : "las columnas del filtro"} evitaría leer la tabla entera${cols.length > 1 ? " (primero la columna más selectiva de las de igualdad, después la de rango)" : ""}.${n.salida.length <= 6 && cols.length ? ` Si le incluís ${n.salida.map((c) => c.split(".").pop()).filter((c) => !cols.includes(c)).join(", ") || "las columnas del SELECT"}, cubre la consulta y no hace lookups.` : ""}`,
        { nodos: [n.id] });
    }

    // 3b. Seek con predicado residual
    for (const n of nodos.filter((x) => esSeek(x) && x.predicado && x.real && x.real.filasLeidas !== null)) {
      const leidas = n.real.filasLeidas, dev = n.real.filas;
      if (leidas < 1000 || dev / Math.max(leidas, 1) > 0.2) continue;
      agregar(leidas >= 100000 ? "media" : "baja", `El seek sobre ${n.objeto ? n.objeto.nombre : "el índice"} lee ${fmtNum(leidas, 0)} filas y filtra después hasta ${fmtNum(dev, 0)}`,
        `La búsqueda por índice llega al rango correcto (${n.predicadoSeek.join("; ") || "seek"}), pero el otro filtro («${recortar(n.predicado, 100)}») no está en el índice y se evalúa fila por fila: se descartan ${fmtNum(100 - (dev / leidas) * 100, 0)} % de las filas leídas.`,
        "Agregá la columna de ese filtro a la clave del índice (después de las de igualdad) para que el seek sea más angosto, o al menos como INCLUDE para que no haga lookups.", { nodos: [n.id] });
    }

    // 4. Estimado vs real
    if (real) {
      const desvios = [];
      for (const n of nodos) {
        if (!n.real || n.fisico === "Parallelism") continue;
        const est = n.filasEstTotales, act = n.real.filas;
        if (Math.max(est, act) < 100) continue;
        const ratio = Math.max(est, act) / Math.max(Math.min(est, act), 1);
        if (ratio >= 10) desvios.push({ n, est, act, ratio });
      }
      if (desvios.length) {
        desvios.sort((a, b) => b.ratio - a.ratio);
        const peor = desvios[0];
        const grav = peor.ratio >= 100 && Math.max(peor.est, peor.act) >= 10000 ? "alta" : "media";
        const sniff = p.parametros.some((q) => q.compilado !== undefined && q.ejecucion !== undefined && q.compilado !== q.ejecucion);
        const variables = desvios.some((d) => d.n.objeto && d.n.objeto.esVariable);
        const temporales = desvios.some((d) => d.n.objeto && d.n.objeto.esTemporal);
        const funciones = desvios.some((d) => RE_FUNCION_SOBRE_COLUMNA.test(d.n.predicado) || /CONVERT_IMPLICIT/.test(d.n.predicado));
        const tvf = desvios.some((d) => d.n.fisico === "Table-valued function");
        const variablesLocales = desvios.some((d) => /\[@\w+\]/.test(d.n.predicado + d.n.predicadoSeek.join(" "))) && !p.parametros.length;
        const causas = [];
        if (sniff) causas.push("los parámetros con los que se compiló el plan no son los de esta ejecución (parameter sniffing, ver abajo)");
        if (variables) causas.push("hay variables de tabla, que el optimizador estima con 1 fila (hasta SQL Server 2019, que difiere la compilación)");
        if (temporales) causas.push("hay tablas temporales, cuyas estadísticas pueden haber quedado de una ejecución anterior");
        if (funciones) causas.push("hay funciones o conversiones sobre columnas en los filtros, que el optimizador no puede estimar bien");
        if (tvf) causas.push("hay una función con valores de tabla de varias sentencias, que se estima con un número fijo de filas");
        if (variablesLocales) causas.push("se filtra por variables locales (DECLARE @x), cuyo valor el optimizador no conoce al compilar y estima con promedios");
        if (!causas.length) causas.push("estadísticas desactualizadas o insuficientes (muestreo chico, columnas correlacionadas, valores sesgados)");
        agregar(grav, `El optimizador erró las filas por ${fmtNum(peor.ratio, 0)}× en ${nombreNodo(peor.n)}`,
          `Estimó ${fmtNum(peor.est, 0)} filas y pasaron ${fmtNum(peor.act, 0)}${desvios.length > 1 ? `; hay ${desvios.length} operadores con desvíos de 10× o más (${desvios.slice(1, 4).map((d) => `${d.n.nombreEs}: ${fmtNum(d.est, 0)} → ${fmtNum(d.act, 0)}`).join("; ")}${desvios.length > 4 ? "…" : ""})` : ""}. Con estimaciones así de erradas el optimizador elige mal: joins por bucles donde iba un hash, memoria de menos (derrames) o de más, recorridos en vez de búsquedas. Causa probable: ${causas.join("; ")}.`,
          `${sniff ? "Para parameter sniffing: `OPTION (RECOMPILE)` si la consulta no corre miles de veces por segundo, `OPTIMIZE FOR` si hay un valor típico, o separar la consulta en dos para los casos distintos. En SQL Server 2022 la optimización de planes sensibles a parámetros (PSP) ayuda sola. " : ""}${variables ? "Para variables de tabla: usá una tabla temporal (#t) si tiene más de unas pocas filas, o `OPTION (RECOMPILE)`. " : ""}${funciones ? "Sacá las funciones de las columnas filtradas. " : ""}${!sniff && !variables && !funciones ? "Actualizá las estadísticas (`UPDATE STATISTICS tabla WITH FULLSCAN`) y, si siguen mal, revisá si falta una estadística sobre esa columna o si hay correlación entre columnas que el optimizador no ve (estadísticas filtradas o multicolumna). " : ""}`,
          { nodos: desvios.slice(0, 5).map((d) => d.n.id) });
      }
    }

    // 5. Derrames (spills)
    for (const n of nodos.filter((x) => x.avisos.some((a) => a.tipo === "SpillToTempDb" || a.tipo === "SpillOccurred" || a.tipo === "HashSpillDetails" || a.tipo === "SortSpillDetails"))) {
      const sp = n.avisos.find((a) => a.tipo === "SpillToTempDb") || {};
      agregar(sp.nivel >= 2 || (n.real && n.real.filas >= 100000) ? "alta" : "media", `${n.nombreEs} derramó a tempdb${sp.nivel ? ` (nivel ${sp.nivel})` : ""}`,
        `${nombreNodo(n)} pidió memoria según las filas estimadas (${fmtNum(n.filasEstTotales, 0)}) y le llegaron ${n.real ? fmtNum(n.real.filas, 0) : "más"}: lo que no entró se escribió en tempdb y se volvió a leer. Es disco en el medio de una operación que debería ser en memoria${p.memoria.GrantedMemory ? `; la concesión fue de ${fmtKB(p.memoria.GrantedMemory)}` : ""}.`,
        `La causa casi siempre es la estimación de filas (ver el hallazgo de estimaciones). Si la estimación es correcta y aun así derrama, podés subir el mínimo con \`OPTION (MIN_GRANT_PERCENT = n)\`. Para un Sort, un índice con ese orden lo elimina; para un Hash, revisá si con mejores estimaciones el optimizador elegiría otro join. En SQL Server 2017+ con batch mode (o 2019 en row mode) la memoria se corrige sola a partir de la segunda ejecución (memory grant feedback).`,
        { nodos: [n.id] });
    }

    // 6. Concesión de memoria excesiva / espera por memoria
    const mgw = p.avisos.find((a) => a.tipo === "MemoryGrantWarning");
    const m = p.memoria;
    if (mgw || (m.GrantedMemory >= 10240 && m.MaxUsedMemory !== undefined && m.GrantedMemory >= 10 * Math.max(m.MaxUsedMemory, 1))) {
      const concedida = mgw ? mgw.concedida : m.GrantedMemory, usada = mgw ? mgw.usada : m.MaxUsedMemory;
      agregar(concedida >= 1024 * 1024 ? "alta" : "media", `Pidió ${fmtKB(concedida)} de memoria y usó ${fmtKB(usada)}`,
        `La concesión de memoria (memory grant) se calcula con las filas estimadas. Acá se reservaron ${fmtKB(concedida)} para usar ${fmtKB(usada)}: esa memoria quedó bloqueada para las demás consultas mientras esta corría. Si varias hacen lo mismo a la vez, las siguientes esperan (RESOURCE_SEMAPHORE) aunque el servidor tenga RAM de sobra.`,
        "Corregí la estimación (suele ser la misma causa que el hallazgo de estimaciones: parámetros, estadísticas). Como parche, `OPTION (MAX_GRANT_PERCENT = n)`. El sort o el hash que piden la memoria se evitan con un índice adecuado.", { nodos: nodos.filter((n) => n.fisico === "Sort" || n.fisico === "Hash Match").map((n) => n.id) });
    }
    if (m.GrantWaitTime > 0) agregar(m.GrantWaitTime >= 1000 ? "alta" : "media", `Esperó ${fmtMs(m.GrantWaitTime * 1000)} para que le dieran memoria`, "La consulta no pudo empezar hasta que otras liberaron memoria de concesión: el servidor tenía demasiadas consultas con sort/hash grandes a la vez.", "Bajá lo que pide esta (mejores estimaciones, índices que eviten el sort) y revisá quién más está pidiendo memoria (sys.dm_exec_query_memory_grants).");

    // 7. Conversiones implícitas
    const convs = p.avisos.filter((a) => a.tipo === "PlanAffectingConvert").concat(nodos.flatMap((n) => n.avisos.filter((a) => a.tipo === "PlanAffectingConvert").map((a) => Object.assign({ nodo: n.id }, a))));
    const vistas = new Set();
    for (const c of convs) {
      if (vistas.has(c.expresion)) continue; vistas.add(c.expresion);
      const mt = /CONVERT_IMPLICIT\((\w+(?:\([^)]*\))?),\s*(\[[^\]]+\]\.)*\[([^\]]+)\]/i.exec(c.expresion);
      const tipoDestino = mt ? mt[1] : "otro tipo", columna = mt ? mt[3] : "la columna";
      const seek = c.problema === "Seek Plan";
      agregar(seek ? "alta" : "media", `Conversión implícita de «${columna}» a ${tipoDestino}${seek ? ": no puede usar el índice" : ": estimación a ciegas"}`,
        `La expresión «${recortar(c.expresion, 120)}» convierte la columna al tipo del parámetro, no al revés. ${seek ? "Al convertir la columna, el índice sobre ella no sirve para buscar: se recorre entero y se compara fila por fila." : "El optimizador no puede usar las estadísticas de la columna convertida y estima a ciegas."} El caso típico: columna varchar y parámetro nvarchar (C# manda los string como nvarchar salvo que le digas lo contrario).`,
        "Igualá el tipo del parámetro al de la columna: en Dapper, `new DbString { Value = x, IsAnsi = true, Length = n }`; en EF Core, `.IsUnicode(false)` o `HasColumnType(\"varchar(n)\")` en la configuración; en ADO.NET, `SqlDbType.VarChar`. Con `sp_executesql` a mano, declará el parámetro con el tipo de la columna. La otra opción es cambiar la columna a nvarchar, si la aplicación lo justifica.",
        { nodos: c.nodo !== undefined ? [c.nodo] : nodos.filter((n) => esScan(n) && (n.predicado || "").includes("CONVERT_IMPLICIT")).map((n) => n.id) });
    }

    // 8. Join sin predicado
    for (const n of nodos.filter((x) => x.avisos.some((a) => a.tipo === "NoJoinPredicate"))) {
      const ext = n.hijos[0], int = n.hijos[1];
      agregar("alta", "Join sin condición: producto cartesiano", `${nombreNodo(n)} combina cada fila de un lado con cada fila del otro${ext && int ? ` (${fmtNum(filasReales(ext) !== null ? filasReales(ext) : ext.filasEstTotales, 0)} × ${fmtNum(filasReales(int) !== null ? filasReales(int) : int.filasEstTotales, 0)})` : ""}. Si no es un CROSS JOIN a propósito, falta una condición de join (un ON, o un WHERE que une las tablas).`, "Revisá el FROM: una tabla listada con coma sin su condición en el WHERE, o un JOIN con un ON que compara una tabla consigo misma. Si es intencional (una tabla de números, un calendario), está bien.", { nodos: [n.id] });
    }

    // 8b. Índices filtrados que no se pudieron usar por la parametrización
    if (p.indicesNoUsados.length || nodos.some((n) => n.avisos.some((a) => a.tipo === "UnmatchedIndexes"))) {
      const nombres = p.indicesNoUsados.map((o) => `${o.nombre} (${o.indice})`);
      const afectados = nodos.filter((n) => n.avisos.some((a) => a.tipo === "UnmatchedIndexes") || (esScan(n) && n.objeto && p.indicesNoUsados.some((o) => o.tabla === n.objeto.tabla)));
      agregar(afectados.some((n) => esScan(n) && (n.real ? n.real.filasLeidas || n.real.filas : n.cardinalidadTabla || 0) >= 10000) ? "media" : "baja", `Hay un índice filtrado que no se puede usar porque la consulta está parametrizada${nombres.length ? `: ${nombres.join(", ")}` : ""}`,
        `El plan se compila una vez y se reutiliza con cualquier valor del parámetro, pero el índice filtrado solo tiene las filas que cumplen su WHERE: un plan que lo use sería incorrecto para otros valores, así que el optimizador lo descarta (UnmatchedIndexes) y ${afectados.some(esScan) ? "lee la tabla entera" : "usa otro camino"}. Pasa siempre que la columna del filtro del índice llega como parámetro (Dapper, EF Core, sp_executesql, procedimientos).`,
        "Escribí la condición del filtro del índice como literal en la consulta (en EF Core, la constante en el código y no en una variable; o una consulta aparte para ese caso), usá `OPTION (RECOMPILE)` para que compile con el valor real, o en un procedimiento separá con un IF. Si el índice filtrado no se usa nunca, borralo: solo cuesta.",
        { nodos: afectados.map((n) => n.id) });
    }

    // 9. Columnas sin estadísticas
    for (const n of nodos.filter((x) => x.avisos.some((a) => a.tipo === "ColumnsWithNoStatistics"))) {
      const a = n.avisos.find((x) => x.tipo === "ColumnsWithNoStatistics");
      agregar("media", `Sin estadísticas sobre ${a.columnas.join(", ")}`, `El optimizador no tiene estadísticas de ${a.columnas.join(", ")} y estimó a ciegas en ${nombreNodo(n)}. Suele pasar con AUTO_CREATE_STATISTICS apagado en la base, o en columnas de una tabla recién creada.`, "Creá las estadísticas (`CREATE STATISTICS st_col ON tabla (col)`) o encendé `AUTO_CREATE_STATISTICS` en la base. Si la columna se filtra seguido, directamente un índice.", { nodos: [n.id] });
    }

    // 10. Parameter sniffing (parámetros distintos)
    const distintos = p.parametros.filter((q) => q.compilado !== undefined && q.ejecucion !== undefined && q.compilado !== q.ejecucion);
    if (distintos.length) {
      const yaDesvio = H.some((h) => /erró las filas/.test(h.titulo));
      agregar(yaDesvio ? "alta" : "info", `El plan se compiló con ${distintos.map((q) => `${q.nombre} = ${q.compilado}`).join(", ")} y corrió con ${distintos.map((q) => `${q.ejecucion}`).join(", ")}`,
        `El plan en caché se armó para ${distintos.length === 1 ? "un valor" : "unos valores"} y esta ejecución usó ${distintos.length === 1 ? "otro" : "otros"}. Si la cantidad de filas que devuelve cambia mucho según el valor (un cliente con 10 pedidos y otro con 100.000), el mismo plan sirve para uno y es un desastre para el otro: eso es parameter sniffing.${yaDesvio ? " Acá se ve: las estimaciones no coinciden con las filas reales." : " En esta ejecución las estimaciones no se desviaron demasiado, así que por ahora no molesta."}`,
        yaDesvio ? "Opciones, de menos a más invasiva: `OPTION (RECOMPILE)` en esa consulta (compila cada vez, con el valor real); `OPTION (OPTIMIZE FOR (@p = valor típico))` o `OPTIMIZE FOR UNKNOWN`; separar en dos consultas o procedimientos según el caso; o un índice que cubra bien ambos escenarios para que el plan sea el mismo. SQL Server 2022 trae PSP optimization, que guarda varios planes por consulta." : "Nada por ahora. Si la consulta a veces tarda mucho y a veces nada con la misma forma, acordate de esto.",
        { nodos: [] });
    }

    // 11. Timeout del optimizador
    if (s.abortoTemprano === "TimeOut") agregar("media", "El optimizador se quedó sin tiempo y entregó el mejor plan que tenía", `Con ${nodos.length} operadores y muchos joins, el optimizador agotó su presupuesto de búsqueda antes de recorrer todas las alternativas (StatementOptmEarlyAbortReason = TimeOut). El plan puede ser razonable o puede ser malo; no lo eligió por bueno, lo eligió porque se acabó el tiempo.`, "Simplificá la consulta: menos joins por sentencia, materializar partes en tablas temporales (#t, con estadísticas propias), sacar vistas anidadas, evitar OR entre tablas distintas (partir en UNION ALL). También ayuda tener índices que hagan obvias las elecciones.");
    if (s.abortoTemprano === "MemoryLimitExceeded") agregar("media", "El optimizador se quedó sin memoria para compilar", "La consulta es tan grande que la compilación superó su límite de memoria y se eligió un plan incompleto.", "Partí la consulta en partes más chicas con tablas temporales.");

    // 12. Spools
    for (const n of nodos.filter((x) => /Spool$/.test(x.fisico) && x.fisico !== "Row Count Spool" && x.fisico !== "Window Spool")) {
      const ansioso = n.logico === "Eager Spool";
      if (n.fisico === "Index Spool") {
        agregar(ansioso ? "alta" : "media", `Index Spool: el optimizador se armó un índice al vuelo${n.objeto ? ` sobre ${n.objeto.nombre}` : ""}`, `${nombreNodo(n)} copia ${n.real ? fmtNum(n.real.filas, 0) : fmtNum(n.filasEstTotales, 0)} filas a tempdb y les arma un índice temporal porque la consulta necesita buscar en ellas muchas veces y no existe un índice que sirva. Se repite en cada ejecución de la consulta.`, "Creá el índice permanente sobre las columnas por las que busca el spool (mirá las columnas de salida del operador y la condición del join que está arriba). Es de los arreglos con mejor relación costo-beneficio.", { nodos: [n.id] });
      } else if (n.fisico === "Table Spool" && n.padre && n.padre.fisico === "Nested Loops" && n.padre.hijos[1] === n) {
        const ej = ejecuciones(n);
        const filasSpool = n.real ? n.real.filas : n.filasEstTotales;
        if (nodos.some((x) => x.fisico === "Nested Loops" && x.hijos[1] === n && H.some((h) => h.nodos.includes(x.id)))) continue; // ya cubierto por el hallazgo de bucles
        agregar(filasSpool >= 10000000 ? "alta" : ej >= 1000 || filasSpool >= 1000000 ? "media" : "baja", `Table Spool en el lado interno de un Nested Loops (${fmtNum(ej, 0)} ejecuciones, ${fmtNum(filasSpool, 0)} filas releídas)`, `${nombreNodo(n)} guarda en tempdb el resultado del lado interno para releerlo en cada vuelta del bucle en vez de volver a leer la tabla. Avisa que el join no tiene un índice cómodo del lado interno${n.hijos[0] && n.hijos[0].objeto ? ` (${n.hijos[0].nombreEs} sobre ${n.hijos[0].objeto.nombre})` : ""}.`, "Un índice sobre la columna de join del lado interno lo convierte en un seek y el spool desaparece. Si la condición de join no es de igualdad (rangos, expresiones), revisá si se puede reescribir.", { nodos: [n.id] });
      } else if (ansioso && n.fisico === "Table Spool" && !/Insert|Update|Delete/.test(s.tipo)) {
        agregar("info", "Table Spool ansioso", `${nombreNodo(n)} materializa todas las filas antes de seguir: típico en UPDATE/DELETE que leen la misma tabla que modifican (protección Halloween) o en CTE recursivas.`, "Si es por modificar la tabla que se lee, es necesario; si no, revisá la consulta.", { nodos: [n.id] });
      }
    }

    // 13. Sorts caros
    for (const n of nodos.filter((x) => x.fisico === "Sort")) {
      const filas = n.real ? n.real.filas : n.filasEstTotales;
      if (n.porcentaje < 25 && filas < 100000) continue;
      if (n.real && n.real.filas === 0) continue;
      if (n.avisos.some((a) => a.tipo === "SpillToTempDb")) continue; // ya reportado
      const padreTop = n.padre && n.padre.fisico === "Top";
      agregar(n.porcentaje >= 50 || filas >= 1000000 ? "media" : "baja", `El ordenamiento se lleva el ${fmtNum(n.porcentaje, 0)} % del costo (${fmtNum(filas, 0)} filas por ${(n.detalle.ordenPor || []).join(", ") || "varias columnas"})`,
        `${n.logico === "TopN Sort" ? "Un Top N Sort ordena para quedarse con las primeras filas: barato en memoria, pero igual tiene que leer todo lo de abajo." : n.logico === "Distinct Sort" ? "El Sort está haciendo el DISTINCT." : "El Sort ordena en memoria (o en tempdb) todo lo que le llega, y necesita todas las filas antes de soltar la primera."}${padreTop ? " Está debajo de un Top." : ""} ${filas >= 100000 ? `Son ${fmtNum(filas, 0)} filas.` : ""}`,
        `Un índice cuyo orden coincida con el ORDER BY (${(n.detalle.ordenPor || []).join(", ") || "esas columnas"}, con las columnas del WHERE adelante si las hay) hace que las filas ya vengan ordenadas y el Sort desaparece. Si el orden es solo para paginar, un índice así hace que \`OFFSET/FETCH\` o \`TOP\` lean solo lo necesario. ${n.logico === "Distinct Sort" ? "Si el DISTINCT es para tapar duplicados de un join, el problema es el join." : ""}`,
        { nodos: [n.id] });
    }

    // 14. Nested loops con lado interno pesado
    for (const n of nodos.filter((x) => x.fisico === "Nested Loops" && x.hijos.length === 2)) {
      const interno = n.hijos[1];
      const ej = ejecuciones(interno);
      const trabajoInterno = interno.real ? interno.real.filas : interno.filasEstTotales;
      if (ej < 1000 && trabajoInterno < 1000000) continue;
      const scanDentro = buscarEnSubarbol(interno, (x) => esScan(x) && !(x.objeto && (x.objeto.esTemporal || x.objeto.esVariable)) && !x.esLookup);
      const spoolDentro = buscarEnSubarbol(interno, (x) => /Spool$/.test(x.fisico));
      const internoLookup = interno.esLookup;
      if (internoLookup) continue; // ya reportado como lookup
      const leidasInterno = interno.real ? interno.real.filas : null;
      if (scanDentro) {
        agregar("alta", `Bucles anidados que recorren ${scanDentro.objeto ? scanDentro.objeto.nombre : "una tabla"} ${fmtNum(ej, 0)} veces`, `${nombreNodo(n)} ejecuta el lado interno ${fmtNum(ej, 0)} veces, y adentro hay un ${scanDentro.nombreEs}${spoolDentro ? ` guardado en un ${spoolDentro.nombreEs} que se relee en cada vuelta` : ""}${leidasInterno !== null ? `: el lado interno entregó ${fmtNum(leidasInterno, 0)} filas en total` : ""}. Es multiplicar: filas externas × filas de la tabla interna.${n.predicado && !/=/.test(n.predicado.replace(/[<>]=/g, "")) ? " La condición del join no es de igualdad, así que ni hash ni merge sirven." : ""}`, "Un índice sobre la columna de join del lado interno convierte el recorrido en una búsqueda. Si las estimaciones estaban mal (ver arriba), al corregirlas el optimizador probablemente elija un Hash Match en vez de bucles. Si la condición compara una expresión (CAST, cálculo), guardá la expresión en una columna calculada persistida e indexala.", { nodos: [n.id, scanDentro.id] });
      } else if (ej >= 100000) {
        agregar("media", `Bucles anidados con ${fmtNum(ej, 0)} ejecuciones del lado interno`, `${nombreNodo(n)} repite el lado interno (${interno.nombreEs}) ${fmtNum(ej, 0)} veces. Aunque cada vuelta sea una búsqueda rápida, son muchas vueltas${n.filasEst < ej / 10 ? `; el optimizador esperaba ${fmtNum(n.hijos[0].filasEstTotales, 0)} filas del lado externo` : ""}.`, "Si las estimaciones del lado externo estaban bajas, corregirlas lleva a un Hash o Merge Join. Si no, un índice que cubra el lado interno reduce el costo de cada vuelta.", { nodos: [n.id] });
      }
    }

    // 15. UDF escalar
    const udfCpu = p.tiempos && p.tiempos.udfCpuMs !== null ? p.tiempos.udfCpuMs : null;
    const udfNodos = nodos.filter((n) => (n.detalle.expresiones || []).some((e) => /\[\w+\]\.\[\w+\]\(/.test(e)));
    if (/UserDefinedFunction/.test(p.razonNoParalelo) || udfCpu || udfNodos.length) {
      const filas = udfNodos.length ? (udfNodos[0].real ? udfNodos[0].real.filas : udfNodos[0].filasEstTotales) : null;
      agregar(filas !== null && filas >= 10000 ? "alta" : "media", "Función escalar definida por el usuario: se ejecuta una vez por fila", `${udfNodos.length ? `${nombreNodo(udfNodos[0])} llama a una función escalar (${recortar((udfNodos[0].detalle.expresiones || []).find((e) => /\[\w+\]\.\[\w+\]\(/.test(e)) || "", 100)})${filas !== null ? ` para ${fmtNum(filas, 0)} filas` : ""}. ` : ""}Las funciones escalares T-SQL se ejecutan fila por fila, su costo no se ve en el plan${udfCpu !== null ? ` (acá sí: ${fmtMs(udfCpu)} de CPU de ${fmtMs(p.tiempos.cpuMs)} totales fueron de la función)` : ""} y obligan a un plan serial${/UserDefinedFunction/.test(p.razonNoParalelo) ? " (NonParallelPlanReason = TSQLUserDefinedFunctionsNotParallelizable)" : ""}.`,
        "Reemplazá la función por la expresión directa en la consulta, por una función con valores de tabla inline (`RETURNS TABLE AS RETURN SELECT …`) con CROSS APPLY, o por una columna calculada. En SQL Server 2019+ con compatibilidad 150 muchas funciones escalares se «inlinean» solas, salvo que usen GETDATE(), tengan WHILE, o estén marcadas WITH INLINE = OFF.", { nodos: udfNodos.map((n) => n.id) });
    }

    // 16. Paralelismo
    if (p.razonNoParalelo && !/UserDefinedFunction/.test(p.razonNoParalelo)) agregar(s.costo >= 50 ? "media" : "info", `No se pudo paralelizar: ${RAZONES_NO_PARALELO[p.razonNoParalelo] || p.razonNoParalelo}`, `El costo estimado (${fmtCosto(s.costo)}) hace que el optimizador quiera un plan paralelo, pero no pudo porque ${RAZONES_NO_PARALELO[p.razonNoParalelo] || p.razonNoParalelo}.`, s.costo >= 50 ? "Si la consulta es pesada, sacá lo que bloquea el paralelismo (la variable de tabla, la función, el cursor)." : "Con este costo no importa mucho.");
    const esperaCx = p.esperas.filter((e) => /^CX/.test(e.tipo)).reduce((a, e) => a + e.ms, 0);
    if (p.dop > 1 && p.tiempos && esperaCx > 0 && p.tiempos.transcurridoMs > 500 && esperaCx > p.tiempos.transcurridoMs * (p.dop - 1) * 0.8) {
      agregar("baja", "Los hilos paralelos pasaron casi todo el tiempo esperándose", `Plan con ${p.dop} hilos, pero las esperas CX suman ${fmtMs(esperaCx)} contra ${fmtMs(p.tiempos.transcurridoMs)} de duración: probablemente uno o dos hilos hicieron todo el trabajo (reparto desparejo) o el paralelismo no aporta.`, "Revisá si un operador tiene todas las filas en un solo hilo (en el árbol, hilos por operador) y si las estimaciones son correctas. A veces `OPTION (MAXDOP 1)` es más rápido para esa consulta en particular.");
    }

    // 17. Esperas dominantes
    if (p.tiempos && p.esperas.length) {
      const total = p.tiempos.transcurridoMs;
      for (const e of p.esperas.slice(0, 3)) {
        if (/^CX|^HT|^BP|MEMORY_ALLOCATION/.test(e.tipo)) continue;
        if (e.ms >= 100 && e.ms >= total * 0.3) agregar(e.ms >= total * 0.7 && total >= 1000 ? "media" : "baja", `${fmtMs(e.ms)} de ${fmtMs(total)} se fueron esperando ${e.tipo}`, `${e.significado || "Espera registrada durante la ejecución."}`, /ASYNC_NETWORK/.test(e.tipo) ? "Traé menos filas (paginar, filtrar en el servidor) y consumí el resultado de un tiro (ToList o DataTable), sin procesar entre lecturas." : /PAGEIOLATCH/.test(e.tipo) ? "Menos páginas leídas (índices que cubran la consulta) o más memoria para el buffer pool. Mirá las lecturas físicas en el árbol." : /^LCK_/.test(e.tipo) ? "Mirá qué sesión bloqueaba (sys.dm_exec_requests, blocking_session_id), acortá las transacciones y revisá si READ COMMITTED SNAPSHOT aplica a tu base." : /RESOURCE_SEMAPHORE/.test(e.tipo) ? "Reducí la memoria que piden las consultas (estimaciones, índices que eviten sort y hash)." : /SOS_SCHEDULER/.test(e.tipo) ? "Es CPU: menos filas procesadas (índices, filtros antes del join) o menos trabajo por fila (funciones)." : /IO_COMPLETION/.test(e.tipo) ? "Suele venir de derrames a tempdb: ver los hallazgos de spill." : "Revisá el significado de la espera en la documentación de sys.dm_os_wait_stats.");
      }
    }

    // 18. CPU vs tiempo
    if (p.tiempos && p.tiempos.transcurridoMs >= 1000) {
      const t = p.tiempos;
      if (t.cpuMs < t.transcurridoMs * 0.3 && !p.esperas.length) agregar("info", `Tardó ${fmtMs(t.transcurridoMs)} pero usó ${fmtMs(t.cpuMs)} de CPU: el resto fue espera`, "La diferencia entre duración y CPU es tiempo esperando: disco, bloqueos, red o el cliente consumiendo filas. El plan no trae WaitStats, así que no se puede decir cuál.", "Capturá el plan con SQL Server 2016 SP1+ (trae esperas) o mirá sys.dm_exec_session_wait_stats mientras corre.");
    }

    // 19. Compilación cara
    if (p.compilacionMs >= 500) agregar(p.compilacionMs >= 3000 ? "media" : "baja", `Compilar el plan llevó ${fmtMs(p.compilacionMs)}`, `Solo armar el plan tardó ${fmtMs(p.compilacionMs)} (${fmtKB(p.compilacionKB)} de memoria). Si la consulta se compila seguido (texto distinto cada vez, OPTION (RECOMPILE), caché que se vacía), ese costo se paga en cada ejecución.`, "Parametrizá la consulta (parámetros en vez de literales concatenados), evitá RECOMPILE si no hace falta y simplificá la consulta. En SQL Server 2022, la cache de planes de consultas ad hoc se puede controlar con «optimize for ad hoc workloads».");

    // 20. Plan trivial / parametrización simple / CE
    if (s.nivelOptimizacion === "TRIVIAL") agregar("info", "Plan trivial: no hubo optimización", "La consulta tenía una sola forma razonable de ejecutarse (una tabla, filtro por clave), así que el optimizador no evaluó alternativas. Por eso tampoco sugiere índices faltantes.", "Nada que hacer. Si ves que es lenta, el problema no es el plan: bloqueos, red o cantidad de ejecuciones.");
    if (/@1\b|@\d+\b/.test(s.texto) && !p.parametros.some((q) => !/^@\d+$/.test(q.nombre)) && p.parametros.length) agregar("info", "La consulta se parametrizó sola (simple parameterization)", "El texto tenía literales (`= 4242`) y SQL Server los reemplazó por parámetros (`@1`) para reutilizar el plan entre valores distintos. Está bien, pero el plan queda atado al primer valor que se compiló.", "Si mandás la consulta desde .NET, usá parámetros explícitos de entrada en lugar de concatenar valores: mismo plan, sin inyección SQL.");
    if (s.versionCE !== null && s.versionCE <= 70) agregar("info", "Usa el estimador de cardinalidad viejo (CE 70)", "La base está en compatibilidad 110 o menor, o se forzó el estimador legado. No es un error, pero las estimaciones para joins y filtros múltiples son distintas a las del estimador nuevo (120+).", "Si la base está en compatibilidad vieja por costumbre, probá subirla en un entorno de prueba con Query Store encendido para comparar.");

    // 21. Row goal
    for (const n of nodos.filter((x) => x.filasSinMetaEst !== null && x.filasSinMetaEst > 0)) {
      if (n.filasSinMetaEst / Math.max(n.filasEst, 0.001) < 100 || !(n.real && n.real.filas > n.filasEst * 10)) continue;
      agregar("media", `Meta de filas (TOP / EXISTS) engañosa en ${nombreNodo(n)}`, `Por un TOP, EXISTS o IN, el optimizador asumió que iba a encontrar lo que buscaba enseguida y estimó ${fmtNum(n.filasEst, 0)} filas (sin la meta serían ${fmtNum(n.filasSinMetaEst, 0)}). En la ejecución pasaron ${fmtNum(n.real.filas, 0)}: las filas que buscaba estaban al final, o no existían.`, "Si la consulta busca algo raro con TOP, probá `OPTION (USE HINT ('DISABLE_OPTIMIZER_ROWGOAL'))` o un índice que lleve directo a esas filas.", { nodos: [n.id] });
      break;
    }

    // 22. Adaptive join / batch mode (info)
    const adapt = nodos.find((n) => n.fisico === "Adaptive Join");
    if (adapt) agregar("info", `Join adaptativo: eligió ${adapt.detalle.joinReal ? (adapt.detalle.joinReal === "HashMatch" ? "hash" : "bucles anidados") : "en tiempo de ejecución"}${adapt.detalle.umbralAdaptativo ? ` (umbral: ${fmtNum(adapt.detalle.umbralAdaptativo, 0)} filas)` : ""}`, "El plan tiene un Adaptive Join: espera a ver cuántas filas llegan y recién ahí decide entre Hash Match y Nested Loops. Es una ventaja de batch mode (SQL Server 2017+ con columnstore, o 2019+ en rowstore).", "Nada que hacer; es buena señal.", { nodos: [adapt.id] });

    // 23. Modificaciones
    const modif = nodos.filter((n) => /Insert|Update|Delete|Merge/.test(n.fisico) && n.clase === "modificacion");
    if (modif.length) {
      const indices = nodos.filter((n) => /^Index (Insert|Update|Delete)$/.test(n.fisico)).length;
      const filas = modif[0].real ? modif[0].real.filas : modif[0].filasEstTotales;
      agregar("info", `Modifica ${fmtNum(filas, 0)} filas${indices ? ` y mantiene ${indices} índice${indices > 1 ? "s" : ""} aparte` : ""}`, `${modif.map(nombreNodo).join("; ")}. ${indices ? "Cada índice no agrupado sobre columnas modificadas se actualiza también (operadores Index Insert/Update/Delete): más índices, más caro escribir." : "Los índices no agrupados se mantienen dentro del mismo operador (narrow plan) o no hacen falta."}`, "Si la parte de lectura (el WHERE) es lo que pesa, aplican los mismos hallazgos que para un SELECT. Si pesa la escritura, revisá índices que nadie usa (sys.dm_db_index_usage_stats).", { nodos: modif.map((n) => n.id) });
    }

    // 24. Lecturas totales grandes (info de contexto)
    if (real && s.lecturasLogicas >= 10000 && !H.some((h) => h.gravedad === "alta")) agregar("baja", `Leyó ${fmtPaginas(s.lecturasLogicas)} en total`, `Sumando todos los operadores, la consulta tocó ${fmtPaginas(s.lecturasLogicas)}${s.lecturasFisicas ? `, de las cuales ${fmtNum(s.lecturasFisicas, 0)} vinieron del disco` : ""}. Es la medida más estable de cuánto trabajo hace una consulta: el tiempo varía, las lecturas no.`, "Compará este número antes y después de cada cambio de índice o de consulta.");

    H.sort((a, b) => GRAVEDAD[a.gravedad] - GRAVEDAD[b.gravedad]);
    return H;
  }

  function buscarEnSubarbol(n, pred) {
    if (pred(n)) return n;
    for (const h of n.hijos) { const r = buscarEnSubarbol(h, pred); if (r) return r; }
    return null;
  }

  function recortar(s, n) { s = (s || "").replace(/\s+/g, " "); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  /* ------------------------------------------------------------------ */
  /* Resumen                                                             */
  /* ------------------------------------------------------------------ */

  function resumir(s) {
    const p = s.plan;
    const partes = [];
    partes.push(`${s.tipo || "Consulta"}${s.nivelOptimizacion === "TRIVIAL" ? " con plan trivial" : ""}, costo estimado ${fmtCosto(s.costo)}`);
    if (s.esReal && s.filasReales !== null) partes.push(`devolvió ${plural(s.filasReales, "fila")} (estimaba ${fmtNum(s.filasEst, 0)})`);
    else partes.push(`estima ${plural(s.filasEst, "fila")}`);
    if (p.dop !== null) partes.push(p.dop > 1 ? `paralela con ${p.dop} hilos` : "serial");
    if (p.tiempos) partes.push(`${fmtMs(p.tiempos.transcurridoMs)} de duración y ${fmtMs(p.tiempos.cpuMs)} de CPU`);
    if (s.esReal && s.lecturasLogicas) partes.push(`${fmtPaginas(s.lecturasLogicas)} leídas`);
    const pesados = s.nodos.filter((n) => n.porcentaje > 0 && !n.noEjecutado).sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 3);
    const frase = partes.join(", ") + ".";
    const masPesa = pesados.length ? ` Lo que más pesa: ${pesados.map((n) => `${nombreNodo(n)} (${fmtNum(n.porcentaje, 0)} %)`).join(", ")}.` : "";
    const altas = s.hallazgos.filter((h) => h.gravedad === "alta").length, medias = s.hallazgos.filter((h) => h.gravedad === "media").length;
    const veredicto = altas ? `${altas} problema${altas > 1 ? "s" : ""} serio${altas > 1 ? "s" : ""}${medias ? ` y ${medias} para mirar` : ""}.` : medias ? `${medias} cosa${medias > 1 ? "s" : ""} para mirar, nada grave.` : "No encontré nada serio.";
    return { frase, masPesa, veredicto, pesados: pesados.map((n) => n.id) };
  }

  /* ------------------------------------------------------------------ */
  /* Texto plano del árbol (para tests y para copiar)                    */
  /* ------------------------------------------------------------------ */

  function lineaNodo(n) {
    const filas = n.real ? `${fmtNum(n.filasEstTotales, 0)} est → ${fmtNum(n.real.filas, 0)} reales` : `${fmtNum(n.filasEstTotales, 0)} est`;
    const ej = ejecuciones(n);
    const hilos = n.real ? n.real.hilos : 0;
    const ejTexto = n.noEjecutado ? " · no se ejecutó" : hilos > 1 && ej <= hilos ? ` · ${hilos} hilos` : ej > 1 ? ` · ${fmtNum(ej, 0)} ejec.` : "";
    return `[${fmtNum(n.porcentaje, 0).padStart(3)} %] ${n.nombreEs}${n.logicoEs ? ` (${n.logicoEs})` : ""}${n.objeto ? ` · ${n.objeto.nombreCompleto}` : ""} · ${filas}${ejTexto}${n.real && n.real.lecturasLogicas ? ` · ${fmtNum(n.real.lecturasLogicas, 0)} lect.` : ""}${n.avisos.length ? " ⚠" : ""}`;
  }

  function arbolTexto(s) {
    const lineas = [];
    const rec = (n, prof) => { lineas.push("  ".repeat(prof) + lineaNodo(n)); for (const h of n.hijos) rec(h, prof + 1); };
    if (s.raiz) rec(s.raiz, 0);
    return lineas.join("\n");
  }

  function glosario() {
    return Object.keys(OPERADORES).filter((k) => k !== "Hash Match Aggregate").map((k) => ({ ingles: k, nombre: OPERADORES[k][0], clase: OPERADORES[k][1], descripcion: OPERADORES[k][2] }));
  }

  return { analizar, parsearXml, diagnosticar, arbolTexto, lineaNodo, glosario, scriptIndice, plural, fmtNum, fmtKB, fmtMs, fmtCosto, fmtPaginas, nombreNodo, recortar, OPERADORES, ESPERAS, RAZONES_NO_PARALELO, GRAVEDAD };
});
