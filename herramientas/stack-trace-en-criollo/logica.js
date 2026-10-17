/* Stack trace en criollo: lógica pura, sin DOM.
   Parsea el texto de Exception.ToString() de .NET (Core y Framework, en inglés o en español, incluso escapado
   dentro de un JSON de logs), arma el árbol de excepciones (externa → internas → causa raíz, AggregateException
   con varias), desenmaraña los nombres que inventa el compilador (lambdas, async, iteradores, funciones locales,
   top-level statements), clasifica cada frame (tuyo, framework, librería, ruido del runtime) y diagnostica la
   causa raíz con una base de conocimiento de errores típicos de un backend .NET.
   Se usa desde index.html y desde los tests (Node). */
(function (raiz) {
  "use strict";

  // ---------- Preparación del texto ----------

  /** Si el texto es un JSON de log (Serilog, Elastic, etc.) saca el campo que tiene la traza. */
  function sacarDeJson(texto) {
    const t = texto.trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return null;
    let obj;
    try { obj = JSON.parse(t); } catch { return null; }
    let mejor = null;
    (function recorrer(v) {
      if (typeof v === "string") { if (/(^|\n)\s*(at|en)\s+\S+\(|Exception/.test(v) && (!mejor || v.length > mejor.length)) mejor = v; }
      else if (v && typeof v === "object") Object.values(v).forEach(recorrer);
    })(obj);
    return mejor;
  }

  /** Desescapa un texto pegado desde un JSON o un string de C#: \r\n, \n, \t, \", \\, '. */
  function desescapar(texto) {
    return texto
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\r\\n|\\n|\\r/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, "\"")
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  function prepararTexto(original) {
    const notas = [];
    let texto = original.replace(/^﻿/, "");
    const deJson = sacarDeJson(texto);
    if (deJson !== null) { texto = deJson; notas.push("json"); }
    const saltosReales = (texto.match(/\n/g) || []).length;
    const saltosEscapados = (texto.match(/\\r\\n|\\n/g) || []).length;
    if (saltosEscapados >= 2 && saltosEscapados > saltosReales * 2) { texto = desescapar(texto); notas.push("escapado"); }
    texto = texto.replace(/\r\n?/g, "\n");
    // A veces la traza llega en una sola línea, con «   at» pegado: lo separamos.
    texto = texto.replace(/([)\]])\s{2,}(?=(?:at|en)\s+[\w<>.`\[]+[.(])/g, "$1\n   ");
    return { texto, notas };
  }

  // ---------- Reconocimiento de líneas ----------

  const RE_FRAME = /^\s*(?:at|en|bei|à|in|em)\s+(\S.*?)\s*$/;
  const RE_ARCHIVO = /\s+(?:in|en|dans|em|bei)\s+(.+?):(?:line|línea|linea|ligne|Zeile|riga|linha|regel)\s+(\d+)\s*$/;
  const RE_ARCHIVO_SOLO = /\s+(?:in|en)\s+(\S.*\.(?:cs|vb|fs|razor|cshtml))\s*$/;
  const RE_INNER_START = /^\s*--->\s*(?:\(Inner Exception #(\d+)\)\s*)?(.*)$/;
  const RE_INNER_END = /^\s*---\s*(?:End of inner exception stack trace|Fin del seguimiento de la pila de la excepción interna|Fin de la traza de la pila de la excepción interna|Fin de seguimiento de la pila de la excepción interna)\s*---\s*$/i;
  const RE_PREV = /^\s*---\s*(?:End of stack trace from previous location(?: where exception was thrown)?|Fin del seguimiento de la pila de la ubicación anterior(?: donde se produjo la excepción)?|Fin de la pila de seguimiento de la ubicación anterior donde se produjo la excepción)\s*---\s*$/i;
  const RE_CIERRE_AGREGADA = /<---\s*$/;
  const RE_PREFIJO = /^\s*(?:Unhandled exception\.|Excepción no controlada\.|Unhandled Exception:|Exception Info:|Información de la excepción:)\s*/;
  // Tipo: identificador con puntos, `1, +anidado; el último segmento tiene Exception o Error.
  const RE_HEADER = /^\s*((?:[A-Za-z_][\w]*[.+])*(?:[A-Za-z_]\w*)?(?:Exception|Error)\w*(?:`\d+)?(?:\[[^\]]*\])?)(?:\s*\((0x[0-9A-Fa-f]{8}|-?\d+)\))?(?::\s?(.*))?$/;
  const RE_EXTRA = /^\s*([A-Za-z][\w ]{1,30}):\s*(.*)$/;
  const RE_EXTRA_SQL = /Error Number:\s*(-?\d+)\s*,\s*State:\s*(\d+)\s*,\s*Class:\s*(\d+)/;
  const RE_CONSOLA_LOG = /^\s*(fail|crit|warn|info|dbug|trce):\s+([\w.]+)\[(\d+)\]\s*$/;

  function nuevaExcepcion(tipo, mensaje, hresult, padre) {
    return { tipo: tipo || "", corto: tipo ? tipo.split(/[.+]/).pop() : "", mensaje: mensaje || "", hresult: hresult || null,
      frames: [], internas: [], padre: padre || null, extras: {}, extraTexto: [], indiceAgregada: null, cerrada: false };
  }

  function parsearHeader(linea) {
    const sinPrefijo = linea.replace(RE_PREFIJO, "");
    const m = RE_HEADER.exec(sinPrefijo);
    if (!m) return null;
    return { tipo: m[1], hresult: m[2] || null, mensaje: (m[3] || "").trim() };
  }

  // ---------- Parser principal ----------

  function parsear(original) {
    const { texto, notas } = prepararTexto(original);
    const lineas = texto.split("\n");
    const raices = [];
    const contexto = [];
    let actual = null;
    const pila = [];
    let noReconocidas = 0;

    function abrir(ex) { if (actual) pila.push(actual); actual = ex; }
    function cerrar() { if (pila.length) { actual.cerrada = true; actual = pila.pop(); } }
    function nuevaRaiz(h) { const ex = nuevaExcepcion(h.tipo, h.mensaje, h.hresult, null); raices.push(ex); pila.length = 0; actual = ex; abrirEncadenadas(ex); }
    // «Tipo: mensaje ---> Interno: mensaje» en una sola línea (.NET Framework): se abren las internas en cadena.
    function abrirEncadenadas(ex) {
      let m;
      while ((m = /^(.*?)\s+--->\s+(\S.*)$/.exec(ex.mensaje)) && parsearHeader(m[2])) {
        const h = parsearHeader(m[2]);
        ex.mensaje = m[1].trim();
        const interna = nuevaExcepcion(h.tipo, h.mensaje, h.hresult, ex);
        ex.internas.push(interna);
        abrir(interna);
        ex = interna;
      }
    }

    for (let i = 0; i < lineas.length; i++) {
      let linea = lineas[i];
      if (!linea.trim()) { if (actual && actual.frames.length === 0 && actual.mensaje) actual.mensaje += "\n"; continue; }

      let cierraAgregada = false;
      if (actual && RE_CIERRE_AGREGADA.test(linea) && (actual.indiceAgregada !== null || pila.some((e) => e.indiceAgregada !== null))) {
        linea = linea.replace(RE_CIERRE_AGREGADA, ""); cierraAgregada = true;
      }

      let m;
      if (RE_INNER_END.test(linea)) { if (actual) cerrar(); continue; }
      if (RE_PREV.test(linea)) { if (actual) actual.frames.push({ marcador: "anterior" }); continue; }
      if ((m = RE_INNER_START.exec(linea)) && actual) {
        const h = parsearHeader(m[2]) || { tipo: "", mensaje: m[2].trim(), hresult: null };
        let padre = actual;
        if (m[1] !== undefined) { while (pila.length) cerrar(); padre = actual; }
        const ex = nuevaExcepcion(h.tipo, h.mensaje, h.hresult, padre);
        if (m[1] !== undefined) ex.indiceAgregada = parseInt(m[1], 10);
        padre.internas.push(ex);
        abrir(ex);
        abrirEncadenadas(ex);
        if (cierraAgregada) cerrar();
        continue;
      }
      if ((m = RE_FRAME.exec(linea)) && /[()]|^<|^lambda_method/.test(m[1])) {
        if (!actual) nuevaRaiz({ tipo: "", mensaje: "", hresult: null });
        actual.frames.push(parsearFrame(m[1]));
        if (cierraAgregada) { while (pila.length && actual.indiceAgregada === null) cerrar(); cerrar(); }
        continue;
      }
      if ((m = RE_CONSOLA_LOG.exec(linea))) { contexto.push({ nivel: m[1], categoria: m[2], evento: m[3] }); continue; }
      const h = parsearHeader(linea);
      if (h && (!actual || actual.frames.length > 0 || (!actual.mensaje && !actual.tipo))) {
        if (actual && !actual.tipo && !actual.mensaje && actual.frames.length === 0) { actual.tipo = h.tipo; actual.corto = h.tipo.split(/[.+]/).pop(); actual.mensaje = h.mensaje; actual.hresult = h.hresult; abrirEncadenadas(actual); }
        else nuevaRaiz(h);
        continue;
      }
      if (!actual) { contexto.push({ texto: linea.trim() }); continue; }
      if (actual.frames.length === 0) { actual.mensaje = actual.mensaje ? actual.mensaje + "\n" + linea.trim() : linea.trim(); continue; }
      if ((m = RE_EXTRA_SQL.exec(linea))) { actual.extras["Error Number"] = m[1]; actual.extras.State = m[2]; actual.extras.Class = m[3]; continue; }
      if (/^\s*ClientConnectionId:/.test(linea)) { actual.extras.ClientConnectionId = linea.split(":")[1].trim(); continue; }
      if (/^\s*Exception data:\s*$/i.test(linea)) continue;
      if ((m = RE_EXTRA.exec(linea)) && !/^https?$/i.test(m[1])) { actual.extras[m[1].trim()] = m[2].trim(); continue; }
      if (RE_FRAME.test(linea)) noReconocidas++;
      actual.extraTexto.push(linea.trim());
    }
    // SqlClient y Npgsql a veces imprimen « ---> Interna» sin el «End of inner exception stack trace» cuando la interna
    // nunca se tiró (no tiene pila): los frames que siguen son de la externa. Si la externa quedó sin frames y la
    // interna nunca se cerró, se los devolvemos.
    raices.forEach((r) => todas(r).forEach((e) => {
      e.mensaje = e.mensaje.trim();
      const i = e.internas[0];
      if (e.frames.length === 0 && e.internas.length === 1 && !i.cerrada && i.frames.length && !i.internas.length) {
        e.frames = i.frames; i.frames = [];
        Object.assign(e.extras, i.extras); i.extras = {};
        e.extraTexto = i.extraTexto; i.extraTexto = [];
        e.reparada = true;
      }
    }));
    const idioma = /(^|\n)\s*en\s+\S+\(.*\)(\s+en\s+.*:línea\s+\d+)?\s*$/m.test(texto) && !/(^|\n)\s*at\s+\S+\(/m.test(texto) ? "es" : "en";
    return { raices, contexto, notas, idioma, noReconocidas, texto };
  }

  // ---------- Frames ----------

  const PREFIJOS_FRAMEWORK = ["System", "Microsoft", "mscorlib", "Internal", "Windows", "MS", "DynamicClass", "Interop"];
  const LIBRERIAS = [
    ["Microsoft.EntityFrameworkCore", "EF Core"], ["Microsoft.Data.SqlClient", "SqlClient"], ["System.Data.SqlClient", "SqlClient (viejo)"],
    ["Microsoft.AspNetCore", "ASP.NET Core"], ["Microsoft.Extensions", "Microsoft.Extensions"], ["System.Net.Http", "HttpClient"],
    ["System.Text.Json", "System.Text.Json"], ["System.Web", "ASP.NET clásico"], ["Npgsql", "Npgsql"], ["Dapper", "Dapper"], ["Newtonsoft.Json", "Newtonsoft.Json"],
    ["StackExchange.Redis", "StackExchange.Redis"], ["Serilog", "Serilog"], ["NLog", "NLog"], ["AutoMapper", "AutoMapper"], ["Mapster", "Mapster"],
    ["MediatR", "MediatR"], ["FluentValidation", "FluentValidation"], ["Polly", "Polly"], ["Hangfire", "Hangfire"], ["Quartz", "Quartz.NET"],
    ["MassTransit", "MassTransit"], ["RabbitMQ", "RabbitMQ.Client"], ["Confluent.Kafka", "Confluent.Kafka"], ["Grpc", "gRPC"], ["Swashbuckle", "Swashbuckle"],
    ["Castle", "Castle"], ["Autofac", "Autofac"], ["Moq", "Moq"], ["Xunit", "xUnit"], ["NUnit", "NUnit"], ["Oracle.ManagedDataAccess", "Oracle"],
    ["MySqlConnector", "MySqlConnector"], ["MySql.Data", "MySql.Data"], ["Pomelo", "Pomelo"], ["MongoDB", "MongoDB"], ["Azure", "Azure SDK"],
    ["Amazon", "AWS SDK"], ["Google", "Google"], ["Elastic", "Elastic"], ["Nest", "NEST"], ["Duende", "Duende"], ["IdentityModel", "IdentityModel"],
    ["Refit", "Refit"], ["RestSharp", "RestSharp"], ["Flurl", "Flurl"], ["Humanizer", "Humanizer"], ["Bogus", "Bogus"], ["Z.EntityFramework", "Z.EntityFramework"],
    ["EFCore.BulkExtensions", "EFCore.BulkExtensions"], ["LinqKit", "LinqKit"], ["Ocelot", "Ocelot"], ["Yarp", "YARP"], ["SixLabors", "ImageSharp"],
    ["ClosedXML", "ClosedXML"], ["OfficeOpenXml", "EPPlus"], ["iText", "iText"], ["QuestPDF", "QuestPDF"], ["DocumentFormat", "Open XML"],
    ["Minio", "MinIO"], ["Renci", "SSH.NET"], ["MailKit", "MailKit"], ["MimeKit", "MimeKit"], ["Sentry", "Sentry"], ["OpenTelemetry", "OpenTelemetry"],
    ["HotChocolate", "Hot Chocolate"], ["MudBlazor", "MudBlazor"], ["Radzen", "Radzen"], ["DevExpress", "DevExpress"], ["Telerik", "Telerik"], ["Syncfusion", "Syncfusion"],
    ["Microsoft.Data.Sqlite", "Sqlite"], ["System.Data.SQLite", "SQLite"], ["Microsoft.Identity", "MSAL"], ["Microsoft.IdentityModel", "IdentityModel"],
    ["Microsoft.Azure", "Azure"], ["Microsoft.ApplicationInsights", "Application Insights"], ["Microsoft.Office", "Office Interop"],
  ];
  // Frames que el runtime mete en el medio y no dicen nada sobre tu código.
  const RUIDO = [
    /^System\.Runtime\.ExceptionServices\.ExceptionDispatchInfo\.Throw/,
    /^System\.Runtime\.CompilerServices\.(?:Configured)?(?:Value)?Task(?:Awaiter|Awaitable)/,
    /^System\.Runtime\.CompilerServices\.AsyncMethodBuilderCore/, /^System\.Runtime\.CompilerServices\.(?:Pooling)?Async(?:Task|Void|ValueTask)MethodBuilder/,
    /^System\.Runtime\.CompilerServices\.ValueTaskAwaiter/, /^System\.Runtime\.CompilerServices\.AsyncIteratorMethodBuilder/,
    /^System\.Threading\.Tasks\.Task\.(?:ThrowIfExceptional|Wait|InnerInvoke|Execute|ExecuteWithThreadLocal|ExecuteEntry|ExecuteFromThreadPool|RunContinuations|GetResultCore|ValidateEnd|WaitAll|WaitAny|InternalWait|SpinThenBlockingWait|ThrowAsync|HandleException|<>c)/,
    /^System\.Threading\.Tasks\.Task`1\.(?:InnerInvoke|GetResultCore|get_Result)/, /^System\.Threading\.Tasks\.ValueTask/,
    /^System\.Threading\.Tasks\.TaskReplicator/, /^System\.Threading\.Tasks\.Parallel\./, /^System\.Threading\.Tasks\.Sources/,
    /^System\.Threading\.ExecutionContext\.(?:RunInternal|Run|RunFromThreadPoolDispatchLoop)/, /^System\.Threading\.ThreadPoolWorkQueue/,
    /^System\.Threading\.(?:PortableThreadPool|ThreadPool|Thread|ThreadHelper|TimerQueue|QueueUserWorkItemCallback)/,
    /^System\.Threading\.Tasks\.(?:AwaitTaskContinuation|SynchronizationContextAwaitTaskContinuation|TaskCompletionSourceWithCancellation|TaskFactory)/,
    /^System\.Runtime\.CompilerServices\.RuntimeHelpers/,
    /^System\.Reflection\.(?:RuntimeMethodInfo|MethodBase|MethodBaseInvoker|RuntimeConstructorInfo)\.(?:Invoke|InvokeWithNoArgs|InvokeWithOneArg|InvokeWithManyArgs|InvokeDirect|InvokeWithFewArgs|InternalInvoke|UnsafeInvokeInternal)/,
    /^System\.RuntimeMethodHandle\.InvokeMethod/, /^System\.RuntimeType\.CreateInstance/, /^System\.Activator\./,
    /^System\.Threading\.CancellationToken\.Throw/, /^System\.ThrowHelper/, /^System\.Text\.Json\.ThrowHelper/,
    /^System\.Number\.Throw/, /^System\.Collections\.Generic\.ThrowHelper/, /^System\.Linq\.ThrowHelper/, /^System\.Net\.Sockets\.Socket\.AwaitableSocketAsyncEventArgs\.ThrowException/,
    /^System\.Web\.(?:HttpApplication|HttpRuntime)/,
  ];
  const TIPOS_CORTOS = { String: "string", Int32: "int", Int64: "long", Int16: "short", Boolean: "bool", Object: "object", Decimal: "decimal", Double: "double",
    Single: "float", Byte: "byte", SByte: "sbyte", Char: "char", UInt32: "uint", UInt64: "ulong", UInt16: "ushort", Void: "void", IntPtr: "nint", UIntPtr: "nuint" };

  function dividirSegmentos(sig) {
    const segs = []; let actual = ""; let ang = 0, cor = 0;
    for (let i = 0; i < sig.length; i++) {
      const c = sig[i];
      if (c === "<") ang++; else if (c === ">") ang--; else if (c === "[") cor++; else if (c === "]") cor--;
      if (c === "." && ang === 0 && cor === 0) {
        if (actual === "" && segs.length && /^c?ctor$/.test(sig.slice(i + 1).split(/[.(]/)[0])) { actual = "."; continue; } // ".ctor"
        segs.push(actual); actual = ""; continue;
      }
      actual += c;
    }
    segs.push(actual);
    return segs.filter((s, i) => s !== "" || i === 0);
  }

  function arreglarGenericos(nombre) {
    return nombre.replace(/`(\d+)/g, (_, n) => "<" + (n === "1" ? "T" : Array.from({ length: +n }, (__, i) => "T" + (i + 1)).join(",")) + ">");
  }

  /** Interpreta un segmento con nombres generados por el compilador de C#. */
  function desenmarañar(seg) {
    let m;
    if (seg === "<>c" || /^<>c__DisplayClass\w*$/.test(seg) || /^<>c__\d+/.test(seg) || /^<>[A-Za-z_]\w*$/.test(seg)) return { nombre: null, lambda: true };
    if ((m = /^<(.+)>d(?:__\d+)?(`\d+)?$/.exec(seg))) return { nombre: desenmarañar(m[1]).nombre || m[1], maquina: true };
    if ((m = /^<(.+)>b__[\w]+$/.exec(seg))) { const d = desenmarañar(m[1]); return { nombre: d.nombre || m[1], lambdaDentroDe: d.nombre || m[1] }; }
    if ((m = /^<(.+)>g____PInvoke\|?[\w]*$/.exec(seg))) return { nombre: m[1], pinvoke: true };
    if ((m = /^<(.+)>g__(\w+)\|[\w]+$/.exec(seg))) { const d = desenmarañar(m[1]); return { nombre: m[2], localDentroDe: d.nombre || m[1] }; }
    if ((m = /^<(.+)>\$$/.exec(seg))) return { nombre: m[1], topLevel: true };
    if ((m = /^<(.+)>k__BackingField$/.exec(seg))) return { nombre: m[1] };
    if ((m = /^<(.+)>$/.exec(seg))) return { nombre: desenmarañar(m[1]).nombre || m[1] };
    return { nombre: seg };
  }

  function tipoCorto(t) {
    let s = t.trim().replace(/^System\./, "");
    const ref = /&$/.test(s); s = s.replace(/&$/, "");
    const arr = /\[\]$/.test(s); s = s.replace(/\[\]$/, "");
    s = arreglarGenericos(s);
    const base = s.replace(/<.*$/, "");
    if (TIPOS_CORTOS[base]) s = TIPOS_CORTOS[base] + s.slice(base.length);
    if (s === "Nullable<T>") s = "T?";
    return (ref ? "ref " : "") + s + (arr ? "[]" : "");
  }

  function parsearParametros(texto) {
    if (!texto.trim()) return [];
    const partes = []; let actual = ""; let prof = 0;
    for (const c of texto) {
      if (c === "<" || c === "[" || c === "(") prof++; else if (c === ">" || c === "]" || c === ")") prof--;
      if (c === "," && prof === 0) { partes.push(actual.trim()); actual = ""; } else actual += c;
    }
    partes.push(actual.trim());
    return partes.filter(Boolean).map((p) => {
      const i = p.lastIndexOf(" ");
      return i < 0 ? { tipo: tipoCorto(p), nombre: "" } : { tipo: tipoCorto(p.slice(0, i)), nombre: p.slice(i + 1) };
    });
  }

  function parsearFrame(textoFrame) {
    let texto = textoFrame.trim();
    const frame = { crudo: textoFrame.trim(), archivo: null, linea: null, etiquetas: [] };
    let m;
    if ((m = RE_ARCHIVO.exec(texto))) { frame.archivo = m[1].trim(); frame.linea = parseInt(m[2], 10); texto = texto.slice(0, m.index); }
    else if ((m = RE_ARCHIVO_SOLO.exec(texto))) { frame.archivo = m[1].trim(); texto = texto.slice(0, m.index); }
    texto = texto.replace(/\s+/g, " ").trim();
    if ((m = /^(.*\))\+MoveNext\(\)$/.exec(texto))) { texto = m[1]; frame.etiquetas.push("iterador"); }
    let params = ""; let sig = texto;
    if (texto.endsWith(")")) {
      let prof = 0, idx = -1;
      for (let i = texto.length - 1; i >= 0; i--) { if (texto[i] === ")") prof++; else if (texto[i] === "(") { prof--; if (prof === 0) { idx = i; break; } } }
      if (idx >= 0) { params = texto.slice(idx + 1, -1); sig = texto.slice(0, idx); }
    }
    frame.parametros = parsearParametros(params);
    let genericosMetodo = "";
    if ((m = /\[([\w,` ]+)\]$/.exec(sig))) { genericosMetodo = "<" + m[1].replace(/\s/g, "") + ">"; sig = sig.slice(0, m.index); }
    const segs = dividirSegmentos(sig);
    frame.rutaCompleta = sig;
    let metodo = segs.pop() || "";
    let metodoDe = null;
    const info = desenmarañar(metodo);
    if (metodo === ".ctor") { metodo = "constructor"; frame.etiquetas.push("constructor"); }
    else if (metodo === ".cctor") { metodo = "constructor estático"; frame.etiquetas.push("constructor estático"); }
    else if (metodo === "MoveNext" || metodo === "MoveNextAsync") { frame.etiquetas.push("maquina"); }
    else if (info.lambdaDentroDe) { metodo = "λ"; metodoDe = info.lambdaDentroDe; frame.etiquetas.push("lambda"); }
    else if (info.localDentroDe) { metodo = info.nombre; metodoDe = info.localDentroDe; frame.etiquetas.push("función local"); }
    else if (info.topLevel) { metodo = info.nombre; frame.etiquetas.push("top-level"); }
    else if (info.pinvoke) { metodo = info.nombre; frame.etiquetas.push("P/Invoke"); }
    else if ((m = /^(get|set|add|remove)_(\w+)$/.exec(metodo))) { metodo = m[2]; frame.etiquetas.push(m[1] === "get" ? "propiedad (get)" : m[1] === "set" ? "propiedad (set)" : "evento"); }
    else if ((m = /^op_(\w+)$/.exec(metodo))) { metodo = "operador " + m[1]; }
    else if (/^lambda_method\d*$/.test(metodo) && segs.length === 0) { frame.etiquetas.push("expresión compilada"); }
    else if (/^Deserialize[0-9a-f-]{20,}$/i.test(metodo) && segs.length === 0) { metodo = "Deserialize (materializador de Dapper)"; frame.etiquetas.push("Dapper"); }
    else metodo = info.nombre || metodo;
    const clases = [];
    for (const seg of segs) {
      const d = desenmarañar(seg);
      if (d.lambda) { frame.etiquetas.push("lambda"); continue; }
      if (d.maquina) { frame.etiquetas.push("async"); if (frame.etiquetas.includes("maquina")) metodo = d.nombre; else if (!metodoDe) metodoDe = d.nombre; continue; }
      if (d.lambdaDentroDe) { frame.etiquetas.push("lambda"); metodoDe = metodoDe || d.lambdaDentroDe; continue; }
      if (d.localDentroDe) { frame.etiquetas.push("función local"); continue; }
      clases.push(arreglarGenericos(d.nombre || seg));
    }
    if (frame.etiquetas.includes("maquina")) { frame.etiquetas.splice(frame.etiquetas.indexOf("maquina"), 1); if (!frame.etiquetas.includes("async")) frame.etiquetas.push("async"); }
    if (frame.etiquetas.includes("iterador") && frame.etiquetas.includes("async")) frame.etiquetas.splice(frame.etiquetas.indexOf("async"), 1);
    // Implementación explícita de interfaz: «Clase.System.Threading.Tasks.Sources.IValueTaskSource<T>.GetResult»
    let clase = null; let ns = [];
    if (clases.length) {
      const k = clases.length - 1;
      if (k >= 2 && /^I[A-Z]\w*(<.*>)?$/.test(clases[k])) {
        let inicio = k - 1;
        while (inicio > 0 && !/^(System|Microsoft)$/.test(clases[inicio])) inicio--;
        if (inicio > 0 && /^(System|Microsoft)$/.test(clases[inicio])) { metodo = clases[k] + "." + metodo; clases.splice(inicio); }
      }
      clase = clases[clases.length - 1];
      ns = clases.slice(0, -1);
    }
    frame.clase = clase;
    frame.namespace = ns.join(".");
    frame.rutaLimpia = ns.concat(clase ? [clase] : []).join(".");
    frame.metodo = metodo + genericosMetodo;
    frame.metodoDe = metodoDe;
    frame.etiquetas = [...new Set(frame.etiquetas)];
    frame.origen = clasificarOrigen(frame);
    if (/^(lambda_method|Deserialize)/.test(sig) && segs.length === 0) frame.origen = "generado";
    frame.ruido = frame.origen !== "tuyo" && RUIDO.some((re) => re.test(sig));
    return frame;
  }

  function clasificarOrigen(frame) {
    const ruta = frame.rutaLimpia || frame.rutaCompleta || "";
    for (const [prefijo, nombre] of LIBRERIAS) {
      if (ruta === prefijo || ruta.startsWith(prefijo + ".") || ruta.startsWith(prefijo + "+")) {
        frame.libreria = nombre;
        return /^(System|Microsoft)\b/.test(prefijo) ? "framework" : "libreria";
      }
    }
    if (PREFIJOS_FRAMEWORK.some((p) => ruta === p || ruta.startsWith(p + ".") || ruta.startsWith(p + "`"))) return "framework";
    return "tuyo";
  }

  function nombreFrame(frame, opciones) {
    const o = opciones || {};
    if (!frame.clase && !frame.metodo) return frame.crudo;
    const params = (frame.parametros || []).map((p) => p.nombre ? `${p.tipo} ${p.nombre}` : p.tipo).join(", ");
    let met = frame.metodo;
    if (frame.etiquetas.includes("lambda")) met = frame.metodoDe ? `λ dentro de ${frame.metodoDe}` : "λ";
    else if (frame.etiquetas.includes("función local")) met = `${frame.metodo} (función local de ${frame.metodoDe})`;
    if (frame.etiquetas.includes("async")) met = "async " + met;
    const clase = frame.clase ? frame.clase + "." : "";
    const ns = o.conNamespace && frame.namespace ? frame.namespace + "." : "";
    if (frame.etiquetas.includes("constructor")) return `${ns}new ${frame.clase}(${params})`;
    if (frame.etiquetas.includes("constructor estático")) return `${ns}static ${frame.clase}()`;
    return `${ns}${clase}${met}(${params})`;
  }

  function archivoCorto(ruta) { return ruta ? ruta.split(/[\\/]/).pop() : null; }

  // ---------- Recorridos ----------

  function cadenaPrincipal(ex) { const c = []; let e = ex; while (e) { c.push(e); e = e.internas[0] || null; } return c; }
  function todas(ex) { const r = []; (function rec(e) { r.push(e); e.internas.forEach(rec); })(ex); return r; }
  function causaRaiz(ex) { let e = ex; while (e.internas.length) e = e.internas[0]; return e; }
  function framesTuyos(ex) { return ex.frames.filter((f) => !f.marcador && f.origen === "tuyo"); }

  raiz.__parte1 = { prepararTexto, parsear, parsearFrame, nombreFrame, archivoCorto, cadenaPrincipal, todas, causaRaiz, framesTuyos, arreglarGenericos, tipoCorto };
})(typeof module !== "undefined" ? module.exports : (window.StackTrace = window.StackTrace || {}));

/* ---------- Diagnóstico ---------- */
(function (raiz) {
  "use strict";
  const P = raiz.__parte1;
  if (typeof module !== "undefined" && !raiz.REGLAS) Object.assign(raiz, require("./conocimiento.js"));

  function numeroSql(ex) {
    if (ex.extras["Error Number"]) return parseInt(ex.extras["Error Number"], 10);
    const m = /\b(?:error|Error Number|Number):\s*(-?\d+)/.exec(ex.mensaje);
    return m ? parseInt(m[1], 10) : null;
  }
  function sqlState(ex) {
    if (ex.extras.SqlState) return ex.extras.SqlState;
    const m = /^([0-9A-Z]{5}):/.exec(ex.mensaje);
    return m ? m[1] : null;
  }

  /** Reglas que aplican a una excepción, de mayor a menor prioridad. */
  function reglasPara(ex) {
    const corto = ex.corto || "";
    const numero = numeroSql(ex);
    const estado = sqlState(ex);
    const aplican = raiz.REGLAS.filter((r) => {
      if (!r.tipo.test(corto)) return false;
      if (r.numero && !r.numero.includes(numero)) return false;
      if (r.sqlState && !r.sqlState.includes(estado)) return false;
      if (r.mensaje && !r.mensaje.test(ex.mensaje)) return false;
      return true;
    }).sort((a, b) => b.prioridad - a.prioridad);
    // Una regla «excluyente» que reconoce el mensaje pisa a las genéricas del tipo aunque tenga prioridad baja
    // (sirve para bajarle el peso a un detalle de bajo nivel, como una SocketException cancelada).
    const exc = aplican.filter((r) => r.excluyente);
    return exc.length ? exc.concat(aplican.filter((r) => !r.excluyente)) : aplican;
  }

  /** Elige la excepción que mejor explica el problema: la regla más específica, y a igual prioridad la más interna. */
  function elegirCausa(todasLasExcepciones) {
    let mejor = null;
    todasLasExcepciones.forEach((ex, profundidad) => {
      const reglas = reglasPara(ex);
      const r = reglas[0];
      const prioridad = r ? r.prioridad : -1;
      if (!mejor || prioridad > mejor.prioridad || (prioridad === mejor.prioridad && profundidad > mejor.profundidad)) mejor = { ex, regla: r, prioridad, profundidad };
    });
    return mejor;
  }

  function primerFrameTuyo(cadena) {
    // De la causa raíz hacia afuera: el primer frame tuyo que aparezca.
    for (let i = cadena.length - 1; i >= 0; i--) {
      const f = P.framesTuyos(cadena[i])[0];
      if (f) return { frame: f, ex: cadena[i] };
    }
    return null;
  }

  function detectarPlataforma(frames, texto) {
    const crudos = frames.map((f) => f.crudo || "").join("\n");
    if (/mscorlib|System\.Web\.|\.ni\.dll|Fin del seguimiento|HttpApplication\.ExecuteStep/.test(crudos + texto)) return ".NET Framework";
    if (/System\.Private\.CoreLib|Microsoft\.AspNetCore|\+MoveNext\(\)|\.<Main>\$/.test(crudos)) return ".NET (Core / 5+)";
    if (/<\w+>d__\d+\.MoveNext/.test(crudos)) return "async con nombres sin limpiar (.NET Framework o .NET Core ≤ 5)";
    return null;
  }

  function armarAvisos(resultado, cadena, todasLasEx, frames, causa) {
    const avisos = [];
    const texto = resultado.texto;
    if (resultado.notas.includes("json")) avisos.push({ nivel: "dato", titulo: "Era un JSON de log", texto: "Saqué la traza del campo de texto más largo del JSON (Serilog, Elastic, NLog…)." });
    if (resultado.notas.includes("escapado")) avisos.push({ nivel: "dato", titulo: "Venía escapada", texto: "Los \\r\\n y \\\" eran literales (texto copiado de un JSON o de un string de C#): los desescapé antes de leerla." });
    const tuyos = frames.filter((f) => !f.marcador && f.origen === "tuyo");
    const conLinea = tuyos.filter((f) => f.linea);
    if (tuyos.length && !conLinea.length) avisos.push({ nivel: "ojo", titulo: "Tus frames no tienen archivo ni número de línea", texto: "Los números de línea salen de los .pdb. Si no están al lado de la DLL en el servidor, la traza queda sin «in Archivo.cs:line N». Publicá con <DebugType>portable</DebugType> (es el default) y copiá los .pdb al deploy; en Release algunos métodos chicos se inlinean y desaparecen de la traza." });
    else if (tuyos.length && conLinea.length < tuyos.length) avisos.push({ nivel: "dato", titulo: "Algunos frames tuyos no tienen número de línea", texto: "Los que no lo tienen vienen de una DLL sin .pdb al lado (otro proyecto o paquete interno)." });
    if (!tuyos.length && frames.some((f) => !f.marcador)) avisos.push({ nivel: "ojo", titulo: "No hay ningún frame de tu código", texto: "Todos los frames son del framework o de librerías. Puede ser un hilo de fondo (timer, thread pool, servidor web) que corrió sin pasar por tu código, un método tuyo que el JIT inlineó, o que lo que te interesa es la excepción externa y no esta. Si usás namespaces que empiezan con System o Microsoft, los estoy contando como framework." });
    if (/\.Result|\.Wait\(|GetResultCore|GetAwaiter\(\)\.GetResult/.test(frames.map((f) => f.crudo).join(" ")) && todasLasEx.some((e) => e.corto === "AggregateException")) avisos.push({ nivel: "ojo", titulo: "Sync sobre async: .Result o .Wait()", texto: "La AggregateException y los frames de Task.Wait / GetResultCore delatan un .Result o .Wait() sobre una Task. Además de envolver la excepción, bajo carga eso bloquea hilos del thread pool y puede colgar la API. Cambiá a await." });
    if (frames.some((f) => f.marcador === "anterior")) avisos.push({ nivel: "dato", titulo: "«End of stack trace from previous location»", texto: "No es un error: marca dónde la excepción se relanzó al terminar un await (o un ExceptionDispatchInfo.Throw). Los frames de arriba son de donde se tiró; los de abajo, de quién estaba esperando." });
    if (frames.some((f) => f.etiquetas && f.etiquetas.includes("async"))) avisos.push({ nivel: "dato", titulo: "Hay métodos async", texto: "Los nombres tipo <Metodo>d__12.MoveNext() son la máquina de estados que genera el compilador para cada método async: los traduje al nombre real. En .NET 6+ el runtime ya los muestra limpios." });
    if (frames.some((f) => f.etiquetas && f.etiquetas.includes("lambda"))) avisos.push({ nivel: "dato", titulo: "Hay lambdas", texto: "<>c.<Metodo>b__0_1 y <>c__DisplayClass5_0 son las clases que inventa el compilador para las lambdas (y las variables que capturan). «λ dentro de Metodo» es la lambda escrita en ese método; el número de línea apunta adentro de la lambda." });
    if (frames.some((f) => f.etiquetas && f.etiquetas.includes("expresión compilada"))) avisos.push({ nivel: "dato", titulo: "lambda_method: código generado en tiempo de ejecución", texto: "Un frame lambda_methodN(Closure, …) es un delegate compilado desde un árbol de expresiones: el handler de un endpoint mínimo en ASP.NET Core, un mapeo de AutoMapper, una proyección de EF Core. No tiene archivo ni línea; mirá el frame siguiente para saber quién lo invocó." });
    if (frames.some((f) => f.etiquetas && f.etiquetas.includes("Dapper"))) avisos.push({ nivel: "dato", titulo: "Deserialize…: el materializador de Dapper", texto: "Dapper genera un método por consulta para armar los objetos desde el reader. Si falla ahí, es un tipo de columna que no coincide con la propiedad (ver el diagnóstico)." });
    if (/\\(?:Users|src|source|a\\_work|agent\\_work|Projects|Proyectos|TeamCity|Jenkins)\\|[A-Z]:\\/i.test(texto) && /line \d+/.test(texto)) avisos.push({ nivel: "dato", titulo: "Las rutas son de la máquina donde se compiló", texto: "«C:\\…\\Archivo.cs» es la ruta en la máquina o el agente de build donde se compiló, no en el servidor. Si ves «/_/», la librería se compiló con rutas deterministas (SourceLink)." });
    const agregadas = todasLasEx.filter((e) => e.corto === "AggregateException" && e.internas.length > 1);
    if (agregadas.length) avisos.push({ nivel: "ojo", titulo: `La AggregateException tiene ${agregadas[0].internas.length} excepciones internas`, texto: "Vienen de Task.WhenAll, Task.WaitAll o Parallel.ForEach: fallaron varias tareas. Abajo están todas; el diagnóstico es de la que me pareció más clara, pero mirá cada una." });
    const plataforma = detectarPlataforma(frames, texto);
    if (plataforma) avisos.push({ nivel: "dato", titulo: "Plataforma", texto: `Por la pinta de los frames, esto corrió en ${plataforma}.` });
    if (resultado.idioma === "es") avisos.push({ nivel: "dato", titulo: "Traza en español", texto: "El runtime estaba en español («en … en …:línea N»): eso pasa en .NET Framework con el paquete de idioma instalado. La entendí igual." });
    if (resultado.raices.length > 1) avisos.push({ nivel: "ojo", titulo: `Hay ${resultado.raices.length} excepciones independientes en el texto`, texto: "Pegaste más de una traza (o un log con varias). Analizo la primera; las otras están al final." });
    if (resultado.noReconocidas) avisos.push({ nivel: "ojo", titulo: `${resultado.noReconocidas} línea(s) con «at» que no pude leer`, texto: "Las dejé como texto. Si es una traza que no es de .NET (Java, Node, Python), este analizador no la entiende." });
    if (causa && cadena.length > 1 && causa.ex !== cadena[cadena.length - 1] && cadena.includes(causa.ex)) avisos.push({ nivel: "dato", titulo: "El diagnóstico no es de la más interna", texto: `La excepción más interna (${cadena[cadena.length - 1].corto}) es un detalle de más bajo nivel; la que mejor explica el problema es la ${causa.ex.corto}, que la envuelve.` });
    if (todasLasEx.some((e) => e.reparada)) avisos.push({ nivel: "dato", titulo: "Interna sin pila propia", texto: "La excepción interna no tiene frames (se creó pero nunca se tiró; SqlClient y Npgsql hacen eso con Win32Exception y SocketException) y el log no trae el separador «End of inner exception stack trace»: los frames se los asigné a la externa, que es la que se tiró." });
    const framesConTemplate = frames.filter((f) => f.archivo && /\.(razor|cshtml)$/.test(f.archivo));
    if (framesConTemplate.length) avisos.push({ nivel: "dato", titulo: "Hay frames de vistas Razor", texto: "El error se originó al renderizar una vista o componente; el número de línea es del .cshtml/.razor." });
    return avisos;
  }

  function resumenCadena(cadena, causa) {
    const partes = cadena.map((e) => {
      const n = numeroSql(e); const s = sqlState(e);
      let extra = "";
      if (e.corto === "SqlException" && n !== null) extra = ` ${n}`;
      else if (e.corto === "PostgresException" && s) extra = ` ${s}`;
      else if (e.corto === "SocketException" || e.corto === "Win32Exception") { const m = /\((\d+)\)/.exec(e.mensaje) || /^(\d+)/.exec(e.mensaje); if (m) extra = ` (${m[1]})`; }
      return (e.corto || "excepción sin tipo") + extra;
    });
    let frase;
    if (cadena.length === 1) frase = `Una ${partes[0]}.`;
    else frase = `Una ${partes[0]} que envuelve ${partes.slice(1).map((p, i) => (i === partes.length - 2 ? "una " + p : "una " + p)).join(", que a su vez envuelve ")}.`;
    if (causa && cadena.length > 1) frase += ` La que explica el problema es la ${causa.ex.corto}.`;
    return frase;
  }

  function analizar(texto) {
    const resultado = P.parsear(texto);
    if (!resultado.raices.length) return { ok: false, motivo: "No encontré ninguna excepción de .NET: ni una línea «Tipo.Exception: mensaje» ni frames «at Namespace.Clase.Metodo(...)».", resultado };
    const principal = resultado.raices[0];
    const cadena = P.cadenaPrincipal(principal);
    const todasLasEx = P.todas(principal);
    const frames = todasLasEx.flatMap((e) => e.frames);
    const causa = elegirCausa(todasLasEx);
    const donde = primerFrameTuyo(cadena.includes(causa.ex) ? cadena.slice(0, cadena.indexOf(causa.ex) + 1).concat(cadena.slice(cadena.indexOf(causa.ex) + 1)) : cadena);
    const dondeCausa = P.framesTuyos(causa.ex)[0] ? { frame: P.framesTuyos(causa.ex)[0], ex: causa.ex } : donde;
    const llamadores = dondeCausa ? P.framesTuyos(dondeCausa.ex).slice(0, 8) : [];
    const avisos = armarAvisos(resultado, cadena, todasLasEx, frames, causa);
    const porExcepcion = todasLasEx.map((ex) => ({ ex, reglas: reglasPara(ex).slice(0, 1), numero: numeroSql(ex), sqlState: sqlState(ex) }));
    const raizNamespace = (function () {
      const cuenta = {};
      frames.filter((f) => !f.marcador && f.origen === "tuyo" && f.namespace).forEach((f) => { const k = f.namespace.split(".")[0]; cuenta[k] = (cuenta[k] || 0) + 1; });
      return Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || null;
    })();
    return { ok: true, resultado, principal, cadena, todasLasEx, frames, causa, donde: dondeCausa, llamadores, avisos, porExcepcion, resumen: resumenCadena(cadena, causa), raizNamespace,
      otrasRaices: resultado.raices.slice(1) };
  }

  /** Traza limpia en Markdown para pegar en un issue o un chat. */
  function aMarkdown(analisis, modo) {
    const m = modo || "sin-ruido";
    const lineas = [];
    const { cadena, causa, donde } = analisis;
    lineas.push(`**${analisis.resumen}**`);
    if (causa && causa.regla) lineas.push(`Causa probable: ${causa.regla.titulo}.`);
    if (donde) lineas.push(`Dónde: \`${P.nombreFrame(donde.frame)}\`${donde.frame.archivo ? ` (${P.archivoCorto(donde.frame.archivo)}${donde.frame.linea ? ":" + donde.frame.linea : ""})` : ""}`);
    lineas.push("");
    analisis.todasLasEx.forEach((ex, i) => {
      const nivel = profundidad(ex);
      lineas.push(`${"  ".repeat(nivel)}- **${ex.tipo || "(sin tipo)"}**: ${ex.mensaje.split("\n")[0]}`);
      const fs = ex.frames.filter((f) => !f.marcador && (m === "todo" || (m === "tuyos" ? f.origen === "tuyo" : !f.ruido)));
      fs.forEach((f) => lineas.push(`${"  ".repeat(nivel + 1)}- ${f.origen === "tuyo" ? "**" : ""}${P.nombreFrame(f, { conNamespace: f.origen !== "tuyo" })}${f.origen === "tuyo" ? "**" : ""}${f.archivo ? ` · ${P.archivoCorto(f.archivo)}${f.linea ? ":" + f.linea : ""}` : ""}`));
      const ocultos = ex.frames.filter((f) => !f.marcador).length - fs.length;
      if (ocultos > 0) lineas.push(`${"  ".repeat(nivel + 1)}- _(${ocultos} frame${ocultos > 1 ? "s" : ""} del framework omitido${ocultos > 1 ? "s" : ""})_`);
    });
    return lineas.join("\n");
  }
  function profundidad(ex) { let n = 0; let e = ex; while (e.padre) { n++; e = e.padre; } return n; }

  Object.assign(raiz, {
    analizar, aMarkdown, reglasPara, numeroSql, sqlState, profundidad,
    parsear: P.parsear, parsearFrame: P.parsearFrame, nombreFrame: P.nombreFrame, archivoCorto: P.archivoCorto,
    cadenaPrincipal: P.cadenaPrincipal, todas: P.todas, causaRaiz: P.causaRaiz, framesTuyos: P.framesTuyos, prepararTexto: P.prepararTexto,
  });
})(typeof module !== "undefined" ? module.exports : (window.StackTrace = window.StackTrace || {}));
