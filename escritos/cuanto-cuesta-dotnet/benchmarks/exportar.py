# Convierte el JSON completo de BenchmarkDotNet en resultados.json (compacto) para el escrito.
import json, glob, sys, re
# Primero el reporte conjunto (define el orden y la base de cada capítulo); después las corridas sueltas, que pisan.
src = sorted(glob.glob(sys.argv[1] + "/BenchmarkDotNet.Artifacts/results/*-report-full.json"), key=lambda f: (0 if "joined" in f else 1, f))
dest = sys.argv[2]
caps = {}
host = None
for f in src:
    d = json.load(open(f))
    host = host or d.get("HostEnvironmentInfo")
    for b in d["Benchmarks"]:
        tipo = b["Type"]; st = b["Statistics"]; mem = b.get("Memory") or {}
        if not st: print("sin estadísticas:", tipo, b["Method"]); continue
        # Un reporte posterior (una corrida sola) pisa al anterior para el mismo método.
        caps.setdefault(tipo, [])
        fila = {
            "metodo": b["Method"],
            "mediaNs": round(st["Mean"], 3), "errorNs": round(st.get("StandardError", 0) * 1.96, 3), "medianaNs": round(st["Median"], 3),
            "desvioNs": round(st["StandardDeviation"], 3),
            "bytes": mem.get("BytesAllocatedPerOperation"), "gen0": mem.get("Gen0Collections"), "gen1": mem.get("Gen1Collections"), "gen2": mem.get("Gen2Collections"),
        }
        previos = [i for i, x in enumerate(caps[tipo]) if x["metodo"] == b["Method"]]
        if previos: caps[tipo][previos[0]] = fila
        else: caps[tipo].append(fila)
for tipo, lista in caps.items():
    base = lista[0]["mediaNs"]
    for b in lista:
        b["ratio"] = round(b["mediaNs"] / base, 3) if base else None
salida = {"entorno": {
    "runtime": host.get("RuntimeVersion"), "benchmarkDotNet": host.get("BenchmarkDotNetVersion"), "os": host.get("OsVersion"),
    "cpu": host.get("ProcessorName"), "nucleosLogicos": host.get("LogicalCoreCount"), "nucleosFisicos": host.get("PhysicalCoreCount"),
    "configuracion": host.get("Configuration"),
    "job": "ShortRun: 1 lanzamiento, 3 calentamientos, 5 iteraciones, Release, TieredPGO, workstation GC",
    "nota": "Contenedor Docker con 2 vCPU asignadas (cpuset) en una máquina compartida de la nube. Los valores absolutos cambian con el hardware; las relaciones entre variantes son lo que importa."},
    "capitulos": caps}
json.dump(salida, open(dest, "w"), ensure_ascii=False, indent=1)
for tipo, lista in caps.items():
    print(f"\n## {tipo}")
    for b in lista:
        print(f"  {b['metodo']:<40} {b['mediaNs']:>12,.1f} ns  x{b['ratio']:<8} {str(b['bytes']):>8} B  gen0={b['gen0']}")
