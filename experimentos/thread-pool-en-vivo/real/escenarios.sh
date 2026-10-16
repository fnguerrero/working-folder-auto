#!/bin/bash
cd /w
run() { nombre=$1; shift; echo "== $nombre $* $(date +%T)"; dotnet bin/Release/net8.0/ThreadPoolReal.dll "$@" > salida/$nombre.json; }
run pod         modo=sync        rps=100 dur=30
run result      modo=result      rps=100 dur=30
run async       modo=async       rps=100 dur=30
run minthreads  modo=sync        rps=100 dur=30 min=32
run pico        modo=sync        rps=15  dur=30 rafaga=150
run result50    modo=result      rps=50  dur=30
run http-async  modo=http-async  rps=100 dur=30
run http-result modo=http-result rps=100 dur=30
run http-sync   modo=http-sync   rps=100 dur=30
run largo       modo=sync        rps=50  dur=90
echo FIN
