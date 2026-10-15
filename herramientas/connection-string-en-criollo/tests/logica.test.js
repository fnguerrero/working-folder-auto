// Tests de la lógica pura. Se corren con: node --test herramientas/connection-string-en-criollo/tests/logica.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const titulos = (a) => L.avisar(a).map((w) => w.titulo);
const niveles = (a) => Object.fromEntries(L.avisar(a).map((w) => [w.titulo, w.nivel]));

test("parsearPares: reglas de DbConnectionStringBuilder", () => {
  const { pares, errores } = L.parsearPares("Server=a; Database = b ;Password=\"p;w\"\"x\";Otra='c;d';ODBC={x;y};;Vacia=;Sin");
  assert.deepEqual(pares, [
    { clave: "Server", valor: "a" }, { clave: "Database", valor: "b" }, { clave: "Password", valor: 'p;w"x' },
    { clave: "Otra", valor: "c;d" }, { clave: "ODBC", valor: "x;y" }, { clave: "Vacia", valor: "" },
  ]);
  assert.deepEqual(errores, ["«Sin» no tiene valor (falta el «=»)."]);
  assert.deepEqual(L.parsearPares("a==b=c").pares, [{ clave: "a=b", valor: "c" }]);
  assert.ok(L.parsearPares("Password=\"abierta").errores[0].includes("no la cierra"));
});

test("parsearUri: postgres con usuario, clave codificada, puerto, base y parámetros", () => {
  const u = L.parsearUri("postgresql://app:p%40ss%3Aw@db.interno:5433/ventas?sslmode=require&application_name=api");
  assert.equal(u.esquema, "postgresql");
  assert.equal(u.usuario, "app"); assert.equal(u.clave, "p@ss:w");
  assert.deepEqual(u.hosts, [{ host: "db.interno", puerto: 5433 }]);
  assert.equal(u.ruta, "ventas");
  assert.deepEqual(u.parametros, [{ clave: "sslmode", valor: "require" }, { clave: "application_name", valor: "api" }]);
  assert.equal(L.parsearUri("Server=x;Database=y"), null);
  const r = L.parsearUri("rediss://:clave@cache:6380/2");
  assert.equal(r.usuario, ""); assert.equal(r.clave, "clave"); assert.equal(r.ruta, "2");
});

test("detectar: cada proveedor por sus claves típicas", () => {
  assert.equal(L.detectar("Server=.;Database=x;Trusted_Connection=True"), "sqlserver");
  assert.equal(L.detectar("Data Source=srv\\inst;Initial Catalog=x;User ID=u;Password=p"), "sqlserver");
  assert.equal(L.detectar("Server=srv,1433;Database=x;User ID=u;Password=p"), "sqlserver");
  assert.equal(L.detectar("Host=localhost;Username=u;Password=p;Database=x"), "postgres");
  assert.equal(L.detectar("Server=localhost;Port=5432;User Id=u;Password=p;Database=x"), "postgres");
  assert.equal(L.detectar("Server=localhost;Port=3306;Uid=u;Pwd=p;Database=x"), "mysql");
  assert.equal(L.detectar("Server=localhost;Database=x;User=u;Password=p;SslMode=None"), "mysql");
  assert.equal(L.detectar("localhost:6379,abortConnect=false"), "redis");
  assert.equal(L.detectar("localhost"), "redis");
  assert.equal(L.detectar("postgres://u:p@h/db"), "postgres");
  assert.equal(L.detectar("mysql://u:p@h/db"), "mysql");
  assert.equal(L.detectar("redis://h:6379"), "redis");
  assert.equal(L.detectar("ftp://h"), null);
  assert.equal(L.detectar("cualquier cosa"), null);
  assert.equal(L.detectar("Host=db;Database=x;Username=u;Password=p;SSL Mode=Require;Trust Server Certificate=true"), "postgres");
  assert.equal(L.detectar("Server=srv;Database=x;User ID=u;Password=p;TrustServerCertificate=True"), "sqlserver");
  assert.equal(L.detectar("Server=(localdb)\\MSSQLLocalDB;AttachDbFilename=|DataDirectory|\\x.mdf"), "sqlserver");
});

