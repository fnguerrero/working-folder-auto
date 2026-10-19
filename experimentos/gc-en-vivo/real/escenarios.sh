#!/bin/bash
# Corre todos los escenarios y deja un JSON por corrida en salida/. Se ejecuta dentro del contenedor: ./docker.sh ./escenarios.sh
cd "$(dirname "$0")"; mkdir -p salida
run() { nombre=$1; shift; echo "== $nombre $* $(date +%T)"; env "${ENV[@]}" dotnet bin/Release/net8.0/GcReal.dll "$@" > salida/$nombre.json 2> salida/$nombre.err || echo "   FALLÓ $nombre"; }
ENV=()
run nada              escenario=nada  dur=10
run corta-100         escenario=corta dur=15 rate=100
run corta-200         escenario=corta dur=15 rate=200
run corta-400         escenario=corta dur=15 rate=400
run corta-800         escenario=corta dur=15 rate=800
run media-100         escenario=media dur=15 rate=200 vida=100
run media-500         escenario=media dur=15 rate=200 vida=500
run media-2000        escenario=media dur=15 rate=200 vida=2000
run media-5000        escenario=media dur=15 rate=200 vida=5000
run cache-256         escenario=cache dur=15 rate=200 cache=256
run cache-1024        escenario=cache dur=15 rate=200 cache=1024
run cache-2048        escenario=cache dur=15 rate=200 cache=2048
run loh               escenario=loh      dur=15 rate=200 obj=102400
run loh-pool          escenario=loh-pool dur=15 rate=200 obj=102400
run loh-chico         escenario=loh      dur=15 rate=200 obj=81920
run finalizador       escenario=finalizador dur=15 rate=200 obj=1024
run crecer            escenario=crecer dur=20 rate=25
run sustained-1024    escenario=cache dur=15 rate=200 cache=1024 latencia=sustained
run cache-media-1024  escenario=cache-media dur=15 rate=200 cache=1024 vida=500
run cache-media-2048  escenario=cache-media dur=15 rate=200 cache=2048 vida=500
run sustained-media-1024 escenario=cache-media dur=15 rate=200 cache=1024 vida=500 latencia=sustained
ENV=(DOTNET_gcConcurrent=0)
run noconc-cache-1024 escenario=cache dur=15 rate=200 cache=1024
run noconc-crecer     escenario=crecer dur=20 rate=25
run noconc-cache-media-1024 escenario=cache-media dur=15 rate=200 cache=1024 vida=500
run noconc-media-500  escenario=media dur=15 rate=200 vida=500
ENV=(DOTNET_gcServer=1)
run server-corta-200  escenario=corta dur=15 rate=200
run server-media-500  escenario=media dur=15 rate=200 vida=500
run server-cache-1024 escenario=cache dur=15 rate=200 cache=1024
run server-crecer     escenario=crecer dur=20 rate=25
run server-cache-media-1024 escenario=cache-media dur=15 rate=200 cache=1024 vida=500
ENV=(DOTNET_gcServer=1 DOTNET_GCDynamicAdaptationMode=1)
run datas-corta-200   escenario=corta dur=15 rate=200
run datas-media-500   escenario=media dur=15 rate=200 vida=500
ENV=(DOTNET_GCgen0size=0x400000)
run gen0-4mb-corta    escenario=corta dur=15 rate=200
run gen0-4mb-media    escenario=media dur=15 rate=200 vida=500
ENV=(DOTNET_GCgen0size=0x10000000)
run gen0-256mb-corta  escenario=corta dur=15 rate=200
run gen0-256mb-media  escenario=media dur=15 rate=200 vida=500
echo FIN
