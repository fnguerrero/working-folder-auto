/* Tests de JWT en criollo.   node --test herramientas/jwt-en-criollo/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const J = require("../logica.js"); const E = require("../ejemplos.js");
const AHORA = 1792477000; // 2026-10-20 06:16:40 UTC (03:16:40 en Argentina), 1000 s después del iat de los ejemplos estáticos
const ej = (id) => E.EJEMPLOS.find((e) => e.id === id);
const vivo = async (id, t) => { const e = ej(id); return J.firmarHS(e.header, e.payload(t || AHORA), e.secreto, e.alg); };

test("limpia lo que viene pegado alrededor: Bearer, comillas, JSON, cookie, espacios", () => {
  const t = "aaa.bbb.ccc";
  for (const x of [t, "Bearer " + t, "Authorization: Bearer " + t, `"${t}"`, `'${t}',`, `{"access_token":"${t}","token_type":"Bearer"}`, `sesion=${t}; Path=/; HttpOnly`, "aaa.\nbbb.\n ccc "]) assert.equal(J.limpiar(x), t, x);
});

test("decodifica header, payload y firma; detecta JWE; errores claros", async () => {
  const d = J.decodificar(await vivo("api"));
  assert.equal(d.tipo, "JWS"); assert.equal(d.header.alg, "HS256"); assert.equal(d.payload.sub, "1042"); assert.equal(d.firma.length, 32); assert.ok(d.payloadEsJson);
  const w = J.decodificar(ej("jwe").token); assert.equal(w.tipo, "JWE"); assert.equal(w.header.enc, "A256GCM"); assert.equal(w.payload, null);
  assert.throws(() => J.decodificar(""), /Pegá un token/);
  assert.throws(() => J.decodificar("hola"), /No tiene puntos/);
  assert.throws(() => J.decodificar("a.b"), /Tiene 2 partes/);
  assert.throws(() => J.decodificar("eyJ+.eyJ.x"), /base64 común, no base64url/);
  assert.throws(() => J.decodificar("eyJhbGciOiJIUzI1NiJ9=.e30.x"), /sin relleno/);
  assert.throws(() => J.decodificar(J.textoAB64url("hola") + ".e30.x"), /header no es JSON/);
  assert.throws(() => J.decodificar(J.textoAB64url("[1]") + ".e30.x"), /no es un objeto/);
  const crudo = J.decodificar(J.textoAB64url('{"alg":"HS256"}') + "." + J.textoAB64url("texto plano") + ".");
  assert.equal(crudo.payloadEsJson, false); assert.equal(crudo.payloadRaw, "texto plano");
  assert.equal(J.b64urlATexto(J.textoAB64url("ñandú €")), "ñandú €");
});

test("fechas en hora argentina y tiempos relativos", () => {
  assert.match(J.formatearFecha(1792477000), /^mar 20\/10\/2026 03:16:40$/);
  assert.equal(J.relativo(45), "en 45 s"); assert.equal(J.relativo(-90061), "hace 1 día y 1 h"); assert.equal(J.relativo(3600 * 25), "en 1 día y 1 h"); assert.equal(J.relativo(0), "ahora mismo");
  assert.equal(J.duracion(300), "5 min"); assert.equal(J.duracion(86400 * 365), "1 año"); assert.equal(J.duracion(86400 * 60), "2 meses");
});

test("estado: vigente, gracia (ClockSkew), vencido, nbf, sin exp, milisegundos", () => {
  const e = (p, skew) => J.estado(p, AHORA, skew);
  assert.equal(e({ exp: AHORA + 10 }).estado, "vigente");
  assert.equal(e({ exp: AHORA - 10 }).estado, "gracia"); assert.match(e({ exp: AHORA - 10 }).texto, /ClockSkew de 5 minutos/);
  assert.equal(e({ exp: AHORA - 10 }, 0).estado, "vencido");
  assert.equal(e({ exp: AHORA - 301 }).estado, "vencido");
  assert.equal(e({ nbf: AHORA + 100, exp: AHORA + 1000 }).estado, "pronto"); assert.equal(e({ nbf: AHORA + 400, exp: AHORA + 1000 }).estado, "todavia-no");
  assert.equal(e({ sub: "1" }).estado, "sin-exp");
  assert.equal(e({ exp: AHORA * 1000 }).estado, "ms");
  assert.equal(e({ iat: AHORA - 100, exp: AHORA + 200 }).vida, 300); assert.equal(e({ nbf: AHORA - 50, iat: AHORA - 100, exp: AHORA + 200 }).vida, 250);
});

test("explica los claims: estándar, Entra, Keycloak, nombres largos de .NET, secretos, datos personales, propios", () => {
  const x = (p) => Object.fromEntries(J.explicarClaims(p, { ahora: AHORA }).map((c) => [c.clave, c]));
  const c = x({ iss: "https://sso.x.com/realms/a", sub: "1", aud: ["a", "b"], exp: AHORA + 60, name: "N", roles: ["admin"], tid: "t", oid: "o", realm_access: { roles: ["r1"] }, password: "x", dni: "33123456", mio: 1, "https://x.com/suc": "R", "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "admin", amr: ["pwd", "mfa"], exp2: 1 });
  assert.match(c.iss.texto, /openid-configuration/); assert.match(c.aud.texto, /puede ser una lista/); assert.match(c.exp.texto, /Vence el .*hora argentina.*en 1 min/);
  assert.match(c.name.texto, /NO se convierte en ClaimTypes.Name/); assert.equal(c.sub.netMapeado, "ClaimTypes.NameIdentifier"); assert.equal(c.roles.netMapeado, "ClaimTypes.Role"); assert.equal(c.name.netMapeado, null);
  assert.match(c.oid.texto, /identificador estable/); assert.match(c.realm_access.texto, /«r1».*IClaimsTransformation/);
  assert.equal(c.password.nivel, "mal"); assert.equal(c.dni.nivel, "medio"); assert.match(c.dni.texto, /DNI/);
  assert.match(c.mio.texto, /Claim propio/); assert.match(c["https://x.com/suc"].texto, /Auth0/);
  assert.equal(c["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"].nivel, "medio"); assert.match(c["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"].texto, /ClaimTypes.Role/);
  assert.match(c.amr.texto, /pwd \(clave\).*mfa \(segundo factor\)/);
  const ms = x({ exp: AHORA * 1000, iat: "2026-10-20" });
  assert.equal(ms.exp.nivel, "mal"); assert.match(ms.exp.texto, /milisegundos/); assert.equal(ms.iat.nivel, "mal"); assert.match(ms.iat.texto, /un texto/);
});

test("explica el header: alg, typ, kid, jku, jwk, x5c, crit, enc", () => {
  const h = (o, tipo) => Object.fromEntries(J.explicarHeader(o, tipo || "JWS").map((c) => [c.clave, c]));
  assert.match(h({ alg: "HS256" }).alg.texto, /la misma clave firma y verifica/); assert.match(h({ alg: "RS256" }).alg.texto, /clave privada del emisor/); assert.equal(h({ alg: "none" }).alg.nivel, "mal"); assert.equal(h({ alg: "XX1" }).alg.nivel, "mal");
  assert.match(h({ typ: "at+jwt" }).typ.texto, /RFC 9068/); assert.match(h({ kid: "k" }).kid.texto, /JWKS/);
  assert.equal(h({ jku: "http://x" }).jku.nivel, "mal"); assert.equal(h({ jwk: {} }).jwk.nivel, "mal"); assert.equal(h({ x5c: ["a"] }).x5c.nivel, "medio"); assert.equal(h({ crit: ["b64"] }).crit.nivel, "medio");
  assert.match(h({ alg: "RSA-OAEP", enc: "A256GCM" }, "JWE").enc.texto, /AES-256-GCM/);
});

test("avisos: cada trampa", async () => {
  const av = async (id, t) => J.avisos(J.decodificar(await vivo(id, t)), { ahora: t || AHORA }).map((a) => a.nivel[0] + ":" + a.titulo);
  const avT = (tok, t) => J.avisos(J.decodificar(tok), { ahora: t || AHORA }).map((a) => a.nivel[0] + ":" + a.titulo);
  assert.deepEqual(await av("api"), ["o:Vigente", "i:Al entrar a ASP.NET se renombran", "i:User.Identity.Name va a salir null"]);
  assert.deepEqual(await av("none"), ["m:alg: none", "o:Vigente", "m:Dura demasiado", "i:Al entrar a ASP.NET se renombran"]);
  assert.deepEqual(await av("feo"), ["m:No vence nunca (exp en milisegundos)", "m:Sin aud", "i:Al entrar a ASP.NET se renombran", "m:Hay secretos en el payload", "m:Datos personales en el token", "m:Fechas en milisegundos"]);
  assert.ok((await av("net-largo")).includes("m:Nombres largos de .NET en el payload")); assert.ok(!(await av("net-largo")).includes("m:Sin sub"));
  assert.ok((await av("vencido")).includes("m:Venció hace poco"));
  assert.ok(avT(ej("keycloak").token).includes("i:Roles anidados (Keycloak)")); assert.ok(avT(ej("keycloak").token).includes("m:Vencido"));
  assert.ok(avT(ej("google").token).includes("i:Parece un id_token"));
  assert.ok(avT(ej("auth0").token, AHORA).includes("o:Vigente"));
  assert.deepEqual(avT(ej("jwe").token), ["i:Es un JWE: está cifrado"]);
  const t = (p, h) => J.textoAB64url(JSON.stringify(Object.assign({ alg: "HS256" }, h))) + "." + J.textoAB64url(JSON.stringify(p)) + ".AA";
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y" })).includes("m:Sin exp"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 86400 * 2, iat: AHORA })).includes("m:Dura más de un día"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 40, iat: AHORA })).includes("m:Dura muy poco"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA - 10, iat: AHORA })).includes("m:Vence antes de emitirse"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 1000, iat: AHORA + 900 })).includes("m:Emitido en el futuro"));
  assert.ok(avT(t({ sub: "1", aud: "y", exp: AHORA + 100 })).includes("m:Sin iss"));
  assert.ok(avT(t({ iss: "x", aud: "y", exp: AHORA + 100 })).includes("m:Sin sub"));
  assert.ok(avT(t({ sub: "1", iss: "https://login.microsoftonline.com/t/v2.0", aud: "y", exp: AHORA + 100 })).includes("m:HS256 con un emisor público"));
  assert.ok(avT(t({ sub: "1", iss: "https://sso.x", aud: "y", exp: AHORA + 100 }, { alg: "RS256" })).includes("m:Sin kid"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100, nbf: AHORA + 1000 })).includes("m:Todavía no vale (nbf)"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: "2026-10-20" })).includes("m:Fechas que no son números"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100, relleno: "x".repeat(5000) })).includes("m:Pesa más de 4 KB"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100, relleno: "x".repeat(9000) })).includes("m:Pesa más de 8 KB"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100 }, { jku: "http://x" })).includes("m:URL de claves en el header (jku / x5u)"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100 }, { jwk: { kty: "oct" } })).includes("m:Trae su propia clave (jwk)"));
  assert.ok(avT(t({ sub: "1", iss: "x", aud: "y", exp: AHORA + 100 }, { alg: "ZZZ" })).includes("m:Algoritmo desconocido"));
});

test("verifica HS256 con secreto en texto, base64 y hex; firma mala; clave corta", async () => {
  const d = J.decodificar(await vivo("api"));
  assert.equal((await J.verificar(d, E.SECRETO)).valida, true);
  assert.equal((await J.verificar(d, Buffer.from(E.SECRETO).toString("base64"), { codificacion: "base64" })).valida, true);
  assert.equal((await J.verificar(d, Buffer.from(E.SECRETO).toString("hex"), { codificacion: "hex" })).valida, true);
  assert.equal((await J.verificar(d, Buffer.from(E.SECRETO).toString("base64url"), { codificacion: "base64url" })).valida, true);
  const mala = await J.verificar(d, "otra"); assert.equal(mala.valida, false); assert.match(mala.detalle, /IDX10720/);
  await assert.rejects(J.verificar(d, ""), /Falta la clave/);
  const h512 = J.decodificar(await J.firmarHS({ alg: "HS512" }, { sub: "1" }, "s".repeat(64))); assert.equal((await J.verificar(h512, "s".repeat(64))).valida, true);
  const none = J.decodificar(await vivo("none")); assert.equal((await J.verificar(none, "x")).valida, false); assert.match((await J.verificar(none, "x")).detalle, /alg none/);
  await assert.rejects(J.verificar(J.decodificar(ej("jwe").token), "x"), /JWE no se verifica/);
});

test("verifica RS256, PS256 y ES256 con PEM, JWK, JWKS por kid, certificado y x5c", async () => {
  const ok = async (id, clave) => (await J.verificar(J.decodificar(ej(id).token), clave)).valida;
  assert.equal(await ok("keycloak", E.RSA_PUB), true); assert.equal(await ok("auth0", E.RSA_PUB), true); assert.equal(await ok("google", E.RSA_PUB), true);
  assert.equal(await ok("ps256", E.RSA_PUB), true);
  assert.equal(await ok("entra", E.RSA_JWK), true);
  assert.equal(await ok("entra", JSON.stringify(JSON.parse(E.RSA_JWK).keys[0])), true);
  await assert.rejects(J.verificar(J.decodificar(ej("keycloak").token), E.RSA_JWK), /no tiene la clave «bXkta2V5LWlkLWRlLWtleWNsb2Fr»/);
  const es = J.decodificar(ej("es256").token);
  assert.equal((await J.verificar(es, E.EC_PUB)).valida, true);
  assert.equal((await J.verificar(es, es.header.x5c[0])).valida, true);
  assert.match((await J.verificar(es, "-----BEGIN CERTIFICATE-----\n" + es.header.x5c[0] + "\n-----END CERTIFICATE-----")).detalle, /clave pública del certificado/);
  await assert.rejects(J.verificar(es, E.RSA_PUB), /no es una clave EC P-256/);
  await assert.rejects(J.verificar(J.decodificar(ej("keycloak").token), E.EC_PUB), /no es una clave RSA/);
  await assert.rejects(J.verificar(es, "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----"), /clave PRIVADA/);
  await assert.rejects(J.verificar(es, "no es nada"), /No parece una clave/);
  // Token modificado: la firma ya no cierra.
  const partes = ej("keycloak").token.split("."); const payload = JSON.parse(J.b64urlATexto(partes[1])); payload.realm_access.roles.push("superadmin");
  const trucho = partes[0] + "." + J.textoAB64url(JSON.stringify(payload)) + "." + partes[2];
  const r = await J.verificar(J.decodificar(trucho), E.RSA_PUB); assert.equal(r.valida, false); assert.match(r.detalle, /alguien lo modificó/);
});

test("C#: validar y emitir", async () => {
  const d = J.decodificar(await vivo("api"));
  const v = J.snippetCs(d, "validar");
  assert.match(v, /ValidIssuer = "https:\/\/api\.ejemplo\.com\.ar"/); assert.match(v, /ValidAudience = "ejemplo-web"/); assert.match(v, /SymmetricSecurityKey\(Encoding\.UTF8/); assert.match(v, /ValidAlgorithms = new\[\] \{ "HS256" \}/);
  assert.match(v, /MapInboundClaims = false/); assert.match(v, /NameClaimType = "name"/); assert.match(v, /RoleClaimType = "roles"/); assert.match(v, /Roles = "admin"/);
  const e = J.snippetCs(d, "emitir");
  assert.match(e, /JsonWebTokenHandler/); assert.match(e, /\[JwtRegisteredClaimNames\.Sub\] = "1042"/); assert.match(e, /\["roles"\] = new\[\] \{ "admin", "facturacion" \}/); assert.match(e, /Expires = ahora\.AddHours\(1\)/); assert.match(e, /HmacSha256/);
  const k = J.snippetCs(J.decodificar(ej("keycloak").token), "validar");
  assert.match(k, /o\.Authority = "https:\/\/sso\.empresa\.com\.ar\/realms\/produccion"/); assert.match(k, /ValidAudiences = new\[\] \{ "facturacion-api", "account" \}/); assert.match(k, /Roles de Keycloak anidados/); assert.ok(!/SymmetricSecurityKey/.test(k));
  const es = J.snippetCs(J.decodificar(ej("es256").token), "emitir"); assert.match(es, /ECDsa\.Create\(\)/); assert.match(es, /EcdsaSha256/); assert.match(es, /KeyId = "2026-10"/); assert.match(es, /TokenType = "at\+jwt"/);
  const n = J.snippetCs(J.decodificar(await vivo("net-largo")), "emitir"); assert.match(n, /mejor: JwtRegisteredClaimNames\.Sub/); assert.match(n, /mejor: "role"/);
  const sinNada = J.snippetCs(J.decodificar(J.textoAB64url('{"alg":"HS256"}') + "." + J.textoAB64url('{"sub":"1"}') + ".AA"), "validar");
  assert.match(sinNada, /ValidateIssuer = false/); assert.match(sinNada, /ValidateAudience = false/); assert.match(sinNada, /RequireExpirationTime = false/);
});

test("los doce ejemplos decodifican y los firmados verifican con su clave", async () => {
  assert.equal(E.EJEMPLOS.length, 12);
  for (const e of E.EJEMPLOS) {
    const d = J.decodificar(e.vivo ? await vivo(e.id) : e.token);
    if (d.tipo === "JWE" || d.header.alg === "none") continue;
    assert.equal((await J.verificar(d, e.vivo ? e.secreto : e.clave)).valida, true, e.id);
  }
});
