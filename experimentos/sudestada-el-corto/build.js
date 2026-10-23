/* Arma index.html a partir de src/: la página, los bloques GLSL (comun, main y una escena por archivo) y el JS.
     node build.js */
"use strict";
const fs = require("node:fs"), path = require("node:path");
const src = path.join(__dirname, "src");
const leer = (f) => fs.readFileSync(path.join(src, f), "utf8");
const escenas = fs.readdirSync(path.join(src, "escenas")).filter((f) => f.endsWith(".glsl")).sort();
const bloque = (id, cuerpo) => `<script id="${id}" type="x-shader/x-fragment">\n${cuerpo.trim()}\n</script>`;
let shaders = [bloque("glsl-comun", leer("comun.glsl")), bloque("glsl-main", leer("main.glsl"))];
for (const f of escenas) shaders.push(bloque("glsl-" + f.replace(/\.glsl$/, ""), leer("escenas/" + f)));
const scripts = `<script>\n"use strict";\n${leer("sonido.js").trim()}\n${leer("reproductor.js").trim()}\n</script>`;
let html = leer("pagina.html").replace("<!--SHADERS-->", shaders.join("\n")).replace("<!--SCRIPTS-->", scripts);
fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("index.html:", Math.round(html.length / 1024), "KB,", escenas.length, "escenas");
