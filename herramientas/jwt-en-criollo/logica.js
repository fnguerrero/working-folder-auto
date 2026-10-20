/* JWT en criollo — decodifica un JWT, explica el header y cada claim en castellano, avisa de las trampas,
   verifica la firma con WebCrypto y arma el C# para validarlo o emitirlo. Sin dependencias; se usa desde la
   página y desde los tests (Node 22 trae WebCrypto en globalThis.crypto). */
(function (raiz) {
  "use strict";

  class ErrorJwt extends Error { constructor(msg) { super(msg); this.name = "ErrorJwt"; } }
  const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
  const te = new TextEncoder();

  // ---------- base64url ----------
  function b64urlABytes(s) {
    const malo = /[^A-Za-z0-9_-]/.exec(s);
    if (malo) throw new ErrorJwt(`no es base64url: el carácter «${malo[0] === " " ? "espacio" : malo[0]}» en la posición ${malo.index + 1}${malo[0] === "=" ? " (los JWT van sin relleno «=»)" : malo[0] === "+" || malo[0] === "/" ? " (eso es base64 común, no base64url: va «-» y «_»)" : ""}`);
    if (s.length % 4 === 1) throw new ErrorJwt("no es base64url: le falta o le sobra un carácter");
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesAB64url(bytes) {
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlATexto(s) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(b64urlABytes(s)); }
    catch (e) { if (e instanceof ErrorJwt) throw e; throw new ErrorJwt("decodifica a bytes que no son UTF-8"); }
  }
  function textoAB64url(t) { return bytesAB64url(te.encode(t)); }
  function hexABytes(h) {
    const limpio = h.replace(/[\s:]/g, "");
    if (!/^[0-9a-fA-F]*$/.test(limpio) || limpio.length % 2) throw new ErrorJwt("no es hexadecimal");
    const out = new Uint8Array(limpio.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(limpio.substr(i * 2, 2), 16);
    return out;
  }
  function b64ABytes(s) {
    const limpio = s.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) throw new ErrorJwt("no es base64");
    const bin = atob(limpio); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------- limpiar y decodificar ----------
  /** Saca lo que suele venir pegado alrededor del token: «Authorization: Bearer …», comillas, JSON con access_token, cookies. */
  function limpiar(texto) {
    let t = String(texto || "").trim();
    const json = /"(?:access_token|id_token|token|refresh_token)"\s*:\s*"([^"]+)"/.exec(t);
    if (json) t = json[1];
    t = t.replace(/^authorization\s*:\s*/i, "").replace(/^bearer\s+/i, "").trim();
    t = t.replace(/^['"`]+|['"`,;]+$/g, "");
    const cookie = /(?:^|[;\s])[\w.-]+=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)/.exec(t);
    if (cookie && !/^[A-Za-z0-9_-]+\./.test(t)) t = cookie[1];
    return t.replace(/\s+/g, "");
  }

  /** Decodifica sin validar nada. Devuelve { tipo: "JWS"|"JWE", header, payload, firma, partes, bytes, datosFirmados }. */
  function decodificar(tokenCrudo) {
    const token = limpiar(tokenCrudo);
    if (!token) throw new ErrorJwt("Pegá un token.");
    const partes = token.split(".");
    if (partes.length !== 3 && partes.length !== 5) {
      throw new ErrorJwt(partes.length === 1 ? "No tiene puntos. Un JWT firmado son tres partes en base64url separadas por punto: header.payload.firma." : `Tiene ${partes.length} partes separadas por punto. Un JWT firmado (JWS) tiene 3 (header.payload.firma) y uno cifrado (JWE) tiene 5.`);
    }
    const tipo = partes.length === 3 ? "JWS" : "JWE";
    let headerRaw, header;
    try { headerRaw = b64urlATexto(partes[0]); } catch (e) { throw new ErrorJwt(`El header (primera parte) ${e.message}.`); }
    try { header = JSON.parse(headerRaw); } catch { throw new ErrorJwt(`El header no es JSON: decodifica a «${recortar(headerRaw, 60)}».`); }
    if (!header || typeof header !== "object" || Array.isArray(header)) throw new ErrorJwt("El header decodifica a JSON pero no es un objeto.");
    const r = { token, tipo, partes, header, headerRaw, bytes: token.length, payload: null, payloadRaw: null, payloadEsJson: false, firma: null, datosFirmados: null };
    if (tipo === "JWE") {
      r.cifrado = { claveCifrada: partes[1], iv: partes[2], textoCifrado: partes[3], tag: partes[4] };
      return r;
    }
    try { r.payloadRaw = b64urlATexto(partes[1]); } catch (e) { throw new ErrorJwt(`El payload (segunda parte) ${e.message}.`); }
    try { const p = JSON.parse(r.payloadRaw); if (p && typeof p === "object" && !Array.isArray(p)) { r.payload = p; r.payloadEsJson = true; } } catch { /* payload que no es JSON: un JWS cualquiera */ }
    try { r.firma = b64urlABytes(partes[2]); } catch (e) { throw new ErrorJwt(`La firma (tercera parte) ${e.message}.`); }
    r.datosFirmados = partes[0] + "." + partes[1];
    return r;
  }
  function recortar(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }

  // ---------- fechas ----------
  const ZONA = "America/Argentina/Buenos_Aires";
  function formatearFecha(epochSeg) {
    const d = new Date(epochSeg * 1000);
    if (isNaN(d.getTime())) return "fecha inválida";
    try {
      const f = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      return f.format(d).replace(/,?\s+(\d\d:\d\d:\d\d)/, " $1").replace(/^(\w+),? /, "$1 ");
    } catch { return d.toISOString(); }
  }
  function esEpochPlausible(v) { return typeof v === "number" && isFinite(v) && v > 946684800 && v < 4102444800; }
  /** "en 14 min", "hace 3 días y 2 h", "ahora". */
  function relativo(seg) {
    const s = Math.round(seg); const a = Math.abs(s);
    if (a < 1) return "ahora mismo";
    const u = [["año", "años", 31536000], ["mes", "meses", 2592000], ["día", "días", 86400], ["h", "h", 3600], ["min", "min", 60], ["s", "s", 1]];
    const trozos = []; let resto = a;
    for (const [sing, plur, k] of u) { const q = Math.floor(resto / k); if (q) { trozos.push(q + " " + (q === 1 ? sing : plur)); resto -= q * k; } if (trozos.length === 2) break; }
    const txt = trozos.join(" y ");
    return s > 0 ? "en " + txt : "hace " + txt;
  }
  function duracion(seg) { return relativo(Math.abs(seg)).replace(/^en /, ""); }

  // ---------- estado (exp / nbf) ----------
  /** ahora en segundos epoch; skewSeg = ClockSkew (ASP.NET usa 5 minutos por defecto). */
  function estado(payload, ahora, skewSeg) {
    const skew = skewSeg == null ? 300 : skewSeg;
    const r = { estado: "sin-exp", texto: "", exp: null, nbf: null, iat: null, vida: null };
    if (!payload) return r;
    const num = (k) => (typeof payload[k] === "number" && isFinite(payload[k]) ? payload[k] : null);
    r.exp = num("exp"); r.nbf = num("nbf"); r.iat = num("iat");
    const desde = r.nbf != null ? r.nbf : r.iat;
    if (r.exp != null && r.exp > 1e11) { r.estado = "ms"; r.texto = `exp está en milisegundos: .NET lo lee como el año ${new Date(r.exp * 1000).getUTCFullYear() > 9999 ? "9999" : new Date(r.exp * 1000).getUTCFullYear()}, así que nunca vence.`; return r; }
    if (r.exp != null && desde != null && r.exp > desde) r.vida = r.exp - desde;
    if (r.nbf != null && r.nbf > ahora) {
      r.estado = r.nbf - ahora <= skew ? "pronto" : "todavia-no";
      r.texto = r.estado === "pronto" ? `Todavía no vale (empieza ${relativo(r.nbf - ahora)}), pero entra dentro del ClockSkew de ${Math.round(skew / 60)} min: ASP.NET lo acepta.` : `Todavía no vale: empieza a valer ${relativo(r.nbf - ahora)} (nbf).`;
      return r;
    }
    if (r.exp == null) { r.texto = "No tiene exp: no vence nunca. Un token sin vencimiento es una llave que no se puede retirar."; return r; }
    if (r.exp > ahora) { r.estado = "vigente"; r.texto = `Vigente: vence ${relativo(r.exp - ahora)}.`; }
    else if (ahora - r.exp <= skew) { r.estado = "gracia"; r.texto = `Venció ${relativo(r.exp - ahora)}, pero ASP.NET todavía lo acepta por el ClockSkew de ${Math.round(skew / 60)} minutos por defecto (TokenValidationParameters.ClockSkew).`; }
    else { r.estado = "vencido"; r.texto = `Vencido: venció ${relativo(r.exp - ahora)}.`; }
    return r;
  }

  // ---------- diccionario de claims ----------
  const URI_NET = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "ClaimTypes.NameIdentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "ClaimTypes.Name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "ClaimTypes.Email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "ClaimTypes.GivenName",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname": "ClaimTypes.Surname",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn": "ClaimTypes.Upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/dateofbirth": "ClaimTypes.DateOfBirth",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone": "ClaimTypes.MobilePhone",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/country": "ClaimTypes.Country",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid": "ClaimTypes.Sid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "ClaimTypes.Role",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid": "ClaimTypes.GroupSid",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod": "ClaimTypes.AuthenticationMethod",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationinstant": "ClaimTypes.AuthenticationInstant",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/expiration": "ClaimTypes.Expiration",
    "http://schemas.microsoft.com/identity/claims/objectidentifier": "«oid» de Entra ID (mapeado)",
    "http://schemas.microsoft.com/identity/claims/tenantid": "«tid» de Entra ID (mapeado)",
    "http://schemas.microsoft.com/identity/claims/scope": "«scp» de Entra ID (mapeado)",
  };
  // Lo que Microsoft.IdentityModel renombra al entrar (MapInboundClaims = true, el default): nombre corto → ClaimTypes.*
  const MAPA_ENTRADA = { sub: "ClaimTypes.NameIdentifier", nameid: "ClaimTypes.NameIdentifier", unique_name: "ClaimTypes.Name", email: "ClaimTypes.Email", given_name: "ClaimTypes.GivenName", family_name: "ClaimTypes.Surname", role: "ClaimTypes.Role", roles: "ClaimTypes.Role", upn: "ClaimTypes.Upn", birthdate: "ClaimTypes.DateOfBirth", gender: "ClaimTypes.Gender", website: "ClaimTypes.Webpage", oid: "la URI larga «…/identity/claims/objectidentifier»", tid: "la URI larga «…/identity/claims/tenantid»", scp: "la URI larga «…/identity/claims/scope»", amr: "la URI larga «…/claims/authnmethodsreferences»", acr: "la URI larga «…/claims/authnclassreference»", idp: "la URI larga «…/identity/claims/identityprovider»", actort: "ClaimTypes.Actor" };

  const CLAIMS = {
    iss: (v) => `Quién lo emitió (issuer). Tu API tiene que exigir exactamente este valor: si lo firma otro emisor con una clave válida, no sirve. ${/^https?:\/\//.test(v) ? "Es una URL: casi seguro publica sus claves en «" + v.replace(/\/$/, "") + "/.well-known/openid-configuration» y alcanza con poner Authority." : "No es una URL: lo validás con ValidIssuer y la clave la tenés que tener vos."}`,
    sub: () => "A quién identifica (subject): el id del usuario o de la aplicación. Tiene que ser estable y único dentro del emisor; no uses el mail para esto, cambia.",
    aud: (v) => `Para quién es (audience). Tu API tiene que estar acá${Array.isArray(v) ? " (puede ser una lista; con que uno coincida alcanza)" : ""}; si no, lo tiene que rechazar aunque la firma sea válida. Es lo que evita que un token sacado para otra app se use en la tuya.`,
    exp: (v, c) => `Vence el ${formatearFecha(v)} (hora argentina)${c.ahora != null ? ", " + relativo(v - c.ahora) : ""}.`,
    nbf: (v, c) => `No vale antes del ${formatearFecha(v)} (hora argentina)${c.ahora != null ? ", " + relativo(v - c.ahora) : ""} (not before).`,
    iat: (v, c) => `Emitido el ${formatearFecha(v)} (hora argentina)${c.ahora != null ? ", " + relativo(v - c.ahora) : ""} (issued at).`,
    jti: () => "Id único del token (JWT ID). Sirve para revocarlo antes de que venza (lista de negados) o para que no se use dos veces.",
    typ: (v) => `Tipo declarado en el payload: «${v}».${/^bearer$/i.test(v) ? " Keycloak lo pone en sus access tokens." : v === "Refresh" || v === "Offline" ? " Un refresh token de Keycloak: no es para mandar a la API." : ""}`,
    azp: () => "La app a la que se le emitió (authorized party): el client_id que lo pidió. En un id_token con una sola audiencia suele coincidir con aud.",
    scope: (v) => `Permisos (scopes) concedidos, separados por espacio: ${listar(String(v).split(/\s+/).filter(Boolean))}. En .NET llegan como un solo claim «scope» con el texto entero: para chequear uno hay que partirlo.`,
    scp: (v) => `Scopes delegados (Entra ID): ${listar(String(v).split(/\s+/).filter(Boolean))}. Son permisos de la app actuando por el usuario. Con el mapeo por defecto de .NET llega como «http://schemas.microsoft.com/identity/claims/scope».`,
    roles: (v) => `Roles de la aplicación: ${listar(arr(v))}. Con el mapeo por defecto de .NET llega como ClaimTypes.Role, así que [Authorize(Roles = "…")] anda; sin mapeo hay que poner RoleClaimType = "roles".`,
    role: (v) => `Rol o roles: ${listar(arr(v))}. Con el mapeo por defecto de .NET llega como ClaimTypes.Role.`,
    groups: (v) => `Grupos a los que pertenece: ${listar(arr(v))}. En Entra son ids de grupo (GUID); si hay más de 200 el token no los trae y pone «hasgroups» o un link a Graph.`,
    permissions: (v) => `Permisos (Auth0 con RBAC): ${listar(arr(v))}. Son los de la API (audiencia), no scopes del usuario.`,
    name: () => "Nombre para mostrar. OJO: con el mapeo por defecto de .NET este claim NO se convierte en ClaimTypes.Name (el que se mapea es «unique_name»), así que User.Identity.Name sale null salvo que pongas NameClaimType = \"name\".",
    unique_name: () => "Nombre de usuario (claim de Microsoft). Con el mapeo por defecto de .NET es el que llega como ClaimTypes.Name, o sea User.Identity.Name.",
    preferred_username: () => "Nombre de usuario preferido (OIDC): puede cambiar, no lo uses como id. En Entra v2 y Keycloak es el login o el mail.",
    email: () => "Mail del usuario. No es un identificador estable (puede cambiar) y es dato personal: queda en los logs de cualquiera que registre el token.",
    email_verified: (v) => (v ? "El emisor verificó el mail." : "El emisor NO verificó este mail: no lo uses para vincular cuentas."),
    given_name: () => "Nombre de pila.", family_name: () => "Apellido.", middle_name: () => "Segundo nombre.", nickname: () => "Apodo.",
    picture: () => "URL de la foto de perfil.", locale: () => "Idioma y región del usuario.", zoneinfo: () => "Zona horaria del usuario.", updated_at: () => "Cuándo se actualizó el perfil.",
    phone_number: () => "Teléfono. Dato personal: pensá si hace falta en el token.", phone_number_verified: () => "Si el emisor verificó el teléfono.",
    address: () => "Dirección postal. Dato personal: casi nunca hace falta en un token.",
    birthdate: () => "Fecha de nacimiento. Dato personal.", gender: () => "Género. Dato personal.",
    nonce: () => "Valor que tu app mandó al pedir la autorización (OIDC). Tiene que coincidir con el que guardaste: es lo que evita que te metan un id_token de otra sesión (replay).",
    auth_time: (v, c) => `Cuándo el usuario se autenticó de verdad (puso la clave): ${formatearFecha(v)}${c.ahora != null ? ", " + relativo(v - c.ahora) : ""}. Sirve para pedir re-login en operaciones sensibles (max_age).`,
    acr: (v) => `Nivel de autenticación (authentication context class): «${v}».${v === "0" ? " Cero quiere decir que no cumplió ISO 29115 nivel 1, o sea cualquier método." : v === "1" ? " Keycloak lo pone en 1 con usuario y clave." : ""}`,
    amr: (v) => `Cómo se autenticó (authentication methods): ${listar(arr(v).map((m) => AMR[m] || m))}. Si tu operación exige MFA, acá lo chequeás.`,
    sid: () => "Id de la sesión en el emisor. Sirve para el logout global (back-channel logout).",
    session_state: () => "Id de sesión de Keycloak (lo mismo que sid en versiones viejas).",
    at_hash: () => "Hash del access token que vino junto con este id_token: permite chequear que son del mismo par.",
    c_hash: () => "Hash del código de autorización: el id_token del flujo híbrido lo trae para atar código y token.",
    tid: () => "Tenant (directorio) de Entra ID en el que se autenticó el usuario. Si tu app es multi-tenant, acá decidís si lo dejás entrar.",
    oid: () => "Id del objeto en Entra ID: el identificador estable del usuario en ese tenant. «sub» en Entra cambia por aplicación; si querés el mismo usuario en varias apps, usá oid (más tid).",
    upn: () => "User principal name de Entra: parece un mail pero es el nombre de login. Puede cambiar; para identificar usá oid.",
    appid: () => "Client id de la app que pidió el token (Entra v1; en v2 es azp).",
    appidacr: (v) => `Cómo se autenticó la app: ${{ "0": "0 = cliente público, sin secreto", "1": "1 = con client secret", "2": "2 = con certificado" }[String(v)] || v}.`,
    azpacr: (v) => `Cómo se autenticó el cliente (Entra v2): ${{ "0": "0 = cliente público, sin secreto", "1": "1 = con client secret", "2": "2 = con certificado" }[String(v)] || v}.`,
    ver: (v) => `Versión del formato del token de Entra: «${v}».${String(v) === "1.0" ? " Los v1 tienen iss login.microsoftonline.com/<tid>/ sin v2.0 y traen appid en vez de azp." : ""}`,
    idp: () => "Proveedor de identidad con el que se autenticó (Entra). Si no está, es el propio tenant.",
    aio: () => "Interno de Entra (para su caché); ignoralo.", uti: () => "Id interno de la solicitud en Entra (para soporte); ignoralo.", rh: () => "Interno de Entra (refresh); ignoralo.",
    wids: () => "Ids de roles de directorio de Entra (p. ej. Global Administrator). No son roles de tu app.",
    xms_tcdt: () => "Fecha de creación del tenant (Entra).", xms_st: () => "Interno de Entra.", xms_cc: () => "Capacidades del cliente (Entra, CAE).",
    realm_access: (v) => `Roles de realm de Keycloak: ${listar(arr(v && v.roles))}. No llegan como ClaimTypes.Role porque están anidados en JSON: hay que mapearlos con un IClaimsTransformation o en OnTokenValidated.`,
    resource_access: (v) => `Roles por cliente de Keycloak: ${Object.keys(v || {}).map((k) => k + " → " + listar(arr(v[k] && v[k].roles))).join("; ") || "ninguno"}. Anidados: para [Authorize(Roles)] hay que aplanarlos (o usar el mapper «client roles» en el claim «roles»).`,
    "allowed-origins": (v) => `Orígenes permitidos para CORS según Keycloak: ${listar(arr(v))}. Informativo; el CORS lo decide tu API.`,
    gty: (v) => `Tipo de grant (Auth0): «${v}».${v === "client-credentials" ? " Lo pidió una app, no un usuario: no va a tener claims de persona." : ""}`,
    org_id: () => "Organización (Auth0 Organizations).",
    user_id: () => "Id del usuario (Firebase lo repite en sub).",
    firebase: (v) => `Datos de Firebase Auth: se autenticó con «${(v && v.sign_in_provider) || "?"}».`,
    hd: (v) => `Dominio de Google Workspace: «${v}». Si querés dejar entrar solo a tu empresa, chequeá este claim, no el final del mail.`,
    cnf: () => "Confirmación de posesión (RFC 7800): el token está atado a una clave o certificado del cliente (mTLS / DPoP). Un bearer robado no alcanza.",
    client_id: () => "Client id de la app (RFC 9068). Lo mismo que azp en OIDC.",
    entitlements: (v) => `Permisos (entitlements): ${listar(arr(v))}.`,
    events: () => "Eventos de seguridad (SET / back-channel logout). No es un token de acceso.",
    act: () => "Actor: otra parte está actuando en nombre del sub (delegación, RFC 8693).",
    may_act: () => "Quién puede actuar en nombre de este sujeto (RFC 8693).",
  };
  const AMR = { pwd: "pwd (clave)", mfa: "mfa (segundo factor)", otp: "otp (código de un solo uso)", sms: "sms", fido: "fido (llave física)", hwk: "hwk (llave de hardware)", rsa: "rsa (certificado)", face: "face (reconocimiento facial)", fpt: "fpt (huella)", wia: "wia (Windows integrada)", ngcmfa: "ngcmfa (Windows Hello con MFA)", pop: "pop (prueba de posesión)" };
  function arr(v) { return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]; }
  function listar(xs) { return xs.length ? xs.map((x) => "«" + x + "»").join(", ") : "ninguno"; }
  const PII = { dni: "DNI", cuil: "CUIL", cuit: "CUIT", documento: "documento", nro_documento: "documento", numero_documento: "documento", telefono: "teléfono", phone: "teléfono", celular: "celular", direccion: "dirección", domicilio: "domicilio", address: "dirección", birthdate: "fecha de nacimiento", fecha_nacimiento: "fecha de nacimiento", salario: "salario", sueldo: "sueldo", tarjeta: "tarjeta", cbu: "CBU", alias: "alias bancario", obra_social: "obra social", email: "mail" };
  const SECRETOS = /^(password|pass|pwd|clave|contrase[nñ]a|secret|secreto|api[_-]?key|apikey|client_secret|token|access_token|refresh_token|hash|salt|pin)$/i;

  /** Explica cada claim del payload. ctx: { ahora }. Devuelve [{ clave, valor, texto, nivel, netMapeado }]. */
  function explicarClaims(payload, ctx) {
    const c = ctx || {}; const out = [];
    for (const clave of Object.keys(payload || {})) {
      const v = payload[clave]; let texto, nivel = "info";
      const largo = URI_NET[clave];
      if (largo) {
        texto = `Nombre largo de .NET: es ${largo}. Lo emitió una API .NET que armó los claims con ClaimTypes.* y un handler que no los acorta (JsonWebTokenHandler, el default desde .NET 8). Cualquier cliente que no sea .NET lo va a leer con esta URI de 60 caracteres. Al emitir, usá los nombres cortos (JwtRegisteredClaimNames.Sub, "role", "name").`;
        nivel = "medio";
      } else if (CLAIMS[clave]) {
        try { texto = CLAIMS[clave](v, c); } catch { texto = ""; }
        if ((clave === "exp" || clave === "nbf" || clave === "iat" || clave === "auth_time") && typeof v !== "number") { texto = `Tiene que ser un número (segundos desde 1970, NumericDate) y es ${typeof v === "string" ? "un texto" : typeof v}: los validadores lo rechazan o lo ignoran.`; nivel = "mal"; }
        else if ((clave === "exp" || clave === "nbf" || clave === "iat" || clave === "auth_time") && typeof v === "number" && v > 1e11) { texto = `Parece estar en milisegundos (${v}). El estándar son segundos: .NET lo lee como el año ${new Date(v * 1000).getUTCFullYear() > 9999 ? "9999 o más" : new Date(v * 1000).getUTCFullYear()}, así que ${clave === "exp" ? "nunca vence" : "la fecha no sirve"}.`; nivel = "mal"; }
      } else if (/^https?:\/\//.test(clave)) {
        texto = "Claim con nombre de URL (namespaced): así obliga Auth0 a nombrar los claims propios para que no choquen con los estándar. En .NET llega con el nombre completo.";
      } else if (SECRETOS.test(clave)) {
        texto = "Esto no va en un token: el payload es base64, cualquiera que lo tenga lo lee. Un secreto acá es un secreto publicado."; nivel = "mal";
      } else if (PII[clave.toLowerCase()]) {
        texto = `Parece ${PII[clave.toLowerCase()]}: dato personal. El token viaja en cada request y queda en logs, proxies y navegadores; si la API no lo necesita en cada llamada, no lo metas.`; nivel = "medio";
      } else {
        texto = "Claim propio del emisor: .NET lo deja tal cual en User.Claims con este nombre.";
      }
      out.push({ clave, valor: v, texto, nivel, netMapeado: MAPA_ENTRADA[clave] || null });
    }
    return out;
  }

  // ---------- header ----------
  const ALGS = {
    HS256: ["HMAC con SHA-256", "simetrico"], HS384: ["HMAC con SHA-384", "simetrico"], HS512: ["HMAC con SHA-512", "simetrico"],
    RS256: ["RSA PKCS#1 v1.5 con SHA-256", "asimetrico"], RS384: ["RSA PKCS#1 v1.5 con SHA-384", "asimetrico"], RS512: ["RSA PKCS#1 v1.5 con SHA-512", "asimetrico"],
    PS256: ["RSA-PSS con SHA-256", "asimetrico"], PS384: ["RSA-PSS con SHA-384", "asimetrico"], PS512: ["RSA-PSS con SHA-512", "asimetrico"],
    ES256: ["ECDSA con la curva P-256 y SHA-256", "asimetrico"], ES384: ["ECDSA con P-384 y SHA-384", "asimetrico"], ES512: ["ECDSA con P-521 y SHA-512", "asimetrico"], ES256K: ["ECDSA con secp256k1 (la de Bitcoin)", "asimetrico"],
    EdDSA: ["Ed25519 o Ed448", "asimetrico"], none: ["sin firma", "ninguno"],
  };
  function explicarHeader(header, tipo) {
    const out = [];
    for (const clave of Object.keys(header)) {
      const v = header[clave]; let texto = "", nivel = "info";
      switch (clave) {
        case "alg": {
          const a = ALGS[v];
          if (v === "none") { texto = "Sin firma. Cualquiera puede escribir el payload que quiera. Ningún validador serio lo acepta (.NET lo rechaza salvo que lo habilites a mano con ValidAlgorithms o RequireSignedTokens = false)."; nivel = "mal"; }
          else if (!a) { texto = `Algoritmo desconocido «${v}». Si no está en la lista de la RFC 7518, ningún validador lo va a aceptar.`; nivel = "mal"; }
          else if (tipo === "JWE") texto = `Cómo se cifró la clave de contenido: ${v}.`;
          else if (a[1] === "simetrico") texto = `${a[0]}: la misma clave firma y verifica. Sirve cuando el que emite y el que valida son vos (tu API). Si hay otro que valida, tiene tu clave y puede emitir tokens: ahí va RS256 o ES256.`;
          else texto = `${a[0]}: firma con la clave privada del emisor y cualquiera valida con la pública. Es lo que usan Entra ID, Keycloak, Auth0, Google y Firebase; la pública se baja del JWKS del emisor.${v.startsWith("ES") ? " La firma es corta (r‖s) y la validación es rápida." : v.startsWith("PS") ? " PSS es la variante moderna de RSA; .NET la soporta desde Core 2.1." : ""}`;
          break;
        }
        case "typ": texto = v === "JWT" ? "Tipo: JWT. Es el valor de siempre." : /^at\+jwt$/i.test(v) ? "Tipo «at+jwt»: access token según la RFC 9068. Un validador estricto puede rechazar un id_token mandado como access token (y al revés)." : /^jwt$/i.test(v) ? "Tipo JWT en minúsculas: vale, el campo no distingue mayúsculas." : `Tipo «${v}». Si tu validador fija ValidTypes, tiene que estar.`; break;
        case "kid": texto = `Id de la clave con la que se firmó: «${v}». El validador busca esta clave en el JWKS del emisor (y si no la encuentra, Microsoft.IdentityModel vuelve a bajar el JWKS una vez: así rotan claves sin cortar nada).`; break;
        case "cty": texto = v === "JWT" ? "Contenido: otro JWT adentro (anidado). Lo de adentro hay que decodificarlo de nuevo." : `Tipo del contenido: «${v}».`; break;
        case "jku": texto = `URL de donde bajar las claves: «${v}». NUNCA la uses para validar: el que arma el token elige la URL y te hace confiar en sus propias claves. .NET la ignora; la URL del JWKS sale de tu configuración, no del token.`; nivel = "mal"; break;
        case "x5u": texto = `URL del certificado: «${v}». Lo mismo que jku: no confiar, viene del token.`; nivel = "mal"; break;
        case "jwk": texto = "El token trae la clave pública adentro. Verificar la firma con esta clave no prueba nada (el atacante firma con su clave y la pega acá, CVE-2018-0114). Solo sirve si la comparás con una clave que ya tenés."; nivel = "mal"; break;
        case "x5c": texto = `Cadena de certificados en el header (${Array.isArray(v) ? v.length : 1}). Verificar con el primero solo dice que el token es consistente consigo mismo; para confiar hay que validar la cadena contra una CA que conozcas. Abajo podés probarlo igual.`; nivel = "medio"; break;
        case "x5t": texto = `Huella SHA-1 del certificado de firma (Entra la manda junto con kid).`; break;
        case "x5t#S256": texto = `Huella SHA-256 del certificado de firma.`; break;
        case "crit": texto = `Extensiones críticas: ${listar(arr(v))}. Si tu validador no las entiende, tiene que rechazar el token.`; nivel = "medio"; break;
        case "enc": texto = `Cómo está cifrado el contenido: ${v}. ${{ A256GCM: "AES-256-GCM.", A128GCM: "AES-128-GCM.", "A128CBC-HS256": "AES-128-CBC con HMAC-SHA-256.", "A256CBC-HS512": "AES-256-CBC con HMAC-SHA-512." }[v] || ""}`; break;
        case "zip": texto = `Contenido comprimido con ${v} antes de cifrar.`; break;
        case "nonce": texto = "Nonce del header (Entra lo usa en algunos tokens de Graph: no están pensados para que tu API los valide, y la firma no cierra si no se procesa el nonce)."; nivel = "medio"; break;
        case "ver": texto = `Versión: ${v}.`; break;
        default: texto = "Parámetro del header que no está en la lista estándar; los validadores lo ignoran.";
      }
      out.push({ clave, valor: v, texto, nivel });
    }
    return out;
  }

  // ---------- avisos ----------
  function avisos(dec, ctx) {
    const c = Object.assign({ ahora: Math.floor(Date.now() / 1000), skew: 300 }, ctx);
    const out = []; const h = dec.header; const p = dec.payload;
    const mal = (t, x) => out.push({ nivel: "mal", titulo: t, texto: x }); const medio = (t, x) => out.push({ nivel: "medio", titulo: t, texto: x }); const info = (t, x) => out.push({ nivel: "info", titulo: t, texto: x }); const ok = (t, x) => out.push({ nivel: "ok", titulo: t, texto: x });
    if (dec.tipo === "JWE") { info("Es un JWE: está cifrado", "El contenido no se puede leer sin la clave privada del destinatario. Si te lo da Entra ID para Graph o para otra API, no es tuyo para validar: es para que lo pases. .NET lo abre con TokenDecryptionKey."); return out; }
    if (h.alg === "none") mal("alg: none", "Sin firma. Si tu validador lo acepta, cualquiera entra como admin escribiendo el payload a mano. ASP.NET lo rechaza por defecto (IDX10504); no toques RequireSignedTokens.");
    if (h.alg && !ALGS[h.alg]) mal("Algoritmo desconocido", `«${h.alg}» no es ninguno de la RFC 7518.`);
    if (!h.alg) mal("Sin alg", "El header no dice con qué se firmó. Ningún validador lo acepta.");
    if (h.jwk) mal("Trae su propia clave (jwk)", "Un token que te dice con qué clave verificarlo se verifica solo. La clave tiene que venir de tu configuración o del JWKS del emisor que vos configuraste.");
    if (h.jku || h.x5u) mal("URL de claves en el header (jku / x5u)", "No bajes claves de una URL que eligió el que armó el token. .NET las ignora; dejalo así.");
    if (!dec.payloadEsJson) { medio("El payload no es JSON", "Es un JWS con contenido crudo, no un JWT. Si esperabas claims, el emisor armó mal el token."); return out; }
    const e = estado(p, c.ahora, c.skew);
    if (e.estado === "sin-exp") mal("Sin exp", "No vence nunca. Si se filtra, vale para siempre; no hay forma de retirarlo sin cambiar la clave. Un access token suele durar entre 5 minutos y una hora. En ASP.NET, RequireExpirationTime = true (el default) lo rechaza (IDX10225).");
    else if (e.estado === "vencido") mal("Vencido", e.texto + " ASP.NET lo rechaza con IDX10223 y responde 401 con el header WWW-Authenticate: Bearer error=\"invalid_token\", error_description=\"The token expired at…\".");
    else if (e.estado === "gracia") medio("Venció hace poco", e.texto + " Si eso te molesta, bajá ClockSkew a un minuto (no a cero: dos relojes nunca coinciden).");
    else if (e.estado === "todavia-no") medio("Todavía no vale (nbf)", e.texto + " ASP.NET responde IDX10222. Suele ser un reloj adelantado en el emisor.");
    else if (e.estado === "pronto") info("nbf dentro del ClockSkew", e.texto);
    else if (e.estado === "ms") mal("No vence nunca (exp en milisegundos)", e.texto);
    else ok("Vigente", e.texto);
    if (e.vida != null) {
      const esRefresh = /refresh|offline/i.test(String(p.typ || ""));
      if (e.vida > 86400 * 30 && !esRefresh) mal("Dura demasiado", `Vale ${duracion(e.vida)}. Un bearer token robado sirve todo ese tiempo y no hay revocación en un JWT. Para sesiones largas: access token corto más refresh token que sí se puede revocar.`);
      else if (e.vida > 86400 && !esRefresh) medio("Dura más de un día", `Vale ${duracion(e.vida)}. Para un access token es mucho: entre 5 minutos y una hora es lo habitual, con refresh token para renovar.`);
      else if (e.vida <= 60 && e.estado !== "sin-exp") medio("Dura muy poco", `Vale ${duracion(e.vida)}. Con el ClockSkew de 5 minutos por defecto, ASP.NET lo va a aceptar hasta 5 minutos después de vencido, más que lo que dura.`);
    }
    if (p.exp != null && p.iat != null && typeof p.exp === "number" && typeof p.iat === "number" && p.exp < p.iat && p.exp < 1e11) mal("Vence antes de emitirse", "exp es anterior a iat: el emisor tiene mal el reloj o la cuenta de la duración.");
    if (p.iat != null && typeof p.iat === "number" && p.iat < 1e11 && p.iat - c.ahora > c.skew) medio("Emitido en el futuro", `iat es ${relativo(p.iat - c.ahora)}. El reloj del emisor está adelantado; con más de ClockSkew de diferencia, algunos validadores lo rechazan.`);
    if (p.aud == null) medio("Sin aud", "No dice para quién es. Un token de otra API firmado por el mismo emisor entraría igual. ASP.NET con ValidateAudience = true (el default) lo rechaza con IDX10206 salvo que pongas ValidateAudience = false, y eso no conviene: pedile al emisor que lo ponga y fijá ValidAudience.");
    if (p.iss == null) medio("Sin iss", "No dice quién lo emitió. ASP.NET con ValidateIssuer = true (el default) lo rechaza (IDX10211). Si lo emitís vos, poné Issuer en el descriptor.");
    if (p.sub == null && p.oid == null && p.client_id == null && p.appid == null && p.azp == null && p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] == null) medio("Sin sub", "No identifica a nadie. Si es un token de usuario, falta el id; si es de app (client credentials), debería traer client_id o azp.");
    const esNet = Object.keys(p).some((k) => URI_NET[k]);
    if (esNet) medio("Nombres largos de .NET en el payload", "Hay claims con la URI de ClaimTypes.*. Un cliente en JavaScript, un gateway o Postman los ven con 60 caracteres de nombre y los claims estándar (sub, name, role) no existen. Al emitir, usá JwtRegisteredClaimNames y nombres cortos.");
    const mapeados = Object.keys(p).filter((k) => MAPA_ENTRADA[k]);
    if (mapeados.length && !esNet) info("Al entrar a ASP.NET se renombran", `Con MapInboundClaims = true (el default), ${mapeados.map((k) => "«" + k + "» pasa a " + MAPA_ENTRADA[k]).join(", ")}. User.FindFirst("${mapeados[0]}") devuelve null. Si querés los nombres tal cual vienen, poné MapInboundClaims = false en AddJwtBearer y ajustá NameClaimType y RoleClaimType.`);
    if (p.name != null && p.unique_name == null) info("User.Identity.Name va a salir null", "Hay «name» pero el mapeo por defecto de .NET usa «unique_name» para ClaimTypes.Name. Poné NameClaimType = \"name\" en TokenValidationParameters (o JwtClaimTypes.Name si usás IdentityModel).");
    if (p.realm_access || p.resource_access) info("Roles anidados (Keycloak)", "Los roles vienen en realm_access.roles y resource_access.<cliente>.roles, como JSON. [Authorize(Roles)] no los ve: aplanalos en OnTokenValidated o configurá en Keycloak un mapper «realm roles» al claim «roles» (multivalued).");
    const secretos = Object.keys(p).filter((k) => SECRETOS.test(k));
    if (secretos.length) mal("Hay secretos en el payload", `${listar(secretos)}: un JWT no está cifrado, cualquiera que lo tenga lo lee con esta misma página. Sacalos.`);
    const pii = Object.keys(p).filter((k) => PII[k.toLowerCase()] && k !== "email");
    if (pii.length) medio("Datos personales en el token", `${listar(pii)}. El token viaja en cada request y queda en los logs de la API, del gateway y del navegador. Lo que la API no necesita en cada llamada va en un endpoint /me, no en el token.`);
    const ms = ["exp", "nbf", "iat"].filter((k) => typeof p[k] === "number" && p[k] > 1e11);
    if (ms.length) mal("Fechas en milisegundos", `${listar(ms)} parecen venir de DateTime.Now.Ticks o de Date.now() sin dividir. Van en segundos (DateTimeOffset.UtcNow.ToUnixTimeSeconds()).`);
    const texto = ["exp", "nbf", "iat"].filter((k) => p[k] != null && typeof p[k] !== "number");
    if (texto.length) mal("Fechas que no son números", `${listar(texto)} tienen que ser NumericDate (número de segundos), no texto ni fecha ISO.`);
    if (dec.bytes > 8192) mal("Pesa más de 8 KB", `${dec.bytes} caracteres. IIS corta los headers en 16 KB y muchos proxies (y las cookies, 4 KB) antes. Un token que lista grupos o permisos a lo loco termina en 400 o 431 en producción.`);
    else if (dec.bytes > 4096) medio("Pesa más de 4 KB", `${dec.bytes} caracteres: va en cada request. Si lo guardás en una cookie, el navegador la tira. Sacá lo que no hace falta en cada llamada.`);
    if (h.alg && h.alg.startsWith("HS") && p.iss && /^https?:\/\//.test(String(p.iss)) && /login\.microsoftonline|accounts\.google|auth0\.com|keycloak|okta/i.test(String(p.iss))) mal("HS256 con un emisor público", "Entra, Google, Auth0, Okta y Keycloak firman con RS256/ES256. Un token HS256 que dice venir de ahí es sospechoso: la trampa clásica es firmar con la clave pública como si fuera el secreto y que un validador mal hecho lo acepte. Fijá ValidAlgorithms.");
    if (h.alg && /^(RS|PS|ES)/.test(h.alg) && p.iss && /^https?:\/\//.test(String(p.iss)) && !h.kid) medio("Sin kid", "Con firma asimétrica y un emisor con JWKS, el kid dice qué clave probar; sin kid el validador prueba todas y la rotación de claves se complica.");
    if (p.scope == null && p.scp == null && p.roles == null && p.role == null && p.permissions == null && !esNet && !p.realm_access && p.aud != null && !p.email && !p.nonce) info("Sin scopes ni roles", "El token dice quién es pero no qué puede hacer: la autorización depende de que tu API consulte permisos por su cuenta. Está bien si es así a propósito.");
    if (p.nonce != null && p.at_hash != null) info("Parece un id_token", "Tiene nonce y at_hash: es el token de identidad para tu front, no un access token para tu API. Las APIs validan access tokens (aud = la API), no id_tokens.");
    return out;
  }

  // ---------- firma ----------
  const CURVAS = { ES256: ["P-256", "SHA-256", 64], ES384: ["P-384", "SHA-384", 96], ES512: ["P-521", "SHA-512", 132] };
  const HASH = (alg) => ({ "256": "SHA-256", "384": "SHA-384", "512": "SHA-512" }[alg.slice(2)]);
  function pemADer(pem) {
    const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(pem);
    if (!m) throw new ErrorJwt("No parece PEM: falta «-----BEGIN …-----».");
    return { tipo: m[1], der: b64ABytes(m[2]) };
  }
  // Lector mínimo de DER para sacar el SubjectPublicKeyInfo de un certificado X.509.
  function der(bytes, i) {
    const tag = bytes[i]; let len = bytes[i + 1]; let j = i + 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + bytes[j++]; }
    return { tag, inicio: j, fin: j + len, total: j + len - i };
  }
  function spkiDeCertificado(certDer) {
    const cert = der(certDer, 0); if (cert.tag !== 0x30) throw new ErrorJwt("El certificado no es DER (no empieza con SEQUENCE).");
    const tbs = der(certDer, cert.inicio); let i = tbs.inicio;
    let n = der(certDer, i); if (n.tag === 0xa0) { i = n.fin; n = der(certDer, i); } // version opcional
    i = n.fin; // serial
    for (let k = 0; k < 4; k++) { n = der(certDer, i); i = n.fin; } // sigAlg, issuer, validity, subject
    n = der(certDer, i); if (n.tag !== 0x30) throw new ErrorJwt("No encontré la clave pública dentro del certificado.");
    return certDer.slice(i, n.fin);
  }
  /** Convierte lo que pegó el usuario en una clave de WebCrypto para verificar con alg. opciones: { codificacion: "utf8"|"base64"|"base64url"|"hex" } para HS*. */
  async function importarClave(alg, textoClave, opciones) {
    const s = subtle(); if (!s) throw new ErrorJwt("Este navegador no tiene WebCrypto.");
    const t = String(textoClave || "").trim(); const o = opciones || {};
    if (!t) throw new ErrorJwt("Falta la clave.");
    if (alg.startsWith("HS")) {
      let bytes;
      switch (o.codificacion || "utf8") { case "base64": bytes = b64ABytes(t); break; case "base64url": bytes = b64urlABytes(t); break; case "hex": bytes = hexABytes(t); break; default: bytes = te.encode(t); }
      const clave = await s.importKey("raw", bytes, { name: "HMAC", hash: HASH(alg) }, false, ["verify", "sign"]);
      return { clave, bytes: bytes.length, tipo: "secreto" };
    }
    let der = null, jwk = null, tipo = "";
    if (t.startsWith("{")) {
      let j; try { j = JSON.parse(t); } catch { throw new ErrorJwt("La clave parece JSON (JWK) pero no parsea."); }
      if (j.keys) { const kid = o.kid; j = (kid && j.keys.find((k) => k.kid === kid)) || j.keys[0]; if (!j) throw new ErrorJwt("El JWKS no tiene claves."); if (kid && j.kid !== kid) throw new ErrorJwt(`El JWKS no tiene la clave «${kid}» del header (kid).`); }
      jwk = Object.assign({}, j); delete jwk.use; delete jwk.key_ops; delete jwk.alg; delete jwk.kid; delete jwk.x5c; delete jwk.x5t; delete jwk["x5t#S256"]; tipo = "JWK";
    } else if (t.includes("-----BEGIN")) {
      const p = pemADer(t);
      if (p.tipo === "CERTIFICATE") { der = spkiDeCertificado(p.der); tipo = "certificado"; }
      else if (p.tipo === "PUBLIC KEY") { der = p.der; tipo = "clave pública"; }
      else if (/PRIVATE KEY/.test(p.tipo)) throw new ErrorJwt("Eso es una clave PRIVADA. Para verificar va la pública (y la privada no se pega en ningún lado).");
      else if (p.tipo === "RSA PUBLIC KEY") throw new ErrorJwt("Es una clave RSA en formato PKCS#1 («BEGIN RSA PUBLIC KEY»). Convertila a SPKI: openssl rsa -RSAPublicKey_in -in clave.pem -pubout");
      else throw new ErrorJwt(`No sé qué hacer con un PEM de tipo «${p.tipo}».`);
    } else {
      try { der = spkiDeCertificado(b64ABytes(t)); tipo = "certificado"; } catch { throw new ErrorJwt("No parece una clave pública PEM, un certificado ni un JWK."); }
    }
    let algoritmo, usos = ["verify"];
    if (alg.startsWith("RS")) algoritmo = { name: "RSASSA-PKCS1-v1_5", hash: HASH(alg) };
    else if (alg.startsWith("PS")) algoritmo = { name: "RSA-PSS", hash: HASH(alg) };
    else if (CURVAS[alg]) algoritmo = { name: "ECDSA", namedCurve: CURVAS[alg][0] };
    else if (alg === "EdDSA") algoritmo = { name: "Ed25519" };
    else throw new ErrorJwt(`No puedo verificar «${alg}» con WebCrypto.`);
    try {
      const clave = jwk ? await s.importKey("jwk", jwk, algoritmo, false, usos) : await s.importKey("spki", der, algoritmo, false, usos);
      return { clave, tipo };
    } catch (e) {
      throw new ErrorJwt(`La clave no sirve para ${alg}: ${jwk ? "el JWK es de tipo " + (jwk.kty || "?") + (jwk.crv ? " (" + jwk.crv + ")" : "") : "no es una clave " + (alg.startsWith("ES") ? "EC " + CURVAS[alg][0] : alg === "EdDSA" ? "Ed25519" : "RSA")}.`);
    }
  }
  /** Verifica la firma. Devuelve { valida, detalle }. Nunca tira por firma mala, solo por clave inservible. */
  async function verificar(dec, textoClave, opciones) {
    const alg = dec.header.alg;
    if (dec.tipo === "JWE") throw new ErrorJwt("Un JWE no se verifica: se descifra, y para eso hace falta la clave privada del destinatario.");
    if (alg === "none") return { valida: false, detalle: "alg none: no hay firma que verificar. Rechazalo." };
    if (!ALGS[alg]) throw new ErrorJwt(`Algoritmo desconocido «${alg}».`);
    if (alg === "ES256K") throw new ErrorJwt("WebCrypto no tiene secp256k1; .NET tampoco lo trae de fábrica.");
    const k = await importarClave(alg, textoClave, Object.assign({ kid: dec.header.kid }, opciones));
    const s = subtle(); const datos = te.encode(dec.datosFirmados);
    let valida = false, detalle = "";
    if (alg.startsWith("HS")) {
      valida = await s.verify("HMAC", k.clave, dec.firma, datos);
      const minFirmar = { HS256: 32, HS384: 48, HS512: 64 }[alg];
      detalle = valida ? `Firma válida con el secreto (${k.bytes} bytes).` : `La firma no coincide con ese secreto (${k.bytes} bytes). Revisá la codificación: ASP.NET suele usar Encoding.UTF8.GetBytes(clave); otros emisores guardan el secreto en base64.`;
      if (k.bytes < minFirmar) detalle += ` OJO: Microsoft.IdentityModel exige al menos ${minFirmar} bytes para firmar con ${alg} (IDX10720) y 16 para validar (IDX10653); con ${k.bytes} bytes tu API no va a poder emitir.`;
      return { valida, detalle, bytes: k.bytes };
    }
    if (alg.startsWith("RS")) valida = await s.verify("RSASSA-PKCS1-v1_5", k.clave, dec.firma, datos);
    else if (alg.startsWith("PS")) valida = await s.verify({ name: "RSA-PSS", saltLength: parseInt(alg.slice(2), 10) / 8 }, k.clave, dec.firma, datos);
    else if (CURVAS[alg]) { if (dec.firma.length !== CURVAS[alg][2]) return { valida: false, detalle: `La firma mide ${dec.firma.length} bytes y ${alg} necesita ${CURVAS[alg][2]} (r‖s). Si viene en DER es un token mal armado: la RFC 7518 pide r‖s crudos.` }; valida = await s.verify({ name: "ECDSA", hash: CURVAS[alg][1] }, k.clave, dec.firma, datos); }
    else if (alg === "EdDSA") valida = await s.verify("Ed25519", k.clave, dec.firma, datos);
    detalle = valida ? `Firma válida con ${k.tipo === "certificado" ? "la clave pública del certificado" : k.tipo === "JWK" ? "la clave del JWK" : "la clave pública"}.` : `La firma no coincide con esa clave. O el token lo firmó otra clave (mirá el kid), o alguien lo modificó.`;
    return { valida, detalle };
  }
  /** Firma HS* con WebCrypto (para los ejemplos vivos y los tests). */
  async function firmarHS(header, payload, secreto, alg) {
    const a = alg || header.alg || "HS256"; const s = subtle();
    const h = Object.assign({ alg: a, typ: "JWT" }, header);
    const datos = textoAB64url(JSON.stringify(h)) + "." + textoAB64url(JSON.stringify(payload));
    if (a === "none") return datos + ".";
    const clave = await s.importKey("raw", typeof secreto === "string" ? te.encode(secreto) : secreto, { name: "HMAC", hash: HASH(a) }, false, ["sign"]);
    const firma = new Uint8Array(await s.sign("HMAC", clave, te.encode(datos)));
    return datos + "." + bytesAB64url(firma);
  }

  // ---------- C# ----------
  function csStr(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
  function valorCs(v) {
    if (typeof v === "string") return csStr(v);
    if (typeof v === "number") return Number.isInteger(v) ? String(v) + (Math.abs(v) > 2147483647 ? "L" : "") : String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (Array.isArray(v)) return "new[] { " + v.map(valorCs).join(", ") + " }";
    if (v && typeof v === "object") return "new Dictionary<string, object> { " + Object.keys(v).map((k) => "[" + csStr(k) + "] = " + valorCs(v[k])).join(", ") + " }";
    return "null";
  }
  function snippetCs(dec, modo, opciones) {
    const o = Object.assign({ ahora: Math.floor(Date.now() / 1000) }, opciones);
    const h = dec.header; const p = dec.payload || {}; const alg = h.alg || "HS256";
    const sim = alg.startsWith("HS"); const issUrl = typeof p.iss === "string" && /^https?:\/\//.test(p.iss);
    const aud = Array.isArray(p.aud) ? p.aud : p.aud != null ? [p.aud] : [];
    const tieneName = p.name != null && p.unique_name == null;
    const rolClaim = p.roles != null ? "roles" : p.role != null ? "role" : p.permissions != null ? "permissions" : null;
    const esNet = Object.keys(p).some((k) => URI_NET[k]);
    if (modo === "emitir") {
      const claims = Object.keys(p).filter((k) => !["exp", "nbf", "iat", "iss", "aud"].includes(k));
      const vida = p.exp != null && p.iat != null && typeof p.exp === "number" && typeof p.iat === "number" && p.exp > p.iat && p.exp < 1e11 ? p.exp - p.iat : 3600;
      const l = [];
      l.push("// Emitir un token igual a este, con la API nueva de Microsoft.IdentityModel (JsonWebTokenHandler).");
      l.push("// dotnet add package Microsoft.IdentityModel.JsonWebTokens");
      l.push("using Microsoft.IdentityModel.JsonWebTokens;");
      l.push("using Microsoft.IdentityModel.Tokens;");
      if (sim) l.push("using System.Text;"); else if (alg.startsWith("ES")) l.push("using System.Security.Cryptography;"); else l.push("using System.Security.Cryptography;");
      l.push("");
      if (sim) l.push(`// La clave va en configuración (user-secrets, variables de entorno, Key Vault), nunca en el código. Mínimo ${{ HS256: 32, HS384: 48, HS512: 64 }[alg]} bytes para ${alg}.`, `var clave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));`, `var credenciales = new SigningCredentials(clave, SecurityAlgorithms.${{ HS256: "HmacSha256", HS384: "HmacSha384", HS512: "HmacSha512" }[alg]});`);
      else if (alg.startsWith("ES")) l.push(`// Clave privada EC (${CURVAS[alg] ? CURVAS[alg][0] : "P-256"}) desde un PEM o un certificado.`, `var ecdsa = ECDsa.Create(); ecdsa.ImportFromPem(File.ReadAllText("privada.pem"));`, `var credenciales = new SigningCredentials(new ECDsaSecurityKey(ecdsa)${h.kid ? ` { KeyId = ${csStr(h.kid)} }` : ""}, SecurityAlgorithms.${{ ES256: "EcdsaSha256", ES384: "EcdsaSha384", ES512: "EcdsaSha512" }[alg] || "EcdsaSha256"});`);
      else if (alg === "EdDSA") l.push("// .NET no firma EdDSA de fábrica: hace falta un paquete (p. ej. NSec o BouncyCastle). Si podés elegir, ES256.", "var credenciales = /* SigningCredentials con una clave Ed25519 */ null!;");
      else l.push(`// Clave privada RSA desde un PEM o un certificado (X509Certificate2 → new X509SecurityKey(cert)).`, `var rsa = RSA.Create(); rsa.ImportFromPem(File.ReadAllText("privada.pem"));`, `var credenciales = new SigningCredentials(new RsaSecurityKey(rsa)${h.kid ? ` { KeyId = ${csStr(h.kid)} }` : ""}, SecurityAlgorithms.${{ RS256: "RsaSha256", RS384: "RsaSha384", RS512: "RsaSha512", PS256: "RsaSsaPssSha256", PS384: "RsaSsaPssSha384", PS512: "RsaSsaPssSha512" }[alg] || "RsaSha256"});`);
      l.push("", "var ahora = DateTime.UtcNow;", "var descriptor = new SecurityTokenDescriptor", "{");
      if (p.iss != null) l.push(`    Issuer = ${csStr(p.iss)},`);
      if (aud.length === 1) l.push(`    Audience = ${csStr(aud[0])},`);
      l.push(`    IssuedAt = ahora,`, `    NotBefore = ahora,`, `    Expires = ahora.Add${vida % 86400 === 0 ? "Days(" + vida / 86400 : vida % 3600 === 0 ? "Hours(" + vida / 3600 : "Minutes(" + Math.round(vida / 60)}),`);
      l.push(`    SigningCredentials = credenciales,`);
      if (h.typ && h.typ !== "JWT") l.push(`    TokenType = ${csStr(h.typ)},`);
      l.push("    Claims = new Dictionary<string, object>", "    {");
      if (aud.length > 1) l.push(`        [JwtRegisteredClaimNames.Aud] = ${valorCs(aud)},`);
      for (const k of claims) {
        const nombre = { sub: "JwtRegisteredClaimNames.Sub", jti: "JwtRegisteredClaimNames.Jti", email: "JwtRegisteredClaimNames.Email", name: "JwtRegisteredClaimNames.Name", given_name: "JwtRegisteredClaimNames.GivenName", family_name: "JwtRegisteredClaimNames.FamilyName", azp: "JwtRegisteredClaimNames.Azp", nonce: "JwtRegisteredClaimNames.Nonce", auth_time: "JwtRegisteredClaimNames.AuthTime", unique_name: "JwtRegisteredClaimNames.UniqueName", at_hash: "JwtRegisteredClaimNames.AtHash" }[k] || csStr(URI_NET[k] ? k : k);
        const comentario = URI_NET[k] ? `  // mejor: ${URI_NET[k].replace(/^ClaimTypes\./, "").toLowerCase() === "nameidentifier" ? "JwtRegisteredClaimNames.Sub" : '"' + URI_NET[k].replace(/^ClaimTypes\./, "").toLowerCase() + '"'}` : k === "jti" ? "  // uno distinto por token: Guid.NewGuid().ToString()" : "";
        l.push(`        [${nombre}] = ${valorCs(p[k])},${comentario}`);
      }
      l.push("    },", "};", "", "var handler = new JsonWebTokenHandler();  // no renombra claims: lo que pongas es lo que sale", "string token = handler.CreateToken(descriptor);");
      if (esNet) l.push("", "// Si venías de JwtSecurityTokenHandler con ClaimTypes.*, esta API ya no acorta los nombres: por eso aparecen las URIs largas.", "// Usá los nombres cortos del diccionario de arriba y en la API que valida poné MapInboundClaims = false.");
      return l.join("\n");
    }
    // validar
    const l = [];
    l.push("// Program.cs — validar este token en ASP.NET Core 8.", "// dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer", "using Microsoft.AspNetCore.Authentication.JwtBearer;", "using Microsoft.AspNetCore.Authorization;", "using Microsoft.IdentityModel.Tokens;", "using System.Security.Claims;");
    if (sim) l.push("using System.Text;");
    l.push("", "builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)", "    .AddJwtBearer(o =>", "    {");
    if (issUrl && !sim) l.push(`        // El emisor publica sus claves: con Authority alcanza, se bajan del JWKS por kid y rotan solas.`, `        o.Authority = ${csStr(p.iss)};`);
    if (issUrl && !sim && /login\.microsoftonline\.com\/[^/]+\/?$/.test(p.iss)) l.push("        // Token v1 de Entra: Authority con /v2.0 no sirve, dejá la URL tal cual o usá Microsoft.Identity.Web.");
    l.push("        o.MapInboundClaims = false;  // que «sub» se llame «sub» y no la URI larga de .NET");
    if (esNet) l.push("        // (Este token ya trae las URIs largas: con false quedan tal cual; con true quedan igual también.)");
    l.push("        o.TokenValidationParameters = new TokenValidationParameters", "        {");
    if (p.iss != null) l.push(`            ValidIssuer = ${csStr(p.iss)},`); else l.push("            ValidateIssuer = false,  // el token no trae iss: pedile al emisor que lo ponga");
    if (aud.length === 1) l.push(`            ValidAudience = ${csStr(aud[0])},`); else if (aud.length > 1) l.push(`            ValidAudiences = ${valorCs(aud)},`); else l.push("            ValidateAudience = false,  // el token no trae aud: así entra cualquier token del emisor, no lo dejes así");
    if (sim) l.push("            // La misma clave que firma. En user-secrets o variables de entorno, nunca en el repo.", `            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),`);
    else if (!issUrl) l.push(alg.startsWith("ES") ? "            IssuerSigningKey = new ECDsaSecurityKey(ecdsaPublica),  // ECDsa.Create() + ImportFromPem(publica.pem)" : "            IssuerSigningKey = new RsaSecurityKey(rsaPublica),  // RSA.Create() + ImportFromPem(publica.pem)");
    l.push(`            ValidAlgorithms = new[] { ${csStr(alg)} },  // que nadie te cambie el algoritmo`);
    if (p.exp == null) l.push("            RequireExpirationTime = false,  // el token no trae exp: no vence nunca, arreglalo en el emisor");
    l.push("            ClockSkew = TimeSpan.FromMinutes(1),  // el default son 5 minutos de gracia después de exp");
    if (tieneName) l.push(`            NameClaimType = "name",  // si no, User.Identity.Name sale null`);
    if (rolClaim) l.push(`            RoleClaimType = ${csStr(rolClaim)},  // para [Authorize(Roles = "...")]`);
    if (h.typ && /^at\+jwt$/i.test(h.typ)) l.push(`            ValidTypes = new[] { "at+jwt" },  // solo access tokens`);
    l.push("        };", "    });", "builder.Services.AddAuthorization();", "", "// Después de Build():", "app.UseAuthentication();", "app.UseAuthorization();");
    l.push("", "// En un endpoint:");
    const ejemploRol = rolClaim && p[rolClaim] != null ? arr(p[rolClaim])[0] : null;
    l.push(`app.MapGet("/yo", (ClaimsPrincipal user) => new`, "{");
    l.push(`    Id = user.FindFirstValue(${p.sub != null ? '"sub"' : p.oid != null ? '"oid"' : '"sub"'}),`);
    if (tieneName || p.unique_name != null) l.push("    Nombre = user.Identity?.Name,");
    if (rolClaim) l.push(`    Roles = user.FindAll(${csStr(rolClaim)}).Select(c => c.Value),`);
    if (p.scope != null || p.scp != null) l.push(`    Scopes = user.FindFirstValue(${csStr(p.scope != null ? "scope" : "scp")})?.Split(' '),`);
    l.push(`}).RequireAuthorization(${ejemploRol ? `new AuthorizeAttribute { Roles = ${csStr(ejemploRol)} }` : ""});`);
    if (p.realm_access) l.push("", "// Roles de Keycloak anidados: aplanarlos al validar.", "// o.Events = new JwtBearerEvents { OnTokenValidated = ctx => { var roles = ctx.Principal!.FindFirst(\"realm_access\")?.Value; /* JsonDocument → ctx.Principal.AddIdentity(new ClaimsIdentity(roles.Select(r => new Claim(\"roles\", r)))) */ return Task.CompletedTask; } };");
    return l.join("\n");
  }

  const api = { ErrorJwt, b64urlABytes, bytesAB64url, b64urlATexto, textoAB64url, limpiar, decodificar, formatearFecha, relativo, duracion, estado, explicarClaims, explicarHeader, avisos, verificar, importarClave, firmarHS, pemADer, spkiDeCertificado, snippetCs, ALGS, URI_NET, MAPA_ENTRADA, esEpochPlausible };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.JwtCriollo = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