test("analizar: alias al nombre canónico, repetidas gana la última, desconocidas quedan sin def", () => {
  const a = L.analizar("Server=a;Data Source=b;trusted_connection=yes;Zarasa=1");
  assert.equal(a.proveedor, "sqlserver");
  const ds = a.claves.find((k) => k.def && k.def.nombre === "Data Source");
  assert.equal(ds.valor, "b");
  assert.ok(a.errores.some((e) => e.includes("más de una vez")));
  assert.equal(a.claves.find((k) => k.def && k.def.nombre === "Integrated Security").valor, "yes");
  assert.equal(a.claves.find((k) => k.clave === "Zarasa").def, null);
  assert.ok(titulos(a).some((t) => t.includes("Zarasa")));
});

test("analizar: una URI de postgres se traduce a claves de Npgsql", () => {
  const a = L.analizar("postgresql://app:secreto@db.interno:5432/ventas?sslmode=verify-full&application_name=api&connect_timeout=5");
  const v = (n) => a.claves.find((k) => k.def && k.def.nombre === n).valor;
  assert.equal(v("Host"), "db.interno"); assert.equal(v("Port"), "5432"); assert.equal(v("Database"), "ventas");
  assert.equal(v("Username"), "app"); assert.equal(v("Password"), "secreto");
  assert.equal(v("SSL Mode"), "verify-full"); assert.equal(v("Application Name"), "api"); assert.equal(v("Timeout"), "5");
  assert.ok(!titulos(a).some((t) => /cifra|claro/.test(t)), "verify-full no genera avisos de cifrado");
});

test("avisos SQL Server: TrustServerCertificate, Encrypt=False, sa, Azure, timeouts", () => {
  const prod = L.analizar("Server=srv-sql01,1433;Initial Catalog=Ventas;User ID=sa;Password=P@ssw0rd;Encrypt=False;TrustServerCertificate=True;Max Pool Size=500;Connect Timeout=0;Command Timeout=0;Persist Security Info=True;Pooling=False");
  const n = niveles(prod);
  assert.equal(n["Encrypt=False: el tráfico va en claro"], "peligro");
  assert.equal(n["TrustServerCertificate=True: cifra, pero no verifica a quién"], "peligro");
  assert.equal(n["Te conectás como sa"], "peligro");
  assert.equal(n["Connect Timeout=0: espera para siempre"], "peligro");
  assert.equal(n["Max Pool Size=500"], "ojo");
  assert.equal(n["Pooling=False"], "ojo");
  assert.equal(n["Persist Security Info=True"], "ojo");
  assert.equal(n["Command Timeout=0: las consultas pueden durar para siempre"], "ojo");
  assert.ok(Object.keys(n).some((t) => t.includes("escáner")));
  // Contra localhost, TrustServerCertificate es solo un "ojo".
  const dev = L.analizar("Server=localhost;Database=Ventas;User Id=app;Password=Clave123!;TrustServerCertificate=True");
  assert.equal(niveles(dev)["TrustServerCertificate=True contra localhost"], "ojo");
  assert.ok(!titulos(dev).some((t) => t.includes("como sa")));
  // Sin Encrypt ni TSC: dato sobre el cambio de default en 4.0.
  const sinEnc = L.analizar("Server=srv;Database=x;User Id=u;Password=p");
  assert.ok(titulos(sinEnc).some((t) => t.startsWith("Encrypt no está")));
  assert.ok(titulos(sinEnc).some((t) => t === "Sin Application Name"));
  // Azure sin validar.
  const az = L.analizar("Server=tcp:mi.database.windows.net,1433;Initial Catalog=x;User ID=u;Password=p;Encrypt=True;TrustServerCertificate=True");
  assert.equal(niveles(az)["Azure SQL sin validar el certificado"], "peligro");
  // Instancia con nombre sin puerto.
  const inst = L.analizar("Server=srv\\SQLEXPRESS;Database=x;Integrated Security=SSPI");
  assert.ok(titulos(inst).some((t) => t === "Instancia con nombre sin puerto"));
  assert.ok(titulos(inst).some((t) => t === "Autenticación de Windows"));
  // Base sin decir.
  assert.ok(titulos(L.analizar("Server=srv;User Id=u;Password=p;Encrypt=True")).some((t) => t === "No dice a qué base"));
});

