#!/usr/bin/env python3
"""Genera las voces del corto con Piper (TTS neuronal, local) y ffmpeg.

    python3 voces/generar.py [--voces DIR] [--solo ID]

Lee voces/lineas.json (id, quien, variante, escena, t, texto), sintetiza cada línea con la voz de su personaje, le aplica el
tono, la velocidad y el filtro de la variante, la deja en voces/<id>.ogg (Opus mono, 32 kb/s) y anota la duración real en
lineas.json (campo dur). Solo regenera lo que cambió (texto, personaje o variante), según voces/.cache.json.

Las voces son las de Piper (https://github.com/rhasspy/piper). Hugging Face no se alcanza desde la nube, pero el release
«tts-models» de sherpa-onnx tiene las mismas voces reempaquetadas; se bajan con:
    for v in es_AR-daniela-high es_ES-davefx-medium es_ES-sharvard-medium; do
      curl -sSL -o $v.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-$v.tar.bz2 && tar xjf $v.tar.bz2
    done
y `pip install piper-tts`. --voces es la carpeta donde quedaron (por defecto, ../../../.voces-piper o $PIPER_VOCES)."""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, wave

AQUI = os.path.dirname(os.path.abspath(__file__))
PERSONAJES = {
    # modelo, hablante, tono (1 = el de la voz), velocidad (length_scale: más es más lento), seseo escrito para las voces de España
    "veronica": dict(modelo="es_AR-daniela-high", hablante=0, tono=1.0, largo=1.0, seseo=False),
    "ana":      dict(modelo="es_AR-daniela-high", hablante=0, tono=1.08, largo=0.93, seseo=False),
    "martin":   dict(modelo="es_ES-davefx-medium", hablante=0, tono=0.93, largo=1.08, seseo=True),
    "elias":    dict(modelo="es_ES-sharvard-medium", hablante=0, tono=1.0, largo=1.12, seseo=True),
    "acuna":    dict(modelo="es_ES-davefx-medium", hablante=0, tono=1.0, largo=1.0, seseo=True),
    "pereyra":  dict(modelo="es_ES-sharvard-medium", hablante=0, tono=1.05, largo=1.1, seseo=True),
}
# filtros de ffmpeg por variante (después del tono): normal = voz en escena; off = voz interior, más cerca y más seca;
# telefono = por el teléfono; grito = más fuerte y un poco más agudo; puerta = del otro lado de una puerta
VARIANTES = {
    "normal":   dict(tono=1.0, largo=1.0, filtro="highpass=f=80,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120,volume=1.0"),
    "off":      dict(tono=0.98, largo=1.04, filtro="highpass=f=70,lowpass=f=9000,acompressor=threshold=-20dB:ratio=3:attack=6:release=150,volume=0.9"),
    "telefono": dict(tono=1.0, largo=1.0, filtro="highpass=f=400,lowpass=f=2800,acompressor=threshold=-24dB:ratio=6:attack=3:release=80,volume=1.4,alimiter=limit=0.9"),
    "grito":    dict(tono=1.04, largo=0.88, filtro="highpass=f=120,acompressor=threshold=-26dB:ratio=5:attack=2:release=60,volume=1.6,alimiter=limit=0.95"),
    "puerta":   dict(tono=1.02, largo=0.92, filtro="highpass=f=150,lowpass=f=2200,acompressor=threshold=-22dB:ratio=4:attack=3:release=80,volume=1.3"),
}

def seseo(texto):
    """Las voces de España pronuncian la ce y la zeta a la española; escribiéndolas con ese salen como acá."""
    texto = re.sub(r"c(?=[eéií])", "s", texto); texto = re.sub(r"C(?=[eéií])", "S", texto)
    return texto.replace("z", "s").replace("Z", "S")

def duracion(wav):
    with wave.open(wav) as w: return w.getnframes() / w.getframerate()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--voces", default=os.environ.get("PIPER_VOCES", os.path.join(AQUI, "..", "..", "..", ".voces-piper"))); ap.add_argument("--solo"); ap.add_argument("--forzar", action="store_true")
    args = ap.parse_args()
    ruta = os.path.join(AQUI, "lineas.json"); lineas = json.load(open(ruta, encoding="utf-8"))
    cache_ruta = os.path.join(AQUI, ".cache.json"); cache = json.load(open(cache_ruta)) if os.path.exists(cache_ruta) else {}
    hechas = 0
    for l in lineas:
        if args.solo and l["id"] != args.solo: continue
        p = PERSONAJES[l["quien"]]; v = VARIANTES[l.get("variante", "normal")]
        texto = l.get("texto_voz") or l["texto"]
        if p["seseo"]: texto = seseo(texto)
        clave = hashlib.sha1(json.dumps([texto, p, v], sort_keys=True).encode()).hexdigest()
        salida = os.path.join(AQUI, l["id"] + ".ogg")
        if not args.forzar and cache.get(l["id"]) == clave and os.path.exists(salida) and l.get("dur"): continue
        carpeta = os.path.join(args.voces, "vits-piper-" + p["modelo"]); modelo = os.path.join(carpeta, p["modelo"] + ".onnx")
        if not os.path.exists(modelo): sys.exit(f"falta la voz {p['modelo']} en {carpeta} (ver la cabecera de este script)")
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, "v.wav")
            subprocess.run([sys.executable, "-m", "piper", "-m", modelo, "-c", modelo + ".json", "-s", str(p["hablante"]), "--length-scale", str(p["largo"] * v["largo"]), "--sentence-silence", "0.25", "-f", wav], input=texto.encode("utf-8"), check=True, stderr=subprocess.DEVNULL)
            tono = p["tono"] * v["tono"]
            filtro = f"asetrate=22050*{tono:.4f},aresample=48000,atempo={1.0 / tono:.4f},{v['filtro']},loudnorm=I=-19:LRA=6:TP=-1.5,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", filtro, "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", salida], check=True)
            # la duración real, del .ogg ya filtrado
            d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", salida], capture_output=True, text=True, check=True).stdout.strip()
            l["dur"] = round(float(d), 2)
        cache[l["id"]] = clave; hechas += 1
        print(f"{l['id']}: {l['dur']} s  «{l['texto'][:60]}»")
    json.dump(lineas, open(ruta, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(cache, open(cache_ruta, "w"), indent=0)
    print(f"{hechas} líneas generadas, {len(lineas)} en total")

if __name__ == "__main__": main()
