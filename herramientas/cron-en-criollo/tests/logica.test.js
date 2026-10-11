// Tests de la lógica pura. Se corren con: node --test herramientas/cron-en-criollo/tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../logica.js");

const AR = "America/Argentina/Buenos_Aires";
const DESDE = Date.UTC(2026, 9, 11, 6, 0, 0);   // domingo 11/10/2026 03:00:00 en Argentina
const frase = (e, m) => C.describir(C.parsear(e, m)).frase;
const prox = (e, n, zona, desde) => C.proximas(C.parsear(e), { desde: desde ?? DESDE, zona: zona || AR, cantidad: n || 3 }).map((t) => C.formatearFecha(t, zona || AR));

test("parsear: dialecto automático y explícito", () => {
  assert.equal(C.parsear("0 3 * * *").modo, "estandar");
  assert.equal(C.parsear("0 0 3 * * ?").modo, "quartz");
  assert.equal(C.parsear("0 0 3 * * ? 2027").modo, "quartz");
  assert.equal(C.parsear("0 3 * * *", "estandar").nCampos, 5);
  assert.throws(() => C.parsear("0 3 * * *", "quartz"), /necesita el campo de segundos/);
  assert.throws(() => C.parsear("0 0 3 * * ?", "estandar"), /no lleva segundos/);
  assert.throws(() => C.parsear("0 0 3 * * ? 2027", "estandar"), /no tiene campo de año/);
  assert.throws(() => C.parsear("* * * *"), /Tiene 4 campos/);
  assert.throws(() => C.parsear(""), /Escribí/);
  assert.throws(() => C.parsear("@raro"), /no es un atajo/);
  assert.equal(C.parsear("@daily").texto, "0 0 * * *");
  assert.equal(C.parsear("  0   3 * *  *  ").texto, "0 3 * * *");
});

test("parsear: valores, nombres y numeración de la semana", () => {
  const e = C.parsear("0 9 * * MON-FRI");
  assert.deepEqual([...e.campos.dow.valores], [1, 2, 3, 4, 5]);
  assert.deepEqual([...C.parsear("0 9 * * 7").campos.dow.valores], [0], "7 es domingo en estándar");
  assert.deepEqual([...C.parsear("0 0 9 ? * 1").campos.dow.valores], [0], "1 es domingo en Quartz");
  assert.deepEqual([...C.parsear("0 0 9 ? * 2-6").campos.dow.valores], [1, 2, 3, 4, 5]);
  assert.deepEqual([...C.parsear("0 0 9 ? * FRI-MON").campos.dow.valores].sort(), [0, 1, 5, 6], "vuelta de semana");
  assert.deepEqual([...C.parsear("0 0 1 jan,JUL *").campos.mes.valores], [1, 7]);
  assert.deepEqual([...C.parsear("*/20 * * * *").campos.min.valores], [0, 20, 40]);
  assert.deepEqual([...C.parsear("5/20 * * * *").campos.min.valores], [5, 25, 45]);
  assert.deepEqual([...C.parsear("8-18/5 * * * *").campos.min.valores], [8, 13, 18]);
  assert.throws(() => C.parsear("60 * * * *"), /se va de rango/);
  assert.throws(() => C.parsear("0 0 * * 8"), /0 \(domingo\) a 6/);
  assert.throws(() => C.parsear("0 0 0 * * 8"), /1 \(domingo\) a 7/);
  assert.throws(() => C.parsear("0 0 0 * * 0"), /1 \(domingo\) a 7/);
  assert.throws(() => C.parsear("0 0 * * LUN"), /no es un día de la semana válido/);
  assert.throws(() => C.parsear("5-1 * * * *"), /al revés/);
  assert.throws(() => C.parsear("1,,2 * * * *"), /coma de más/);
  assert.throws(() => C.parsear("*/0 * * * *"), /al menos 1/);
  assert.throws(() => C.parsear("0 0 ? * MON"), /es de Quartz/);
  assert.throws(() => C.parsear("0 0 L * *"), /sintaxis de Quartz/);
});