test("avisos PostgreSQL: SSL Mode, postgres, pool, Include Error Detail, keepalive", () => {
  const a = L.analizar("Host=db.interno;Database=ventas;Username=postgres;Password=postgres;SSL Mode=Disable;Include Error Detail=true;Maximum Pool Size=300;Timeout=0");
  const n = niveles(a);
  assert.equal(n["SSL Mode=Disable: el tráfico va en claro"], "peligro");
  assert.equal(n["Te conectás como postgres"], "peligro");
  assert.equal(n["Timeout=0: espera la conexión para siempre"], "peligro");
  assert.equal(n["Include Error Detail=True"], "ojo");
  assert.equal(n["Maximum Pool Size=300"], "ojo");
  assert.equal(n["Sin keepalive"], "dato");
  const local = L.analizar("Host=localhost;Database=ventas;Username=app;Password=app;SSL Mode=Disable;Include Error Detail=true");
  assert.equal(niveles(local)["SSL Mode=Disable: el tráfico va en claro"], "ojo");
  assert.equal(niveles(local)["Include Error Detail=True"], "dato");
  assert.ok(!titulos(local).includes("Sin keepalive"));
  const sinSsl = L.analizar("Host=db;Database=x;Username=u;Password=p");
  assert.ok(titulos(sinSsl).some((t) => t.startsWith("SSL Mode no está")));
  const prefer = L.analizar("Host=db;Database=x;Username=u;Password=p;SSL Mode=Prefer");
  assert.equal(niveles(prefer)["SSL Mode=Prefer: cifra si se puede, sin validar"], "ojo");
  const req = L.analizar("Host=db;Database=x;Username=u;Password=p;SSL Mode=Require;Trust Server Certificate=true");
  assert.equal(niveles(req)["Trust Server Certificate=True: acepta cualquier certificado"], "peligro");
  const vf = L.analizar("Host=db;Database=x;Username=u;Password=p;SSL Mode=VerifyFull;Application Name=api;Keepalive=30");
  assert.ok(!L.avisar(vf).some((w) => w.nivel === "peligro"));
});

test("avisos MySQL y Redis", () => {
  const my = L.analizar("Server=mysql.interno;Database=ventas;Uid=root;Pwd=root;SslMode=None;AllowPublicKeyRetrieval=True");
  const n = niveles(my);
  assert.equal(n["SslMode=None: el tráfico va en claro"], "peligro");
  assert.equal(n["AllowPublicKeyRetrieval=True sin TLS validado"], "peligro");
  assert.equal(n["Te conectás como root"], "peligro");
  const rd = L.analizar("cache.redis.cache.windows.net:6380,password=xxxxxxxx,ssl=False,allowAdmin=true");
  const r = niveles(rd);
  assert.equal(r["Sin ssl=true"], "peligro");
  assert.equal(r["Azure Cache for Redis sin TLS"], "peligro");
  assert.equal(r["allowAdmin=true"], "ojo");
  assert.equal(r["abortConnect por defecto (true)"], "dato");
  const rdLocal = L.analizar("localhost:6379,abortConnect=false");
  assert.ok(!L.avisar(rdLocal).some((w) => w.nivel === "peligro"));
  assert.equal(L.resumir(rdLocal), "Te conectás a Redis en «localhost:6379», sin TLS, sin contraseña, base 0.");
});

