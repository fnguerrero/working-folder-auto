#!/usr/bin/env python3
"""Arma sudestada.epub (EPUB 3, sin dependencias) desde capitulos/NN.md y meta.json.
    python3 epub.py            genera el .epub
    python3 epub.py --check    además verifica la estructura (mimetype primero y sin comprimir, XML bien formado)"""
import json, os, re, sys, zipfile, uuid, html, datetime
from xml.dom import minidom

RAIZ = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(RAIZ, "meta.json"), encoding="utf-8"))

def inline(s):
    return re.sub(r"\*([^*\n]+)\*", r"<em>\1</em>", html.escape(s, quote=False))

def parsear(md, n):
    titulo, cuando, partes, parrafo = "", "", [], []
    def cerrar():
        nonlocal parrafo
        if parrafo:
            partes.append("<p>%s</p>" % inline(" ".join(parrafo))); parrafo = []
    for l in md.replace("\r", "").split("\n"):
        if l.startswith("# ") and not titulo: titulo = l[2:].strip(); continue
        if l.startswith("> ") and not cuando: cuando = l[2:].strip(); continue
        if re.match(r"^---\s*$", l): cerrar(); partes.append('<p class="sep">⁂</p>'); continue
        if not l.strip(): cerrar(); continue
        parrafo.append(l.strip())
    cerrar()
    return {"n": n, "titulo": titulo, "cuando": cuando, "html": "\n".join(partes)}

caps = []
for f in sorted(os.listdir(os.path.join(RAIZ, "capitulos"))):
    if re.match(r"^\d\d\.md$", f):
        caps.append(parsear(open(os.path.join(RAIZ, "capitulos", f), encoding="utf-8").read(), int(f[:2])))

CSS = """body { font-family: Georgia, serif; line-height: 1.5; margin: 1em; }
h1 { font-weight: normal; font-size: 1.7em; margin: 1.5em 0 .3em; }
.num { display: block; font-size: .7em; letter-spacing: .12em; text-transform: uppercase; color: #666; }
.cuando { color: #666; font-style: italic; margin-bottom: 1.6em; }
p { margin: 0; text-indent: 1.4em; }
p.primero, h1 + p, .cuando + p, p.sep + p { text-indent: 0; }
p.sep { text-align: center; text-indent: 0; margin: 1.4em 0; color: #666; }
.portada { text-align: center; margin-top: 30%; }
.portada h1 { font-size: 2.6em; }
.sinopsis p { text-indent: 0; margin-bottom: .8em; text-align: left; }
"""
def xhtml(titulo, cuerpo):
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es-AR" lang="es-AR">\n'
            '<head><meta charset="utf-8"/><title>%s</title><link rel="stylesheet" type="text/css" href="style.css"/></head>\n<body>%s</body></html>\n' % (html.escape(titulo), cuerpo))

t = html.escape(meta["titulo"]); autor = html.escape(meta["autor"])
portada = xhtml(meta["titulo"], '<section class="portada" epub:type="titlepage"><h1>%s</h1><p class="primero"><em>%s</em></p><p class="primero">%s</p></section><section class="sinopsis">%s</section>'
                % (t, html.escape(meta["bajada"]), autor, "".join("<p>%s</p>" % inline(s) for s in meta["sinopsis"])))
nav = xhtml("Índice", '<nav epub:type="toc" id="toc"><h1>Capítulos</h1><ol>%s</ol></nav>' % "".join('<li><a href="cap-%02d.xhtml">%d. %s</a></li>' % (c["n"], c["n"], html.escape(c["titulo"])) for c in caps))
uid = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, "https://fnguerrero.github.io/working-folder-auto/escritos/sudestada/"))
fecha = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
manifest = ['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="css" href="style.css" media-type="text/css"/>', '<item id="portada" href="portada.xhtml" media-type="application/xhtml+xml"/>', '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>']
spine = ['<itemref idref="portada"/>', '<itemref idref="nav"/>']
for c in caps:
    manifest.append('<item id="cap%02d" href="cap-%02d.xhtml" media-type="application/xhtml+xml"/>' % (c["n"], c["n"]))
    spine.append('<itemref idref="cap%02d"/>' % c["n"])
opf = ('<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="es-AR">\n'
       '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">%s</dc:identifier><dc:title>%s</dc:title><dc:creator>%s</dc:creator><dc:language>es-AR</dc:language>'
       '<dc:description>%s</dc:description><meta property="dcterms:modified">%s</meta></metadata>\n<manifest>%s</manifest>\n<spine toc="ncx">%s</spine>\n</package>\n'
       % (uid, t, autor, html.escape(meta["descripcion"]), fecha, "".join(manifest), "".join(spine)))
ncx = ('<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="%s"/></head><docTitle><text>%s</text></docTitle><navMap>%s</navMap></ncx>\n'
       % (uid, t, "".join('<navPoint id="np%d" playOrder="%d"><navLabel><text>%d. %s</text></navLabel><content src="cap-%02d.xhtml"/></navPoint>' % (c["n"], i + 1, c["n"], html.escape(c["titulo"]), c["n"]) for i, c in enumerate(caps))))
salida = os.path.join(RAIZ, "sudestada.epub")
with zipfile.ZipFile(salida, "w") as z:
    z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/container.xml", '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n', zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/content.opf", opf, zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/nav.xhtml", nav, zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/toc.ncx", ncx, zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/style.css", CSS, zipfile.ZIP_DEFLATED)
    z.writestr("OEBPS/portada.xhtml", portada, zipfile.ZIP_DEFLATED)
    for c in caps:
        cuerpo = '<section epub:type="chapter"><h1><span class="num">Capítulo %d</span>%s</h1><p class="cuando">%s</p>%s</section>' % (c["n"], html.escape(c["titulo"]), html.escape(c["cuando"]), c["html"])
        z.writestr("OEBPS/cap-%02d.xhtml" % c["n"], xhtml("%d. %s" % (c["n"], c["titulo"]), cuerpo), zipfile.ZIP_DEFLATED)
print("sudestada.epub: %d capítulos, %d KB" % (len(caps), os.path.getsize(salida) // 1024))

if "--check" in sys.argv:
    with zipfile.ZipFile(salida) as z:
        nombres = z.namelist()
        assert nombres[0] == "mimetype" and z.getinfo("mimetype").compress_type == zipfile.ZIP_STORED, "mimetype tiene que ir primero y sin comprimir"
        assert z.read("mimetype") == b"application/epub+zip"
        for n in nombres:
            if n.endswith((".xhtml", ".opf", ".ncx", ".xml")):
                minidom.parseString(z.read(n))  # XML bien formado
        opf_txt = z.read("OEBPS/content.opf").decode()
        for href in re.findall(r'href="([^"]+)"', opf_txt):
            assert "OEBPS/" + href in nombres, "falta en el zip: " + href
    print("EPUB: estructura OK (%d archivos)" % len(nombres))
