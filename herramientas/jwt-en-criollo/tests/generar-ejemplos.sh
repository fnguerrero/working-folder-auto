#!/bin/sh
# Cómo se generaron las claves de juguete de ejemplos.js (no hace falta volver a correrlo; si se corre, hay que re-firmar los tokens).
set -e
openssl ecparam -name prime256v1 -genkey -noout -out ec.key
openssl req -new -x509 -key ec.key -days 3650 -subj "/CN=api-ejemplo.local" -out ec.crt
openssl pkey -in ec.key -pubout -out ec.pub
openssl genrsa -out rsa.key 2048
openssl rsa -in rsa.key -pubout -out rsa.pub
# Después, con Node: firmar header.payload en base64url con crypto.sign("sha256", datos, clave) (RS256), con
# padding PSS y saltLength 32 (PS256) o con dsaEncoding "ieee-p1363" (ES256), y pegar los tokens y las públicas en ejemplos.js.
