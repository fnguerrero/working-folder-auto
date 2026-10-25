/* Regenera CalendarioArgentino.cs y feriados.json a partir de logica.js (los mismos que copia la página).
   Correr desde la raíz del repo después de tocar la lista: node herramientas/feriados-y-habiles/generar.js */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const F = require("./logica.js");

fs.writeFileSync(path.join(__dirname, "csharp", "CalendarioArgentino.cs"), F.csharp());
fs.writeFileSync(path.join(__dirname, "feriados.json"), F.json());
console.log(`Listo: ${F.FERIADOS.length} días de ${F.PRIMER_ANIO} a ${F.ULTIMO_ANIO}.`);