test("parsear: reglas de Quartz (?, L, W, #) y el error con sugerencia", () => {
  let err;
  try { C.parsear("0 0 12 * * *"); } catch (e) { err = e; }
  assert.match(err.message, /exige "\?"/);
  assert.equal(err.sugerencia, "0 0 12 * * ?");
  try { C.parsear("0 0 12 * * MON"); } catch (e) { err = e; }
  assert.equal(err.sugerencia, "0 0 12 ? * MON");
  assert.deepEqual(C.parsear("0 0 12 L * ?").campos.dia.especiales, [{ tipo: "L" }]);
  assert.deepEqual(C.parsear("0 0 12 L-3 * ?").campos.dia.especiales, [{ tipo: "L-", n: 3 }]);
  assert.deepEqual(C.parsear("0 0 12 LW * ?").campos.dia.especiales, [{ tipo: "LW" }]);
  assert.deepEqual(C.parsear("0 0 12 15W * ?").campos.dia.especiales, [{ tipo: "W", n: 15 }]);
  assert.deepEqual(C.parsear("0 0 12 ? * 6L").campos.dow.especiales, [{ tipo: "ultimo", dow: 5 }]);
  assert.deepEqual(C.parsear("0 0 12 ? * FRIL").campos.dow.especiales, [{ tipo: "ultimo", dow: 5 }]);
  assert.deepEqual(C.parsear("0 0 12 ? * MON#2").campos.dow.especiales, [{ tipo: "enesimo", dow: 1, n: 2 }]);
  assert.deepEqual([...C.parsear("0 0 12 ? * L").campos.dow.valores], [6], "L solo en díaSem es sábado");
  assert.throws(() => C.parsear("0 0 12 ? * MON#6"), /va de 1 a 5/);
  assert.throws(() => C.parsear("0 0 12 32W * ?"), /va de 1 a 31/);
  assert.throws(() => C.parsear("0 0 12 ? * ?"), /no en los dos/);
  assert.throws(() => C.parsear("0 0 12 ? JUL ?"), /no en los dos/);
  assert.deepEqual([...C.parsear("0 0 12 ? JUL *").campos.mes.valores], [7], "JUL no se confunde con L");
  assert.throws(() => C.parsear("0 ? 12 * * ?"), /solo va en día/);
});

test("avisos: pasos que no dividen, día 31, dos restricciones de día, numeración", () => {
  assert.match(C.parsear("*/7 * * * *").avisos[0], /60 no es múltiplo de 7/);
  assert.equal(C.parsear("*/15 * * * *").avisos.length, 0);
  assert.match(C.parsear("0 0 31 * *").avisos[0], /no existe en todos los meses/);
  assert.equal(C.parsear("0 0 31 1 *").avisos.length, 0, "con mes fijo no avisa");
  assert.match(C.parsear("0 9 13 * FRI").avisos[0], /cualquiera de los dos/);
  assert.match(C.parsear("0 9 * * 1").avisos[0], /1 es lunes/);
  assert.match(C.parsear("0 0 9 ? * 7").avisos[0], /7 es sábado/);
  assert.equal(C.parsear("0 9 * * MON").avisos.length, 0, "con nombres no avisa");
});

