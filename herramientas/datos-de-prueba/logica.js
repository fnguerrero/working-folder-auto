/* Datos de prueba argentinos — genera personas y empresas inventadas con DNI, CUIT/CUIL, CBU, alias, patente,
   dirección y teléfono con pinta argentina y dígitos verificadores correctos; exporta a JSON, CSV, SQL y C#, y valida
   CUIT, CBU, DNI, patentes y alias. Sin dependencias; se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  // ---------- Azar con semilla ----------
  // cyrb128 convierte la semilla (cualquier texto) en 128 bits; sfc32 es el generador. Cada registro tiene su propio
  // flujo (semilla + tipo + número), así el registro 7 es el mismo pidas 10 o 10.000 y aunque cambies los campos.
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function crearAzar(semilla) {
    const num = sfc32(...cyrb128(String(semilla)));
    for (let i = 0; i < 12; i++) num();
    const entero = (min, max) => min + Math.floor(num() * (max - min + 1));
    const elegir = (arr) => arr[Math.floor(num() * arr.length)];
    const ponderado = (arr, peso) => {
      let total = 0; for (const x of arr) total += peso(x);
      let r = num() * total;
      for (const x of arr) { r -= peso(x); if (r < 0) return x; }
      return arr[arr.length - 1];
    };
    const digitos = (n) => { let s = ""; for (let i = 0; i < n; i++) s += Math.floor(num() * 10); return s; };
    const letras = (n, de) => { let s = ""; for (let i = 0; i < n; i++) s += elegir(de || LETRAS); return s; };
    return { num, entero, elegir, ponderado, digitos, letras, prob: (p) => num() < p };
  }
  const semillaAlAzar = () => {
    const az = crearAzar(String(Date.now()) + Math.random());
    return az.elegir(PALABRAS_ALIAS) + "-" + az.entero(10, 999);
  };

  // ---------- CUIT / CUIL ----------
  const soloDigitos = (s) => String(s == null ? "" : s).replace(/\D/g, "");
  const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  /** Dígito verificador de los 10 primeros dígitos. Devuelve 10 cuando no hay dígito posible con ese prefijo. */
  function digitoCuit(diez) {
    const d = soloDigitos(diez);
    if (d.length !== 10) throw new Error("hacen falta 10 dígitos");
    let suma = 0; for (let i = 0; i < 10; i++) suma += Number(d[i]) * PESOS_CUIT[i];
    const v = 11 - (suma % 11);
    return v === 11 ? 0 : v;
  }
  const ocho = (dni) => soloDigitos(dni).padStart(8, "0");
  /** CUIL de una persona a partir del DNI y el sexo (F o M). Si con 20 o 27 el dígito da 10, va 23 (y sale 9 o 4). */
  function cuilDesdeDni(dni, sexo) {
    const n = ocho(dni);
    let pre = sexo === "F" ? "27" : "20";
    let v = digitoCuit(pre + n);
    if (v === 10) { pre = "23"; v = digitoCuit(pre + n); }
    return pre + n + v;
  }
  /** CUIT de una sociedad: 30; si da 10, 33; si también, 34. */
  function cuitEmpresa(numero) {
    const n = ocho(numero);
    for (const pre of ["30", "33", "34"]) { const v = digitoCuit(pre + n); if (v !== 10) return pre + n + v; }
    return null;
  }
  const formatearCuit = (c) => { const d = soloDigitos(c); return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : String(c); };
  const formatearDni = (dni) => soloDigitos(dni).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const PREFIJOS_CUIT = {
    "20": "persona, masculino", "27": "persona, femenino",
    "23": "persona (cuando con 20 o 27 el dígito daría 10)", "24": "persona (prefijo alternativo, poco común)",
    "25": "persona (prefijo alternativo, poco común)", "26": "persona (prefijo alternativo, poco común)",
    "30": "persona jurídica (sociedad, asociación, fundación)", "33": "persona jurídica (cuando con 30 el dígito daría 10)",
    "34": "persona jurídica (cuando con 30 y 33 el dígito daría 10)",
    "50": "sujeto del exterior (país o entidad extranjera)", "51": "sujeto del exterior (país o entidad extranjera)", "55": "sujeto del exterior (país o entidad extranjera)",
  };
  /** La cuenta del dígito, escrita para mostrarla: «2×5 + 0×4 + … = 88 → 88 mod 11 = 0 → 11 − 0 = 11 → 0». */
  function cuentaCuit(diez) {
    const d = soloDigitos(diez);
    let suma = 0; const t = [];
    for (let i = 0; i < 10; i++) { suma += Number(d[i]) * PESOS_CUIT[i]; t.push(`${d[i]}×${PESOS_CUIT[i]}`); }
    const resto = suma % 11, v = 11 - resto;
    const fin = v === 11 ? "11 → 0" : v === 10 ? "10 → no hay dígito con este prefijo" : String(v);
    return `${t.join(" + ")} = ${suma} → ${suma} mod 11 = ${resto} → 11 − ${resto} = ${fin}`;
  }
  function validarCuit(texto) {
    const d = soloDigitos(texto);
    if (d.length !== 11) return { valido: false, error: `Un CUIT o CUIL tiene 11 dígitos y este tiene ${d.length}.` };
    const esperado = digitoCuit(d.slice(0, 10));
    const prefijo = d.slice(0, 2);
    const r = { cuit: d, formateado: formatearCuit(d), prefijo, clase: PREFIJOS_CUIT[prefijo] || null, dni: d.slice(2, 10), digito: Number(d[10]), esperado };
    r.valido = esperado !== 10 && esperado === r.digito && !!r.clase;
    r.cuenta = cuentaCuit(d.slice(0, 10));
    if (esperado === 10) {
      r.error = `Con el prefijo ${prefijo} no hay dígito verificador posible (la cuenta da 10): ARCA (ex AFIP) en ese caso cambia el prefijo.`;
      const alt = prefijo === "30" || prefijo === "33" ? cuitEmpresa(r.dni) : cuilDesdeDni(r.dni, prefijo === "27" ? "F" : "M");
      if (alt && alt !== d) r.sugerido = formatearCuit(alt);
    } else if (esperado !== r.digito) {
      r.error = `El dígito verificador no cierra: con esos 10 dígitos tendría que ser ${esperado}, no ${r.digito}.`;
      r.sugerido = formatearCuit(d.slice(0, 10) + esperado);
    } else if (!r.clase) {
      r.error = `El dígito cierra, pero el prefijo ${prefijo} no es uno de los que asigna ARCA (20, 23, 24, 27, 30, 33, 34…).`;
    }
    return r;
  }

  // ---------- CBU / CVU ----------
  const PESOS_BLOQUE1 = [7, 1, 3, 9, 7, 1, 3];
  const PESOS_BLOQUE2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];
  function digitoPonderado(d, pesos) {
    if (d.length !== pesos.length) throw new Error(`hacen falta ${pesos.length} dígitos`);
    let suma = 0; for (let i = 0; i < pesos.length; i++) suma += Number(d[i]) * pesos[i];
    return (10 - (suma % 10)) % 10;
  }
  /** Primer bloque: entidad (3) + sucursal (4) → dígito. */
  const digitoCbuBloque1 = (siete) => digitoPonderado(soloDigitos(siete), PESOS_BLOQUE1);
  /** Segundo bloque: número de cuenta (13) → dígito. */
  const digitoCbuBloque2 = (trece) => digitoPonderado(soloDigitos(trece), PESOS_BLOQUE2);
  function cuentaCbu(d, pesos) {
    let suma = 0; const t = [];
    for (let i = 0; i < pesos.length; i++) { suma += Number(d[i]) * pesos[i]; t.push(`${d[i]}×${pesos[i]}`); }
    const resto = suma % 10;
    return `${t.join(" + ")} = ${suma} → 10 − ${resto} = ${10 - resto}${resto === 0 ? " → 0" : ""}`;
  }
  function armarCbu(entidad, sucursal, cuenta) {
    const b1 = String(entidad).padStart(3, "0") + String(sucursal).padStart(4, "0");
    const b2 = String(cuenta).padStart(13, "0");
    return b1 + digitoCbuBloque1(b1) + b2 + digitoCbuBloque2(b2);
  }
  // Códigos de entidad del BCRA (los más comunes; el nombre es el de hoy, entre paréntesis el que figura en el CBU viejo).
  const BANCOS = {
    "007": "Banco Galicia", "011": "Banco de la Nación Argentina", "014": "Banco de la Provincia de Buenos Aires",
    "015": "ICBC", "016": "Citibank (hoy Santander)", "017": "BBVA", "020": "Banco de la Provincia de Córdoba (Bancor)",
    "027": "Banco Supervielle", "029": "Banco Ciudad", "034": "Banco Patagonia", "044": "Banco Hipotecario",
    "045": "Banco de San Juan", "065": "Banco Municipal de Rosario", "072": "Banco Santander", "083": "Banco del Chubut",
    "086": "Banco de Santa Cruz", "093": "Banco de La Pampa", "094": "Banco de Corrientes", "097": "Banco Provincia del Neuquén",
    "143": "Brubank", "147": "Banco Interfinanzas", "150": "Galicia Más (ex HSBC)", "191": "Banco Credicoop",
    "198": "Banco de Valores", "259": "Banco Macro (ex Itaú)", "268": "Banco de Tierra del Fuego",
    "285": "Banco Macro", "299": "Banco Comafi", "300": "BICE", "301": "Banco Piano", "309": "Banco Rioja",
    "311": "Nuevo Banco del Chaco", "315": "Banco de Formosa", "319": "Banco CMF", "321": "Banco de Santiago del Estero",
    "322": "Banco Industrial (BIND)", "330": "Nuevo Banco de Santa Fe", "384": "Wilobank", "386": "Nuevo Banco de Entre Ríos",
    "389": "Banco Columbia", "426": "Banco Bica", "431": "Banco Coinag", "432": "Banco de Comercio",
  };
  // Para generar: los bancos grandes salen más seguido.
  const BANCOS_PESO = [["011", 14], ["007", 10], ["014", 9], ["072", 9], ["017", 7], ["285", 6], ["015", 4], ["029", 4],
    ["191", 4], ["027", 3], ["034", 3], ["150", 3], ["020", 3], ["330", 3], ["044", 2], ["143", 2], ["299", 2], ["386", 1],
    ["097", 1], ["065", 1], ["083", 1], ["093", 1], ["094", 1], ["045", 1], ["384", 1]];
  const PSP = { "0000003": "Mercado Pago" };
  function validarCbu(texto) {
    const d = soloDigitos(texto);
    if (d.length !== 22) return { valido: false, error: `Un CBU o CVU tiene 22 dígitos y este tiene ${d.length}.` };
    const r = { cbu: d, bloque1: d.slice(0, 8), bloque2: d.slice(8), entidad: d.slice(0, 3), sucursal: d.slice(3, 7), nroCuenta: d.slice(8, 21) };
    r.esperado1 = digitoCbuBloque1(d.slice(0, 7)); r.digito1 = Number(d[7]);
    r.esperado2 = digitoCbuBloque2(d.slice(8, 21)); r.digito2 = Number(d[21]);
    r.ok1 = r.esperado1 === r.digito1; r.ok2 = r.esperado2 === r.digito2;
    r.cuenta1 = cuentaCbu(d.slice(0, 7), PESOS_BLOQUE1); r.cuenta2 = cuentaCbu(d.slice(8, 21), PESOS_BLOQUE2);
    r.esCvu = d.startsWith("000");
    if (r.esCvu) {
      r.banco = PSP[d.slice(0, 7)] ? `CVU de ${PSP[d.slice(0, 7)]}` : `CVU de una billetera virtual (proveedor ${d.slice(3, 7)})`;
    } else r.banco = BANCOS[r.entidad] || null;
    r.valido = r.ok1 && r.ok2;
    const errores = [];
    if (!r.ok1) errores.push(`El primer bloque no cierra: el dígito 8 tendría que ser ${r.esperado1}, no ${r.digito1}.`);
    if (!r.ok2) errores.push(`El segundo bloque no cierra: el último dígito tendría que ser ${r.esperado2}, no ${r.digito2}.`);
    if (errores.length) { r.error = errores.join(" "); r.sugerido = d.slice(0, 7) + r.esperado1 + d.slice(8, 21) + r.esperado2; }
    return r;
  }

  // ---------- Patentes y alias ----------
  const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const FORMATOS_PATENTE = [
    { re: /^[A-Z]{2}\d{3}[A-Z]{2}$/, formato: "Mercosur de auto (desde 2016)", fmt: (p) => `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` },
    { re: /^[A-Z]{3}\d{3}$/, formato: "vieja de auto (1995 a 2016)", fmt: (p) => `${p.slice(0, 3)} ${p.slice(3)}` },
    { re: /^[A-Z]\d{3}[A-Z]{3}$/, formato: "Mercosur de moto (desde 2016)", fmt: (p) => `${p[0]} ${p.slice(1, 4)} ${p.slice(4)}` },
    { re: /^\d{3}[A-Z]{3}$/, formato: "vieja de moto (1995 a 2016)", fmt: (p) => `${p.slice(0, 3)} ${p.slice(3)}` },
  ];
  function validarPatente(texto) {
    const p = String(texto).toUpperCase().replace(/[\s.-]/g, "");
    const f = FORMATOS_PATENTE.find((x) => x.re.test(p));
    return f ? { valido: true, patente: p, formateada: f.fmt(p), formato: f.formato } : { valido: false, patente: p };
  }
  function validarAlias(texto) {
    const a = String(texto).trim();
    const errores = [];
    if (a.length < 6 || a.length > 20) errores.push(`tiene que tener entre 6 y 20 caracteres (tiene ${a.length})`);
    const malo = /[^A-Za-z0-9.-]/.exec(a);
    if (malo) errores.push(`solo admite letras sin acento ni ñ, números, punto y guion (sobra «${malo[0]}»)`);
    return { alias: a, valido: !errores.length, error: errores.length ? "El alias " + errores.join(" y ") + "." : null };
  }

  // ---------- DNI según el año de nacimiento ----------
  // Aproximado: el número de DNI crece con los años (los nacidos en 1960 andan por los 12 millones; en 2000, por los 42).
  const DNI_POR_ANIO = [[1940, 3.5e6], [1950, 6e6], [1960, 12.5e6], [1970, 20.5e6], [1980, 27.5e6], [1990, 34.5e6], [2000, 42e6], [2010, 51e6]];
  function interpolar(tabla, x) {
    if (x <= tabla[0][0]) return tabla[0][1];
    for (let i = 1; i < tabla.length; i++) {
      const [x0, y0] = tabla[i - 1], [x1, y1] = tabla[i];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return tabla[tabla.length - 1][1];
  }
  const dniTipico = (anio) => Math.round(interpolar(DNI_POR_ANIO, anio));
  const anioTipico = (dni) => Math.round(interpolar(DNI_POR_ANIO.map(([a, d]) => [d, a]), Number(dni)));

  function validarDni(texto) {
    const d = soloDigitos(texto);
    if (d.length < 7 || d.length > 8) return { valido: false, error: `Un DNI tiene 7 u 8 dígitos y este tiene ${d.length}.` };
    const n = Number(d);
    return {
      valido: true, dni: d, formateado: formatearDni(d), cuilM: formatearCuit(cuilDesdeDni(d, "M")), cuilF: formatearCuit(cuilDesdeDni(d, "F")),
      anio: n >= 1e6 && n < 6e7 ? anioTipico(n) : null,
    };
  }

  /** Detecta qué se pegó (CUIT, CBU, DNI, patente o alias) y lo valida. */
  function analizar(texto) {
    const t = String(texto == null ? "" : texto).trim();
    if (!t) return { tipo: "vacio" };
    const sinSep = t.replace(/[\s.\-/]/g, "");
    if (/^\d+$/.test(sinSep)) {
      if (sinSep.length === 11) return { tipo: "cuit", ...validarCuit(sinSep) };
      if (sinSep.length === 22) return { tipo: "cbu", ...validarCbu(sinSep) };
      if (sinSep.length === 7 || sinSep.length === 8) return { tipo: "dni", ...validarDni(sinSep) };
      return { tipo: "desconocido", valido: false, error: `Son ${sinSep.length} dígitos: un DNI tiene 7 u 8, un CUIT 11 y un CBU 22.` };
    }
    const pat = validarPatente(t);
    if (pat.valido) return { tipo: "patente", ...pat };
    if (/^[A-Za-z0-9]{6,7}$/.test(sinSep) && /\d/.test(sinSep) && /[A-Za-z]/.test(sinSep) && !/[.]/.test(t))
      return { tipo: "patente", ...pat, error: "No es una patente argentina: las de auto son ABC 123 (vieja) o AB 123 CD (Mercosur); las de moto, 123 ABC o A 123 BCD." };
    return { tipo: "alias", ...validarAlias(t) };
  }

  // ---------- Listas propias (nombres comunes, ninguna persona real) ----------
  const NOMBRES = {
    F: [
      ["María Cristina", "Graciela", "Susana", "Marta", "Silvia", "Norma", "Liliana", "Mónica", "Beatriz", "Ana María", "Alicia", "Stella Maris", "Patricia", "Elena", "Rosa", "Mirta", "Nélida", "Teresa", "Cristina", "Adriana"],
      ["Laura", "Andrea", "Carolina", "Valeria", "Mariana", "Gabriela", "Natalia", "Soledad", "Romina", "Florencia", "Paula", "Verónica", "Lorena", "Silvina", "Vanesa", "María José", "Julieta", "Luciana", "Cecilia", "Daniela"],
      ["Sofía", "Martina", "Camila", "Valentina", "Lucía", "Agustina", "Micaela", "Milagros", "Catalina", "Abril", "Delfina", "Josefina", "Candela", "Rocío", "Pilar", "Malena", "Victoria", "Morena", "Zoe", "Guadalupe"],
    ],
    M: [
      ["Carlos", "Jorge", "Juan Carlos", "Roberto", "Héctor", "Raúl", "Rubén", "Osvaldo", "Alberto", "Miguel Ángel", "José Luis", "Hugo", "Ricardo", "Oscar", "Daniel", "Luis", "Mario", "Eduardo", "Néstor", "Norberto"],
      ["Pablo", "Diego", "Martín", "Sebastián", "Gustavo", "Marcelo", "Fernando", "Leandro", "Damián", "Juan Pablo", "Mariano", "Hernán", "Gonzalo", "Federico", "Cristian", "Alejandro", "Javier", "Maximiliano", "Ezequiel", "Nicolás"],
      ["Mateo", "Thiago", "Santiago", "Benjamín", "Joaquín", "Lautaro", "Tomás", "Bautista", "Facundo", "Franco", "Valentín", "Agustín", "Ignacio", "Lucas", "Juan Cruz", "Felipe", "Bruno", "Francisco", "Lisandro", "Ian"],
    ],
  };
  const APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez",
    "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Suárez",
    "Aguirre", "Giménez", "Gutiérrez", "Pereyra", "Rojas", "Molina", "Castro", "Ortiz", "Silva", "Núñez", "Luna", "Juárez",
    "Cabrera", "Ríos", "Ferreyra", "Godoy", "Morales", "Domínguez", "Moreno", "Peralta", "Vega", "Carrizo", "Quiroga",
    "Castillo", "Ledesma", "Muñoz", "Ojeda", "Ponce", "Vera", "Vázquez", "Villalba", "Cardozo", "Navarro", "Ramos", "Arias",
    "Coronel", "Córdoba", "Figueroa", "Correa", "Cáceres", "Vargas", "Maldonado", "Mansilla", "Farías", "Rivero", "Paz",
    "Miranda", "Roldán", "Méndez", "Lucero", "Cruz", "Hernández", "Agüero", "Páez", "Blanco", "Mendoza", "Barrios",
    "Escobar", "Ávila", "Soria", "Leiva", "Acuña", "Maidana", "Moyano", "Campos", "Olivera", "Duarte", "Bustos", "Chávez",
    "Ferrari", "Russo", "Bianchi", "Romano", "Colombo", "Rossi", "Ricci", "Marino", "Greco", "Gallo", "Conti", "Costa",
    "Mancini", "Lombardi", "Fontana", "Moretti", "Rinaldi", "Caruso", "Ferraro", "Giordano", "Iturralde", "Echeverría",
    "Goñi", "Larrañaga", "Etcheverry", "Schmidt", "Müller", "Kowalski", "Nowak", "Haddad", "Nasser"];
  const CALLES = ["San Martín", "Belgrano", "Rivadavia", "Sarmiento", "Mitre", "Moreno", "25 de Mayo", "9 de Julio",
    "Independencia", "Urquiza", "Alberdi", "Lavalle", "Güemes", "Pueyrredón", "Almirante Brown", "Colón", "Italia",
    "España", "Entre Ríos", "Córdoba", "Mendoza", "Tucumán", "Maipú", "Chacabuco", "Las Heras", "Saavedra", "Castelli",
    "Juan José Paso", "French", "Laprida", "Dorrego", "Alsina", "Rodríguez Peña", "Lamadrid", "Pringles", "Necochea",
    "Av. del Libertador", "Av. Mitre", "Av. Rivadavia", "Av. San Martín", "Av. Belgrano", "Hipólito Yrigoyen",
    "Av. Perón", "Leandro N. Alem", "Larrea", "Juan B. Justo", "Garay", "Bolívar", "Suipacha", "Ituzaingó",
    "Av. Pellegrini", "Santa Fe", "Catamarca", "Salta", "Jujuy", "San Lorenzo", "Bartolomé Mitre", "Monteagudo",
    "Azcuénaga", "Viamonte", "Tres de Febrero", "Constitución", "Libertad", "Rioja", "Corrientes", "Avellaneda"];
  // [localidad, provincia, código postal (o rango), característica, peso aproximado por población]
  const LOCALIDADES = [
    ["Ciudad de Buenos Aires", "Ciudad Autónoma de Buenos Aires", [1001, 1439], "11", 30],
    ["San Justo", "Buenos Aires", 1754, "11", 12], ["Quilmes", "Buenos Aires", 1878, "11", 6], ["Lanús", "Buenos Aires", 1824, "11", 5],
    ["Lomas de Zamora", "Buenos Aires", 1832, "11", 6], ["Avellaneda", "Buenos Aires", 1870, "11", 4], ["Morón", "Buenos Aires", 1708, "11", 3],
    ["San Isidro", "Buenos Aires", 1642, "11", 3], ["Tigre", "Buenos Aires", 1648, "11", 3], ["Pilar", "Buenos Aires", 1629, "230", 3],
    ["Merlo", "Buenos Aires", 1722, "220", 3], ["Moreno", "Buenos Aires", 1744, "237", 3], ["La Plata", "Buenos Aires", 1900, "221", 7],
    ["Mar del Plata", "Buenos Aires", 7600, "223", 6], ["Bahía Blanca", "Buenos Aires", 8000, "291", 3], ["Tandil", "Buenos Aires", 7000, "249", 1],
    ["Junín", "Buenos Aires", 6000, "236", 1], ["Pergamino", "Buenos Aires", 2700, "2477", 1], ["Olavarría", "Buenos Aires", 7400, "2284", 1],
    ["Luján", "Buenos Aires", 6700, "2323", 1], ["Necochea", "Buenos Aires", 7630, "2262", 1],
    ["Córdoba", "Córdoba", 5000, "351", 13], ["Río Cuarto", "Córdoba", 5800, "358", 2], ["Villa María", "Córdoba", 5900, "353", 1],
    ["Villa Carlos Paz", "Córdoba", 5152, "3541", 1],
    ["Rosario", "Santa Fe", 2000, "341", 10], ["Santa Fe", "Santa Fe", 3000, "342", 4], ["Rafaela", "Santa Fe", 2300, "3492", 1],
    ["Venado Tuerto", "Santa Fe", 2600, "3462", 1],
    ["Mendoza", "Mendoza", 5500, "261", 4], ["Godoy Cruz", "Mendoza", 5501, "261", 2], ["San Rafael", "Mendoza", 5600, "260", 1],
    ["San Miguel de Tucumán", "Tucumán", 4000, "381", 6], ["Salta", "Salta", 4400, "387", 5], ["San Salvador de Jujuy", "Jujuy", 4600, "388", 3],
    ["Santiago del Estero", "Santiago del Estero", 4200, "385", 3], ["San Fernando del Valle de Catamarca", "Catamarca", 4700, "383", 2],
    ["La Rioja", "La Rioja", 5300, "380", 2], ["San Juan", "San Juan", 5400, "264", 4], ["San Luis", "San Luis", 5700, "266", 2],
    ["Neuquén", "Neuquén", 8300, "299", 3], ["San Carlos de Bariloche", "Río Negro", 8400, "294", 1], ["Viedma", "Río Negro", 8500, "2920", 1],
    ["General Roca", "Río Negro", 8332, "298", 1], ["Santa Rosa", "La Pampa", 6300, "2954", 1],
    ["Paraná", "Entre Ríos", 3100, "343", 3], ["Concordia", "Entre Ríos", 3200, "345", 1], ["Gualeguaychú", "Entre Ríos", 2820, "3446", 1],
    ["Corrientes", "Corrientes", 3400, "379", 3], ["Posadas", "Misiones", 3300, "376", 3], ["Resistencia", "Chaco", 3500, "362", 3],
    ["Formosa", "Formosa", 3600, "370", 2], ["Rawson", "Chubut", 9103, "280", 1], ["Trelew", "Chubut", 9100, "280", 1],
    ["Comodoro Rivadavia", "Chubut", 9000, "297", 1], ["Río Gallegos", "Santa Cruz", 9400, "2966", 1],
    ["Ushuaia", "Tierra del Fuego", 9410, "2901", 1], ["Río Grande", "Tierra del Fuego", 9420, "2964", 1],
  ];
  const PALABRAS_ALIAS = ["mate", "tango", "nube", "rio", "sol", "luna", "faro", "puma", "ceibo", "ombu", "pampa", "sauce",
    "tero", "hornero", "carpincho", "yerba", "dulce", "leche", "alfajor", "medialuna", "bondi", "chacra", "campo", "monte",
    "lago", "isla", "delta", "viento", "lluvia", "trueno", "rayo", "piedra", "arena", "barco", "remo", "tren", "colectivo",
    "plaza", "banco", "farol", "esquina", "patio", "parra", "limon", "naranja", "durazno", "nuez", "trigo", "maiz",
    "girasol", "jacaranda", "tilo", "aromo", "lapacho", "condor", "zorro", "ciervo", "guanaco", "vicuna", "pinguino",
    "ballena", "lobo", "gato", "perro", "loro", "calandria", "zorzal", "benteveo", "chimango", "mesa", "silla", "taza",
    "pava", "bombilla", "termo", "poncho", "boina", "guitarra", "bandoneon", "milonga", "zamba", "chacarera", "truco",
    "envido", "ancho", "basto", "copa", "oro", "espada"];
  const RUBROS = ["Distribuidora", "Metalúrgica", "Lácteos", "Transportes", "Construcciones", "Agropecuaria", "Textil",
    "Logística", "Servicios", "Ferretería", "Panificadora", "Frigorífico", "Bodegas", "Software", "Consultora",
    "Laboratorios", "Inmobiliaria", "Imprenta", "Molinos", "Plásticos", "Maderera", "Autopartes", "Agroquímica", "Ingeniería"];
  const LUGARES = ["del Sur", "del Norte", "del Litoral", "Pampeana", "Andina", "Patagónica", "del Plata", "Cuyana",
    "Mesopotámica", "del Oeste", "Serrana", "del Valle", "Riojana", "Austral", "del Paraná", "Chaqueña", "Puntana"];
  const FANTASIA = ["El Ombú", "Los Aromos", "La Esperanza", "San Jorge", "El Hornero", "Los Ceibos", "La Golondrina",
    "El Trébol", "Tres Lomas", "Las Acacias", "El Calden", "Los Tilos", "Cruz del Sur", "Nueva Era", "Punto Norte",
    "Horizonte", "El Mangrullo", "La Tranquera", "Dos Hermanos", "Altos del Valle"];
  const SOCIEDADES = [["S.A.", 5], ["S.R.L.", 4], ["S.A.S.", 2]];
  // Mails: dominios reservados para ejemplos (RFC 2606), para que un mail de prueba no le llegue a nadie.
  const DOMINIOS = ["example.com", "example.net", "example.org"];

  // ---------- Campos ----------
  // k: clave en JSON/CSV; t: str | int | date; largo: para el VARCHAR; nulo: puede venir vacío.
  const CAMPOS = {
    persona: [
      { k: "id", t: "int", etiqueta: "Id" }, { k: "nombre", t: "str", largo: 60 }, { k: "apellido", t: "str", largo: 60 },
      { k: "sexo", t: "str", largo: 1 }, { k: "dni", t: "str", largo: 10, etiqueta: "DNI" }, { k: "cuil", t: "str", largo: 13, etiqueta: "CUIL" },
      { k: "fechaNacimiento", t: "date", etiqueta: "Nacimiento" }, { k: "email", t: "str", largo: 120 }, { k: "telefono", t: "str", largo: 24, etiqueta: "Teléfono" },
      { k: "calle", t: "str", largo: 80 }, { k: "numero", t: "int", etiqueta: "Número" }, { k: "piso", t: "str", largo: 4, nulo: true },
      { k: "depto", t: "str", largo: 4, nulo: true }, { k: "localidad", t: "str", largo: 60 }, { k: "provincia", t: "str", largo: 60 },
      { k: "codigoPostal", t: "str", largo: 8, etiqueta: "CP" }, { k: "condicionIva", t: "str", largo: 30, etiqueta: "IVA" },
      { k: "banco", t: "str", largo: 60 }, { k: "cbu", t: "str", largo: 22, etiqueta: "CBU" }, { k: "alias", t: "str", largo: 20 },
      { k: "patente", t: "str", largo: 9 },
    ],
    empresa: [
      { k: "id", t: "int", etiqueta: "Id" }, { k: "razonSocial", t: "str", largo: 120, etiqueta: "Razón social" },
      { k: "cuit", t: "str", largo: 13, etiqueta: "CUIT" }, { k: "condicionIva", t: "str", largo: 30, etiqueta: "IVA" },
      { k: "fechaInicio", t: "date", etiqueta: "Inicio de actividades" }, { k: "email", t: "str", largo: 120 },
      { k: "telefono", t: "str", largo: 24, etiqueta: "Teléfono" }, { k: "calle", t: "str", largo: 80 }, { k: "numero", t: "int", etiqueta: "Número" },
      { k: "piso", t: "str", largo: 4, nulo: true }, { k: "depto", t: "str", largo: 4, nulo: true }, { k: "localidad", t: "str", largo: 60 },
      { k: "provincia", t: "str", largo: 60 }, { k: "codigoPostal", t: "str", largo: 8, etiqueta: "CP" },
      { k: "banco", t: "str", largo: 60 }, { k: "cbu", t: "str", largo: 22, etiqueta: "CBU" }, { k: "alias", t: "str", largo: 20 },
      { k: "patente", t: "str", largo: 9 },
    ],
  };
  for (const lista of Object.values(CAMPOS)) for (const c of lista) if (!c.etiqueta) c.etiqueta = c.k[0].toUpperCase() + c.k.slice(1);

  // ---------- Generación ----------
  const MAX_REGISTROS = 10000;
  const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const paraMail = (s) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const dos = (n) => String(n).padStart(2, "0");
  const diasDelMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
  function fechaAlAzar(az, desde, hasta) {
    const a = az.entero(desde, hasta), m = az.entero(1, 12), d = az.entero(1, diasDelMes(a, m));
    return { anio: a, iso: `${a}-${dos(m)}-${dos(d)}` };
  }
  function telefono(az, caract, movil) {
    const largo = 10 - caract.length;
    const abonado = (movil ? az.elegir(["2", "3", "5", "6"]) : "4") + az.digitos(largo - 1);
    const corte = largo - 4;
    return `+54 ${movil ? "9 " : ""}${caract} ${abonado.slice(0, corte)}-${abonado.slice(corte)}`;
  }
  function direccion(az, grande) {
    const loc = az.ponderado(LOCALIDADES, (l) => l[4]);
    const cp = Array.isArray(loc[2]) ? az.entero(loc[2][0], loc[2][1]) : loc[2];
    const calle = az.elegir(CALLES);
    const numero = az.ponderado([[1, 400], [400, 2000], [2000, 6000]], (r) => (r[0] === 400 ? 3 : 1));
    const nro = az.entero(numero[0], numero[1]);
    const depto = az.prob(grande ? 0.45 : 0.15);
    const piso = depto ? (az.prob(0.1) ? "PB" : String(az.entero(1, 14))) : null;
    const letra = depto ? az.elegir(["A", "B", "C", "D", "E", "F", "1", "2", "3", "4"]) : null;
    return { calle, numero: nro, piso, depto: letra, localidad: loc[0], provincia: loc[1], codigoPostal: String(cp), caract: loc[3] };
  }
  function patentes(az) {
    const vieja = az.letras(1, "ABCDEFGHIJKLMNOP".split("")) + az.letras(2) + az.digitos(3);
    const mercosur = "A" + az.letras(1, "ABCDEFGH".split("")) + az.digitos(3) + az.letras(2);
    return { vieja, mercosur, moneda: az.num() };
  }
  function cuentaBancaria(az, usados) {
    for (let i = 0; i < 20; i++) {
      const [entidad] = az.ponderado(BANCOS_PESO, (b) => b[1]);
      const cbu = armarCbu(entidad, az.entero(1, 999), "0" + az.digitos(12));
      let alias = "";
      do alias = [az.elegir(PALABRAS_ALIAS), az.elegir(PALABRAS_ALIAS), az.elegir(PALABRAS_ALIAS)].join(".");
      while (alias.length > 20);
      if (!usados.cbu.has(cbu) && !usados.alias.has(alias)) { usados.cbu.add(cbu); usados.alias.add(alias); return { banco: BANCOS[entidad], cbu, alias }; }
    }
    throw new Error("no pude generar un CBU que no se repita");
  }
  function mailUnico(base, dominio, usados) {
    let m = `${base}@${dominio}`, i = 2;
    while (usados.email.has(m)) m = `${base}${i++}@${dominio}`;
    usados.email.add(m);
    return m;
  }

  function persona(az, usados) {
    const sexo = az.prob(0.5) ? "F" : "M";
    const nac = fechaAlAzar(az, 1945, 2006);
    const epoca = nac.anio < 1970 ? 0 : nac.anio < 1995 ? 1 : 2;
    const nombre = az.elegir(NOMBRES[sexo][epoca]);
    const apellido = az.elegir(APELLIDOS);
    let dni;
    do dni = String(Math.min(59999999, Math.max(1000000, dniTipico(nac.anio + az.num()) + az.entero(-700000, 700000))));
    while (usados.dni.has(dni));
    usados.dni.add(dni);
    const dir = direccion(az, true);
    const n1 = paraMail(nombre.split(" ")[0]), ap = paraMail(apellido);
    const forma = az.entero(0, 4);
    const base = [`${n1}.${ap}`, `${n1}${ap}${dos(nac.anio % 100)}`, `${n1[0]}${ap}`, `${ap}.${n1}`, `${n1}_${ap}${az.entero(1, 99)}`][forma];
    const email = mailUnico(base, az.elegir(DOMINIOS), usados);
    const tel = telefono(az, dir.caract, true);
    const iva = az.ponderado([["Consumidor final", 6], ["Monotributo", 3], ["Responsable inscripto", 1]], (x) => x[1])[0];
    const cuenta = cuentaBancaria(az, usados);
    return { nombre, apellido, sexo, dni, cuil: cuilDesdeDni(dni, sexo), fechaNacimiento: nac.iso, email, telefono: tel,
      calle: dir.calle, numero: dir.numero, piso: dir.piso, depto: dir.depto, localidad: dir.localidad, provincia: dir.provincia,
      codigoPostal: dir.codigoPostal, condicionIva: iva, ...cuenta, _patentes: patentes(az) };
  }

  function razonSocial(az) {
    const tipo = az.ponderado(SOCIEDADES, (s) => s[1])[0];
    const forma = az.entero(0, 4);
    const a1 = az.elegir(APELLIDOS), a2 = az.elegir(APELLIDOS), rubro = az.elegir(RUBROS), lugar = az.elegir(LUGARES), fant = az.elegir(FANTASIA);
    const nombre = [`${rubro} ${lugar}`, `${a1} Hnos.`, `${a1} y ${a2 === a1 ? "Asociados" : a2}`, `${rubro} ${fant}`, `${fant}`][forma];
    return { nombre, razon: `${nombre} ${tipo}` };
  }
  function empresa(az, usados) {
    const rs = razonSocial(az);
    const ini = fechaAlAzar(az, 1965, 2024);
    let cuit;
    do {
      const n = ini.anio < 1995 ? az.entero(50000000, 69999999) : ini.anio < 2008 ? az.entero(70000000, 70999999) : az.entero(71000000, 71899999);
      cuit = cuitEmpresa(n);
    } while (!cuit || usados.cuit.has(cuit));
    usados.cuit.add(cuit);
    const iva = az.ponderado([["Responsable inscripto", 9], ["Exento", 1]], (x) => x[1])[0];
    const dir = direccion(az, false);
    let dom = paraMail(rs.nombre.replace(/\bHnos\.|\by\b/g, ""));
    if (dom.length > 24) dom = dom.slice(0, 24);
    const email = mailUnico(az.elegir(["info", "ventas", "administracion", "contacto", "compras"]), `${dom}.example`, usados);
    const tel = telefono(az, dir.caract, false);
    const cuenta = cuentaBancaria(az, usados);
    return { razonSocial: rs.razon, cuit, condicionIva: iva, fechaInicio: ini.iso, email, telefono: tel,
      calle: dir.calle, numero: dir.numero, piso: dir.piso, depto: dir.depto, localidad: dir.localidad, provincia: dir.provincia,
      codigoPostal: dir.codigoPostal, ...cuenta, _patentes: patentes(az) };
  }

  /**
   * Genera los registros completos (todos los campos).
   * opciones: tipo ("persona" | "empresa"), cantidad, semilla, patentes ("mercosur" | "vieja" | "mezcla"), separadores (bool).
   */
  function generar(opciones) {
    const o = Object.assign({ tipo: "persona", cantidad: 10, semilla: "mate", patentes: "mezcla", separadores: false }, opciones);
    const tipo = o.tipo === "empresa" ? "empresa" : "persona";
    const n = Math.max(0, Math.min(MAX_REGISTROS, Math.floor(Number(o.cantidad) || 0)));
    const usados = { dni: new Set(), cuit: new Set(), cbu: new Set(), alias: new Set(), email: new Set() };
    const fabrica = tipo === "empresa" ? empresa : persona;
    const out = [];
    for (let i = 1; i <= n; i++) {
      const az = crearAzar(`${o.semilla}|${tipo}|${i}`);
      const r = fabrica(az, usados);
      const p = r._patentes; delete r._patentes;
      const cual = o.patentes === "vieja" ? "vieja" : o.patentes === "mercosur" ? "mercosur" : p.moneda < 0.5 ? "vieja" : "mercosur";
      let patente = p[cual];
      if (o.separadores) patente = validarPatente(patente).formateada;
      if (o.separadores) {
        if (r.dni) r.dni = formatearDni(r.dni);
        if (r.cuil) r.cuil = formatearCuit(r.cuil);
        if (r.cuit) r.cuit = formatearCuit(r.cuit);
      }
      out.push({ id: i, ...r, patente });
    }
    return out;
  }
  const proyectar = (registros, campos) => registros.map((r) => Object.fromEntries(campos.map((c) => [c, r[c] === undefined ? null : r[c]])));

  // ---------- Exportar ----------
  const pascal = (k) => k[0].toUpperCase() + k.slice(1);
  const snake = (k) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
  const metaCampos = (tipo, campos) => campos.map((k) => CAMPOS[tipo].find((c) => c.k === k)).filter(Boolean);

  function aJson(registros, campos) { return JSON.stringify(proyectar(registros, campos), null, 2); }

  function aCsv(registros, campos, sep) {
    const s = sep || ",";
    const celda = (v) => {
      if (v == null) return "";
      const t = String(v);
      return t.includes(s) || /["\r\n]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = [campos.map(celda).join(s)];
    for (const r of registros) filas.push(campos.map((c) => celda(r[c])).join(s));
    return filas.join("\r\n") + "\r\n";
  }

  function aSql(registros, campos, opciones) {
    const o = Object.assign({ dialecto: "sqlserver", tabla: "", crear: true, tipo: "persona" }, opciones);
    const pg = o.dialecto === "postgres";
    const meta = metaCampos(o.tipo, campos);
    const tablaBase = (o.tabla || (o.tipo === "empresa" ? "Empresas" : "Personas")).replace(/[^\p{L}\p{N}_.]/gu, "") || "Datos";
    const id = (x) => (pg ? `"${x}"` : `[${x}]`);
    const tabla = pg ? tablaBase.split(".").map((p) => (/^[a-z_][a-z0-9_]*$/.test(p) ? p : id(p))).join(".") : tablaBase.split(".").map(id).join(".");
    const col = (c) => (pg ? snake(c.k) : id(pascal(c.k)));
    const lit = (c, v) => {
      if (v == null) return "NULL";
      if (c.t === "int") return String(Number(v));
      const t = String(v).replace(/'/g, "''");
      return c.t === "str" && !pg ? `N'${t}'` : `'${t}'`;
    };
    const tipoSql = (c) => {
      if (c.t === "int") return pg ? "integer" : "INT";
      if (c.t === "date") return pg ? "date" : "DATE";
      return pg ? `varchar(${c.largo})` : `NVARCHAR(${c.largo})`;
    };
    const out = [];
    if (o.crear) {
      const defs = meta.map((c) => `    ${col(c)} ${tipoSql(c)}${c.k === "id" ? " NOT NULL PRIMARY KEY" : c.nulo ? " NULL" : " NOT NULL"}`);
      out.push(`CREATE TABLE ${tabla} (\n${defs.join(",\n")}\n);\n`);
    }
    if (!pg && registros.length) out.push("SET NOCOUNT ON;\n");
    const cols = meta.map(col).join(", ");
    // SQL Server acepta hasta 1000 filas por cada VALUES: se parte en tandas.
    for (let i = 0; i < registros.length; i += 1000) {
      const tanda = registros.slice(i, i + 1000).map((r) => `    (${meta.map((c) => lit(c, r[c.k])).join(", ")})`);
      out.push(`INSERT INTO ${tabla} (${cols}) VALUES\n${tanda.join(",\n")};\n`);
    }
    return out.join("\n");
  }

  function aCsharp(registros, campos, opciones) {
    const o = Object.assign({ tipo: "persona", clase: "" }, opciones);
    const meta = metaCampos(o.tipo, campos);
    const clase = (o.clase || (o.tipo === "empresa" ? "Empresa" : "Persona")).replace(/[^\p{L}\p{N}_]/gu, "") || "Registro";
    const lista = clase.endsWith("a") || clase.endsWith("o") || clase.endsWith("e") ? clase + "s" : clase + "es";
    const cadena = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
    const tipoCs = (c) => (c.t === "int" ? "int" : c.t === "date" ? "DateOnly" : c.nulo ? "string?" : "string");
    const valor = (c, v) => {
      if (v == null) return c.t === "str" ? "null" : "default";
      if (c.t === "int") return String(Number(v));
      if (c.t === "date") { const [a, m, d] = String(v).split("-").map(Number); return `new DateOnly(${a}, ${m}, ${d})`; }
      return cadena(v);
    };
    const props = meta.map((c) => `    public ${tipoCs(c)} ${pascal(c.k)} { get; init; }${tipoCs(c) === "string" ? ' = "";' : ""}`);
    const items = registros.map((r) => `        new() { ${meta.map((c) => `${pascal(c.k)} = ${valor(c, r[c.k])}`).join(", ")} },`);
    return [
      `// Datos de prueba inventados: ningún DNI, CUIT, CBU ni persona es real.`,
      `public sealed record ${clase}`, `{`, ...props, `}`, ``,
      `public static class DatosDePrueba`, `{`,
      `    public static readonly IReadOnlyList<${clase}> ${lista} = new List<${clase}>`, `    {`, ...items, `    };`, `}`, ``,
    ].join("\n");
  }

  function exportar(formato, registros, campos, opciones) {
    const o = opciones || {};
    if (formato === "csv") return aCsv(registros, campos, o.separador);
    if (formato === "sql") return aSql(registros, campos, o);
    if (formato === "cs") return aCsharp(registros, campos, o);
    return aJson(registros, campos);
  }
  const EXTENSIONES = { json: "json", csv: "csv", sql: "sql", cs: "cs" };

  const api = {
    crearAzar, semillaAlAzar, digitoCuit, cuentaCuit, cuilDesdeDni, cuitEmpresa, formatearCuit, formatearDni, validarCuit,
    digitoCbuBloque1, digitoCbuBloque2, armarCbu, validarCbu, validarPatente, validarAlias, validarDni, analizar,
    dniTipico, anioTipico, generar, proyectar, aJson, aCsv, aSql, aCsharp, exportar,
    CAMPOS, BANCOS, LOCALIDADES, DOMINIOS, MAX_REGISTROS, EXTENSIONES,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.DatosDePrueba = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
