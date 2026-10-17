/* Base de conocimiento de «Stack trace en criollo»: qué suele significar cada excepción típica de un backend .NET
   y qué conviene mirar. Cada regla: id, tipo (regex sobre el nombre corto), mensaje (regex opcional sobre el
   mensaje), numero (Error Number de SqlException), sqlState (PostgresException), prioridad (gana la más alta al
   elegir la causa raíz), titulo, que, hacer[] y fuente opcional. Las reglas genéricas por tipo tienen prioridad 2 o 3;
   las que reconocen un mensaje concreto, 4 o 5. */
(function (raiz) {
  "use strict";
  const R = [];
  const regla = (r) => R.push(r);
  const SQL = (numero, titulo, que, hacer, fuente) => regla({ id: "sql-" + [numero].flat()[0], tipo: /^SqlException$/, numero: [numero].flat(), prioridad: 5, titulo, que, hacer, fuente });
  const PG = (estado, titulo, que, hacer) => regla({ id: "pg-" + [estado].flat()[0], tipo: /^PostgresException$/, sqlState: [estado].flat(), prioridad: 5, titulo, que, hacer });

  // ----- Las de todos los días -----
  regla({ id: "nullref", tipo: /^NullReferenceException$/, prioridad: 3, titulo: "Algo era null y lo usaste",
    que: "Se llamó a un método o se leyó una propiedad de una variable que valía null. .NET no dice cuál: el primer frame tuyo y su número de línea son la pista.",
    hacer: ["En esa línea hay un «.» sobre algo que vino null: un parámetro, el resultado de un FirstOrDefault, una propiedad de navegación sin Include, un servicio sin inyectar.", "Si la línea tiene varios «.», separala en variables para encontrar cuál.", "A largo plazo: <Nullable>enable</Nullable> y hacer caso a los warnings CS86xx."] });
  regla({ id: "argnull", tipo: /^ArgumentNullException$/, prioridad: 3, titulo: "Se pasó null donde no se podía",
    que: "Un método recibió null en un parámetro obligatorio. El nombre viene en el mensaje: «(Parameter 'x')».",
    hacer: ["Mirá quién llama al método del primer frame tuyo y de dónde sale ese valor."] });
  regla({ id: "argnull-source", tipo: /^ArgumentNullException$/, mensaje: /Parameter 'source'/, prioridad: 4, titulo: "LINQ sobre una colección que es null",
    que: "«Value cannot be null. (Parameter 'source')» es un Where/Select/First/ToList/Any aplicado a una lista que vale null.",
    hacer: ["La colección del primer frame tuyo es la que vino null.", "Inicializá las listas (= new()) o devolvé colecciones vacías en vez de null."] });
  regla({ id: "argnull-connstr", tipo: /^ArgumentNullException$/, mensaje: /Parameter 'connectionString'/, prioridad: 5, titulo: "La cadena de conexión es null",
    que: "GetConnectionString(\"Nombre\") devolvió null (no tira) y se lo pasaste al SqlConnection o a UseSqlServer. Casi siempre el nombre no coincide o el appsettings de ese entorno no la tiene.",
    hacer: ["Confirmá que exista exactamente ese nombre en appsettings.{Entorno}.json o en la variable ConnectionStrings__Nombre (doble guion bajo).", "Validá al arrancar: GetConnectionString(\"X\") ?? throw new InvalidOperationException(...)."] });
  regla({ id: "argout", tipo: /^ArgumentOutOfRangeException$/, prioridad: 3, titulo: "Un índice o valor fuera de rango",
    que: "Un índice más allá de la lista, un Substring más largo que el string, o un número fuera de lo permitido (un día 31 en un mes de 30).",
    hacer: ["Con listas: «Index was out of range» es una lista más corta de lo que creías (¿vacía?). ElementAtOrDefault o chequear Count.", "Con Substring: chequeá Length o usá AsSpan."] });
  regla({ id: "indexout", tipo: /^IndexOutOfRangeException$/, prioridad: 3, titulo: "Índice fuera del array",
    que: "Un array se indexó más allá de su largo, o un Split devolvió menos partes de las que el código esperaba.",
    hacer: ["Revisá el límite del bucle o el Split en el primer frame tuyo."] });
  regla({ id: "indexout-reader", tipo: /^IndexOutOfRangeException$/, mensaje: /^[\w\s_]+$/, prioridad: 4, titulo: "El reader no tiene esa columna",
    que: "Cuando el mensaje de un IndexOutOfRangeException es solo un nombre («Nombre», «ClienteId»), lo tiró reader[\"columna\"]: el resultado de la consulta no trae una columna con ese nombre exacto.",
    hacer: ["Compará el SELECT con el nombre que usás en el reader (alias, mayúsculas en Postgres, columna renombrada).", "Con SELECT * y un cambio de esquema pasa esto en producción: nombrá las columnas."] });
  regla({ id: "keynotfound", tipo: /^KeyNotFoundException$/, prioridad: 3, titulo: "La clave no está en el diccionario",
    que: "dict[clave] con una clave inexistente. El mensaje suele decir cuál.",
    hacer: ["TryGetValue o GetValueOrDefault cuando puede no estar.", "Si la clave es texto, revisá mayúsculas y espacios (StringComparer.OrdinalIgnoreCase)."] });
  regla({ id: "invalidcast", tipo: /^InvalidCastException$/, prioridad: 3, titulo: "El tipo real no era el que esperabas",
    que: "Un cast (T) directo no convierte: (int) sobre un object que tiene un long tira esto. El mensaje dice los dos tipos.",
    hacer: ["Si viene de un reader o de Dapper, el tipo de la columna no coincide con el de la propiedad (decimal vs int, bigint vs int, bit vs int).", "Para convertir números, Convert.ToInt32 o un «is» antes."] });
  regla({ id: "invalidcast-dbnull", tipo: /^InvalidCastException$/, mensaje: /DBNull/, prioridad: 5, titulo: "La columna vino NULL y la leíste como si no",
    que: "«Unable to cast object of type 'System.DBNull'» es un NULL de la base leído con (string)reader[\"x\"] o GetString(i). En ADO.NET un NULL no es null: es DBNull.Value.",
    hacer: ["Chequeá reader.IsDBNull(i) antes, o usá reader[\"x\"] as string.", "Con Dapper y una propiedad int, decimal o DateTime: hacela anulable (int?) o corregí el dato.", "Si la columna no debería admitir NULL, ponele NOT NULL y arreglá el origen."] });
  regla({ id: "invalidcast-reader", tipo: /^InvalidCastException$/, mensaje: /Specified cast is not valid|La conversión especificada no es válida|Unable to cast object of type 'System\.(?:Decimal|Int64|Int32|Int16|Byte|Boolean|DateTime|DateTimeOffset|Double|Single|Guid|String|TimeSpan)' to type 'System\.(?:Decimal|Int64|Int32|Int16|Byte|Boolean|DateTime|DateTimeOffset|Double|Single|Guid|String|TimeSpan)'/i, prioridad: 4, titulo: "El valor es de otro tipo que el que pediste (GetInt32 sobre un decimal, (int) sobre un long)",
    que: "«Specified cast is not valid» o «Unable to cast object of type 'System.Decimal' to type 'System.Int32'»: un Get* tipado del reader o un cast directo sobre un object con un valor de otro tipo. Ni los Get* ni el cast (T) convierten entre números.",
    hacer: ["decimal(18,2) es GetDecimal, bigint GetInt64, bit GetBoolean; compará con la tabla.", "Con Dapper la propiedad tiene que ser del tipo de la columna o convertir en el SELECT."] });
  regla({ id: "format", tipo: /^FormatException$/, prioridad: 3, titulo: "El texto no tenía el formato esperado",
    que: "int.Parse, decimal.Parse, DateTime.Parse o Guid.Parse recibieron un texto que no pudieron interpretar.",
    hacer: ["TryParse cuando el dato viene de afuera.", "Con decimales y fechas la cultura importa: «1,5» con InvariantCulture falla y «1.5» con es-AR da 15. Pasá la CultureInfo explícita o ParseExact."] });
  regla({ id: "format-num", tipo: /^FormatException$/, mensaje: /was not in a correct format|no tiene el formato correcto/i, prioridad: 4, titulo: "Número con un formato que el parser no esperaba",
    que: "«The input string 'x' was not in a correct format»: letras, espacios, el separador decimal equivocado (coma vs punto) o un string vacío.",
    hacer: ["Mirá el valor del mensaje. Si es «1,5» o «1.234,56», es cultura: en servidores Linux/Docker la cultura por defecto suele ser invariante (punto decimal), distinto de tu Windows en español.", "TryParse con NumberStyles y CultureInfo explícitos."] });
  regla({ id: "format-date", tipo: /^FormatException$/, mensaje: /not recognized as a valid DateTime|no se reconoce como un valor DateTime|out-of-range value|calendar/i, prioridad: 4, titulo: "Fecha que no se pudo interpretar",
    que: "DateTime.Parse con un texto que no es una fecha válida para esa cultura: día y mes invertidos (dd/MM vs MM/dd), un 31 de febrero, o un formato ISO con cultura equivocada.",
    hacer: ["ParseExact con el formato exacto («dd/MM/yyyy») y CultureInfo.InvariantCulture.", "Entre sistemas, mandá siempre ISO 8601 (yyyy-MM-ddTHH:mm:ss)."] });
  regla({ id: "overflow", tipo: /^OverflowException$/, prioridad: 3, titulo: "El número no entra en el tipo",
    que: "Una operación checked, un Convert o un Parse dio un valor que no entra en el tipo destino.",
    hacer: ["Si es un contador o un Id, pasá de int a long.", "Si viene de la base, el decimal(p,s) de la columna es más chico que el valor."] });
  regla({ id: "dividebyzero", tipo: /^DivideByZeroException$/, prioridad: 3, titulo: "División entera por cero",
    que: "Con int, long o decimal una división por 0 tira; con double da Infinity.",
    hacer: ["Chequeá el divisor (¿Count = 0 al promediar?). Para promedios, DefaultIfEmpty().Average()."] });
  regla({ id: "invalidop", tipo: /^InvalidOperationException$/, prioridad: 2, titulo: "El objeto no estaba en el estado que hacía falta",
    que: "La excepción comodín de .NET para «esto no se puede hacer ahora». El mensaje es lo que importa.",
    hacer: ["Leé el mensaje completo: casi siempre dice qué regla se rompió.", "El primer frame tuyo dice qué operación estabas haciendo."] });
  regla({ id: "linq-vacio", tipo: /^InvalidOperationException$/, mensaje: /Sequence contains no (?:matching )?elements|La secuencia no contiene (?:ningún )?elemento/i, prioridad: 4, titulo: "First/Single/Max sobre una secuencia vacía",
    que: "First(), Single(), Last(), Max(), Min() o Average() sin elementos. En EF Core, un FirstAsync/SingleAsync que no encontró la fila.",
    hacer: ["Si puede no estar: FirstOrDefault/SingleOrDefault y manejá el null (o devolvé 404).", "Si tiene que estar, falta el dato o el filtro está mal.", "Max/Min/Average: Any() antes o DefaultIfEmpty()."] });
  regla({ id: "linq-varios", tipo: /^InvalidOperationException$/, mensaje: /Sequence contains more than one (?:matching )?element|La secuencia contiene más de un elemento/i, prioridad: 4, titulo: "Single() encontró más de uno",
    que: "Single exige exactamente uno y había dos o más: datos duplicados o un filtro incompleto.",
    hacer: ["Buscá los duplicados (GROUP BY ... HAVING COUNT(*) > 1) y poné una restricción UNIQUE si no deberían existir.", "Si es legítimo que haya varios, First con un OrderBy."] });
  regla({ id: "coleccion-modificada", tipo: /^InvalidOperationException$/, mensaje: /Collection was modified|La colección ha cambiado|enumeration operation may not execute/i, prioridad: 5, titulo: "Modificaste la colección mientras la recorrías",
    que: "Un foreach sobre una List o Dictionary y adentro un Add/Remove sobre la misma colección. Con dos hilos compartiendo la lista sin lock pasa lo mismo, pero intermitente.",
    hacer: ["Recorré una copia (lista.ToList()) o usá RemoveAll.", "Si hay varios hilos: ConcurrentDictionary o un lock alrededor de todos los accesos."] });
  regla({ id: "nullable-sinvalor", tipo: /^InvalidOperationException$/, mensaje: /Nullable object must have a value|El objeto que acepta valores NULL debe tener un valor/i, prioridad: 5, titulo: "Un int?/DateTime? sin valor y le pediste .Value",
    que: ".Value de un Nullable<T> que era null, o un cast (int) sobre un int? null. En EF Core también pasa al proyectar una columna NULL a una propiedad no anulable.",
    hacer: ["HasValue o ?? con un valor por defecto.", "En una proyección de EF, la propiedad del DTO tiene que ser anulable si la columna admite NULL."] });
  regla({ id: "ef-segunda-op", tipo: /^InvalidOperationException$/, mensaje: /A second operation was started on this context/i, prioridad: 5, titulo: "El DbContext se usó desde dos lados a la vez",
    que: "EF Core detectó dos operaciones simultáneas sobre la misma instancia: consultas en paralelo (Task.WhenAll sobre el mismo contexto), un await olvidado, o un DbContext compartido entre requests o hilos.",
    hacer: ["Buscá el await que falta.", "No hagas Task.WhenAll con consultas del mismo contexto; secuencialas o usá IDbContextFactory.", "El DbContext tiene que ser Scoped y no quedar capturado en un singleton, un BackgroundService o un cache."],
    fuente: "https://learn.microsoft.com/ef/core/dbcontext-configuration/#avoiding-dbcontext-threading-issues" });
  regla({ id: "ef-disposed", tipo: /^ObjectDisposedException$/, mensaje: /disposed context instance|DbContext/i, prioridad: 5, titulo: "El DbContext ya estaba disposed",
    que: "Se usó después de que lo liberaron: una tarea que siguió corriendo después del request (fire and forget), un using cerrado antes de tiempo, o un IQueryable materializado tarde.",
    hacer: ["Para trabajo en segundo plano, creá un scope propio (IServiceScopeFactory) o usá IDbContextFactory.", "Si devolvés IQueryable desde un método con using, materializá adentro (ToListAsync)."] });
  regla({ id: "disposed", tipo: /^ObjectDisposedException$/, prioridad: 3, titulo: "Se usó un objeto después de liberarlo",
    que: "Un using se cerró y el objeto se siguió usando (stream, conexión, CancellationTokenSource). El mensaje dice el tipo.",
    hacer: ["Mové el uso adentro del using o alargá la vida del objeto.", "Con CancellationTokenSource: no lo dispongas mientras haya tareas usando su Token."] });
  regla({ id: "ef-no-traducida", tipo: /^InvalidOperationException$/, mensaje: /could not be translated/i, prioridad: 5, titulo: "EF Core no pudo traducir la consulta a SQL",
    que: "Un Where/Select/OrderBy usa algo sin equivalente en SQL: un método tuyo, ToString con formato, una comparación con cultura, un Normalize. Desde EF Core 3 tira en vez de evaluar en memoria sin avisar.",
    hacer: ["El mensaje muestra la expresión exacta. Reescribila con algo traducible (EF.Functions.Like, rangos de fechas, == en vez de Equals con cultura).", "Si hace falta C#, filtrá en SQL primero y después AsEnumerable().", "Para funciones propias, HasDbFunction."],
    fuente: "https://learn.microsoft.com/ef/core/querying/client-eval" });
  regla({ id: "ef-tracking", tipo: /^InvalidOperationException$/, mensaje: /cannot be tracked because another instance with the (?:same )?key value/i, prioridad: 5, titulo: "Dos instancias con la misma clave en el mismo DbContext",
    que: "Attach/Update/Add de una entidad cuya clave ya está rastreada por otra instancia: la trajiste con una consulta y después quisiste actualizar un objeto nuevo con el mismo Id.",
    hacer: ["Modificá la instancia que ya está en el contexto, o consultá con AsNoTracking antes del Update.", "En APIs: traer la entidad y copiarle el DTO (db.Entry(e).CurrentValues.SetValues(dto))."] });
  regla({ id: "ef-sin-proveedor", tipo: /^InvalidOperationException$/, mensaje: /No database provider has been configured/i, prioridad: 5, titulo: "El DbContext no sabe a qué base conectarse",
    que: "Se creó sin UseSqlServer/UseNpgsql: ni en AddDbContext ni en OnConfiguring. Pasa en tests, en dotnet ef o al hacer new TiendaContext() a mano.",
    hacer: ["AddDbContext<T>(o => o.UseSqlServer(cs)) y dejar que DI lo cree.", "Para dotnet ef: IDesignTimeDbContextFactory<T>."] });
  regla({ id: "di-sin-registrar", tipo: /^InvalidOperationException$/, mensaje: /Unable to resolve service for type '([^']+)' while attempting to activate '([^']+)'/i, prioridad: 5, titulo: "Falta registrar un servicio en DI",
    que: "El contenedor quiso construir una clase y un parámetro del constructor no está registrado. El mensaje dice cuál falta y para quién.",
    hacer: ["builder.Services.AddScoped<IServicio, Servicio>() (o Singleton/Transient) en Program.cs.", "Genéricas: AddScoped(typeof(IRepositorio<>), typeof(Repositorio<>)).", "Si falta IHttpClientFactory, ILogger<T> o IOptions<T>: AddHttpClient(), AddLogging(), Configure<T>()."],
    fuente: "https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection" });
  regla({ id: "di-no-service", tipo: /^InvalidOperationException$/, mensaje: /No service for type '([^']+)' has been registered/i, prioridad: 5, titulo: "GetRequiredService de algo que no está registrado",
    que: "Se pidió un servicio al contenedor (GetRequiredService o un parámetro de un endpoint mínimo) y no hay registro.",
    hacer: ["Registralo en Program.cs.", "En minimal APIs, un parámetro que no es de ruta ni body se resuelve de DI: si era del body, [FromBody]."] });
  regla({ id: "di-scoped-raiz", tipo: /^InvalidOperationException$/, mensaje: /Cannot resolve (?:scoped service|'[^']+' from root provider)|Cannot consume scoped service/i, prioridad: 5, titulo: "Un servicio Scoped pedido desde un Singleton (o desde la raíz)",
    que: "Un singleton, un BackgroundService o app.Services directo quiso resolver algo Scoped como el DbContext. En Development se valida y tira; en Producción no tira pero el Scoped se vuelve singleton de facto.",
    hacer: ["Inyectá IServiceScopeFactory y creá un scope: using var scope = factory.CreateScope(); scope.ServiceProvider.GetRequiredService<T>().", "Para el DbContext, IDbContextFactory<T>.", "No registres el DbContext como Singleton para «arreglarlo»."],
    fuente: "https://learn.microsoft.com/aspnet/core/fundamentals/dependency-injection#scope-validation" });
  regla({ id: "aspnet-handler-404", tipo: /^InvalidOperationException$/, mensaje: /exception handler configured on ExceptionHandlerOptions produced a 404/i, prioridad: 1, titulo: "UseExceptionHandler sin manejador: tu error es la excepción interna",
    que: "app.UseExceptionHandler() está sin ruta ni IExceptionHandler (o la ruta devuelve 404), así que ASP.NET Core envuelve la excepción original en esta.",
    hacer: ["Mirá la excepción interna: ese es tu error.", "Configurá app.UseExceptionHandler(\"/error\") con un endpoint, o AddProblemDetails() + AddExceptionHandler<T>() en .NET 8."] });
  regla({ id: "aspnet-body", tipo: /^BadHttpRequestException$/, prioridad: 4, titulo: "El body del request no se pudo leer",
    que: "ASP.NET Core no pudo deserializar el JSON del body al parámetro del endpoint. Al cliente le llega un 400; la causa está en la JsonException interna.",
    hacer: ["«Path: $.campo» de la interna dice qué propiedad no cerró.", "Si el cliente manda números como strings, JsonNumberHandling.AllowReadingFromString.", "Es un 400 esperable: no lo loguees como error del servidor."] });
  regla({ id: "aspnet-ambiguo", tipo: /^AmbiguousMatchException$/, prioridad: 5, titulo: "Dos endpoints matchean la misma ruta",
    que: "Dos acciones o MapGet con la misma plantilla y verbo. El mensaje lista los candidatos.",
    hacer: ["Diferencialos por ruta, verbo o restricción ({id:int})."] });
  regla({ id: "aspnet-headers", tipo: /^InvalidOperationException$/, mensaje: /Headers are read-only, response has already started|StatusCode cannot be set because the response has already started/i, prioridad: 5, titulo: "Quisiste cambiar la respuesta cuando ya había empezado a salir",
    que: "Un middleware o un catch intentó setear StatusCode o un header después de que el cuerpo empezó a escribirse.",
    hacer: ["Decidí el status antes de escribir al body.", "En tu middleware de errores, chequeá context.Response.HasStarted."] });
  regla({ id: "aspnet-sync-io", tipo: /^InvalidOperationException$/, mensaje: /Synchronous operations are disallowed/i, prioridad: 5, titulo: "I/O sincrónica sobre el request o la respuesta",
    que: "Kestrel no permite Read/Write sincrónicos sobre el body: un StreamReader.ReadToEnd o un serializador viejo escribiendo a Response.Body.",
    hacer: ["Usá la versión async (ReadToEndAsync, WriteAsync, SerializeAsync).", "AllowSynchronousIO = true es un parche, no un arreglo."] });
  regla({ id: "timeout", tipo: /^TimeoutException$/, prioridad: 3, titulo: "Se venció un tiempo de espera",
    que: "Alguna operación no terminó en el plazo configurado; quién la tiró dice cuál (HttpClient, un lock, una cola, SqlClient al abrir).",
    hacer: ["Identificá el plazo y por qué se superó: ¿el otro lado está lento o caído?", "Subir el timeout solo si la operación legítimamente tarda."] });
  regla({ id: "taskcanceled-http", tipo: /^TaskCanceledException$/, mensaje: /HttpClient\.Timeout/i, prioridad: 5, titulo: "Timeout de HttpClient (no una cancelación tuya)",
    que: "Desde .NET 5 el mensaje lo dice: el request superó HttpClient.Timeout (100 s por defecto). El servicio al que le pegás tardó más de lo esperado.",
    hacer: ["Mirá qué tan lento está el destino. Si legítimamente tarda, subí Timeout en ese HttpClient nombrado.", "Pasá el CancellationToken del request a SendAsync.", "Con Polly: timeout por intento, reintentos acotados y circuit breaker."],
    fuente: "https://learn.microsoft.com/dotnet/api/system.net.http.httpclient.timeout" });
  regla({ id: "taskcanceled", tipo: /^TaskCanceledException$/, prioridad: 3, titulo: "Una tarea se canceló",
    que: "Un CancellationToken se activó: el cliente HTTP cerró la conexión (RequestAborted), la app se apaga, un timeout con cancelación, o una CancellationTokenSource tuya.",
    hacer: ["En .NET Core 3.1 o anterior, un TaskCanceledException de HttpClient sin cancelación tuya es el Timeout.", "Si es RequestAborted: el usuario cerró la pestaña; no es un error de la app, bajale el nivel de log."] });
  regla({ id: "opcanceled", tipo: /^OperationCanceledException$/, prioridad: 3, titulo: "Una operación se canceló",
    que: "Alguien llamó a Cancel() (o venció un CancelAfter) y el código lo respetó.",
    hacer: ["Si viene de IHostApplicationLifetime o un BackgroundService: la app se estaba apagando, es normal.", "Capturala explícitamente cuando sea esperable y no la loguees como error."] });
  regla({ id: "aggregate", tipo: /^AggregateException$/, prioridad: 2, titulo: "Una o más excepciones envueltas por una Task",
    que: ".Result, .Wait(), Task.WaitAll o Parallel.ForEach envuelven lo que falló. Las causas reales son las internas.",
    hacer: ["Mirá las internas.", "Si llegaste por .Result o .Wait(), cambiá a await: evitás el envoltorio y los bloqueos del thread pool.", "A mano: ex.Flatten().InnerExceptions."] });
  regla({ id: "typeinit", tipo: /^TypeInitializationException$/, prioridad: 4, titulo: "Falló el constructor estático de un tipo",
    que: "Un static readonly o un static ctor tiraron. Ese tipo queda inutilizable en todo el proceso (vuelve a tirar lo mismo cada vez). La causa está en la interna.",
    hacer: ["Mirá la interna: variable de entorno faltante, archivo, configuración, Regex inválida, librería nativa.", "Mové inicializaciones que pueden fallar a Lazy<T> o a DI, donde el error se ve claro."] });
  regla({ id: "notimplemented", tipo: /^NotImplementedException$/, prioridad: 4, titulo: "Un método que todavía no está implementado",
    que: "Un throw new NotImplementedException() quedó en el código y se llamó.",
    hacer: ["Implementalo, o si no aplica tirá NotSupportedException con un mensaje.", "Buscá NotImplementedException en el repo: suele haber más."] });
  regla({ id: "notsupported", tipo: /^NotSupportedException$/, prioridad: 3, titulo: "La operación no está soportada por ese objeto",
    que: "Escribir en un stream de solo lectura, Add en un array o colección fija, Seek en un NetworkStream, serializar un tipo abstracto.",
    hacer: ["El mensaje y el primer frame tuyo dicen qué operación; buscá la alternativa."] });
  regla({ id: "invariante", tipo: /^NotSupportedException$/, mensaje: /Globalization Invariant Mode is not supported/i, prioridad: 5, titulo: "SqlClient no anda con InvariantGlobalization",
    que: "La imagen de Docker o el csproj tienen el modo invariante de globalización (sin ICU) y Microsoft.Data.SqlClient lo rechaza al abrir la conexión. Pasa con imágenes alpine o con <InvariantGlobalization>true</InvariantGlobalization>.",
    hacer: ["Instalá ICU en la imagen (apk add icu-libs) y DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false.", "O sacá InvariantGlobalization del csproj."],
    fuente: "https://learn.microsoft.com/dotnet/core/runtime-config/globalization" });
  regla({ id: "cultura", tipo: /^CultureNotFoundException$/, prioridad: 5, titulo: "La cultura no existe (o estás en modo invariante)",
    que: "new CultureInfo con un nombre inválido, o un nombre válido («es-AR») en un entorno con globalización invariante, donde solo existe la invariante.",
    hacer: ["Si el nombre es correcto y falla en Docker: instalá ICU y desactivá el modo invariante.", "Si el nombre viene del usuario o de Accept-Language, validalo y usá una por defecto."] });
  regla({ id: "drawing", tipo: /^PlatformNotSupportedException$/, mensaje: /System\.Drawing\.Common is not supported on non-Windows/i, prioridad: 5, titulo: "System.Drawing no anda en Linux (desde .NET 6)",
    que: "System.Drawing.Common es solo Windows desde .NET 6. Lo trae alguna librería de imágenes, PDF, códigos de barras o Excel vieja.",
    hacer: ["Reemplazá por ImageSharp, SkiaSharp o Magick.NET.", "Si lo trae una librería, buscá su versión multiplataforma."],
    fuente: "https://learn.microsoft.com/dotnet/core/compatibility/core-libraries/6.0/system-drawing-common-windows-only" });
  regla({ id: "plataforma", tipo: /^PlatformNotSupportedException$/, prioridad: 4, titulo: "Esa API no existe en este sistema operativo",
    que: "Algo que solo está en Windows (registro, WMI, EventLog, System.Drawing) y la app corre en Linux.",
    hacer: ["Alternativa multiplataforma o protegelo con OperatingSystem.IsWindows(). El analizador CA1416 te lo marca al compilar."] });
  regla({ id: "ensamblado", tipo: /^FileNotFoundException$/, mensaje: /Could not load file or assembly|No se puede cargar el archivo o ensamblado/i, prioridad: 5, titulo: "Falta un ensamblado o la versión no coincide",
    que: "El runtime buscó una DLL con una versión exacta y no la encontró: paquetes NuGet con versiones distintas entre proyectos, un deploy incompleto, un plugin compilado contra otra versión, o en .NET Framework un binding redirect que falta.",
    hacer: ["El mensaje nombra el ensamblado y la versión: ¿está en la carpeta de deploy? ¿Es esa versión?", "Unificá versiones en toda la solución (Directory.Packages.props ayuda).", "En .NET Framework: <bindingRedirect> o AutoGenerateBindingRedirects."] });
  regla({ id: "archivo", tipo: /^FileNotFoundException$/, prioridad: 4, titulo: "No se encontró el archivo",
    que: "La ruta no existe donde corre la app. El mensaje suele traer la ruta completa.",
    hacer: ["¿Es relativa? Depende del directorio de trabajo, que en un servicio o en Docker no es el de la DLL: usá AppContext.BaseDirectory o ContentRootPath.", "En Linux importan mayúsculas y minúsculas.", "¿Está marcado «Copiar en el directorio de salida»?"] });
  regla({ id: "carpeta", tipo: /^DirectoryNotFoundException$/, prioridad: 4, titulo: "La carpeta no existe",
    que: "Se quiso escribir o leer en una carpeta no creada (logs, uploads), o una ruta de Windows en Linux.",
    hacer: ["Directory.CreateDirectory antes de escribir.", "Path.Combine en vez de strings pegados."] });
  regla({ id: "sin-permiso", tipo: /^UnauthorizedAccessException$/, prioridad: 4, titulo: "Sin permiso para ese archivo o carpeta",
    que: "La cuenta con la que corre la app no puede leer o escribir ahí (el usuario del app pool en IIS; en las imágenes .NET 8 el usuario «app», no root). También pasa al abrir una carpeta como si fuera un archivo.",
    hacer: ["Dale permisos a la cuenta del servicio sobre esa carpeta, o usá una que ya tenga (ContentRoot, /tmp).", "Si la ruta es una carpeta y querías un archivo, es este mismo error."] });
  regla({ id: "archivo-en-uso", tipo: /^IOException$/, mensaje: /being used by another process|está siendo utilizado por otro proceso/i, prioridad: 5, titulo: "El archivo lo tiene abierto otro proceso (o vos mismo)",
    que: "Un Excel abierto, un antivirus, otro worker, o tu propio FileStream anterior que no se cerró (falta un using).",
    hacer: ["Revisá que todos los FileStream/StreamWriter se cierren.", "Si otros procesos pueden tenerlo abierto, FileShare.ReadWrite o reintento con espera."] });
  regla({ id: "io-cancelada", tipo: /^IOException$/, mensaje: /Operation canceled|operación se canceló/i, prioridad: 1, excluyente: true, titulo: "La lectura de red se canceló (detalle de bajo nivel)",
    que: "La conexión se cortó porque alguien canceló la operación desde arriba (un timeout o un CancellationToken). Es el efecto, no la causa: mirá la excepción que la envuelve.",
    hacer: ["Mirá las excepciones externas: ahí está el timeout o la cancelación."] });
  regla({ id: "io-transporte", tipo: /^IOException$/, mensaje: /Unable to (?:read|write) data (?:from|to) the transport connection/i, prioridad: 3, titulo: "Se cortó la conexión de red",
    que: "El socket se cerró o reseteó en el medio: el otro lado cerró, un proxy o balanceador cortó por inactividad, o un timeout canceló la operación. El detalle está en la SocketException interna.",
    hacer: ["Mirá el código de la SocketException (104/10054 reset por el otro lado, 110/10060 timeout, 125 cancelado por un timeout tuyo).", "Si pasa después de un tiempo fijo (30, 60, 100 s), es un timeout de alguien.", "Para HttpClient singleton, PooledConnectionLifetime evita reutilizar conexiones muertas."] });
  regla({ id: "io", tipo: /^IOException$/, prioridad: 3, titulo: "Error de entrada/salida",
    que: "Algo falló leyendo o escribiendo un archivo, un socket o un pipe.",
    hacer: ["El mensaje dice qué: disco lleno, ruta larga, archivo en uso, conexión cortada."] });
  regla({ id: "ruta-larga", tipo: /^PathTooLongException$/, prioridad: 5, titulo: "Ruta de más de 260 caracteres en Windows",
    que: "Windows limita las rutas salvo que se habilite el soporte de rutas largas.",
    hacer: ["LongPathsEnabled (Windows 10 1607+) o acortá la ruta base.", "Si el nombre lo arma tu código con datos del usuario, recortalo."] });
  regla({ id: "dll-nativa", tipo: /^DllNotFoundException$/, prioridad: 5, titulo: "Falta una DLL nativa",
    que: "Un P/Invoke o una librería con componente nativo (SQLite, libgdiplus, libssl, SkiaSharp) no encontró la .so/.dll. Típico al pasar a Linux o a imágenes alpine (musl).",
    hacer: ["Instalá la dependencia nativa en la imagen o usá la variante linux-musl del paquete.", "Revisá que el paquete incluya runtimes/ de tu plataforma."] });
  regla({ id: "badimage", tipo: /^BadImageFormatException$/, prioridad: 5, titulo: "Mezcla de 32 y 64 bits (o una DLL que no es .NET)",
    que: "Una DLL x86 en un proceso x64 o al revés. Clásico con drivers Oracle/Access/ODBC de 32 bits en un IIS de 64.",
    hacer: ["Igualá la plataforma: PlatformTarget, «Enable 32-Bit Applications» en el app pool, o el driver de 64 bits."] });
  regla({ id: "missingmethod", tipo: /^Missing(?:Method|Member|Field)Exception$/, prioridad: 5, titulo: "El método existe en tu compilación pero no en la DLL cargada",
    que: "Se compiló contra una versión de una librería y en runtime se cargó otra sin ese método, o un Activator.CreateInstance con parámetros que no coinciden con ningún constructor.",
    hacer: ["Unificá la versión del paquete y hacé un deploy limpio (borrá la carpeta antes de copiar).", "Si es reflexión: el tipo no tiene un constructor con esos parámetros."] });
  regla({ id: "typeload", tipo: /^(?:ReflectionTypeLoad|TypeLoad)Exception$/, prioridad: 5, titulo: "No se pudo cargar un tipo",
    que: "Un tipo referenciado no existe en la DLL cargada (versión incompatible). Mismo problema de versiones mezcladas que MissingMethodException.",
    hacer: ["Alineá versiones y rehacé el deploy.", "Con ReflectionTypeLoadException, la info real está en LoaderExceptions."] });
  regla({ id: "stackoverflow", tipo: /^(?:StackOverflow|InsufficientExecutionStack)Exception$/, prioridad: 5, titulo: "Recursión infinita",
    que: "Una propiedad que se devuelve a sí misma, dos métodos que se llaman mutuamente, o la serialización de un grafo con ciclos. En .NET Core un StackOverflow mata el proceso sin catch.",
    hacer: ["El frame que se repite es el ciclo.", "Si es JSON: ReferenceHandler.IgnoreCycles o DTOs."] });
  regla({ id: "oom", tipo: /^OutOfMemoryException$/, prioridad: 5, titulo: "Se acabó la memoria (o pediste un array enorme)",
    que: "Una lista que crece sin fin, un ToList de millones de filas, un archivo entero en memoria, o el límite del contenedor. «Array dimensions exceeded supported range» es un array de más de 2 GB.",
    hacer: ["¿Qué estaba creando el primer frame tuyo? ¿Una lista con toda la tabla?", "Procesá en streaming: IAsyncEnumerable, paginación, leer por líneas.", "Si crece con el tiempo: pérdida de memoria (eventos sin desuscribir, cache sin límite)."] });
  regla({ id: "win32", tipo: /^Win32Exception$/, prioridad: 3, titulo: "Un error del sistema operativo",
    que: "Un código nativo de Windows (o errno en Linux). 2 archivo no encontrado, 5 acceso denegado, 258 tiempo de espera agotado (el que acompaña a los timeouts de SqlClient), 10061 conexión rechazada.",
    hacer: ["Si viene de Process.Start: el ejecutable no está en el PATH o la ruta es incorrecta (en Linux además necesita permiso de ejecución).", "Si está adentro de una SqlException, mirá esa."] });
  regla({ id: "socket", tipo: /^SocketException$/, prioridad: 3, titulo: "Error de red a nivel socket",
    que: "El TCP de abajo falló. El código entre paréntesis dice cómo: 111 / 10061 nadie escucha en ese puerto; 110 / 10060 no contestó; 113 / 10065 no hay ruta; 104 / 10054 el otro lado cortó; 11001 no resolvió el nombre; 125 cancelado por un timeout tuyo.",
    hacer: ["Rechazada: el servicio no está levantado o escucha en otro puerto (en Docker, «localhost» es el contenedor, no el host).", "Timeout: probá con Test-NetConnection o nc desde la misma máquina.", "DNS: el nombre no resuelve desde ese servidor."] });
  regla({ id: "socket-cancelada", tipo: /^SocketException$/, mensaje: /Operation canceled|\(125\)|\(995\)|\(10004\)|operación de E\/S se anuló/i, prioridad: 1, excluyente: true, titulo: "El socket se canceló (detalle de bajo nivel)",
    que: "Código 125 (Linux) o 995/10004 (Windows): la operación de red se canceló desde arriba, por un timeout o un CancellationToken. No es la causa: es el efecto. Lo que importa es la excepción que la envuelve.",
    hacer: ["Mirá las excepciones externas: ahí está el timeout o la cancelación que la provocó."] });
  regla({ id: "socket-rechazada", tipo: /^SocketException$/, mensaje: /Connection refused|\(111\)|\(10061\)|rechaz/i, prioridad: 4, titulo: "Nadie escucha en ese host:puerto",
    que: "La máquina contestó, pero en ese puerto no hay nada (errno 111 en Linux, 10061 en Windows). El servicio no está arriba, escucha en otro puerto, o solo en 127.0.0.1.",
    hacer: ["¿Está levantado el destino? ¿En ese puerto? (ss -ltnp / netstat -an).", "En Docker Compose o Kubernetes, usá el nombre del servicio, no localhost.", "Revisá la configuración de este entorno (URL y puerto)."] });
  regla({ id: "socket-timeout", tipo: /^SocketException$/, mensaje: /timed out|\(110\)|\(10060\)|tiempo de espera/i, prioridad: 4, titulo: "El host no contestó (timeout de conexión)",
    que: "Se mandó el SYN y nadie respondió (110 / 10060): algo descarta los paquetes, una IP equivocada o un host apagado.",
    hacer: ["Probá la conectividad desde el servidor de la app (Test-NetConnection host -Port n, o nc -vz).", "Verificá que la IP o el nombre sean los del entorno correcto."] });
  regla({ id: "socket-dns", tipo: /^SocketException$/, mensaje: /No such host is known|Name or service not known|nodename nor servname|Host desconocido|\(11001\)|Resource temporarily unavailable/i, prioridad: 4, titulo: "El nombre no resuelve (DNS)",
    que: "El servidor donde corre la app no pudo traducir el nombre a una IP: nombres internos que solo resuelven en la red de la oficina, DNS del contenedor, o un typo en la URL.",
    hacer: ["nslookup / dig desde esa máquina o contenedor.", "En Docker Compose usá el nombre del servicio; en Kubernetes, servicio.namespace.svc."] });
  regla({ id: "socket-reset", tipo: /^SocketException$/, mensaje: /Connection reset|\(104\)|\(10054\)|restableci/i, prioridad: 4, titulo: "El otro lado cortó la conexión",
    que: "Llegó un RST: el servidor cerró de golpe (se reinició, el proceso murió, un balanceador la mató por inactividad). Si la conexión venía del pool, estaba muerta y recién te enteraste al usarla.",
    hacer: ["Mirá los logs del destino a esa hora.", "Para HttpClient singleton, PooledConnectionLifetime; para una base, un failover da esto una vez.", "Reintentar una vez una operación idempotente suele ser razonable."] });
  regla({ id: "http", tipo: /^HttpRequestException$/, prioridad: 3, titulo: "Falló un pedido HTTP",
    que: "HttpClient no pudo completarlo: no conectó, se cortó, falló el TLS, o EnsureSuccessStatusCode vio un 4xx/5xx. La SocketException interna (si hay) tiene el detalle de red.",
    hacer: ["Si dice «Connection refused», «No such host», «timed out»: mirá la SocketException de abajo.", "Si dice «The SSL connection could not be established»: certificados, mirá la AuthenticationException."] });
  regla({ id: "http-status", tipo: /^HttpRequestException$/, mensaje: /Response status code does not indicate success: (\d{3})/i, prioridad: 4, titulo: "El servidor respondió con un error HTTP",
    que: "El request llegó y el otro servicio contestó con error; EnsureSuccessStatusCode lo convirtió en excepción. 401/403 credenciales o permisos; 404 ruta o recurso; 400/422 el body que mandaste; 429 te limitaron; 5xx el otro lado está roto o caído.",
    hacer: ["Antes de EnsureSuccessStatusCode, leé y logueá response.Content: ahí está la explicación real.", "Para 5xx y 429: reintentos con backoff y circuit breaker; nunca reintentes un 400."] });
  regla({ id: "http-ssl", tipo: /^HttpRequestException$/, mensaje: /SSL connection could not be established|No se pudo establecer la conexión SSL/i, prioridad: 4, titulo: "Falló el TLS con el servidor",
    que: "El handshake no cerró: certificado de una CA interna que el servidor de la app no conoce, certificado vencido, nombre que no coincide, o versiones de TLS sin coincidencia. El detalle está en la AuthenticationException interna.",
    hacer: ["«UntrustedRoot» o «PartialChain»: instalar la CA raíz e intermedias en el servidor o contenedor que hace el pedido.", "«NotTimeValid»: renovar el certificado del destino.", "«RemoteCertificateNameMismatch»: usá el nombre que figura en el certificado, no la IP."] });
  regla({ id: "autenticacion", tipo: /^AuthenticationException$/, prioridad: 4, titulo: "Certificado rechazado",
    que: "La validación del certificado TLS falló; el mensaje dice el motivo (UntrustedRoot, NotTimeValid, RemoteCertificateNameMismatch, PartialChain).",
    hacer: ["Instalar la cadena de la CA en el cliente, renovar el certificado del servidor o corregir el nombre según el motivo."] });
  regla({ id: "json-stj", tipo: /^JsonException$/, prioridad: 4, titulo: "System.Text.Json no pudo leer el JSON",
    que: "El JSON no coincide con el tipo destino (un string donde iba un número, null en un int) o está mal formado (coma final, comentario). «Path: $.campo | LineNumber | BytePositionInLine» dice exactamente dónde.",
    hacer: ["Mirá el Path: esa propiedad es la que no cerró.", "Números entre comillas: JsonNumberHandling.AllowReadingFromString. Comas finales: AllowTrailingCommas.", "Otro casing: PropertyNameCaseInsensitive (en ASP.NET Core ya está activo; en Deserialize a mano, no)."],
    fuente: "https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/handle-errors" });
  regla({ id: "json-ciclo", tipo: /^JsonException$/, mensaje: /possible object cycle/i, prioridad: 5, titulo: "Ciclo al serializar (navegaciones en los dos sentidos)",
    que: "Típico de devolver entidades de EF Core con Cliente.Pedidos y Pedido.Cliente desde un controlador.",
    hacer: ["Devolvé DTOs proyectados con Select.", "Si no: ReferenceHandler.IgnoreCycles en AddJsonOptions o [JsonIgnore] en la navegación inversa."] });
  regla({ id: "json-reader", tipo: /^JsonReaderException$/, prioridad: 3, titulo: "El texto no es JSON válido",
    que: "Un HTML de error en vez de JSON, texto vacío, comillas simples, comas finales, o un texto cortado. «'<' is an invalid start of a value» es un HTML.",
    hacer: ["Logueá el texto crudo antes de deserializar.", "Si viene de HttpClient, chequeá status y Content-Type antes."] });
  regla({ id: "json-newtonsoft-reader", tipo: /^JsonReaderException$/, mensaje: /Path '[^']*', line \d+, position \d+/i, prioridad: 4, titulo: "Newtonsoft no pudo leer el JSON en ese punto",
    que: "Json.NET falló leyendo el texto: «Could not convert string to integer» (vino un string donde iba un número), «Unexpected character encountered while parsing value: <» (un HTML donde esperabas JSON), «After parsing a value an unexpected character was encountered» (falta una coma o una comilla), «Unterminated string» (texto cortado). «Path 'x', line n, position m» dice exactamente dónde.",
    hacer: ["Mirá el Path y la posición del mensaje sobre el texto crudo.", "Si viene de HttpClient, chequeá status y Content-Type antes de deserializar.", "Si el texto se guardó truncado en una columna varchar(n), ese es el problema."] });
  regla({ id: "json-newtonsoft", tipo: /^JsonSerializationException$/, prioridad: 4, titulo: "Newtonsoft no pudo convertir el JSON al tipo",
    que: "«Error converting value» (tipo que no coincide), «Cannot deserialize the current JSON array into type» (vino un array y esperabas un objeto, o al revés), «Self referencing loop detected» (ciclos).",
    hacer: ["«Path 'x.y', line n» apunta a la propiedad.", "Array vs objeto: List<T> vs T.", "Ciclos: ReferenceLoopHandling.Ignore o DTOs."] });
  regla({ id: "validacion", tipo: /^ValidationException$/, prioridad: 4, titulo: "Un dato no pasó la validación",
    que: "DataAnnotations o FluentValidation encontraron un dato inválido; el mensaje es el de la regla.",
    hacer: ["Si viene de IOptions al arrancar, falta o está mal una configuración.", "Si es un request, devolvé 400 con los errores en vez de un 500."] });
  regla({ id: "options", tipo: /^OptionsValidationException$/, prioridad: 5, titulo: "Una sección de configuración no cumple sus validaciones",
    que: "ValidateDataAnnotations/ValidateOnStart rechazó la configuración. El mensaje lista cada regla rota.",
    hacer: ["Completá la sección en appsettings del entorno o en variables (Seccion__Propiedad).", "Mejor que falle al arrancar que a las 3 AM en el primer request."] });
  regla({ id: "semaforo", tipo: /^SemaphoreFullException$/, prioridad: 5, titulo: "Release() de más en un SemaphoreSlim", que: "Se llamó Release más veces que Wait: un Release en un finally cuyo Wait falló.", hacer: ["WaitAsync afuera del try y el Release en el finally."] });
  regla({ id: "lock-recursivo", tipo: /^LockRecursionException$/, prioridad: 5, titulo: "Tomaste el mismo lock dos veces en un hilo", que: "ReaderWriterLockSlim sin recursión, o GetOrAdd de ConcurrentDictionary cuyo valueFactory vuelve a entrar.", hacer: ["Tomá el lock una sola vez o usá EnterUpgradeableReadLock."] });
  regla({ id: "threadabort", tipo: /^ThreadAbortException$/, prioridad: 4, titulo: "El hilo fue abortado (.NET Framework)", que: "Thread.Abort, o en ASP.NET clásico un Response.Redirect/Response.End que corta el hilo del request (es su forma normal de terminar).", hacer: ["Response.Redirect(url, false) + CompleteRequest y no la captures como error."] });
  regla({ id: "targetinvocation", tipo: /^TargetInvocationException$/, prioridad: 2, titulo: "Un método llamado por reflexión tiró; la causa es la interna",
    que: "MethodInfo.Invoke, Activator o un framework que invoca por reflexión envuelven la excepción real en esta.",
    hacer: ["Mirá la interna.", "Si invocás vos, relanzá la InnerException con ExceptionDispatchInfo para no perder la traza."] });
  regla({ id: "dbupdate", tipo: /^DbUpdateException$/, prioridad: 3, titulo: "SaveChanges falló en la base; la causa es la interna",
    que: "La base rechazó los cambios. La SqlException/PostgresException interna tiene el motivo (clave duplicada, FK, NULL, truncamiento, deadlock).",
    hacer: ["Mirá la interna: ahí está el número de error y la restricción.", "Para distinguir en código: ex.InnerException is SqlException { Number: 2627 or 2601 } o PostgresException { SqlState: \"23505\" }.", "ex.Entries tiene las entidades que se guardaban: logueá sus claves."] });
  regla({ id: "concurrencia", tipo: /^DbUpdateConcurrencyException$/, prioridad: 5, titulo: "Otro cambió (o borró) la fila antes que vos",
    que: "EF Core esperaba afectar 1 fila y afectó 0: la fila ya no existe o cambió su rowversion desde que la leíste. También con una entidad Modified que nunca estuvo en la base, o con triggers que cambian el conteo de filas.",
    hacer: ["Si usás rowversion, era el objetivo: capturala, recargá (entry.Reload()) y decidí (gana el último, mergeás, avisás).", "Si no: la fila fue borrada, o estás actualizando algo que no existe (¿Id en 0?).", "Con triggers en SQL Server y EF Core 7+: HasTrigger en la tabla."],
    fuente: "https://learn.microsoft.com/ef/core/saving/concurrency" });
  regla({ id: "dapper", tipo: /^DataException$/, mensaje: /Error parsing column (\d+) \(([^=]+)=/i, prioridad: 5, titulo: "Dapper no pudo mapear una columna a la propiedad",
    que: "«Error parsing column N (Columna=valor - Tipo)»: el valor de la base no entra en la propiedad (string en int, decimal en int, NULL en un tipo no anulable). El detalle está en la interna.",
    hacer: ["Compará el tipo de la columna (lo dice el mensaje) con el de la propiedad del mismo nombre.", "Para NULL: propiedad anulable. Para tipos distintos: ajustá la propiedad o registrá un TypeHandler."] });
  regla({ id: "redis-conexion", tipo: /^RedisConnectionException$/, prioridad: 5, titulo: "No se pudo conectar a Redis",
    que: "StackExchange.Redis no llegó al servidor: host o puerto, Redis caído, TLS requerido (los servicios gestionados suelen usar 6380 con ssl=true). Con abortConnect=true (el default) un fallo al arrancar tira esto en vez de seguir reintentando.",
    hacer: ["Probá redis-cli -h host -p puerto desde el servidor de la app.", "En web apps, abortConnect=false para que siga intentando y no tumbe el arranque."] });
  regla({ id: "redis-timeout", tipo: /^RedisTimeoutException$/, prioridad: 5, titulo: "Redis no contestó a tiempo",
    que: "Un comando superó syncTimeout/asyncTimeout (5 s). El mensaje trae contadores: si WORKER o IOCP muestran Busy ≥ Min, el problema es el thread pool de tu app, no Redis; si «in» es grande, la respuesta es enorme; si «qs» es grande, hay mucho encolado.",
    hacer: ["Leé los contadores con la guía oficial.", "Evitá comandos grandes (KEYS, HGETALL gigantes) y .Result sobre Redis.", "Un solo ConnectionMultiplexer por app."],
    fuente: "https://stackexchange.github.io/StackExchange.Redis/Timeouts" });
  regla({ id: "rabbit", tipo: /^BrokerUnreachableException$/, prioridad: 5, titulo: "No se pudo conectar a RabbitMQ", que: "Host/puerto (5672, 5671 con TLS), credenciales, vhost inexistente o permisos sobre el vhost. La interna dice cuál.", hacer: ["Mirá la interna.", "El vhost «/» se codifica como %2F en la URI."] });
  regla({ id: "grpc", tipo: /^RpcException$/, prioridad: 4, titulo: "Falló una llamada gRPC", que: "El StatusCode dice qué: Unavailable (no conectó), DeadlineExceeded (timeout), NotFound, Internal (excepción del servidor), Unimplemented (método o versión que no coincide).", hacer: ["Unavailable: ¿el servidor escucha HTTP/2? ¿http:// con un cliente que exige TLS?", "Internal: el log del servidor."] });
  regla({ id: "sql", tipo: /^SqlException$/, prioridad: 3, titulo: "SQL Server devolvió un error",
    que: "Una SqlException trae «Error Number», State y Class al pie: el número es la clave para saber qué pasó y para manejarlo en código con ex.Number.",
    hacer: ["SELECT text FROM sys.messages WHERE message_id = N AND language_id = 1033.", "Class ≥ 20 significa que la conexión se cortó."] });

  // ----- SQL Server, por número -----
  SQL([2627, 2601], "Clave duplicada (PRIMARY KEY o índice único)",
    "Ya existe una fila con esa clave: 2627 es una PRIMARY KEY/UNIQUE, 2601 un índice único. El mensaje dice la restricción, la tabla y el valor.",
    ["Si es un alta repetida (doble clic, reintento, mensaje reprocesado): hacé la operación idempotente (buscar antes, MERGE, o capturar 2627/2601 y devolver el existente).", "Si el Id lo asignás vos: ¿dos procesos generando el mismo? IDENTITY o secuencias.", "Si no debería existir, es un problema de datos."]);
  SQL(547, "Restricción FOREIGN KEY o CHECK rota",
    "Un INSERT/UPDATE apunta a un padre inexistente, un DELETE quiere borrar un padre con hijos, o un CHECK rechazó el valor. El mensaje nombra la restricción, la tabla y la columna.",
    ["FK en alta: el Id padre no existe en este entorno (¿datos de otro entorno?, ¿se creó en otra transacción sin confirmar?).", "FK en borrado: borrar o desvincular los hijos primero, o ON DELETE CASCADE/SET NULL si corresponde.", "CHECK: el valor no cumple la regla."]);
  SQL(515, "Se intentó insertar NULL en una columna NOT NULL",
    "El mensaje dice la columna. Falta un valor obligatorio, o el ORM mandó null porque la propiedad no tenía valor.",
    ["De dónde debería venir el valor en tu código.", "Si la columna debería tener default, definilo (HasDefaultValueSql en EF Core)."]);
  SQL([2628, 8152], "El texto no entra en la columna (truncamiento)",
    "Un string más largo que el varchar(n) de la columna. En SQL Server 2019+ el mensaje (2628) dice tabla, columna y valor; antes (8152) solo «String or binary data would be truncated».",
    ["Agrandá la columna o validá el largo antes (MaxLength en el DTO y HasMaxLength en la entidad).", "En versiones viejas, el flag 460 o compatibilidad 150 para que diga cuál columna."]);
  SQL(208, "El objeto no existe (tabla, vista o función)",
    "«Invalid object name 'X'»: no existe en esa base, está en otro esquema, o te conectaste a otra base (master por defecto, o la de otro entorno).",
    ["Revisá Initial Catalog/Database de la cadena: ¿es la base correcta?", "Calificá con el esquema (dbo.Clientes).", "¿Falta aplicar migraciones en ese entorno?"]);
  SQL(207, "La columna no existe",
    "«Invalid column name 'X'»: se renombró, falta una migración en este entorno, o el modelo de EF Core tiene una propiedad que la base no tiene.",
    ["Una propiedad nueva en la entidad sin migración aplicada da exactamente esto.", "dotnet ef migrations list para ver qué falta."]);
  SQL(2812, "El procedimiento almacenado no existe", "«Could not find stored procedure 'X'»: no está en esa base/esquema, o estás conectado a otra base.", ["Revisá base y esquema.", "¿Se desplegó el script del SP en este entorno?"]);
  SQL(245, "No se pudo convertir un texto a número",
    "«Conversion failed when converting the varchar value 'abc' to data type int»: se comparó o insertó texto en una columna numérica. Típico de WHERE Id = 'abc', de una columna varchar que guarda números «casi siempre», o de un parámetro mandado como string.",
    ["Mandá los parámetros con el tipo correcto (SqlDbType.Int, no AddWithValue con un string).", "Si la columna varchar mezcla números y letras, TRY_CONVERT o arreglá el modelo."]);
  SQL([241, 242], "Fecha que el servidor no pudo convertir",
    "«31/02/2026», o un dd/MM/yyyy con un servidor en inglés (que espera MM/dd). Casi siempre una fecha concatenada en el SQL en vez de pasada como parámetro.",
    ["Pasá las fechas como parámetros DateTime.", "Si tiene que ser texto, 'yyyyMMdd' o ISO."]);
  SQL(8115, "Desbordamiento aritmético al convertir", "El valor no entra en el decimal(p,s) de la columna o del parámetro (123456.78 en decimal(5,2)).", ["Agrandá la precisión (HasPrecision en EF Core).", "Si es un contador, bigint."]);
  SQL(8134, "División por cero en SQL", "Una división en la consulta con divisor 0.", ["NULLIF(divisor, 0)."]);
  SQL(137, "Falta declarar (o pasar) un parámetro", "«Must declare the scalar variable \"@Id\"»: el SQL usa @Id pero no se agregó ese parámetro (nombre distinto, mayúsculas, o Dapper con una propiedad que no coincide).", ["Los @nombres del SQL y los Parameters/propiedades tienen que coincidir exactamente.", "En Dapper, una propiedad de más no molesta; una de menos da esto."]);
  SQL(1205, "Deadlock: SQL Server eligió tu transacción como víctima",
    "Dos transacciones se bloquearon mutuamente y SQL Server canceló la tuya. No hay nada roto: la operación simplemente no se hizo. Es normal bajo concurrencia si dos procesos tocan las mismas filas en distinto orden.",
    ["Reintentá la transacción entera con una pequeña espera; EF Core lo hace con EnableRetryOnFailure.", "Para que pase menos: tocar las tablas siempre en el mismo orden, transacciones cortas, índices que eviten escaneos.", "El grafo del deadlock está en la sesión system_health de extended events."],
    "https://learn.microsoft.com/sql/relational-databases/sql-server-deadlocks-guide");
  SQL(-2, "Timeout del comando (CommandTimeout)",
    "«Execution Timeout Expired»: la consulta tardó más que CommandTimeout (30 s por defecto). Casi siempre es una consulta lenta (falta un índice, plan malo por parameter sniffing) o un bloqueo (alguien tiene la fila en una transacción abierta).",
    ["¿Lentitud o bloqueo? sys.dm_exec_requests mientras pasa: si blocking_session_id tiene valor, es bloqueo.", "Si es lentitud: el plan de esa consulta con esos parámetros.", "Subir CommandTimeout es para reportes que legítimamente tardan, no para tapar esto."],
    "https://learn.microsoft.com/sql/connect/ado-net/sql/sqlclient-troubleshooting-guide");
  SQL(18456, "Login rechazado",
    "«Login failed for user 'x'»: usuario o contraseña incorrectos para ese servidor, el login no existe, o existe pero no tiene acceso a la base indicada. Al cliente siempre le llega State 1; el motivo fino queda en el error log del servidor.",
    ["Revisá usuario y contraseña configurados para este entorno (¿quedó la variable de otro entorno?).", "Con Integrated Security, el que se conecta es la cuenta del servicio o app pool.", "Pedile al DBA el State del error log del servidor para el motivo exacto."],
    "https://learn.microsoft.com/sql/relational-databases/errors-events/mssqlserver-18456-database-engine-error");
  SQL(4060, "No se puede abrir la base pedida", "«Cannot open database \"X\" requested by the login»: la base no existe en ese servidor, está offline, o el login no tiene usuario en esa base.", ["Confirmá el nombre de la base y que exista en ese servidor.", "Si existe, falta CREATE USER ... FOR LOGIN ... y un rol."]);
  SQL([53, 40, 2, 26, 10061, 11001, 1231, 10060, 64, 10054], "No se pudo llegar al servidor",
    "«A network-related or instance-specific error occurred»: el cliente ni siquiera habló con SQL Server. Nombre o instancia incorrectos, puerto cerrado, SQL Browser apagado (instancias con nombre sin puerto), TCP deshabilitado, firewall, o el servidor está caído. «error: 26» es «no encontré la instancia»; «error: 40» es «no pude abrir la conexión».",
    ["Desde el servidor de la app: Test-NetConnection host -Port 1433.", "Instancia con nombre: o SQL Browser (UDP 1434) o el puerto fijo en la cadena (SERVIDOR,1433).", "En Docker/Linux, «localhost» no es tu host, y la barra de la instancia no significa nada: usá host,puerto.", "La Win32Exception/SocketException interna dice si fue DNS, rechazo o timeout."],
    "https://learn.microsoft.com/troubleshoot/sql/database-engine/connect/network-related-or-instance-specific-error-occurred-while-establishing-connection");
  SQL([-1, 258, 121, 233, 10053, 10054], "Se cortó la conexión con SQL Server",
    "«A transport-level error has occurred» o «An existing connection was forcibly closed»: la conexión TCP se rompió en el medio por un failover, un reinicio, un idle timeout de un firewall o balanceador, o una consulta que SQL Server mató.",
    ["Si pasa una vez y después anda, el pool tenía una conexión muerta: EnableRetryOnFailure en EF Core o un reintento en la primera operación.", "Si es seguido, mirá el error log del servidor y el firewall entre medio."]);
  SQL([50000], "Un RAISERROR del propio código SQL", "Error 50000: lo tiró un procedimiento o trigger con RAISERROR sin número propio. El mensaje es el que escribió quien hizo el SP.", ["Buscá el texto del mensaje en los procedimientos y triggers de la base."]);
  SQL([2714], "El objeto ya existe", "CREATE TABLE/INDEX/PROC de algo que ya existe: una migración que se corrió dos veces, o un script sin IF NOT EXISTS.", ["Revisá __EFMigrationsHistory si es EF Core.", "Scripts idempotentes: IF OBJECT_ID(...) IS NULL, CREATE OR ALTER."]);
  SQL([3902, 3903, 3930], "Problema con la transacción", "COMMIT/ROLLBACK sin transacción (3902/3903), o «The current transaction cannot be committed» (3930) después de un error adentro de un TRY/CATCH con XACT_ABORT.", ["Chequeá XACT_STATE() en el CATCH y hacé ROLLBACK si es -1.", "No mezcles transacciones de ADO.NET con BEGIN TRAN dentro del SP sin cuidado."]);
  SQL([102, 156], "Error de sintaxis en el SQL", "«Incorrect syntax near 'x'»: casi siempre SQL armado concatenando strings, con una coma de más, una comilla sin cerrar o una palabra reservada.", ["Mirá el SQL que se mandó (logueá CommandText).", "Usá parámetros: evita este error y la inyección."]);
  SQL([1222], "Tiempo de espera de bloqueo agotado", "LOCK_TIMEOUT venció: otra sesión tiene el recurso bloqueado.", ["Buscá la sesión que bloquea en sys.dm_exec_requests.", "Transacciones más cortas."]);
  SQL([9002], "El log de transacciones está lleno", "El archivo .ldf no puede crecer: disco lleno, tamaño máximo, o modelo FULL sin backup de log.", ["Backup del log (modelo FULL) o pasar a SIMPLE si no hacen falta restauraciones a un punto en el tiempo.", "Es tema de infraestructura: avisar al DBA."]);
  SQL([1105], "Disco lleno para la base", "El archivo de datos no puede crecer: disco lleno o tamaño máximo alcanzado.", ["Espacio en disco o límite del archivo. Infraestructura."]);
  SQL([701, 802, 8645], "SQL Server se quedó sin memoria para la consulta", "Falta memoria en el servidor para ejecutar la consulta (ordenamientos y joins grandes, muchas consultas a la vez).", ["Revisá el plan: memory grants desmedidos por estimaciones malas.", "Max server memory y la carga del servidor."]);
  SQL([17142, 17187, 18401], "El servidor no acepta conexiones ahora", "SQL Server está arrancando, pausado o en recuperación.", ["Esperar y reintentar. Si persiste, mirar el estado del servicio."]);
  SQL([40613, 40197, 40501, 49918, 49919, 49920, 10928, 10929], "Error transitorio de Azure SQL", "Azure SQL devuelve estos números cuando la base no está disponible un momento (failover, reconfiguración, límites del nivel de servicio).", ["EnableRetryOnFailure en EF Core o SqlRetryLogicOption en SqlClient: son errores para reintentar.", "10928/10929: superaste el límite de sesiones o workers del tier."]);

  // ----- PostgreSQL, por SQLSTATE -----
  regla({ id: "pg", tipo: /^PostgresException$/, prioridad: 3, titulo: "PostgreSQL devolvió un error",
    que: "Una PostgresException arranca con el SQLSTATE («23505: ...»): cinco caracteres que dicen la clase de error. Al pie, los datos extra (Detail, Hint, Table, Constraint) si la cadena tiene Include Error Detail.",
    hacer: ["Buscá el SQLSTATE en la tabla oficial de códigos de error de PostgreSQL.", "Para que el Detail no venga tapado, Include Error Detail=true en la cadena (solo en desarrollo)."], fuente: "https://www.postgresql.org/docs/current/errcodes-appendix.html" });
  PG("23505", "Clave duplicada", "«duplicate key value violates unique constraint»: ya existe una fila con esa clave en la PK o en un índice único. El nombre de la restricción está en el mensaje; el valor, en Detail.", ["Operación idempotente: INSERT ... ON CONFLICT DO NOTHING/UPDATE, o buscar antes.", "Si el Id lo asignás vos, usá una secuencia o identity."]);
  PG("23503", "Clave foránea rota", "«violates foreign key constraint»: el padre no existe, o querés borrar un padre con hijos.", ["Creá el padre primero o desvinculá los hijos; ON DELETE CASCADE/SET NULL si corresponde."]);
  PG("23502", "NULL en una columna NOT NULL", "«null value in column \"x\" violates not-null constraint».", ["Falta el valor en tu código o un DEFAULT en la columna."]);
  PG("23514", "Restricción CHECK rota", "El valor no cumple el CHECK de la tabla.", ["El nombre de la restricción está en el mensaje; mirá su definición."]);
  PG("22001", "El texto no entra en la columna", "«value too long for type character varying(n)».", ["Agrandá la columna (o usá text) o validá el largo antes."]);
  PG("22P02", "Texto que no es un número (o un UUID, o un JSON)", "«invalid input syntax for type integer: \"abc\"»: un parámetro mandado como texto donde iba un entero, o una columna text comparada con un número.", ["Mandá el parámetro con el tipo correcto (Npgsql infiere del tipo .NET: pasá un int, no un string).", "Si es una columna text con números, castéa explícitamente."]);
  PG("42P01", "La tabla (relación) no existe", "«relation \"Clientes\" does not exist»: en Postgres los nombres sin comillas se pasan a minúsculas, así que «Clientes» ≠ clientes. También: otra base, otro schema fuera del search_path, o migración sin aplicar.", ["Si la tabla se creó con comillas (EF Core lo hace), tenés que consultarla con comillas y el mismo casing.", "Revisá Database y search_path de la cadena."]);
  PG("42703", "La columna no existe", "«column \"nombree\" does not exist»: typo, mayúsculas sin comillas, o migración sin aplicar.", ["Mismo tema de comillas y minúsculas que las tablas."]);
  PG("42601", "Error de sintaxis", "«syntax error at or near»: SQL armado a mano, o sintaxis de T-SQL (TOP, [corchetes], GETDATE()) en Postgres.", ["LIMIT en vez de TOP, comillas dobles en vez de corchetes, now() en vez de GETDATE()."]);
  PG("42883", "La función no existe (o no con esos tipos)", "«function x(integer) does not exist»: nombre incorrecto o los tipos de los argumentos no coinciden; Postgres no convierte implícitamente como SQL Server.", ["Castéa los argumentos al tipo que espera la función."]);
  PG("42P07", "La tabla ya existe", "CREATE TABLE de algo existente: migración repetida o script sin IF NOT EXISTS.", ["Scripts idempotentes."]);
  PG("40P01", "Deadlock", "«deadlock detected»: dos transacciones se bloquearon mutuamente y Postgres canceló una. Detail y Where dicen qué filas y qué consulta.", ["Reintentá la transacción entera.", "Tocá las filas siempre en el mismo orden; transacciones cortas."]);
  PG("40001", "Fallo de serialización", "Con nivel SERIALIZABLE o REPEATABLE READ, Postgres canceló una transacción que no podía serializar.", ["Es esperable con esos niveles: reintentá la transacción."]);
  PG("57014", "Consulta cancelada (statement_timeout o cancelación)", "«canceling statement due to statement timeout» (statement_timeout del servidor o de la sesión) o «due to user request» (CancellationToken o Command Timeout de Npgsql, que cancela del lado del servidor).", ["Si es statement_timeout, la consulta es lenta: EXPLAIN ANALYZE.", "Npgsql convierte su Command Timeout en una cancelación: por eso aparece como 57014."]);
  PG("55P03", "El recurso está bloqueado", "«could not obtain lock on row»: NOWAIT o SKIP LOCKED sobre una fila que otro tiene tomada.", ["Reintentar o esperar."]);
  PG("53300", "Demasiadas conexiones", "«sorry, too many clients already» o «remaining connection slots are reserved»: se llegó a max_connections del servidor.", ["Revisá el pool: Maximum Pool Size × instancias de la app no puede superar max_connections.", "PgBouncer si hay muchas instancias."]);
  PG("28P01", "Contraseña incorrecta", "«password authentication failed for user»: la contraseña configurada no es la de ese usuario en ese servidor.", ["Revisá la configuración de este entorno."]);
  PG("28000", "Sin permiso para conectarse así", "pg_hba.conf no admite esa combinación de usuario, base, origen y método.", ["Es configuración del servidor: pedir que habiliten el origen (IP de la app) y el método."]);
  PG("3D000", "La base no existe", "«database \"x\" does not exist».", ["Revisá Database en la cadena; en Postgres la base es case sensitive si se creó con comillas."]);
  PG("42501", "Sin permiso sobre el objeto", "«permission denied for table x»: el usuario de la app no tiene GRANT sobre esa tabla o schema.", ["GRANT SELECT/INSERT/UPDATE/DELETE ON ... TO usuario; y USAGE sobre el schema."]);
  PG("P0001", "Un RAISE EXCEPTION del propio código SQL", "Lo tiró una función o trigger con RAISE EXCEPTION. El mensaje es el que escribió quien la hizo.", ["Buscá el texto en las funciones y triggers de la base."]);
  PG("22008", "Fecha u hora fuera de rango", "«date/time field value out of range»: día y mes invertidos para el DateStyle del servidor, o un valor imposible.", ["Pasá fechas como parámetros DateTime, no como texto."]);
  PG("22003", "Número fuera de rango", "«numeric field overflow» o «integer out of range»: el valor no entra en el tipo de la columna.", ["Agrandá el tipo (bigint, numeric con más precisión)."]);
  PG("08006", "Se cortó la conexión con Postgres", "«connection failure» / «server closed the connection unexpectedly»: reinicio del servidor, idle timeout, o el proceso backend murió.", ["Reintentá la primera operación; Npgsql descarta la conexión del pool."]);
  PG("08P01", "Violación de protocolo", "Casi siempre una versión de Npgsql incompatible con un pooler (PgBouncer en modo transaction con prepared statements) o un bug.", ["Con PgBouncer transaction mode: Max Auto Prepare=0 y No Reset On Close=true, o pooler en session mode."]);
  regla({ id: "npgsql-fecha", tipo: /^(?:ArgumentException|InvalidCastException)$/, mensaje: /Cannot write DateTime with Kind=(?:Local|Unspecified) to PostgreSQL type 'timestamp with time zone'|Cannot write DateTime with Kind=UTC to PostgreSQL type 'timestamp without time zone'/i, prioridad: 5, titulo: "Npgsql 6+: el Kind del DateTime no coincide con la columna",
    que: "Desde Npgsql 6, timestamptz exige DateTime con Kind=Utc y timestamp exige Kind=Unspecified o Local. Un DateTime.Now (Local) hacia timestamptz tira esto.",
    hacer: ["Usá DateTime.UtcNow para columnas timestamptz, o DateTime.SpecifyKind.", "Para volver al comportamiento viejo (no recomendado): AppContext.SetSwitch(\"Npgsql.EnableLegacyTimestampBehavior\", true)."],
    fuente: "https://www.npgsql.org/doc/types/datetime.html" });
  regla({ id: "npgsql-timeout", tipo: /^NpgsqlException$/, mensaje: /Exception while reading from stream|Timeout during reading attempt/i, prioridad: 5, titulo: "Timeout de comando de Npgsql (Command Timeout)",
    que: "«Exception while reading from stream ---> TimeoutException: Timeout during reading attempt» es Npgsql esperando la respuesta del servidor más que Command Timeout (30 s por defecto): la consulta es lenta, está bloqueada por otra transacción, o la red se trabó. Npgsql además intenta cancelar la consulta del lado del servidor.",
    hacer: ["pg_stat_activity mientras pasa: si wait_event_type es Lock, es un bloqueo; si no, EXPLAIN ANALYZE de esa consulta.", "Para reportes largos, Command Timeout por comando, no global.", "Si la conexión quedó rota después, el pool la descarta solo."] });
  regla({ id: "npgsql", tipo: /^NpgsqlException$/, prioridad: 4, titulo: "Npgsql no pudo hablar con el servidor",
    que: "A diferencia de PostgresException (un error que devolvió el servidor), NpgsqlException es del lado del cliente: no se pudo conectar, se cortó, timeout del pool («The connection pool has been exhausted»), o se agotó el Command Timeout.",
    hacer: ["«Failed to connect»: mirá la SocketException interna.", "«connection pool has been exhausted»: conexiones que no se devuelven (falta un using) o Maximum Pool Size chico para la carga.", "«Exception while reading from stream» con timeout: la consulta superó Command Timeout."] });
  regla({ id: "sql-pool", tipo: /^InvalidOperationException$/, mensaje: /Timeout expired\.\s+The timeout period elapsed prior to obtaining a connection from the pool/i, prioridad: 5, titulo: "El pool de conexiones se agotó",
    que: "Todas las conexiones del pool (100 por defecto) están en uso y ninguna se liberó en Connect Timeout. Casi siempre son conexiones que no se cierran (un SqlConnection o DbContext sin using), o consultas lentas acumulando conexiones bajo carga.",
    hacer: ["Buscá SqlConnection/DbContext que no se liberan: using en todos.", "sp_who2 o sys.dm_exec_sessions para ver cuántas conexiones tiene abiertas la app y en qué estado (sleeping = abiertas sin usar).", "Subir Max Pool Size solo después de descartar la fuga."] });
  regla({ id: "sql-cerrada", tipo: /^InvalidOperationException$/, mensaje: /requires an open and available Connection|ExecuteReader requires an open|ExecuteScalar requires an open|The connection is closed|ConnectionString property has not been initialized/i, prioridad: 5, titulo: "El comando se ejecutó con la conexión cerrada (o sin cadena)",
    que: "Se llamó ExecuteReader/ExecuteScalar sin cn.Open(), o la conexión se cerró antes (un using externo), o la cadena quedó vacía («ConnectionString property has not been initialized»).",
    hacer: ["Abrí la conexión antes del comando (Dapper lo hace solo).", "Si la cadena está vacía, el nombre en GetConnectionString no coincide con appsettings."] });
  regla({ id: "sql-mars", tipo: /^InvalidOperationException$/, mensaje: /There is already an open DataReader associated with this (?:Command|Connection)/i, prioridad: 5, titulo: "Dos readers abiertos sobre la misma conexión",
    que: "Se ejecutó un comando mientras un SqlDataReader seguía abierto en la misma conexión. Típico de recorrer un reader y por cada fila hacer otra consulta, o de lazy loading de EF6 dentro de un foreach.",
    hacer: ["Materializá el primer resultado (ToList) antes de la segunda consulta.", "MultipleActiveResultSets=True en la cadena lo permite, pero suele esconder un N+1."] });
  regla({ id: "sql-reader-cerrado", tipo: /^InvalidOperationException$/, mensaje: /Invalid attempt to call (?:Read|FieldCount|MetaData|GetValue) when reader is closed|Invalid attempt to read when no data is present/i, prioridad: 5, titulo: "Se leyó del reader cuando ya no había datos (o estaba cerrado)",
    que: "«no data is present» es leer una columna sin haber llamado Read() (o cuando devolvió false); «reader is closed» es usar el reader después de cerrar la conexión o salir del using.",
    hacer: ["if (reader.Read()) antes de leer columnas.", "Si devolvés datos de un método, copialos a objetos antes de salir del using."] });
  regla({ id: "sql-tx-zombie", tipo: /^InvalidOperationException$/, mensaje: /This SqlTransaction has completed; it is no longer usable|ExecuteNonQuery requires the command to have a transaction|requires the command to have a transaction when the connection assigned/i, prioridad: 5, titulo: "Transacción ya terminada, o comando sin la transacción asignada",
    que: "O se hizo Commit/Rollback dos veces (o SQL Server ya la abortó por un error con XACT_ABORT), o se creó un SqlCommand sobre una conexión con transacción activa sin asignarle cmd.Transaction.",
    hacer: ["Asigná la transacción a cada comando (new SqlCommand(sql, cn, tx)); con Dapper, pasá transaction: tx.", "Si SQL Server abortó la transacción por un error previo, el error real es el anterior en el log."] });
  regla({ id: "bulkcopy", tipo: /^InvalidOperationException$/, mensaje: /The given ColumnMapping does not match up with any column in the source or destination|The given value of type .* from the data source cannot be converted to type/i, prioridad: 5, titulo: "SqlBulkCopy: las columnas no coinciden",
    que: "Un nombre de columna del DataTable o del mapeo no existe en la tabla destino, o un valor no se pudo convertir al tipo de la columna. Sin mapeo explícito, SqlBulkCopy va por posición.",
    hacer: ["Agregá ColumnMappings por nombre para cada columna.", "«cannot be converted»: el detalle está en la interna; mirá qué columna y qué tipo."] });
  regla({ id: "regex-timeout", tipo: /^RegexMatchTimeoutException$/, prioridad: 5, titulo: "Una expresión regular tardó demasiado", que: "Backtracking catastrófico con una entrada que la hace explotar, y se venció el timeout configurado.", hacer: ["Reescribí el patrón sin cuantificadores anidados, o RegexOptions.NonBacktracking (.NET 7+)."] });
  regla({ id: "xml", tipo: /^XmlException$/, prioridad: 4, titulo: "El XML no es válido", que: "«Data at the root level is invalid. Line 1, position 1» suele ser un BOM o un texto que no es XML (un HTML de error, un JSON).", hacer: ["Mirá los primeros bytes del texto.", "Si viene de un web service: el servidor devolvió una página de error en vez del SOAP."] });
  regla({ id: "soap", tipo: /^FaultException/, prioridad: 4, titulo: "El web service SOAP devolvió un fault", que: "El servidor procesó el pedido y devolvió un error de negocio o de validación. El Reason y el Detail son del servidor.", hacer: ["Mirá el Detail del fault: es lo que el otro sistema quiere decirte."] });
  regla({ id: "comunicacion", tipo: /^(?:CommunicationException|EndpointNotFoundException|ServerTooBusyException)$/, prioridad: 4, titulo: "No se pudo hablar con el servicio WCF/SOAP", que: "EndpointNotFound: la URL no responde. CommunicationException: se cortó, certificado, o la respuesta no era SOAP (un HTML de error). ServerTooBusy: el otro lado está saturado.", hacer: ["Probá la URL con un navegador o curl desde el servidor de la app.", "Si la respuesta era HTML, el servicio está caído detrás de un proxy que devuelve una página."] });
  regla({ id: "seguridad-token", tipo: /^SecurityToken\w*Exception$/, prioridad: 5, titulo: "El token JWT no pasó la validación",
    que: "SecurityTokenExpiredException: venció. SecurityTokenInvalidSignatureException: la clave con la que se validó no es la que lo firmó (issuer equivocado, clave rotada). SecurityTokenInvalidAudienceException/IssuerException: el aud/iss del token no coincide con lo configurado. SecurityTokenSignatureKeyNotFoundException: no se encontró el kid en las claves del issuer (el discovery no se refrescó).",
    hacer: ["Decodificá el token (jwt.ms) y compará iss, aud, exp y kid con la configuración de JwtBearer.", "Si la clave rotó, el cliente tiene que refrescar el discovery; ASP.NET Core lo hace solo cada 24 h o con RefreshOnIssuerKeyNotFound."] });
  regla({ id: "mapper", tipo: /^AutoMapperMappingException$/, prioridad: 5, titulo: "AutoMapper no pudo mapear", que: "«Missing type map configuration» (falta CreateMap entre esos tipos) o «Error mapping types» con la causa real en la interna (una propiedad, un converter).", hacer: ["Agregá el CreateMap en el Profile.", "Mirá la interna para el campo exacto; AssertConfigurationIsValid en un test te lo avisa antes."] });
  regla({ id: "mediatr", tipo: /^InvalidOperationException$/, mensaje: /Handler was not found for request|No service for type 'MediatR\.IRequestHandler/i, prioridad: 5, titulo: "MediatR no encontró el handler", que: "El IRequestHandler para ese request no está registrado: falta el ensamblado en RegisterServicesFromAssembly, o el handler tiene un constructor con una dependencia que no resuelve (y el error real se esconde atrás).", hacer: ["Revisá RegisterServicesFromAssemblyContaining<T>() con un tipo del ensamblado correcto.", "Probá resolver el handler directo con GetRequiredService para ver el error de DI de fondo."] });
  regla({ id: "hangfire", tipo: /^(?:JobLoadException|JobAbortedException|BackgroundJobClientException)$/, prioridad: 5, titulo: "Hangfire no pudo cargar o encolar el job", que: "JobLoadException: el tipo o método serializado en la base ya no existe (renombraste la clase o cambió la firma). BackgroundJobClientException: no se pudo guardar el job (storage caído, argumento no serializable).", hacer: ["No renombres clases o métodos de jobs sin dejar el viejo mientras haya jobs encolados.", "Argumentos simples (Ids, no entidades)."] });
  regla({ id: "circuit", tipo: /^BrokenCircuitException$/, prioridad: 5, titulo: "El circuit breaker de Polly está abierto", que: "Hubo tantos fallos seguidos contra ese servicio que Polly dejó de intentar por un rato: esta excepción no es el error original, es la protección funcionando.", hacer: ["Mirá los errores anteriores en el log: esos son la causa.", "Devolvé una respuesta degradada o un 503 con Retry-After mientras el circuito está abierto."] });
  regla({ id: "polly-timeout", tipo: /^TimeoutRejectedException$/, prioridad: 5, titulo: "La política de timeout de Polly cortó la operación", que: "La operación superó el timeout configurado en la pipeline de resiliencia.", hacer: ["Mirá si el destino está lento; el timeout por intento debería ser menor que el total del request."] });
  regla({ id: "excel-interop", tipo: /^COMException$/, prioridad: 4, titulo: "Un componente COM falló", que: "Interop de Office, un OLE DB, o una librería COM registrada en 32 bits. El HRESULT dice qué; 0x800A03EC es Excel diciendo que algo no vale (rango, hoja, celda); 0x80040154 clase no registrada; 0x80070005 acceso denegado (DCOM).", hacer: ["Office Interop en un servidor no está soportado por Microsoft: ClosedXML, EPPlus u Open XML.", "Clase no registrada: falta instalar el componente o es de otra arquitectura."] });
  regla({ id: "excel-oledb", tipo: /^(?:OleDbException|InvalidOperationException)$/, mensaje: /Microsoft\.ACE\.OLEDB|Microsoft\.Jet\.OLEDB|provider is not registered/i, prioridad: 5, titulo: "Falta el proveedor OLE DB de Access/Excel (o es de otra arquitectura)", que: "«The 'Microsoft.ACE.OLEDB.12.0' provider is not registered on the local machine»: no está instalado el Access Database Engine, o está el de 32 bits y la app corre en 64.", hacer: ["Instalá el Access Database Engine de la misma arquitectura que la app, o leé el Excel con ClosedXML/ExcelDataReader sin OLE DB."] });
  regla({ id: "sqlnull", tipo: /^SqlNullValueException$/, prioridad: 5, titulo: "La columna vino NULL y la leíste con GetString/GetInt32",
    que: "«Data is Null. This method or property cannot be called on Null values»: un Get* tipado del SqlDataReader sobre una columna NULL.",
    hacer: ["reader.IsDBNull(i) antes, o GetFieldValue<int?>(i) / GetFieldValue<string>(i) con tipos anulables.", "Si la columna no debería admitir NULL, arreglá el dato y la definición."] });
  regla({ id: "generica", tipo: /^Exception$/, prioridad: 1, titulo: "Un throw new Exception(...) genérico",
    que: "Alguien tiró System.Exception a secas con un mensaje. No hay más información que el mensaje y la traza.",
    hacer: ["Buscá el texto del mensaje en el código.", "Para el futuro: excepciones propias (StockInsuficienteException) o al menos InvalidOperationException/ArgumentException con el dato que faltó."] });
  regla({ id: "argumento", tipo: /^ArgumentException$/, prioridad: 3, titulo: "Un argumento inválido",
    que: "Un método rechazó un parámetro por su valor (no por ser null). El mensaje y «(Parameter 'x')» dicen cuál.",
    hacer: ["Mirá quién llama al método del primer frame tuyo y con qué valor.", "Si es «An item with the same key has already been added»: Dictionary.Add con una clave repetida (o un ToDictionary sobre datos con duplicados)."] });
  regla({ id: "dict-dup", tipo: /^ArgumentException$/, mensaje: /An item with the same key has already been added|Ya se ha agregado un elemento con la misma clave/i, prioridad: 5, titulo: "Clave repetida al armar un diccionario",
    que: "Dictionary.Add o ToDictionary con dos elementos con la misma clave. Con ToDictionary sobre datos de la base, es que hay duplicados que no esperabas.",
    hacer: ["TryAdd o indexador (dict[k] = v) si pisar está bien; GroupBy si hay varios por clave legítimamente.", "Si no debería haber duplicados, revisá los datos."] });
  regla({ id: "propia", tipo: /./, prioridad: 0, titulo: "Una excepción propia o de una librería",
    que: "No está en la lista de errores típicos. El nombre del tipo y el mensaje son lo que hay; si tiene excepción interna, la causa suele estar ahí.",
    hacer: ["Buscá el nombre del tipo en tu código o en la documentación de la librería.", "Mirá el primer frame tuyo y las excepciones internas."] });

  raiz.REGLAS = R;
})(typeof module !== "undefined" ? module.exports : (window.StackTrace = window.StackTrace || {}));