test("describir: frases en castellano", () => {
  const casos = [
    ["*/5 * * * *", "Cada 5 minutos, todos los días."],
    ["0 3 * * *", "A las 03:00, todos los días."],
    ["30 8 * * MON-FRI", "A las 08:30, de lunes a viernes."],
    ["*/15 8-18 * * 1-5", "Cada 15 minutos, de 8 a 18 hs, de lunes a viernes."],
    ["0 0 1 * *", "A las 00:00, el día 1 de cada mes."],
    ["0 9,17 * * *", "A las 09:00 y 17:00, todos los días."],
    ["0 9 1,15 * *", "A las 09:00, los días 1 y 15 de cada mes."],
    ["0 0 * * 0,6", "A las 00:00, los sábados y domingos."],
    ["0 0 * * 1,3,5", "A las 00:00, los lunes, miércoles y viernes."],
    ["0 0 25 12 *", "A las 00:00, el 25 de diciembre."],
    ["0 0 1 1,7 *", "A las 00:00, el día 1 de cada mes, en enero y julio."],
    ["0 0 1 */3 *", "A las 00:00, el día 1 de cada mes, cada 3 meses (desde enero)."],
    ["0 9 13 * FRI", "A las 09:00, el día 13 de cada mes y también los viernes."],
    ["0 * * * *", "En punto, todos los días."],
    ["15 * * * *", "A los 15 minutos de cada hora, todos los días."],
    ["0 */2 * * *", "En punto, cada 2 horas, todos los días."],
    ["@weekly", "A las 00:00, los domingos."],
    ["*/30 * * * * ?", "Cada 30 segundos, todos los días."],
    ["* * * * * ?", "Cada segundo, todos los días."],
    ["15 * * * * ?", "Cada minuto, en el segundo 15, todos los días."],
    ["0 0 12 * * ?", "A las 12:00, todos los días."],
    ["30 15 10 * * ?", "A las 10:15:30, todos los días."],
    ["0 0 18 ? * 6L", "A las 18:00, el último viernes del mes."],
    ["0 30 23 LW * ?", "A las 23:30, el último día hábil del mes."],
    ["0 0 10 ? * TUE#2", "A las 10:00, el segundo martes del mes."],
    ["0 0 12 15W * ?", "A las 12:00, el día hábil más cercano al 15."],
    ["0 0 12 L-3 * ?", "A las 12:00, 3 días antes de fin de mes."],
    ["0 15 10 ? * MON-FRI 2027", "A las 10:15, de lunes a viernes, en 2027."],
    ["0 0 0 1 1 ? 2030-2032", "A las 00:00, el 1 de enero, de 2030 a 2032."],
    ["0 0/5 14,18 * * ?", "Cada 5 minutos, a las 14 y 18 hs, todos los días."],
    ["0 0 12 ? * FRI-MON", "A las 12:00, de viernes a lunes."],
  ];
  for (const [e, esperado] of casos) assert.equal(frase(e), esperado, e);
  const d = C.describir(C.parsear("0 0 9 ? * 2-6")).detalle;
  assert.equal(d.length, 6);
  assert.deepEqual(d.map((x) => x.nombre), ["Segundo", "Minuto", "Hora", "Día del mes", "Mes", "Día de la semana"]);
  assert.equal(d[3].significado, "sin restricción (lo decide el otro campo de día)");
  assert.equal(d[5].significado, "de lunes a viernes (1 = domingo)");
});

test("proximas: fechas conocidas en hora argentina", () => {
  assert.deepEqual(prox("0 3 * * *"), ["lunes 12/10/2026 03:00:00", "martes 13/10/2026 03:00:00", "miércoles 14/10/2026 03:00:00"], "a las 3 en punto ya pasó hoy");
  assert.deepEqual(prox("0 9 * * MON-FRI", 2), ["lunes 12/10/2026 09:00:00", "martes 13/10/2026 09:00:00"]);
  assert.deepEqual(prox("*/15 8-18 * * 1-5", 2), ["lunes 12/10/2026 08:00:00", "lunes 12/10/2026 08:15:00"]);
  assert.deepEqual(prox("0 0 1 * *", 2), ["domingo 01/11/2026 00:00:00", "martes 01/12/2026 00:00:00"]);
  assert.deepEqual(prox("0 0 29 2 *", 2), ["martes 29/02/2028 00:00:00", "domingo 29/02/2032 00:00:00"], "bisiestos");
  assert.deepEqual(prox("0 0 31 * *", 3), ["sábado 31/10/2026 00:00:00", "jueves 31/12/2026 00:00:00", "domingo 31/01/2027 00:00:00"]);
  assert.deepEqual(prox("0 9 13 * FRI", 3), ["martes 13/10/2026 09:00:00", "viernes 16/10/2026 09:00:00", "viernes 23/10/2026 09:00:00"], "OR en estándar");
  assert.deepEqual(prox("*/30 * * * * ?", 3), ["domingo 11/10/2026 03:00:30", "domingo 11/10/2026 03:01:00", "domingo 11/10/2026 03:01:30"]);
  assert.deepEqual(prox("0 0 18 ? * 6L", 3), ["viernes 30/10/2026 18:00:00", "viernes 27/11/2026 18:00:00", "viernes 25/12/2026 18:00:00"]);
  assert.deepEqual(prox("0 30 23 LW * ?", 3), ["viernes 30/10/2026 23:30:00", "lunes 30/11/2026 23:30:00", "jueves 31/12/2026 23:30:00"]);
  assert.deepEqual(prox("0 0 10 ? * TUE#2", 3), ["martes 13/10/2026 10:00:00", "martes 10/11/2026 10:00:00", "martes 08/12/2026 10:00:00"]);
  assert.deepEqual(prox("0 0 12 15W * ?", 3), ["jueves 15/10/2026 12:00:00", "lunes 16/11/2026 12:00:00", "martes 15/12/2026 12:00:00"], "15/11 es domingo → lunes 16");
  assert.deepEqual(prox("0 0 12 1W * ?", 2), ["lunes 02/11/2026 12:00:00", "martes 01/12/2026 12:00:00"], "1/11 es domingo → lunes 2, no octubre");
  assert.deepEqual(prox("0 0 12 L-3 * ?", 2), ["miércoles 28/10/2026 12:00:00", "viernes 27/11/2026 12:00:00"]);
  assert.deepEqual(prox("0 0 12 L * ?", 2), ["sábado 31/10/2026 12:00:00", "lunes 30/11/2026 12:00:00"]);
  assert.deepEqual(prox("0 15 10 ? * MON-FRI 2027", 1), ["viernes 01/01/2027 10:15:00"]);
  assert.deepEqual(prox("0 0 0 1 1 ? 2030-2032", 3), ["martes 01/01/2030 00:00:00", "miércoles 01/01/2031 00:00:00", "jueves 01/01/2032 00:00:00"]);
  assert.deepEqual(prox("0 0 0 1 1 ? 2020", 3), [], "año pasado: nada");
  assert.deepEqual(prox("0 0 30 2 *", 1), [], "30 de febrero: nunca");
  assert.deepEqual(prox("0 0 12 ? * FRI-MON", 4), ["domingo 11/10/2026 12:00:00", "lunes 12/10/2026 12:00:00", "viernes 16/10/2026 12:00:00", "sábado 17/10/2026 12:00:00"]);
});

