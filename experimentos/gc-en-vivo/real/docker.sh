#!/bin/bash
# Compila y corre dentro del SDK de .NET 8 en Docker. Uso: ./docker.sh build | ./docker.sh escenarios
cd "$(dirname "$0")"
docker run --rm --network host -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
  -v "$PWD":/w -w /w -v /root/.ccr/ca-bundle.crt:/usr/local/share/ca-certificates/proxy.crt:ro \
  mcr.microsoft.com/dotnet/sdk:8.0 bash -c "update-ca-certificates >/dev/null 2>&1; $*"
