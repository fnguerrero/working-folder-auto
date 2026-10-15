/* Connection string en criollo: lógica pura. Se carga en el navegador (window.ConnStr) y en Node (module.exports).
   Parsea cadenas de conexión estilo ADO.NET (clave=valor;) y URIs (postgres://, mysql://, redis://), detecta el
   proveedor, explica cada clave con su default, avisa lo peligroso y convierte entre formatos. Nada sale del navegador. */
(function (raiz) {
  "use strict";

  // ---------- Parser estilo ADO.NET ----------
  // Reglas de DbConnectionStringBuilder: pares clave=valor separados por ';', claves sin distinguir mayúsculas,
  // valores entre comillas simples o dobles pueden tener ';', una comilla se escapa duplicándola, '==' en la
  // clave es un '=' literal, y si una clave se repite gana la última.
  function parsearPares(texto) {
    const pares = []; const errores = [];
    let i = 0; const n = texto.length;
    const saltarEspacios = () => { while (i < n && /\s/.test(texto[i])) i++; };
    while (i < n) {
      saltarEspacios();
      if (i >= n) break;
      if (texto[i] === ";") { i++; continue; }
      // Clave: hasta un '=' que no sea '=='.
      let clave = "";
      while (i < n) {
        if (texto[i] === "=") { if (texto[i + 1] === "=") { clave += "="; i += 2; continue; } break; }
        if (texto[i] === ";") break;
        clave += texto[i++];
      }
      clave = clave.trim();
      if (i >= n || texto[i] !== "=") { errores.push(`«${clave}» no tiene valor (falta el «=»).`); while (i < n && texto[i] !== ";") i++; continue; }
      i++; // '='
      saltarEspacios();
      let valor = "";
      if (i < n && (texto[i] === "'" || texto[i] === '"')) {
        const q = texto[i++];
        let cerrado = false;
        while (i < n) {
          if (texto[i] === q) { if (texto[i + 1] === q) { valor += q; i += 2; continue; } i++; cerrado = true; break; }
          valor += texto[i++];
        }
        if (!cerrado) errores.push(`El valor de «${clave}» abre una comilla ${q} y no la cierra.`);
        saltarEspacios();
        if (i < n && texto[i] !== ";") { errores.push(`Después del valor entrecomillado de «${clave}» hay texto de más.`); while (i < n && texto[i] !== ";") i++; }
      } else if (i < n && texto[i] === "{") {
        // Estilo ODBC/OLE DB: {valor con ; adentro}
        i++;
        while (i < n && texto[i] !== "}") valor += texto[i++];
        if (i < n) i++; else errores.push(`El valor de «${clave}» abre una llave { y no la cierra.`);
        while (i < n && texto[i] !== ";") i++;
      } else {
        while (i < n && texto[i] !== ";") valor += texto[i++];
        valor = valor.trim();
      }
      if (clave === "") { errores.push("Hay un valor sin clave."); continue; }
      pares.push({ clave, valor });
    }
    return { pares, errores };
  }

  // ---------- Parser de URIs ----------
  function parsearUri(texto) {
    const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(texto.trim());
    if (!m) return null;
    const esquema = m[1].toLowerCase(); let resto = m[2];
    let fragmento = null; const h = resto.indexOf("#"); if (h >= 0) { fragmento = resto.slice(h + 1); resto = resto.slice(0, h); }
    let query = ""; const q = resto.indexOf("?"); if (q >= 0) { query = resto.slice(q + 1); resto = resto.slice(0, q); }
    let ruta = ""; const s = resto.indexOf("/"); if (s >= 0) { ruta = resto.slice(s + 1); resto = resto.slice(0, s); }
    let usuario = null, clave = null;
    const at = resto.lastIndexOf("@");
    if (at >= 0) {
      const cred = resto.slice(0, at); resto = resto.slice(at + 1);
      const dp = cred.indexOf(":");
      usuario = decodificar(dp >= 0 ? cred.slice(0, dp) : cred);
      clave = dp >= 0 ? decodificar(cred.slice(dp + 1)) : null;
    }
    const hosts = resto.split(",").filter(Boolean).map((hp) => {
      const mm = /^(\[[^\]]*\]|[^:]*)(?::(\d+))?$/.exec(hp);
      return mm ? { host: mm[1].replace(/^\[|\]$/g, ""), puerto: mm[2] ? Number(mm[2]) : null } : { host: hp, puerto: null };
    });
    const parametros = [];
    for (const par of query.split("&").filter(Boolean)) {
      const e = par.indexOf("=");
      parametros.push({ clave: decodificar(e >= 0 ? par.slice(0, e) : par), valor: e >= 0 ? decodificar(par.slice(e + 1)) : "" });
    }
    return { esquema, usuario, clave, hosts, ruta: decodificar(ruta), parametros, fragmento };
  }
  function decodificar(s) { try { return decodeURIComponent(s.replace(/\+/g, "%20")); } catch (e) { return s; } }

  // ---------- Diccionario de claves por proveedor ----------
  // Cada entrada: nombre canónico, alias (en minúsculas, sin espacios), categoría, default, qué es.
  const norm = (k) => k.toLowerCase().replace(/[\s_-]+/g, "");
  function diccionario(entradas) {
    const porAlias = new Map();
    for (const e of entradas) { porAlias.set(norm(e.nombre), e); for (const a of e.alias || []) porAlias.set(norm(a), e); }
    return { entradas, buscar: (clave) => porAlias.get(norm(clave)) || null };
  }

  const SQLSERVER = diccionario([
    { nombre: "Data Source", alias: ["Server", "Address", "Addr", "Network Address"], cat: "donde", def: "", que: "El servidor. `host`, `host,puerto`, `host\\instancia` o `tcp:host,1433`. Una instancia con nombre sin puerto necesita el SQL Browser (UDP 1434) del otro lado; con el puerto explícito no." },
    { nombre: "Initial Catalog", alias: ["Database"], cat: "donde", def: "(la base por defecto del login, suele ser master)", que: "La base a la que te conectás. Sin esto caés en la base por defecto del login." },
    { nombre: "User ID", alias: ["UID", "User"], cat: "quien", def: "", que: "Usuario de SQL Server (autenticación SQL)." },
    { nombre: "Password", alias: ["PWD"], cat: "quien", def: "", que: "La contraseña. No va en el código ni en el repo: user-secrets en dev, variables de entorno o un vault en prod." },
    { nombre: "Integrated Security", alias: ["Trusted_Connection"], cat: "quien", def: "false", que: "Autenticación de Windows (`true` o `SSPI`): usa la cuenta que corre el proceso. En Linux hace falta Kerberos configurado." },
    { nombre: "Authentication", cat: "quien", def: "(ninguna)", que: "Entra ID / Azure AD: `Active Directory Default`, `Active Directory Managed Identity`, `Active Directory Password`, `Active Directory Interactive`, `Active Directory Service Principal`…" },
    { nombre: "Encrypt", cat: "seguridad", def: "true (desde Microsoft.Data.SqlClient 4.0; antes false)", que: "Cifra el tráfico con TLS. Acepta `true`/`false` y desde 5.0 `Optional`, `Mandatory` y `Strict` (TDS 8). El cambio de default en 4.0 es el origen del famoso «The certificate chain was issued by an authority that is not trusted»." },
    { nombre: "Trust Server Certificate", alias: ["TrustServerCertificate"], cat: "seguridad", def: "false", que: "Acepta el certificado del servidor sin validarlo. Sirve en dev con certificado autofirmado; en prod deja la puerta abierta a un intermediario." },
    { nombre: "Host Name In Certificate", alias: ["HostNameInCertificate"], cat: "seguridad", def: "", que: "Nombre que tiene que figurar en el certificado si no coincide con el del servidor (proxies, alias)." },
    { nombre: "Persist Security Info", cat: "seguridad", def: "false", que: "Si es `true`, la contraseña queda legible en `SqlConnection.ConnectionString` después de conectar. Dejalo en false." },
    { nombre: "Column Encryption Setting", cat: "seguridad", def: "Disabled", que: "Always Encrypted: `Enabled` descifra las columnas del lado del cliente." },
    { nombre: "Connect Timeout", alias: ["Connection Timeout", "Timeout"], cat: "tiempos", def: "15", que: "Segundos para **establecer** la conexión. No tiene nada que ver con cuánto puede tardar una consulta." },
    { nombre: "Command Timeout", cat: "tiempos", def: "30", que: "Segundos que puede tardar un comando antes de cancelarse (es el default de `SqlCommand.CommandTimeout`). Existe en Microsoft.Data.SqlClient; en el viejo System.Data.SqlClient no." },
    { nombre: "Connect Retry Count", alias: ["ConnectRetryCount"], cat: "tiempos", def: "1", que: "Reintentos de reconexión si se cae una conexión ociosa (resiliencia de conexión). 0 la apaga." },
    { nombre: "Connect Retry Interval", alias: ["ConnectRetryInterval"], cat: "tiempos", def: "10", que: "Segundos entre esos reintentos." },
    { nombre: "Pooling", cat: "pool", def: "true", que: "Reusa conexiones. Apagarlo hace que cada `Open()` sea una conexión TCP + login nuevos: lento y caro." },
    { nombre: "Max Pool Size", cat: "pool", def: "100", que: "Tope de conexiones del pool para esta cadena exacta, por proceso. Si se llena, `Open()` espera hasta `Connect Timeout` y tira «Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool»." },
    { nombre: "Min Pool Size", cat: "pool", def: "0", que: "Conexiones que el pool mantiene abiertas aunque no se usen." },
    { nombre: "Load Balance Timeout", alias: ["Connection Lifetime"], cat: "pool", def: "0", que: "Segundos de vida de una conexión antes de que el pool la descarte al devolverla. Sirve para repartir carga tras agregar nodos; 0 = sin límite." },
    { nombre: "Pool Blocking Period", cat: "pool", def: "Auto", que: "Si tras un error de conexión el pool bloquea nuevos intentos un rato (`AlwaysBlock`, `NeverBlock`, `Auto`: nunca para Azure SQL)." },
    { nombre: "MultipleActiveResultSets", alias: ["MARS"], cat: "comportamiento", def: "false", que: "Varias consultas abiertas a la vez sobre la misma conexión. Lo necesita EF Core si enumerás un resultado mientras ejecutás otra consulta; tiene costo y esconde código que debería materializar antes." },
    { nombre: "Application Name", alias: ["App"], cat: "comportamiento", def: "Core Microsoft SqlClient Data Provider", que: "Cómo se ve tu app en `sys.dm_exec_sessions` y en el Profiler. Poné el nombre del servicio: te ahorrás horas cuando algo bloquea." },
    { nombre: "Workstation ID", alias: ["WSID"], cat: "comportamiento", def: "(nombre de la máquina)", que: "El `host_name` que ve el servidor." },
    { nombre: "ApplicationIntent", alias: ["Application Intent"], cat: "comportamiento", def: "ReadWrite", que: "`ReadOnly` te manda a la réplica secundaria de un Availability Group (hay que configurar el enrutamiento del lado del servidor)." },
    { nombre: "Multi Subnet Failover", alias: ["MultiSubnetFailover"], cat: "comportamiento", def: "false", que: "Con un listener de AG en varias subredes, intenta todas las IP a la vez para no esperar un timeout por cada una." },
    { nombre: "Failover Partner", cat: "comportamiento", def: "", que: "Servidor espejo del viejo database mirroring. Hoy se usa un listener de AG." },
    { nombre: "Packet Size", cat: "comportamiento", def: "8000", que: "Bytes por paquete TDS (512 a 32767). Casi nunca hay que tocarlo." },
    { nombre: "Enlist", cat: "comportamiento", def: "true", que: "Si la conexión se suma sola a un `TransactionScope` ambiente." },
    { nombre: "Transaction Binding", cat: "comportamiento", def: "Implicit Unbind", que: "Cómo se desata la conexión de una transacción de `System.Transactions`." },
    { nombre: "Current Language", alias: ["Language"], cat: "comportamiento", def: "", que: "Idioma de los mensajes y formato de fechas en el servidor (`@@LANGUAGE`)." },
    { nombre: "Replication", cat: "comportamiento", def: "false", que: "Solo para conexiones de replicación de SQL Server." },
    { nombre: "Type System Version", cat: "comportamiento", def: "Latest", que: "Compatibilidad de tipos con versiones viejas del servidor." },
    { nombre: "User Instance", cat: "comportamiento", def: "false", que: "Instancia de usuario de SQL Server Express (obsoleto, usá LocalDB)." },
    { nombre: "AttachDbFilename", alias: ["Extended Properties", "Initial File Name"], cat: "donde", def: "", que: "Adjunta un `.mdf` al conectarse (LocalDB / Express)." },
    { nombre: "IP Address Preference", alias: ["IPAddressPreference"], cat: "comportamiento", def: "IPv4First", que: "`IPv4First`, `IPv6First` o `UsePlatformDefault` al resolver el nombre." },
    { nombre: "Server SPN", alias: ["ServerSPN"], cat: "quien", def: "", que: "SPN explícito para Kerberos cuando el automático no coincide." },
    { nombre: "Transparent Network IP Resolution", alias: ["TransparentNetworkIPResolution"], cat: "comportamiento", def: "true (false si MultiSubnetFailover=true)", que: "Si el nombre resuelve a varias IP, prueba la primera y después el resto en paralelo." },
  ]);

  const POSTGRES = diccionario([
    { nombre: "Host", alias: ["Server"], cat: "donde", def: "", que: "El servidor. Puede ser una lista `host1,host2` (Npgsql 6+) para failover o balanceo, o una ruta a un socket Unix." },
    { nombre: "Port", cat: "donde", def: "5432", que: "Puerto TCP." },
    { nombre: "Database", alias: ["DB"], cat: "donde", def: "(igual al usuario)", que: "La base. Si falta, Postgres intenta una con el mismo nombre que el usuario, y suele no existir." },
    { nombre: "Username", alias: ["User ID", "User", "UID"], cat: "quien", def: "", que: "El rol de Postgres." },
    { nombre: "Password", alias: ["PSW", "PWD"], cat: "quien", def: "", que: "La contraseña. No va en el repo: user-secrets, variables de entorno o un vault. También puede venir de `Passfile` (`~/.pgpass`)." },
    { nombre: "Passfile", cat: "quien", def: "", que: "Ruta a un archivo `.pgpass` de donde sacar la contraseña." },
    { nombre: "Integrated Security", cat: "quien", def: "false", que: "Kerberos/GSSAPI o SSPI en Windows." },
    { nombre: "Kerberos Service Name", cat: "quien", def: "postgres", que: "Nombre del servicio Kerberos." },
    { nombre: "SSL Mode", alias: ["SslMode"], cat: "seguridad", def: "Prefer (desde Npgsql 6.0; antes Disable)", que: "`Disable`, `Allow`, `Prefer` (cifra si el servidor puede, sin validar), `Require` (cifra, sin validar el certificado salvo que apagues Trust Server Certificate), `VerifyCA`, `VerifyFull` (valida cadena y nombre: el único que te protege de un intermediario)." },
    { nombre: "Trust Server Certificate", cat: "seguridad", def: "false", que: "Acepta cualquier certificado. En dev vale; en prod, no." },
    { nombre: "Root Certificate", cat: "seguridad", def: "", que: "CA con la que validar el certificado del servidor (`VerifyCA` / `VerifyFull`)." },
    { nombre: "SSL Certificate", cat: "seguridad", def: "", que: "Certificado de cliente para autenticación mutua." },
    { nombre: "SSL Key", cat: "seguridad", def: "", que: "Clave privada del certificado de cliente." },
    { nombre: "SSL Password", cat: "seguridad", def: "", que: "Contraseña de esa clave." },
    { nombre: "Check Certificate Revocation", cat: "seguridad", def: "false", que: "Consulta la revocación del certificado." },
    { nombre: "Channel Binding", cat: "seguridad", def: "Prefer", que: "Channel binding para SCRAM sobre TLS." },
    { nombre: "Persist Security Info", cat: "seguridad", def: "false", que: "Si la contraseña queda legible en `ConnectionString` después de abrir." },
    { nombre: "Include Error Detail", cat: "seguridad", def: "false", que: "Mete valores de parámetros y detalles en los mensajes de error. Útil en dev; en prod termina con datos en los logs." },
    { nombre: "Log Parameters", cat: "seguridad", def: "false", que: "Loguea los parámetros de cada comando. Lo mismo: dev sí, prod no." },
    { nombre: "Timeout", cat: "tiempos", def: "15", que: "Segundos para **establecer** la conexión (y para conseguir una del pool si está lleno)." },
    { nombre: "Command Timeout", cat: "tiempos", def: "30", que: "Segundos que puede tardar un comando. 0 = sin límite (no lo hagas en una API)." },
    { nombre: "Internal Command Timeout", cat: "tiempos", def: "-1", que: "Timeout de los comandos internos de Npgsql. No lo toques." },
    { nombre: "Cancellation Timeout", cat: "tiempos", def: "2000", que: "Milisegundos que espera la cancelación de un comando antes de cerrar la conexión." },
    { nombre: "Keepalive", cat: "tiempos", def: "0", que: "Segundos entre keepalives de Npgsql para que un firewall no mate conexiones ociosas." },
    { nombre: "Tcp Keepalive", cat: "tiempos", def: "false", que: "Keepalive a nivel TCP." },
    { nombre: "Tcp Keepalive Time", cat: "tiempos", def: "0", que: "Segundos de inactividad antes del primer keepalive TCP." },
    { nombre: "Tcp Keepalive Interval", cat: "tiempos", def: "0", que: "Segundos entre keepalives TCP." },
    { nombre: "Pooling", cat: "pool", def: "true", que: "Reusa conexiones. Apagarlo = conexión TCP + autenticación nuevas en cada `Open()`." },
    { nombre: "Minimum Pool Size", cat: "pool", def: "0", que: "Conexiones que el pool mantiene aunque estén ociosas." },
    { nombre: "Maximum Pool Size", cat: "pool", def: "100", que: "Tope de conexiones del pool por cadena y por proceso. Multiplicá por instancias de tu app y compará con `max_connections` del servidor (100 por defecto)." },
    { nombre: "Connection Idle Lifetime", cat: "pool", def: "300", que: "Segundos que una conexión ociosa vive en el pool antes de cerrarse." },
    { nombre: "Connection Pruning Interval", cat: "pool", def: "10", que: "Cada cuántos segundos el pool revisa las ociosas." },
    { nombre: "Connection Lifetime", cat: "pool", def: "0", que: "Segundos de vida total de una conexión antes de que el pool la descarte. 0 = sin límite." },
    { nombre: "No Reset On Close", cat: "pool", def: "false", que: "No hace `DISCARD ALL` al devolver la conexión al pool. Más rápido, pero el estado de sesión se filtra entre usos." },
    { nombre: "Multiplexing", cat: "pool", def: "false", que: "Varios comandos de distintas conexiones lógicas por la misma conexión física. Experimental, para cargas muy altas." },
    { nombre: "Max Auto Prepare", cat: "comportamiento", def: "0", que: "Cuántas sentencias distintas prepara automáticamente (prepared statements sin que vos lo pidas). 0 = apagado." },
    { nombre: "Auto Prepare Min Usages", cat: "comportamiento", def: "5", que: "Cuántas veces tiene que ejecutarse una sentencia antes de prepararse sola." },
    { nombre: "Application Name", cat: "comportamiento", def: "", que: "Cómo te ve `pg_stat_activity`. Poné el nombre del servicio." },
    { nombre: "Search Path", cat: "comportamiento", def: "", que: "Esquemas donde buscar tablas sin prefijo (`search_path`)." },
    { nombre: "Client Encoding", cat: "comportamiento", def: "", que: "`client_encoding` de la sesión." },
    { nombre: "Encoding", cat: "comportamiento", def: "UTF8", que: "Codificación .NET para textos." },
    { nombre: "Timezone", cat: "comportamiento", def: "", que: "Zona horaria de la sesión (`TimeZone`)." },
    { nombre: "Options", cat: "comportamiento", def: "", que: "Opciones de línea de comandos para el backend (`-c nombre=valor`)." },
    { nombre: "Target Session Attributes", cat: "comportamiento", def: "any", que: "Con varios hosts: `primary`, `standby`, `prefer-standby`, `read-write`, `read-only`, `any`." },
    { nombre: "Load Balance Hosts", cat: "comportamiento", def: "false", que: "Con varios hosts, rota entre ellos." },
    { nombre: "Host Recheck Seconds", cat: "comportamiento", def: "10", que: "Cada cuánto vuelve a probar un host que estaba caído." },
    { nombre: "Enlist", cat: "comportamiento", def: "true", que: "Si la conexión se suma a un `TransactionScope` ambiente." },
    { nombre: "Server Compatibility Mode", cat: "comportamiento", def: "None", que: "`Redshift` o `NoTypeLoading` para servidores que no son Postgres de verdad." },
    { nombre: "Array Nullability Mode", cat: "comportamiento", def: "Never", que: "Cómo mapea arrays con nulos." },
    { nombre: "Read Buffer Size", cat: "comportamiento", def: "8192", que: "Buffer de lectura en bytes." },
    { nombre: "Write Buffer Size", cat: "comportamiento", def: "8192", que: "Buffer de escritura en bytes." },
  ]);

  const MYSQL = diccionario([
    { nombre: "Server", alias: ["Host", "Data Source", "DataSource", "Address", "Addr", "Network Address"], cat: "donde", def: "", que: "El servidor (o lista `h1,h2` con Load Balance)." },
    { nombre: "Port", cat: "donde", def: "3306", que: "Puerto TCP." },
    { nombre: "Database", alias: ["Initial Catalog"], cat: "donde", def: "", que: "La base." },
    { nombre: "User ID", alias: ["UserID", "Username", "Uid", "User name", "User"], cat: "quien", def: "", que: "Usuario." },
    { nombre: "Password", alias: ["pwd"], cat: "quien", def: "", que: "La contraseña. No va en el repo." },
    { nombre: "SSL Mode", alias: ["SslMode"], cat: "seguridad", def: "Preferred", que: "`None`, `Preferred` (cifra si se puede, sin validar), `Required` (cifra, sin validar), `VerifyCA`, `VerifyFull` (el único que valida el nombre)." },
    { nombre: "Allow Public Key Retrieval", alias: ["AllowPublicKeyRetrieval"], cat: "seguridad", def: "false", que: "Con `caching_sha2_password` y sin TLS, pide la clave pública al servidor en claro: un intermediario puede hacerse pasar por él. Usá TLS en vez de esto." },
    { nombre: "Certificate File", cat: "seguridad", def: "", que: "Certificado de cliente (.pfx)." },
    { nombre: "SSL CA", alias: ["CACertificateFile", "SslCa"], cat: "seguridad", def: "", que: "CA con la que validar el servidor." },
    { nombre: "SSL Cert", alias: ["SslCert"], cat: "seguridad", def: "", que: "Certificado de cliente (.pem)." },
    { nombre: "SSL Key", alias: ["SslKey"], cat: "seguridad", def: "", que: "Clave privada del certificado de cliente." },
    { nombre: "TLS Version", alias: ["TlsVersion"], cat: "seguridad", def: "", que: "Versiones de TLS permitidas." },
    { nombre: "Persist Security Info", cat: "seguridad", def: "false", que: "Si la contraseña queda legible después de abrir." },
    { nombre: "Allow Load Local Infile", alias: ["AllowLoadLocalInfile"], cat: "seguridad", def: "false", que: "Permite `LOAD DATA LOCAL INFILE`: el servidor puede pedirle archivos al cliente. Peligroso contra un servidor que no controlás." },
    { nombre: "Connection Timeout", alias: ["ConnectTimeout", "Connect Timeout"], cat: "tiempos", def: "15", que: "Segundos para establecer la conexión." },
    { nombre: "Default Command Timeout", alias: ["DefaultCommandTimeout", "Command Timeout"], cat: "tiempos", def: "30", que: "Segundos que puede tardar un comando. 0 = sin límite." },
    { nombre: "Connection Idle Timeout", alias: ["ConnectionIdleTimeout"], cat: "pool", def: "180", que: "Segundos que una conexión ociosa vive en el pool." },
    { nombre: "Keep Alive", alias: ["KeepAlive"], cat: "tiempos", def: "0", que: "Segundos entre keepalives TCP." },
    { nombre: "Pooling", cat: "pool", def: "true", que: "Reusa conexiones." },
    { nombre: "Minimum Pool Size", alias: ["MinPoolSize", "MinimumPoolSize"], cat: "pool", def: "0", que: "Conexiones mínimas en el pool." },
    { nombre: "Maximum Pool Size", alias: ["MaxPoolSize", "MaximumPoolSize"], cat: "pool", def: "100", que: "Tope de conexiones del pool por proceso. Compará con `max_connections` del servidor (151 por defecto)." },
    { nombre: "Connection Lifetime", alias: ["ConnectionLifeTime"], cat: "pool", def: "0", que: "Vida máxima de una conexión en segundos." },
    { nombre: "Connection Reset", alias: ["ConnectionReset"], cat: "pool", def: "true", que: "Resetea la sesión al devolver la conexión al pool." },
    { nombre: "Allow User Variables", alias: ["AllowUserVariables"], cat: "comportamiento", def: "false", que: "Permite `@variables` de usuario en las consultas (si no, `@x` se interpreta como parámetro)." },
    { nombre: "Allow Zero DateTime", alias: ["AllowZeroDateTime"], cat: "comportamiento", def: "false", que: "Devuelve `MySqlDateTime` en vez de `DateTime` para poder representar `0000-00-00`." },
    { nombre: "Convert Zero DateTime", alias: ["ConvertZeroDateTime"], cat: "comportamiento", def: "false", que: "Convierte `0000-00-00` a `DateTime.MinValue` en vez de tirar excepción." },
    { nombre: "Character Set", alias: ["CharSet", "CharacterSet"], cat: "comportamiento", def: "utf8mb4", que: "Juego de caracteres de la conexión." },
    { nombre: "Application Name", alias: ["ApplicationName"], cat: "comportamiento", def: "", que: "Cómo te ve `performance_schema.session_connect_attrs`." },
    { nombre: "Use Affected Rows", alias: ["UseAffectedRows"], cat: "comportamiento", def: "false", que: "Si `ExecuteNonQuery` devuelve filas afectadas (true) o filas que matchearon (false)." },
    { nombre: "Treat Tiny As Boolean", alias: ["TreatTinyAsBoolean"], cat: "comportamiento", def: "true", que: "`TINYINT(1)` como `bool`." },
    { nombre: "Guid Format", alias: ["GuidFormat"], cat: "comportamiento", def: "Default", que: "Cómo se guardan los GUID (`Char36`, `Binary16`, …)." },
    { nombre: "Old Guids", alias: ["OldGuids"], cat: "comportamiento", def: "false", que: "GUID como `BINARY(16)` al estilo viejo del conector de Oracle." },
    { nombre: "Use Compression", alias: ["UseCompression", "Compress"], cat: "comportamiento", def: "false", que: "Comprime el protocolo." },
    { nombre: "Use XA Transactions", alias: ["UseXaTransactions"], cat: "comportamiento", def: "true", que: "Transacciones distribuidas con XA." },
    { nombre: "Load Balance", alias: ["LoadBalance"], cat: "comportamiento", def: "RoundRobin", que: "Con varios hosts: `RoundRobin`, `FailOver`, `Random`, `LeastConnections`." },
    { nombre: "Server Redirection Mode", alias: ["ServerRedirectionMode"], cat: "comportamiento", def: "Disabled", que: "Sigue redirecciones de Azure Database for MySQL." },
    { nombre: "Pipelining", cat: "comportamiento", def: "true", que: "Manda varios paquetes sin esperar respuesta." },
    { nombre: "Auto Enlist", alias: ["AutoEnlist"], cat: "comportamiento", def: "true", que: "Se suma a `TransactionScope`." },
    { nombre: "Interactive Session", alias: ["InteractiveSession"], cat: "comportamiento", def: "false", que: "Usa `interactive_timeout` en vez de `wait_timeout`." },
    { nombre: "Ignore Prepare", alias: ["IgnorePrepare"], cat: "comportamiento", def: "false", que: "Ignora `Prepare()`." },
    { nombre: "No Backslash Escapes", alias: ["NoBackslashEscapes"], cat: "comportamiento", def: "false", que: "Para servidores con `NO_BACKSLASH_ESCAPES`." },
    { nombre: "Connection Protocol", alias: ["ConnectionProtocol", "Protocol"], cat: "donde", def: "Socket", que: "`Socket` (TCP), `Unix`, `Pipe`, `SharedMemory`." },
  ]);

  const REDIS = diccionario([
    { nombre: "(endpoints)", cat: "donde", def: "", que: "Los `host:puerto` separados por coma. Puerto 6379 por defecto (6380 suele ser el de TLS en Azure)." },
    { nombre: "password", cat: "quien", def: "", que: "La contraseña (AUTH). No va en el repo." },
    { nombre: "user", cat: "quien", def: "", que: "Usuario de las ACL de Redis 6+." },
    { nombre: "ssl", cat: "seguridad", def: "false", que: "Cifra con TLS. Afuera de tu red, siempre." },
    { nombre: "sslHost", cat: "seguridad", def: "", que: "Nombre esperado en el certificado si no coincide con el endpoint." },
    { nombre: "sslProtocols", cat: "seguridad", def: "", que: "Versiones de TLS permitidas." },
    { nombre: "checkCertificateRevocation", cat: "seguridad", def: "true", que: "Consulta la revocación del certificado." },
    { nombre: "allowAdmin", cat: "seguridad", def: "false", que: "Habilita comandos peligrosos (`FLUSHALL`, `CONFIG`, `SHUTDOWN`) desde la app. Casi nunca lo querés en producción." },
    { nombre: "abortConnect", cat: "comportamiento", def: "true", que: "Si no puede conectar al arrancar, tira excepción (true) o sigue intentando en segundo plano (false). Azure recomienda `false`." },
    { nombre: "connectTimeout", cat: "tiempos", def: "5000", que: "Milisegundos para establecer la conexión." },
    { nombre: "syncTimeout", cat: "tiempos", def: "5000", que: "Milisegundos que espera una operación sincrónica." },
    { nombre: "asyncTimeout", cat: "tiempos", def: "(= syncTimeout)", que: "Milisegundos que espera una operación asincrónica." },
    { nombre: "connectRetry", cat: "tiempos", def: "3", que: "Reintentos al conectar." },
    { nombre: "keepAlive", cat: "tiempos", def: "-1 (60 s)", que: "Segundos entre pings para mantener viva la conexión." },
    { nombre: "configCheckSeconds", cat: "tiempos", def: "60", que: "Cada cuánto revisa la configuración del cluster/sentinel." },
    { nombre: "responseTimeout", cat: "tiempos", def: "(= syncTimeout)", que: "Obsoleto; antes era el timeout para considerar muerta una conexión." },
    { nombre: "defaultDatabase", cat: "comportamiento", def: "0", que: "Base lógica (0 a 15) por defecto." },
    { nombre: "name", cat: "comportamiento", def: "", que: "Nombre del cliente (`CLIENT SETNAME`): se ve en `CLIENT LIST`." },
    { nombre: "channelPrefix", cat: "comportamiento", def: "", que: "Prefijo para todos los canales pub/sub." },
    { nombre: "proxy", cat: "comportamiento", def: "None", que: "`Twemproxy` o `Envoyproxy` si hay un proxy en el medio." },
    { nombre: "serviceName", cat: "comportamiento", def: "", que: "Nombre del servicio en Sentinel." },
    { nombre: "resolveDns", cat: "comportamiento", def: "false", que: "Resuelve DNS al conectar en vez de dejarlo al socket." },
    { nombre: "tiebreaker", cat: "comportamiento", def: "__Booksleeve_TieBreak", que: "Clave para desempatar masters." },
    { nombre: "version", cat: "comportamiento", def: "", que: "Versión de Redis asumida si no puede preguntarla." },
    { nombre: "protocol", cat: "comportamiento", def: "resp2", que: "`resp2` o `resp3`." },
    { nombre: "configChannel", cat: "comportamiento", def: "__Booksleeve_MasterChanged", que: "Canal de avisos de cambio de configuración." },
  ]);

  const PROVEEDORES = {
    sqlserver: { nombre: "SQL Server (Microsoft.Data.SqlClient)", dic: SQLSERVER },
    postgres: { nombre: "PostgreSQL (Npgsql)", dic: POSTGRES },
    mysql: { nombre: "MySQL / MariaDB (MySqlConnector)", dic: MYSQL },
    redis: { nombre: "Redis (StackExchange.Redis)", dic: REDIS },
  };
  const CATEGORIAS = { donde: "Dónde", quien: "Quién", seguridad: "Seguridad", tiempos: "Tiempos", pool: "Pool de conexiones", comportamiento: "Comportamiento" };

  // ---------- Detección del proveedor ----------
  // Puntaje por proveedor: cuántas claves conoce su diccionario (+2 si la clave es exclusiva de él), más pistas
  // por valores (puerto, barra de instancia, valores típicos de SSL Mode). Redis se reconoce por su formato.
  function detectar(texto) {
    const t = texto.trim();
    const uri = parsearUri(t);
    if (uri) {
      if (/^postgres(ql)?$/.test(uri.esquema)) return "postgres";
      if (/^mysql|^mariadb/.test(uri.esquema)) return "mysql";
      if (/^rediss?$/.test(uri.esquema)) return "redis";
      if (/^(mssql|sqlserver)$/.test(uri.esquema)) return "sqlserver";
      return null;
    }
    const { pares } = parsearPares(t);
    const claves = new Set(pares.map((p) => norm(p.clave)));
    const tiene = (...ks) => ks.some((k) => claves.has(norm(k)));
    const valor = (k) => (pares.find((p) => norm(p.clave) === norm(k)) || {}).valor || "";
    // Redis: trozos host:puerto sin '=' separados por coma, o claves típicas sin servidor.
    if (tiene("abortConnect", "syncTimeout", "allowAdmin", "defaultDatabase") && !tiene("Server", "Host", "Data Source")) return "redis";
    const trozos = t.split(",").map((x) => x.trim()).filter(Boolean);
    if (!t.includes(";") && trozos.length && trozos.every((x) => /^[\w.\-]+(:\d+)?$/.test(x) || /^\w+=/.test(x)) && trozos.some((x) => !x.includes("="))) return "redis";
    if (pares.length === 0) return null;
    const ids = ["sqlserver", "postgres", "mysql"];
    const puntos = { sqlserver: 0, postgres: 0, mysql: 0 };
    for (const p of pares) {
      const conocen = ids.filter((id) => PROVEEDORES[id].dic.buscar(p.clave));
      for (const id of conocen) puntos[id] += conocen.length === 1 ? 3 : 1;
    }
    const servidor = valor("Server") || valor("Data Source") || valor("Host") || valor("Address");
    if (/\\/.test(servidor) || /,\s*\d+$/.test(servidor) || /^tcp:/i.test(servidor) || /\(localdb\)/i.test(servidor)) puntos.sqlserver += 3;
    const puerto = valor("Port");
    if (puerto === "5432") puntos.postgres += 3; if (puerto === "3306") puntos.mysql += 3; if (puerto === "1433") puntos.sqlserver += 3;
    const ssl = (valor("SSL Mode") || valor("SslMode")).toLowerCase();
    if (/^(none|preferred|required)$/.test(ssl)) puntos.mysql += 2;
    if (/^(disable|allow|prefer|require|verify-?ca|verify-?full)$/.test(ssl)) puntos.postgres += 2;
    if (tiene("Uid")) puntos.mysql += 1; if (tiene("Pwd")) puntos.mysql += 1;
    if (tiene("Username")) puntos.postgres += 1;
    let mejor = null, max = 0;
    for (const id of ids) if (puntos[id] > max) { max = puntos[id]; mejor = id; }
    return mejor;
  }

  // ---------- Normalización a una lista de claves ----------
  // Devuelve { proveedor, claves: [{clave, valor, def (entrada del diccionario o null)}], errores, uri }
  function analizar(texto, proveedorForzado) {
    const t = texto.trim();
    if (!t) return { proveedor: null, claves: [], errores: [], uri: null };
    const proveedor = proveedorForzado || detectar(t);
    const uri = parsearUri(t);
    let pares, errores = [];
    if (uri) {
      pares = [];
      if (proveedor === "redis") {
        pares.push({ clave: "(endpoints)", valor: uri.hosts.map((h) => h.host + (h.puerto ? ":" + h.puerto : "")).join(",") });
        if (uri.esquema === "rediss") pares.push({ clave: "ssl", valor: "true" });
        if (uri.usuario) pares.push({ clave: "user", valor: uri.usuario });
        if (uri.clave !== null) pares.push({ clave: "password", valor: uri.clave });
        if (uri.ruta) pares.push({ clave: "defaultDatabase", valor: uri.ruta });
        for (const p of uri.parametros) pares.push(p);
      } else {
        const nombreHost = proveedor === "mysql" ? "Server" : proveedor === "sqlserver" ? "Data Source" : "Host";
        if (uri.hosts.length) pares.push({ clave: nombreHost, valor: uri.hosts.map((h) => h.host).join(",") });
        const puertos = uri.hosts.map((h) => h.puerto).filter((p) => p !== null);
        if (puertos.length) pares.push({ clave: "Port", valor: String(puertos[0]) });
        if (uri.usuario) pares.push({ clave: proveedor === "postgres" ? "Username" : "User ID", valor: uri.usuario });
        if (uri.clave !== null) pares.push({ clave: "Password", valor: uri.clave });
        if (uri.ruta) pares.push({ clave: "Database", valor: uri.ruta });
        for (const p of uri.parametros) pares.push({ clave: LIBPQ_A_NPGSQL[p.clave] || p.clave, valor: p.valor });
      }
    } else if (proveedor === "redis") {
      pares = [];
      const endpoints = [];
      for (const trozo of t.split(",").map((s) => s.trim()).filter(Boolean)) {
        const e = trozo.indexOf("=");
        if (e < 0) endpoints.push(trozo);
        else pares.push({ clave: trozo.slice(0, e).trim(), valor: trozo.slice(e + 1).trim() });
      }
      if (endpoints.length) pares.unshift({ clave: "(endpoints)", valor: endpoints.join(",") });
    } else {
      ({ pares, errores } = parsearPares(t));
    }
    // Si una clave se repite gana la última (así hace DbConnectionStringBuilder).
    const dic = proveedor ? PROVEEDORES[proveedor].dic : null;
    const vistos = new Map(); const repetidas = [];
    for (const p of pares) {
      const e = dic ? dic.buscar(p.clave) : null;
      const id = e ? e.nombre : norm(p.clave);
      if (vistos.has(id)) repetidas.push(p.clave);
      vistos.set(id, { clave: p.clave, valor: p.valor, def: e });
    }
    const claves = [...vistos.values()];
    for (const r of repetidas) errores.push(`«${r}» aparece más de una vez: vale la última.`);
    return { proveedor, claves, errores, uri };
  }

  const LIBPQ_A_NPGSQL = { sslmode: "SSL Mode", application_name: "Application Name", connect_timeout: "Timeout", options: "Options", target_session_attrs: "Target Session Attributes", passfile: "Passfile", sslrootcert: "Root Certificate", sslcert: "SSL Certificate", sslkey: "SSL Key", client_encoding: "Client Encoding", keepalives_idle: "Tcp Keepalive Time", keepalives_interval: "Tcp Keepalive Interval", user: "Username", password: "Password", host: "Host", port: "Port", dbname: "Database", search_path: "Search Path" };
  const NPGSQL_A_LIBPQ = { "SSL Mode": "sslmode", "Application Name": "application_name", "Timeout": "connect_timeout", "Options": "options", "Target Session Attributes": "target_session_attrs", "Passfile": "passfile", "Root Certificate": "sslrootcert", "SSL Certificate": "sslcert", "SSL Key": "sslkey", "Client Encoding": "client_encoding", "Tcp Keepalive Time": "keepalives_idle", "Tcp Keepalive Interval": "keepalives_interval", "Search Path": "search_path" };

  // ---------- Avisos ----------
  const esVerdadero = (v) => /^(true|yes|sspi|1|on)$/i.test(String(v).trim());
  const esFalso = (v) => /^(false|no|0|off)$/i.test(String(v).trim());
  function valorDe(a, nombre) { const c = a.claves.find((k) => k.def && k.def.nombre === nombre); return c ? c.valor : undefined; }
  function tieneClave(a, nombre) { return a.claves.some((k) => k.def && k.def.nombre === nombre); }

  function avisar(a) {
    const avisos = [];
    const peligro = (t, d) => avisos.push({ nivel: "peligro", titulo: t, detalle: d });
    const ojo = (t, d) => avisos.push({ nivel: "ojo", titulo: t, detalle: d });
    const dato = (t, d) => avisos.push({ nivel: "dato", titulo: t, detalle: d });
    if (!a.proveedor) return avisos;
    const p = a.proveedor, v = (n) => valorDe(a, n);
    const desconocidas = a.claves.filter((k) => !k.def);
    for (const k of desconocidas) ojo(`«${k.clave}» no es una clave que conozca para ${PROVEEDORES[p].nombre}`, p === "redis" ? "StackExchange.Redis ignora lo que no conoce." : "El proveedor va a tirar `ArgumentException: Keyword not supported` al abrir. Revisá si es de otro proveedor o si está mal escrita.");
    const pass = v("Password") ?? v("password");
    if (pass !== undefined && pass !== "") {
      dato("La contraseña viaja en la cadena", "En dev: `dotnet user-secrets set \"ConnectionStrings:Default\" \"...\"`. En prod: variable de entorno `ConnectionStrings__Default`, Key Vault, Secrets Manager o el secreto del contenedor. Nunca en appsettings.json commiteado.");
      if (/^(password|123456|admin|sa|root|postgres|changeme|secret|pass|P@ssw0rd)$/i.test(pass)) peligro("Esa contraseña es de las primeras que prueba cualquier escáner", "Si esto es más que un contenedor local, cambiala.");
    }
    if (p === "sqlserver") {
      const enc = v("Encrypt"), tsc = v("Trust Server Certificate"), ds = v("Data Source") || "";
      if (enc !== undefined && esFalso(enc)) peligro("Encrypt=False: el tráfico va en claro", "Usuario, contraseña (en el login va cifrado igual, pero las consultas y los datos no) y todo lo que leas o escribas pasa en texto plano por la red. En Microsoft.Data.SqlClient 4+ el default ya es `true`; si lo apagaste para que «ande», el problema era el certificado: arreglá eso.");
      if (tsc !== undefined && esVerdadero(tsc)) {
        if (/^(\.|localhost|127\.0\.0\.1|\(localdb\)|tcp:localhost|tcp:127\.0\.0\.1)(\\|,|$)/i.test(ds)) ojo("TrustServerCertificate=True contra localhost", "En dev está bien (SQL Server en Docker o Express tienen certificado autofirmado). Que no viaje a producción en la misma cadena.");
        else peligro("TrustServerCertificate=True: cifra, pero no verifica a quién", "Cualquiera que se ponga en el medio (un proxy, un ARP spoof, un DNS pisado) puede presentar su certificado y leer todo. Es el equivalente de aceptar el candado del navegador sin mirar el nombre. Instalá un certificado válido en el servidor (o la CA interna en el cliente) y sacalo; si el nombre no coincide, `Host Name In Certificate`.");
      }
      if (enc === undefined && tsc === undefined) dato("Encrypt no está: depende de la versión del cliente", "Con Microsoft.Data.SqlClient 4.0 o más nuevo es `Encrypt=True` (y con un certificado autofirmado va a fallar con «certificate chain was issued by an authority that is not trusted»); con System.Data.SqlClient o versiones viejas es `False`. Ponelo explícito.");
      if (/^(sa)$/i.test(v("User ID") || "")) peligro("Te conectás como sa", "Es el superusuario: cualquier inyección SQL o bug tiene todo el servidor. Creá un login con permisos solo sobre esa base (y solo los que necesita).");
      if (esVerdadero(v("Integrated Security") || "")) dato("Autenticación de Windows", "Usa la cuenta que corre el proceso (en IIS, el pool; en un servicio, su cuenta). En Linux necesita un ticket Kerberos (`kinit`) o un keytab; en Docker casi nunca es lo que querés.");
      if (v("Initial Catalog") === undefined && !/\(localdb\)/i.test(ds)) ojo("No dice a qué base", "Sin `Initial Catalog` caés en la base por defecto del login, que suele ser `master`. Ponela explícita.");
      if (/\\[^,]+$/.test(ds) && !/,\s*\d+/.test(ds)) dato("Instancia con nombre sin puerto", `Para resolver «${ds}» el cliente le pregunta al SQL Browser por UDP 1434. Si hay firewall en el medio o el Browser está apagado, falla con «error: 26». Con \`host,puerto\` no lo necesita.`);
      if (/\\\\/.test(ds)) dato("Barra doble en el servidor", "En C# o JSON `\\\\` es una sola barra, está bien. Si esto viene de appsettings.json y en el JSON hay una sola barra, el JSON está mal (hay que escaparla).");
      const mps = Number(v("Max Pool Size")); if (!Number.isNaN(mps) && v("Max Pool Size") !== undefined) { if (mps > 200) ojo(`Max Pool Size=${mps}`, "Subirlo mucho suele tapar un problema de conexiones que no se cierran o de consultas lentas; SQL Server tampoco se beneficia de cientos de sesiones del mismo proceso. Y multiplicá por instancias de la app."); if (mps < 10) ojo(`Max Pool Size=${mps} es poco`, "Con unos pocos pedidos en paralelo ya vas a ver «Timeout expired... obtaining a connection from the pool»."); }
      if (esFalso(v("Pooling") || "true")) ojo("Pooling=False", "Cada `Open()` es un handshake TCP, TLS y login nuevos (decenas de ms) y el servidor ve conexiones entrando y saliendo todo el tiempo. Solo tiene sentido en diagnósticos muy puntuales.");
      const ct = Number(v("Connect Timeout")); if (v("Connect Timeout") !== undefined && !Number.isNaN(ct)) { if (ct === 0) peligro("Connect Timeout=0: espera para siempre", "Si el servidor no contesta, el hilo queda colgado sin límite. Un valor entre 5 y 30 segundos."); else if (ct > 60) ojo(`Connect Timeout=${ct} segundos`, "Es mucho: si la base no está, cada pedido va a esperar eso antes de fallar. Y recordá que este timeout también aplica a esperar una conexión del pool lleno."); }
      if (esVerdadero(v("MultipleActiveResultSets") || "")) dato("MARS prendido", "Lo necesita EF Core si enumerás una consulta mientras ejecutás otra en la misma conexión (lazy loading, por ejemplo). Tiene costo y a veces esconde código que debería hacer `ToListAsync()` antes. No es un problema, es una señal.");
      if (v("Application Name") === undefined) dato("Sin Application Name", "Agregá `Application Name=<tu servicio>`: en `sys.dm_exec_sessions`, `sp_who2` y el Profiler vas a ver quién es quién cuando haya bloqueos.");
      if (esVerdadero(v("Persist Security Info") || "")) ojo("Persist Security Info=True", "La contraseña queda legible en `connection.ConnectionString` y en cualquier log que la imprima. Sacalo.");
      const auth = v("Authentication"); if (auth && /managed identity|default/i.test(auth) && pass) ojo("Authentication con Entra ID y además Password", "Con Managed Identity o Default no hace falta contraseña; si está, es una de más dando vueltas.");
      if (/\.database\.windows\.net/i.test(ds) && (esFalso(enc || "true") || esVerdadero(tsc || ""))) peligro("Azure SQL sin validar el certificado", "Azure SQL tiene certificado válido: `Encrypt=True;TrustServerCertificate=False` funciona sin más. Lo otro es regalar la conexión.");
      if (v("Command Timeout") !== undefined && Number(v("Command Timeout")) === 0) ojo("Command Timeout=0: las consultas pueden durar para siempre", "Un reporte pesado o un bloqueo y ese hilo (y esa conexión del pool) no vuelven más. Dejá un tope y subilo solo en los comandos que lo necesiten.");
    }
    if (p === "postgres") {
      const ssl = (v("SSL Mode") || "").toLowerCase().replace(/[\s-]/g, ""), tsc = v("Trust Server Certificate"), host = v("Host") || "";
      const local = /^(localhost|127\.0\.0\.1|::1|\/)/i.test(host);
      if (ssl === "disable") (local ? ojo : peligro)("SSL Mode=Disable: el tráfico va en claro", local ? "Contra localhost vale. Que no viaje a producción." : "Todo lo que leas o escribas pasa en texto plano. `Require` como mínimo; `VerifyFull` para estar protegido de un intermediario.");
      else if (ssl === "" ) dato("SSL Mode no está: depende de la versión de Npgsql", "Desde Npgsql 6.0 el default es `Prefer` (cifra si el servidor puede, pero sin validar el certificado); en versiones anteriores era `Disable`. Ponelo explícito.");
      else if (ssl === "prefer" || ssl === "allow") (local ? dato : ojo)(`SSL Mode=${v("SSL Mode")}: cifra si se puede, sin validar`, "No falla si el servidor no tiene TLS, y aunque lo tenga no verifica el certificado. Para producción, `Require` con un certificado válido o `VerifyFull`.");
      else if (ssl === "require" && !(tsc !== undefined && esFalso(tsc))) (local ? dato : ojo)("SSL Mode=Require cifra pero no valida el certificado", "En Npgsql, `Require` solo exige TLS; para validar cadena y nombre hace falta `VerifyCA` o `VerifyFull` (o `Require` con `Trust Server Certificate=false`, que desde Npgsql 6 también valida).");
      if (tsc !== undefined && esVerdadero(tsc) && !local) peligro("Trust Server Certificate=True: acepta cualquier certificado", "Un intermediario puede presentar el suyo y leer todo. Instalá la CA (`Root Certificate`) y usá `VerifyFull`.");
      if (/^(postgres)$/i.test(v("Username") || "")) peligro("Te conectás como postgres", "Es el superusuario del cluster. Creá un rol con permisos solo sobre esa base.");
      if (v("Database") === undefined) ojo("No dice a qué base", "Sin `Database`, Npgsql usa el nombre del usuario como nombre de base. Casi nunca existe. Ponela explícita.");
      if (esVerdadero(v("Include Error Detail") || "")) (local ? dato : ojo)("Include Error Detail=True", "Los mensajes de error traen valores de parámetros y detalles internos. En dev es oro; en prod termina con datos personales en los logs.");
      if (esVerdadero(v("Log Parameters") || "")) (local ? dato : ojo)("Log Parameters=True", "Loguea el valor de cada parámetro. Dev sí, prod no.");
      const mps = Number(v("Maximum Pool Size")); if (v("Maximum Pool Size") !== undefined && !Number.isNaN(mps)) { if (mps > 100) ojo(`Maximum Pool Size=${mps}`, "`max_connections` de Postgres es 100 por defecto y cada conexión es un proceso con memoria. Si tenés varias instancias de la app, multiplicá. Si necesitás más, PgBouncer."); if (mps < 10) ojo(`Maximum Pool Size=${mps} es poco`, "Unos pocos pedidos en paralelo y ya esperás por una conexión (hasta `Timeout` segundos) antes de un `NpgsqlException: The connection pool has been exhausted`."); }
      if (esFalso(v("Pooling") || "true")) ojo("Pooling=False", "Cada `Open()` es TCP + TLS + autenticación (y en Postgres, un proceso nuevo del lado del servidor). Solo para diagnósticos.");
      if (v("Command Timeout") !== undefined && Number(v("Command Timeout")) === 0) ojo("Command Timeout=0: las consultas pueden durar para siempre", "Dejá un tope y subilo por comando donde haga falta.");
      if (v("Timeout") !== undefined && Number(v("Timeout")) === 0) peligro("Timeout=0: espera la conexión para siempre", "Entre 5 y 30 segundos.");
      if (v("Application Name") === undefined) dato("Sin Application Name", "Agregá `Application Name=<tu servicio>`: en `pg_stat_activity` vas a ver quién tiene qué conexión y qué consulta.");
      if (esVerdadero(v("No Reset On Close") || "")) ojo("No Reset On Close=True", "Las conexiones vuelven al pool sin `DISCARD ALL`: `SET` de sesión, tablas temporales y prepared statements se filtran al próximo que la use.");
      if (v("Keepalive") === undefined && v("Tcp Keepalive") === undefined && !local) dato("Sin keepalive", "Si hay un balanceador o firewall que corta conexiones ociosas (Azure, AWS, algunos NAT lo hacen a los 4-5 minutos), vas a ver errores raros la primera vez que uses una conexión que durmió. `Keepalive=30` lo evita.");
      if (esVerdadero(v("Persist Security Info") || "")) ojo("Persist Security Info=True", "La contraseña queda legible en `ConnectionString`. Sacalo.");
    }
    if (p === "mysql") {
      const ssl = (v("SSL Mode") || "").toLowerCase(), host = v("Server") || "";
      const local = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);
      if (ssl === "none") (local ? ojo : peligro)("SslMode=None: el tráfico va en claro", local ? "Contra localhost vale. Que no viaje a producción." : "Todo en texto plano. `Required` como mínimo, `VerifyFull` para estar protegido de un intermediario.");
      else if (ssl === "" || ssl === "preferred") (local ? dato : ojo)(`SslMode=${v("SSL Mode") || "Preferred (default)"}: cifra si se puede, sin validar`, "No falla sin TLS y no valida el certificado. Para producción, `Required` o `VerifyFull`.");
      else if (ssl === "required") (local ? dato : ojo)("SslMode=Required cifra pero no valida el certificado", "Para validar cadena y nombre, `VerifyCA` o `VerifyFull` con `SSL CA`.");
      if (esVerdadero(v("Allow Public Key Retrieval") || "") && ssl !== "verifyfull" && ssl !== "verifyca") peligro("AllowPublicKeyRetrieval=True sin TLS validado", "Con `caching_sha2_password`, el cliente le pide al servidor su clave pública en claro para cifrar la contraseña. Un intermediario manda la suya y se queda con la contraseña. Lo correcto es TLS, no esto.");
      if (esVerdadero(v("Allow Load Local Infile") || "")) ojo("AllowLoadLocalInfile=True", "El servidor puede pedirle archivos locales al cliente. Contra un servidor que no controlás, es un problema.");
      if (/^root$/i.test(v("User ID") || "")) peligro("Te conectás como root", "Creá un usuario con permisos solo sobre esa base.");
      if (v("Database") === undefined) ojo("No dice a qué base", "Sin `Database` tenés que hacer `USE` o calificar todo. Ponela explícita.");
      const mps = Number(v("Maximum Pool Size")); if (v("Maximum Pool Size") !== undefined && !Number.isNaN(mps) && mps > 150) ojo(`Maximum Pool Size=${mps}`, "`max_connections` de MySQL es 151 por defecto. Multiplicá por instancias de la app.");
      if (esFalso(v("Pooling") || "true")) ojo("Pooling=False", "Cada `Open()` es TCP + TLS + autenticación. Solo para diagnósticos.");
      if (v("Default Command Timeout") !== undefined && Number(v("Default Command Timeout")) === 0) ojo("DefaultCommandTimeout=0", "Las consultas pueden durar para siempre. Dejá un tope.");
      if (v("Application Name") === undefined) dato("Sin Application Name", "Con `ApplicationName=<tu servicio>` se ve en `performance_schema.session_connect_attrs`.");
      if (esVerdadero(v("Persist Security Info") || "")) ojo("Persist Security Info=True", "La contraseña queda legible en `ConnectionString`. Sacalo.");
      if (esVerdadero(v("Allow User Variables") || "")) dato("AllowUserVariables=True", "Hace falta para usar `@variables` de sesión en el SQL; Dapper no lo necesita salvo que las uses de verdad.");
    }
    if (p === "redis") {
      const ssl = v("ssl"), endpoints = v("(endpoints)") || "";
      const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(endpoints);
      if (!esVerdadero(ssl || "") && !local) peligro("Sin ssl=true", "Todo lo que guardes en Redis (sesiones, tokens, cache de respuestas) viaja en claro, y la contraseña también. Afuera de tu red privada, `ssl=true` (y el puerto 6380 en Azure).");
      if (esVerdadero(v("allowAdmin") || "")) ojo("allowAdmin=true", "Habilita `FLUSHALL`, `CONFIG`, `SHUTDOWN` desde la app. Si un bug o un endpoint equivocado los llama, se lleva todo. Solo para herramientas de administración.");
      if (v("abortConnect") === undefined || esVerdadero(v("abortConnect"))) dato("abortConnect por defecto (true)", "Si Redis no está al arrancar, `ConnectionMultiplexer.Connect` tira excepción y tu app no levanta. Con `abortConnect=false` arranca igual y reintenta en segundo plano; Azure lo recomienda.");
      if (pass === undefined || pass === "") (local ? dato : peligro)("Sin password", local ? "Para un Redis local está bien." : "Un Redis abierto a la red sin contraseña es de los blancos más comunes de internet. `requirepass` o ACL del lado del servidor, y `password=` acá.");
      if (/\.redis\.cache\.windows\.net/i.test(endpoints) && !esVerdadero(ssl || "")) peligro("Azure Cache for Redis sin TLS", "Por defecto Azure solo acepta TLS en el 6380: `ssl=true,abortConnect=false`.");
      if (v("syncTimeout") !== undefined && Number(v("syncTimeout")) > 10000) ojo(`syncTimeout=${v("syncTimeout")}`, "Diez segundos o más esperando a Redis en una operación sincrónica congela el hilo. Si Redis tarda eso, el problema es otro.");
      if (v("connectRetry") !== undefined && Number(v("connectRetry")) > 10) ojo(`connectRetry=${v("connectRetry")}`, "Muchos reintentos con `abortConnect=true` demoran el arranque de la app sin ganar nada.");
    }
    const orden = { peligro: 0, ojo: 1, dato: 2 };
    avisos.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
    return avisos;
  }

  // ---------- Resumen en una frase ----------
  function resumir(a) {
    if (!a.proveedor || !a.claves.length) return "";
    const v = (n) => valorDe(a, n), p = a.proveedor;
    const partes = [];
    if (p === "sqlserver") {
      const ds = v("Data Source") || "¿?", db = v("Initial Catalog");
      partes.push(`Te conectás a SQL Server en «${ds}»${db ? `, base «${db}»` : ", sin decir la base (caés en la del login)"}`);
      if (esVerdadero(v("Integrated Security") || "")) partes.push("con autenticación de Windows");
      else if (v("Authentication")) partes.push(`con Entra ID (${v("Authentication")})`);
      else if (v("User ID")) partes.push(`como «${v("User ID")}» con contraseña`);
      const enc = v("Encrypt"), tsc = v("Trust Server Certificate");
      if (enc !== undefined && esFalso(enc)) partes.push("sin cifrar");
      else if (tsc !== undefined && esVerdadero(tsc)) partes.push("cifrado pero sin validar el certificado");
      else if (enc !== undefined) partes.push("cifrado y validando el certificado");
      partes.push(`pool de hasta ${v("Max Pool Size") || 100} conexiones`);
    } else if (p === "postgres") {
      partes.push(`Te conectás a PostgreSQL en «${v("Host") || "¿?"}:${v("Port") || 5432}»${v("Database") ? `, base «${v("Database")}»` : ", sin decir la base"}`);
      if (v("Username")) partes.push(`como «${v("Username")}»`);
      const ssl = (v("SSL Mode") || "").toLowerCase().replace(/[\s-]/g, "");
      partes.push(ssl === "disable" ? "sin cifrar" : ssl === "verifyfull" || ssl === "verifyca" ? "cifrado y validando el certificado" : ssl === "require" ? "cifrado" : "cifrado si el servidor puede");
      partes.push(`pool de hasta ${v("Maximum Pool Size") || 100} conexiones`);
    } else if (p === "mysql") {
      partes.push(`Te conectás a MySQL en «${v("Server") || "¿?"}:${v("Port") || 3306}»${v("Database") ? `, base «${v("Database")}»` : ", sin decir la base"}`);
      if (v("User ID")) partes.push(`como «${v("User ID")}»`);
      const ssl = (v("SSL Mode") || "preferred").toLowerCase();
      partes.push(ssl === "none" ? "sin cifrar" : ssl.startsWith("verify") ? "cifrado y validando el certificado" : ssl === "required" ? "cifrado" : "cifrado si el servidor puede");
      partes.push(`pool de hasta ${v("Maximum Pool Size") || 100} conexiones`);
    } else if (p === "redis") {
      partes.push(`Te conectás a Redis en «${v("(endpoints)") || "¿?"}»`);
      partes.push(esVerdadero(v("ssl") || "") ? "con TLS" : "sin TLS");
      partes.push(v("password") ? "con contraseña" : "sin contraseña");
      partes.push(`base ${v("defaultDatabase") || 0}`);
    }
    return partes.join(", ") + ".";
  }

  // ---------- Salidas ----------
  const SECRETAS = new Set(["Password", "password", "SSL Password"]);
  function esSecreta(k) { return SECRETAS.has(k.def ? k.def.nombre : k.clave); }
  function citar(valor) { return /[;'"=\s]/.test(valor) || valor === "" ? `"${valor.replace(/"/g, '""')}"` : valor; }
  function citarSqlClient(valor) { return /[;'"\s]|^\s|\s$/.test(valor) ? (valor.includes('"') && !valor.includes("'") ? `'${valor}'` : `"${valor.replace(/"/g, '""')}"`) : valor; }

  // La misma cadena, con nombres canónicos y la contraseña reemplazada.
  function reconstruir(a, opciones) {
    const o = Object.assign({ ocultar: true, marcador: "<SECRETO>" }, opciones || {});
    if (a.proveedor === "redis") {
      const partes = [];
      for (const k of a.claves) {
        if (k.clave === "(endpoints)") partes.push(k.valor);
        else partes.push(`${k.def ? k.def.nombre : k.clave}=${o.ocultar && esSecreta(k) ? o.marcador : k.valor}`);
      }
      return partes.join(",");
    }
    return a.claves.map((k) => `${k.def ? k.def.nombre : k.clave}=${citarSqlClient(o.ocultar && esSecreta(k) ? o.marcador : k.valor)}`).join(";");
  }

  function aUri(a) {
    if (a.proveedor !== "postgres" && a.proveedor !== "mysql") return null;
    const v = (n) => valorDe(a, n);
    const esquema = a.proveedor === "postgres" ? "postgresql" : "mysql";
    const host = v(a.proveedor === "postgres" ? "Host" : "Server") || "localhost";
    const usuario = v(a.proveedor === "postgres" ? "Username" : "User ID"), pass = v("Password");
    let s = `${esquema}://`;
    if (usuario) s += encodeURIComponent(usuario) + (pass !== undefined ? ":" + encodeURIComponent(pass) : "") + "@";
    s += host.split(",").map((h) => h + (v("Port") ? ":" + v("Port") : "")).join(",");
    if (v("Database")) s += "/" + encodeURIComponent(v("Database"));
    const q = []; const sinEquivalente = [];
    for (const k of a.claves) {
      const n = k.def ? k.def.nombre : k.clave;
      if (["Host", "Server", "Port", "Database", "Username", "User ID", "Password"].includes(n)) continue;
      if (a.proveedor === "postgres" && NPGSQL_A_LIBPQ[n]) q.push(`${NPGSQL_A_LIBPQ[n]}=${encodeURIComponent(n === "SSL Mode" ? k.valor.toLowerCase().replace(/verifyca/, "verify-ca").replace(/verifyfull/, "verify-full") : k.valor)}`);
      else sinEquivalente.push(n);
    }
    if (q.length) s += "?" + q.join("&");
    return { uri: s, sinEquivalente };
  }

  function snippets(a, nombre) {
    const n = nombre || "Default";
    const cadena = reconstruir(a, { ocultar: true, marcador: "<SECRETO>" });
    const jsonCadena = cadena.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const secreta = a.claves.some(esSecreta);
    return {
      appsettings: `{\n  "ConnectionStrings": {\n    "${n}": "${jsonCadena}"\n  }\n}`,
      userSecrets: secreta ? `dotnet user-secrets init\ndotnet user-secrets set "ConnectionStrings:${n}" "${reconstruir(a, { ocultar: false }).replace(/"/g, '\\"')}"` : `# Sin contraseña en la cadena: puede ir en appsettings.json`,
      entorno: `# Variable de entorno (Linux/Docker). Los dos guiones bajos son el separador de secciones.\nexport ConnectionStrings__${n}='${reconstruir(a, { ocultar: false }).replace(/'/g, "'\\''")}'`,
      csharp: `var cadena = builder.Configuration.GetConnectionString("${n}")\n    ?? throw new InvalidOperationException("Falta ConnectionStrings:${n}");`,
    };
  }

  const EJEMPLOS = {
    sqlserver: "Server=srv-sql01\\PROD,1433;Initial Catalog=Ventas;User ID=sa;Password=P@ssw0rd;Encrypt=True;TrustServerCertificate=True;MultipleActiveResultSets=True;Max Pool Size=500;Connect Timeout=120",
    sqlserverDev: "Server=localhost;Database=Ventas;User Id=sa;Password=Clave123!;TrustServerCertificate=True",
    postgres: "Host=db.interno;Port=5432;Database=ventas;Username=postgres;Password=postgres;SSL Mode=Disable;Include Error Detail=true;Maximum Pool Size=300",
    postgresUri: "postgresql://ventas_app:s3cr3t@db.interno:5432/ventas?sslmode=require&application_name=api-ventas",
    mysql: "Server=mysql.interno;Port=3306;Database=ventas;Uid=root;Pwd=root;SslMode=None;AllowPublicKeyRetrieval=True;ConvertZeroDateTime=True",
    redis: "cache.redis.cache.windows.net:6380,password=xxxxxxxx,ssl=False,abortConnect=True,allowAdmin=true",
  };

  const API = { parsearPares, parsearUri, detectar, analizar, avisar, resumir, reconstruir, aUri, snippets, esSecreta, PROVEEDORES, CATEGORIAS, EJEMPLOS, LIBPQ_A_NPGSQL, NPGSQL_A_LIBPQ };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.ConnStr = API;
})(typeof window !== "undefined" ? window : globalThis);
