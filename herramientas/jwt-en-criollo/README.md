# JWT en criollo

Pegás un JWT (con el `Bearer`, las comillas, el JSON de la respuesta del login o la cookie alrededor, da igual) y
te dice qué tiene adentro, claim por claim y en castellano: quién lo emitió, para quién es, a quién identifica,
cuándo vence (en hora argentina y «en 43 min»), cómo se autenticó, qué roles y scopes trae, y qué significa cada
claim de Entra ID, Keycloak, Auth0, Google y Firebase. Marca el estado con el `ClockSkew` de 5 minutos que usa
ASP.NET por defecto (vigente, vencido, **vencido pero en gracia**, todavía no vale, sin vencimiento), avisa de las
trampas (`alg: none`, sin `exp`, sin `aud`, dura demasiado, fechas en milisegundos, secretos y datos personales
en el payload, más de 4 u 8 KB, `jku`/`jwk` en el header, HS256 con un emisor público, nombres largos de .NET,
`User.Identity.Name` que va a salir null, roles anidados de Keycloak, `name` vs `unique_name`), **verifica la
firma** con la clave que le pegues (secreto HS256/384/512 en texto, base64 o hex; clave pública PEM, certificado,
JWK o JWKS por `kid`; RS*, PS*, ES256/384/512; el `x5c` del header con un clic) y te deja el C#: el `AddJwtBearer`
con `TokenValidationParameters` sacados del token (issuer, audiencias, algoritmo fijo, `MapInboundClaims = false`,
`NameClaimType`, `RoleClaimType`, `ClockSkew`) y un endpoint que lee los claims, o cómo **emitir uno igual** con
`JsonWebTokenHandler`. Doce ejemplos: API propia, nombres largos de .NET, Entra ID, Keycloak, Auth0, Google,
ES256 con `x5c`, PS256 de client credentials, vencido hace 3 minutos, `alg: none`, con datos que no van y un JWE.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/jwt-en-criollo/

**Estado:** terminado.

## Cómo funciona

`logica.js` decodifica (base64url propio, con errores que dicen qué carácter sobra), explica header y claims con
un diccionario en castellano (estándar, OIDC, Entra, Keycloak, Auth0, Google, Firebase, RFC 8693/9068 y las URIs
de `ClaimTypes.*`), calcula el estado y los avisos, verifica con WebCrypto (`crypto.subtle`: HMAC, RSASSA-PKCS1,
RSA-PSS con el salt del hash, ECDSA con firma r‖s, Ed25519 si el navegador lo trae) e importa claves desde PEM
SPKI, certificados X.509 (un lector mínimo de DER saca el `SubjectPublicKeyInfo`), JWK y JWKS (elige por `kid`).
`ejemplos.js` tiene los doce ejemplos: los HS256 y el `alg: none` se firman en el navegador al elegirlos (fechas de
ahora, secreto a la vista); los RS/PS/ES están firmados con claves de juguete generadas para esta página
(`tests/generar-ejemplos.sh`) y traen su clave pública. No hay ningún token real. La página guarda el último token
en `localStorage` (dentro de try/catch), nunca la clave. Con `?ahora=<epoch>` en la URL el reloj queda fijo (lo
usan los tests).

## Cómo se prueba

```bash
node --test herramientas/jwt-en-criollo/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' herramientas/jwt-en-criollo/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node herramientas/jwt-en-criollo/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

Once tests (limpiar lo que viene pegado; decodificar y errores; fechas en hora argentina y relativos; estado con
ClockSkew, nbf, sin exp y milisegundos; explicación de claims y header; cada aviso; HS256 con las cuatro
codificaciones y clave corta; RS256, PS256 y ES256 con PEM, JWK, JWKS por kid, certificado y x5c, más un token
modificado que ya no cierra; el C# de validar y emitir; los doce ejemplos) y un e2e que recorre ejemplos, estado,
claims, avisos, la firma con secreto, PEM, JWKS y x5c, un token pegado con `Authorization: Bearer`, un error, el C#
en los dos modos con copiar y la memoria al recargar (el token sí, la clave no).

Lo que **no se pudo probar**: contra ASP.NET de verdad. Los mensajes de error (`IDX10223`, `IDX10720`…), el mapa
de nombres de `Microsoft.IdentityModel` y el `ClockSkew` siguen la documentación y el código fuente de la
biblioteca, no una corrida real; si algún detalle cambió en una versión, el aviso lo dice como regla general.
EDDSA se verifica solo si el navegador trae Ed25519 en WebCrypto.