test("proximas: zonas horarias (UTC vs Argentina) y horario de verano", () => {
  // 03:00 de Argentina es 06:00 UTC. "0 5 * * *" en UTC es 02:00 de Argentina.
  const utc = C.proximas(C.parsear("0 5 * * *"), { desde: DESDE, zona: "UTC", cantidad: 1 })[0];
  assert.equal(C.formatearFecha(utc, "UTC"), "lunes 12/10/2026 05:00:00");
  assert.equal(C.formatearFecha(utc, AR), "lunes 12/10/2026 02:00:00");
  const ar = C.proximas(C.parsear("0 5 * * *"), { desde: DESDE, zona: AR, cantidad: 1 })[0];
  assert.equal(C.formatearFecha(ar, AR), "domingo 11/10/2026 05:00:00", "en Argentina las 5 todavía no pasaron");
  assert.equal(C.formatearFecha(ar, "UTC"), "domingo 11/10/2026 08:00:00", "Argentina está 3 horas atrás de UTC");
  // Nueva York cambia el reloj el 1/11/2026 a las 2:00: el job de las 9 sigue siendo a las 9 de pared.
  const ny = C.proximas(C.parsear("0 9 * * *"), { desde: Date.UTC(2026, 9, 31, 12), zona: "America/New_York", cantidad: 2 });
  assert.equal(C.formatearFecha(ny[0], "America/New_York"), "sábado 31/10/2026 09:00:00");
  assert.equal(C.formatearFecha(ny[1], "America/New_York"), "domingo 01/11/2026 09:00:00");
  assert.equal(ny[1] - ny[0], 25 * 3600 * 1000, "ese día dura 25 horas");
  assert.ok(C.zonaValida("Europe/Madrid") && !C.zonaValida("Marte/Base"));
});