test("resumir: una frase por proveedor", () => {
  assert.equal(L.resumir(L.analizar("Server=srv,1433;Initial Catalog=Ventas;User ID=app;Password=p;Encrypt=True;TrustServerCertificate=True")),
    "Te conectás a SQL Server en «srv,1433», base «Ventas», como «app» con contraseña, cifrado pero sin validar el certificado, pool de hasta 100 conexiones.");
  assert.equal(L.resumir(L.analizar("Server=.;Database=x;Trusted_Connection=True;Encrypt=True;Max Pool Size=50")),
    "Te conectás a SQL Server en «.», base «x», con autenticación de Windows, cifrado y validando el certificado, pool de hasta 50 conexiones.");
  assert.equal(L.resumir(L.analizar("Host=h;Database=d;Username=u;Password=p;SSL Mode=VerifyFull")),
    "Te conectás a PostgreSQL en «h:5432», base «d», como «u», cifrado y validando el certificado, pool de hasta 100 conexiones.");
  assert.equal(L.resumir(L.analizar("")), "");
});

test("reconstruir: nombres canónicos, contraseña tapada y comillas donde hace falta", () => {
  const a = L.analizar("server=srv;database=Mi Base;uid=u;pwd=con;punto y coma;encrypt=true");
  assert.equal(L.reconstruir(a), 'Data Source=srv;Initial Catalog="Mi Base";User ID=u;Password=<SECRETO>;Encrypt=true');
  assert.ok(a.errores.some((e) => e.includes("«punto y coma» no tiene valor")), "el trozo sin = se reporta");
  const b = L.analizar('Server=srv;Database=x;User ID=u;Password="a;b";Encrypt=true');
  assert.equal(L.reconstruir(b, { ocultar: false }), 'Data Source=srv;Initial Catalog=x;User ID=u;Password="a;b";Encrypt=true');
  assert.equal(L.reconstruir(L.analizar("h:6379,password=p,ssl=true")), "h:6379,password=<SECRETO>,ssl=true");
});

test("aUri: Npgsql a URI de libpq y lo que no tiene equivalente", () => {
  const a = L.analizar("Host=db;Port=5433;Database=ventas;Username=app;Password=p@ss;SSL Mode=VerifyFull;Application Name=api;Maximum Pool Size=50");
  const u = L.aUri(a);
  assert.equal(u.uri, "postgresql://app:p%40ss@db:5433/ventas?sslmode=verify-full&application_name=api");
  assert.deepEqual(u.sinEquivalente, ["Maximum Pool Size"]);
  assert.equal(L.aUri(L.analizar("Server=x;Database=y;Trusted_Connection=true")), null);
});

test("snippets: appsettings con la contraseña tapada, user-secrets con la real, variable de entorno", () => {
  const a = L.analizar("Server=srv\\inst;Database=x;User ID=u;Password=se\"creto;Encrypt=True");
  const s = L.snippets(a, "Ventas");
  assert.ok(s.appsettings.includes('"Ventas": "Data Source=srv\\\\inst;Initial Catalog=x;User ID=u;Password=<SECRETO>;Encrypt=True"'));
  assert.ok(s.userSecrets.includes('dotnet user-secrets set "ConnectionStrings:Ventas"'));
  assert.ok(s.userSecrets.includes("se\\\"creto") || s.userSecrets.includes("secreto") || s.userSecrets.includes('se\\"creto'));
  assert.ok(s.entorno.includes("ConnectionStrings__Ventas="));
  assert.ok(s.csharp.includes('GetConnectionString("Ventas")'));
  const sinPass = L.snippets(L.analizar("Server=.;Database=x;Trusted_Connection=True"));
  assert.ok(sinPass.userSecrets.startsWith("# Sin contraseña"));
});

test("diccionarios: todos los alias apuntan a su entrada y las categorías existen", () => {
  for (const [id, p] of Object.entries(L.PROVEEDORES)) {
    for (const e of p.dic.entradas) {
      assert.ok(L.CATEGORIAS[e.cat], `${id}: categoría ${e.cat}`);
      assert.equal(p.dic.buscar(e.nombre), e);
      for (const a of e.alias || []) assert.equal(p.dic.buscar(a), e, `${id}: alias ${a}`);
    }
  }
  assert.equal(L.PROVEEDORES.sqlserver.dic.buscar("trusted_connection").nombre, "Integrated Security");
  assert.equal(L.PROVEEDORES.postgres.dic.buscar("user id").nombre, "Username");
  assert.equal(L.PROVEEDORES.mysql.dic.buscar("DefaultCommandTimeout").nombre, "Default Command Timeout");
});