test("instante y partes son inversas", () => {
  const t = C.instante(2026, 10, 11, 3, 0, 0, AR);
  assert.equal(t, DESDE);
  assert.deepEqual(C.partes(t, AR), { anio: 2026, mes: 10, dia: 11, hora: 3, min: 0, seg: 0 });
  assert.deepEqual(C.partes(C.instante(2026, 12, 32, 0, 0, 0, AR), AR), { anio: 2027, mes: 1, dia: 1, hora: 0, min: 0, seg: 0 }, "desborde de día");
  assert.equal(C.diaHabilCercano(2026, 11, 15), 16, "domingo 15 → lunes 16");
  assert.equal(C.diaHabilCercano(2026, 11, 1), 2, "domingo 1 → lunes 2");
  assert.equal(C.diaHabilCercano(2026, 10, 31), 30, "sábado 31 → viernes 30");
  assert.equal(C.diaHabilCercano(2026, 8, 1), 3, "sábado 1 → lunes 3");
  assert.equal(C.diaHabilCercano(2027, 1, 31), 29, "domingo 31 → viernes 29");
});

test("convertir entre dialectos", () => {
  assert.equal(C.convertir(C.parsear("0 9 * * 1-5"), "quartz"), "0 0 9 ? * 2-6");
  assert.equal(C.convertir(C.parsear("0 9 * * MON-FRI"), "quartz"), "0 0 9 ? * MON-FRI");
  assert.equal(C.convertir(C.parsear("0 9 * * 0,7"), "quartz"), "0 0 9 ? * 1,1");
  assert.equal(C.convertir(C.parsear("30 8 1 * *"), "quartz"), "0 30 8 1 * ?");
  assert.equal(C.convertir(C.parsear("*/5 * * * *"), "quartz"), "0 */5 * * * ?");
  assert.equal(C.convertir(C.parsear("0 0 9 ? * 2-6"), "estandar"), "0 9 * * 1-5");
  assert.equal(C.convertir(C.parsear("0 30 8 1 * ?"), "estandar"), "30 8 1 * *");
  assert.equal(C.convertir(C.parsear("0 9 * * *"), "estandar"), "0 9 * * *", "mismo dialecto: igual");
  assert.throws(() => C.convertir(C.parsear("0 9 13 * FRI"), "quartz"), /no tiene equivalente/);
  assert.throws(() => C.convertir(C.parsear("30 0 9 * * ?"), "estandar"), /no tiene segundos/);
  assert.throws(() => C.convertir(C.parsear("0 0 9 L * ?"), "estandar"), /no existen en cron estándar/);
  assert.throws(() => C.convertir(C.parsear("0 0 9 * * ? 2027"), "estandar"), /no tiene año/);
  // Lo convertido se vuelve a parsear y describe igual.
  assert.equal(frase(C.convertir(C.parsear("0 9 * * 1-5"), "quartz")), frase("0 9 * * 1-5"));
});

test("snippets, formato relativo y duración", () => {
  const s = C.snippets("0 3 * * *", "estandar", AR);
  assert.match(s.hangfire, /RecurringJob\.AddOrUpdate<MiJob>\(/);
  assert.match(s.hangfire, /"0 3 \* \* \*"/);
  assert.match(s.hangfire, /FindSystemTimeZoneById\("America\/Argentina\/Buenos_Aires"\)/);
  assert.match(s.quartz, /convertí/);
  assert.match(s.ncrontab, /CrontabSchedule\.Parse/);
  const q = C.snippets("0 0 3 * * ?", "quartz", "UTC");
  assert.match(q.quartz, /WithCronSchedule\("0 0 3 \* \* \?", x => x\.InTimeZone\(TimeZoneInfo\.Utc\)\)/);
  assert.match(q.hangfire, /Cronos/);
  assert.equal(C.relativo(DESDE + 45 * 1000, DESDE), "en 45 s");
  assert.equal(C.relativo(DESDE + 7 * 60 * 1000, DESDE), "en 7 min");
  assert.equal(C.relativo(DESDE + (2 * 3600 + 30 * 60) * 1000, DESDE), "en 2 h 30 min");
  assert.equal(C.relativo(DESDE + 86400 * 3 * 1000, DESDE), "en 3 días");
  assert.equal(C.relativo(DESDE + 86400 * 400 * 1000, DESDE), "en 1.1 años");
  assert.equal(C.duracion(15 * 60 * 1000), "15 min");
  assert.equal(C.duracion(90 * 1000), "1 min 30 s");
  assert.equal(C.duracion(25 * 3600 * 1000), "1 d 1 h");
  assert.equal(C.duracion(7 * 86400 * 1000), "7 días");
  for (const e of C.EJEMPLOS) assert.doesNotThrow(() => C.parsear(e.expr), e.expr);
});
