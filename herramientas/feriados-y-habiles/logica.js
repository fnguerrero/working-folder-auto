/* Feriados y días hábiles: lógica pura. Se carga en el navegador (window.Feriados) y en Node (module.exports).
   Tiene la lista de feriados nacionales de Argentina de 2024 a 2027 con su fuente, las cuentas de días hábiles
   (sumar, contar entre dos fechas, qué es un día) y arma el JSON y la clase C# con los mismos datos.
   Las fechas van como texto AAAA-MM-DD y se cuentan como días enteros en UTC, sin horas ni zonas. No toca el DOM. */
"use strict";
(function (raiz) {

  const PRIMER_ANIO = 2024;
  const ULTIMO_ANIO = 2027;
  const CONSULTADO = "2026-10-25";
  const URL = "https://fnguerrero.github.io/working-folder-auto/herramientas/feriados-y-habiles/";

  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* Tipos de día no laborable. «Feriado» son los tres primeros: no se trabaja y si se trabaja se paga doble.
     Los otros dos son días no laborables: el sector público no trabaja y en el privado decide el empleador. */
  const TIPOS = {
    inamovible: { nombre: "Feriado inamovible", feriado: true },
    trasladable: { nombre: "Feriado trasladable", feriado: true },
    turistico: { nombre: "Feriado con fines turísticos", feriado: true },
    puente: { nombre: "Día no laborable con fines turísticos", feriado: false },
    "no laborable": { nombre: "Día no laborable", feriado: false },
  };

  const LEY = "Ley 27.399";
  const CONCEPTOS = {
    anio: { nombre: "Año Nuevo", tipo: "inamovible" },
    carnaval: { nombre: "Carnaval", tipo: "inamovible" },
    memoria: { nombre: "Día Nacional de la Memoria por la Verdad y la Justicia", tipo: "inamovible" },
    malvinas: { nombre: "Día del Veterano y de los Caídos en la Guerra de Malvinas", tipo: "inamovible" },
    juevesSanto: { nombre: "Jueves Santo", tipo: "no laborable" },
    viernesSanto: { nombre: "Viernes Santo", tipo: "inamovible" },
    trabajo: { nombre: "Día del Trabajador", tipo: "inamovible" },
    mayo: { nombre: "Día de la Revolución de Mayo", tipo: "inamovible" },
    guemes: { nombre: "Paso a la Inmortalidad del General Martín Miguel de Güemes", tipo: "trasladable", dia: "06-17" },
    belgrano: { nombre: "Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)", tipo: "inamovible" },
    independencia: { nombre: "Día de la Independencia", tipo: "inamovible" },
    sanMartin: { nombre: "Paso a la Inmortalidad del General José de San Martín", tipo: "trasladable", dia: "08-17" },
    diversidad: { nombre: "Día del Respeto a la Diversidad Cultural", tipo: "trasladable", dia: "10-12" },
    soberania: { nombre: "Día de la Soberanía Nacional", tipo: "trasladable", dia: "11-20" },
    inmaculada: { nombre: "Inmaculada Concepción de María", tipo: "inamovible" },
    navidad: { nombre: "Navidad", tipo: "inamovible" },
    turistico: { nombre: "Feriado con fines turísticos (puente)", tipo: "turistico" },
    puente: { nombre: "Día no laborable con fines turísticos (puente)", tipo: "puente" },
  };

  /* La lista. Cada fila: fecha real, concepto y, si hace falta, la fecha original, la fuente y una nota.
     Para los trasladables sin «original», la fecha real es la de la ley (cayó lunes o fin de semana). */
  const DATOS = [
    // 2024: Pascua el 31/3. Puentes: Decreto 106/2023 (fueron feriados, no días no laborables).
    ["2024-01-01", "anio"], ["2024-02-12", "carnaval"], ["2024-02-13", "carnaval"], ["2024-03-24", "memoria"],
    ["2024-03-28", "juevesSanto"], ["2024-03-29", "viernesSanto"], ["2024-04-01", "turistico", { fuente: "Decreto 106/2023" }],
    ["2024-04-02", "malvinas"], ["2024-05-01", "trabajo"], ["2024-05-25", "mayo"], ["2024-06-17", "guemes"],
    ["2024-06-20", "belgrano"], ["2024-06-21", "turistico", { fuente: "Decreto 106/2023" }], ["2024-07-09", "independencia"],
    ["2024-08-17", "sanMartin"], ["2024-10-11", "turistico", { fuente: "Decreto 106/2023" }], ["2024-10-12", "diversidad"],
    ["2024-11-18", "soberania", { original: "2024-11-20" }], ["2024-12-08", "inmaculada"], ["2024-12-25", "navidad"],

    // 2025: Pascua el 20/4. Puentes: Decreto 1027/2024. El 12/10 cayó domingo y se pasó al viernes 10 (Decreto 614/2025 y Resolución 139/2025).
    ["2025-01-01", "anio"], ["2025-03-03", "carnaval"], ["2025-03-04", "carnaval"], ["2025-03-24", "memoria"],
    ["2025-04-02", "malvinas"], ["2025-04-17", "juevesSanto"], ["2025-04-18", "viernesSanto"], ["2025-05-01", "trabajo"],
    ["2025-05-02", "puente", { fuente: "Decreto 1027/2024" }], ["2025-05-25", "mayo"], ["2025-06-16", "guemes", { original: "2025-06-17" }],
    ["2025-06-20", "belgrano"], ["2025-07-09", "independencia"], ["2025-08-15", "puente", { fuente: "Decreto 1027/2024" }],
    ["2025-08-17", "sanMartin", { nota: "Cayó domingo y quedó ahí: el Decreto 614/2025, que permite mover los trasladables de fin de semana, salió el 28/8/2025." }],
    ["2025-10-10", "diversidad", { original: "2025-10-12", fuente: "Decreto 614/2025 y Resolución 139/2025 (Jefatura de Gabinete)", nota: "Cayó domingo y se adelantó al viernes anterior." }],
    ["2025-11-21", "puente", { fuente: "Decreto 1027/2024" }], ["2025-11-24", "soberania", { original: "2025-11-20" }],
    ["2025-12-08", "inmaculada"], ["2025-12-25", "navidad"],

    // 2026: Pascua el 5/4. Puentes: Resolución 164/2025 de la Jefatura de Gabinete (Boletín Oficial del 26/12/2025).
    ["2026-01-01", "anio"], ["2026-02-16", "carnaval"], ["2026-02-17", "carnaval"], ["2026-03-23", "puente", { fuente: "Resolución 164/2025 (Jefatura de Gabinete)" }],
    ["2026-03-24", "memoria"], ["2026-04-02", "malvinas"], ["2026-04-02", "juevesSanto", { nota: "Coincide con Malvinas, así que es feriado igual." }],
    ["2026-04-03", "viernesSanto"], ["2026-05-01", "trabajo"], ["2026-05-25", "mayo"], ["2026-06-15", "guemes", { original: "2026-06-17" }],
    ["2026-06-20", "belgrano"], ["2026-07-09", "independencia"], ["2026-07-10", "puente", { fuente: "Resolución 164/2025 (Jefatura de Gabinete)" }],
    ["2026-08-17", "sanMartin"], ["2026-10-12", "diversidad"], ["2026-11-23", "soberania", { original: "2026-11-20" }],
    ["2026-12-07", "puente", { fuente: "Resolución 164/2025 (Jefatura de Gabinete)" }], ["2026-12-08", "inmaculada"], ["2026-12-25", "navidad"],

    // 2027: Pascua el 28/3. Lo que fija la ley está; faltan los puentes y saber qué pasa con el 20/11, que cae sábado.
    ["2027-01-01", "anio"], ["2027-02-08", "carnaval"], ["2027-02-09", "carnaval"], ["2027-03-24", "memoria"],
    ["2027-03-25", "juevesSanto"], ["2027-03-26", "viernesSanto"], ["2027-04-02", "malvinas"], ["2027-05-01", "trabajo"],
    ["2027-05-25", "mayo"], ["2027-06-20", "belgrano"], ["2027-06-21", "guemes", { original: "2027-06-17" }], ["2027-07-09", "independencia"],
    ["2027-08-16", "sanMartin", { original: "2027-08-17" }], ["2027-10-11", "diversidad", { original: "2027-10-12" }],
    ["2027-11-20", "soberania", { aConfirmar: true, nota: "Cae sábado. Por el Decreto 614/2025 la Jefatura de Gabinete puede pasarlo al viernes 19 o al lunes 22; todavía no lo definió." }],
    ["2027-12-08", "inmaculada"], ["2027-12-25", "navidad"],
  ];

  const ANIOS = {
    2024: { completo: true, resumen: "Confirmado.", normas: ["Ley 27.399", "Decreto 106/2023 (feriados con fines turísticos)"], pendiente: [] },
    2025: { completo: true, resumen: "Confirmado.", normas: ["Ley 27.399", "Decreto 1027/2024 (días no laborables con fines turísticos)", "Decreto 614/2025 y Resolución 139/2025 (12/10 al viernes 10)"], pendiente: [] },
    2026: { completo: true, resumen: "Confirmado.", normas: ["Ley 27.399", "Resolución 164/2025 de la Jefatura de Gabinete (días no laborables con fines turísticos)"], pendiente: [] },
    2027: {
      completo: false, resumen: "A medias: están los feriados de la ley, faltan los puentes y el 20/11.", normas: ["Ley 27.399"],
      pendiente: [
        "Los días no laborables con fines turísticos (hasta tres por año, en lunes o viernes) todavía no se fijaron.",
        "El 20/11 (Soberanía Nacional) cae sábado: por el Decreto 614/2025 la Jefatura de Gabinete puede pasarlo al viernes 19 o al lunes 22, o dejarlo donde está.",
      ],
    },
  };

  class ErrorFecha extends Error {
    constructor(mensaje) { super(mensaje); this.name = "ErrorFecha"; }
  }

  // --- Fechas como números de día --------------------------------------------------------------

  const MS_DIA = 86400000;
  const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

  function aDia(iso) {
    const m = RE_ISO.exec(String(iso || "").trim());
    if (!m) throw new ErrorFecha(`«${iso}» no es una fecha (va como AAAA-MM-DD).`);
    const a = +m[1], me = +m[2], d = +m[3];
    const t = Date.UTC(a, me - 1, d);
    const f = new Date(t);
    if (f.getUTCFullYear() !== a || f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d) throw new ErrorFecha(`El ${d}/${me}/${a} no existe.`);
    return Math.round(t / MS_DIA);
  }
  function aIso(n) { return new Date(n * MS_DIA).toISOString().slice(0, 10); }
  function partes(iso) { const [a, m, d] = iso.split("-").map(Number); return { anio: a, mes: m, dia: d }; }
  function diaSemana(iso) { return new Date(aDia(iso) * MS_DIA).getUTCDay(); }
  function sumarDias(iso, n) { return aIso(aDia(iso) + n); }
  function esFinDeSemana(iso) { const d = diaSemana(iso); return d === 0 || d === 6; }

  function corta(iso) { const p = partes(iso); return `${DIAS_CORTOS[diaSemana(iso)]} ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}/${p.anio}`; }
  function larga(iso) { const p = partes(iso); return `${DIAS[diaSemana(iso)]} ${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}`; }
  function sinAnio(iso) { const p = partes(iso); return `${DIAS[diaSemana(iso)]} ${p.dia}/${p.mes}`; }

  /* Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  /* Regla del art. 6 de la Ley 27.399: martes o miércoles al lunes anterior; jueves o viernes al lunes siguiente.
     Lunes, sábado y domingo quedan (desde el Decreto 614/2025 el fin de semana lo puede mover la Jefatura de Gabinete). */
  function trasladar(iso) {
    const d = diaSemana(iso);
    if (d === 2 || d === 3) return sumarDias(iso, 1 - d);
    if (d === 4 || d === 5) return sumarDias(iso, 8 - d);
    return iso;
  }

  /* Lo que sale de aplicar la ley sola, sin decretos: sirve para controlar la lista a mano. */
  function segunLey(anio) {
    const p = pascua(anio);
    const fijo = (md, c) => ({ fecha: `${anio}-${md}`, concepto: c });
    const lista = [
      fijo("01-01", "anio"), { fecha: sumarDias(p, -48), concepto: "carnaval" }, { fecha: sumarDias(p, -47), concepto: "carnaval" },
      fijo("03-24", "memoria"), fijo("04-02", "malvinas"), { fecha: sumarDias(p, -3), concepto: "juevesSanto" },
      { fecha: sumarDias(p, -2), concepto: "viernesSanto" }, fijo("05-01", "trabajo"), fijo("05-25", "mayo"), fijo("06-20", "belgrano"),
      fijo("07-09", "independencia"), fijo("12-08", "inmaculada"), fijo("12-25", "navidad"),
    ];
    for (const c of ["guemes", "sanMartin", "diversidad", "soberania"]) {
      const original = `${anio}-${CONCEPTOS[c].dia}`;
      const real = trasladar(original);
      lista.push(real === original ? { fecha: real, concepto: c } : { fecha: real, concepto: c, original });
    }
    return lista.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
  }

  // --- La lista armada --------------------------------------------------------------------------

  function notaDe(fecha, concepto, extra) {
    if (extra.nota) return extra.nota;
    const c = CONCEPTOS[concepto];
    if (c.tipo !== "trasladable") return "";
    if (extra.original) {
      const d = diaSemana(extra.original);
      const hacia = aDia(fecha) < aDia(extra.original) ? "al lunes anterior" : "al lunes siguiente";
      return `Caía ${DIAS[d]} ${sinAnio(extra.original).split(" ")[1]} y pasa ${hacia}.`;
    }
    const d = diaSemana(fecha);
    if (d === 1) return "Cae lunes: no se mueve.";
    return `Cae ${DIAS[d]}: queda ahí.`;
  }

  const FERIADOS = DATOS.map(([fecha, concepto, extra = {}]) => {
    const c = CONCEPTOS[concepto];
    aDia(fecha);
    const f = { fecha, nombre: c.nombre, tipo: c.tipo, concepto, fuente: extra.fuente || (extra.original && c.tipo === "trasladable" ? `${LEY}, art. 6` : LEY) };
    if (extra.original) f.original = extra.original;
    const nota = notaDe(fecha, concepto, extra);
    if (nota) f.nota = nota;
    if (extra.aConfirmar) f.aConfirmar = true;
    return f;
  }).sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));

  const POR_FECHA = new Map();
  for (const f of FERIADOS) { if (!POR_FECHA.has(f.fecha)) POR_FECHA.set(f.fecha, []); POR_FECHA.get(f.fecha).push(f); }
  const POR_ORIGINAL = new Map(FERIADOS.filter((f) => f.original).map((f) => [f.original, f]));

  function validarAnio(iso) {
    const a = partes(iso).anio;
    if (a < PRIMER_ANIO || a > ULTIMO_ANIO) {
      throw new ErrorFecha(`No hay feriados cargados para ${a}: esto cubre de ${PRIMER_ANIO} a ${ULTIMO_ANIO}.`);
    }
  }

  function feriadosDe(anio) {
    if (!ANIOS[anio]) throw new ErrorFecha(`No hay feriados cargados para ${anio}: esto cubre de ${PRIMER_ANIO} a ${ULTIMO_ANIO}.`);
    return FERIADOS.filter((f) => f.fecha.startsWith(anio + "-"));
  }

  // --- Días hábiles -----------------------------------------------------------------------------

  const OPCIONES = { puentesNoHabiles: true, juevesSantoNoHabil: false };
  const opc = (o) => Object.assign({}, OPCIONES, o || {});

  /* Por qué un feriado de la lista hace inhábil el día, según las opciones. */
  function cuenta(f, o) {
    if (TIPOS[f.tipo].feriado) return true;
    if (f.tipo === "puente") return o.puentesNoHabiles;
    if (f.tipo === "no laborable") return o.juevesSantoNoHabil;
    return false;
  }

  function esHabil(iso, opciones) {
    aDia(iso); validarAnio(iso);
    if (esFinDeSemana(iso)) return false;
    const o = opc(opciones);
    return !(POR_FECHA.get(iso) || []).some((f) => cuenta(f, o));
  }

  /* Todo lo que se sabe de un día. */
  function infoDia(iso, opciones) {
    aDia(iso); validarAnio(iso);
    const o = opc(opciones);
    const motivos = POR_FECHA.get(iso) || [];
    const habil = esHabil(iso, o);
    const ds = diaSemana(iso);
    const finde = ds === 0 || ds === 6;
    const feriado = motivos.find((f) => TIPOS[f.tipo].feriado);
    let resumen;
    if (feriado) resumen = finde ? `Es feriado (${feriado.nombre}) y además ${DIAS[ds]}.` : `Es feriado: ${feriado.nombre}.`;
    else if (motivos.length) {
      const m = motivos[0];
      const que = m.tipo === "no laborable" ? `día no laborable (${m.nombre})` : TIPOS[m.tipo].nombre.toLowerCase();
      resumen = finde ? `Es ${DIAS[ds]} y además ${que}.` : `Es ${que}: acá cuenta como ${habil ? "hábil" : "no hábil"}.`;
    } else resumen = finde ? `Es ${DIAS[ds]}.` : "Es día hábil.";
    const movido = POR_ORIGINAL.get(iso);
    let siguiente = null;
    try { siguiente = sumarHabiles(iso, habil ? 1 : 0, o).fecha; } catch (e) { siguiente = null; }
    return { fecha: iso, diaSemana: ds, habil, motivos, resumen, movido: movido || null, siguienteHabil: siguiente };
  }

  /* Sumar (o restar) días hábiles. Se cuenta desde el día siguiente: 1 hábil después del viernes es el lunes.
     Con 0 devuelve el mismo día si es hábil, o el primer hábil que sigue. Devuelve también lo que se salteó. */
  function sumarHabiles(desde, n, opciones) {
    aDia(desde); validarAnio(desde);
    n = Number(n);
    if (!Number.isInteger(n)) throw new ErrorFecha("La cantidad de días tiene que ser un número entero.");
    if (Math.abs(n) > 1500) throw new ErrorFecha("Son demasiados días para cuatro años de feriados.");
    const o = opc(opciones);
    const salteados = [];
    let finesDeSemana = 0;
    let fecha = desde;
    const mirar = (iso) => {
      validarAnio(iso);
      if (esHabil(iso, o)) return true;
      if (esFinDeSemana(iso)) finesDeSemana++;
      else salteados.push({ fecha: iso, motivos: POR_FECHA.get(iso) || [] });
      return false;
    };
    const fuera = (iso) => new ErrorFecha(`La cuenta se pasa de ${partes(iso).anio < PRIMER_ANIO ? `1/1/${PRIMER_ANIO}` : `31/12/${ULTIMO_ANIO}`}: no hay feriados cargados más allá.`);
    if (n === 0) {
      while (!esHabil(fecha, o)) { fecha = sumarDias(fecha, 1); if (partes(fecha).anio > ULTIMO_ANIO) throw fuera(fecha); mirar(fecha); }
      return { fecha, salteados: [], finesDeSemana: 0, corridos: aDia(fecha) - aDia(desde) };
    }
    const paso = n > 0 ? 1 : -1;
    for (let restan = Math.abs(n); restan > 0;) {
      fecha = sumarDias(fecha, paso);
      const a = partes(fecha).anio;
      if (a < PRIMER_ANIO || a > ULTIMO_ANIO) throw fuera(fecha);
      if (mirar(fecha)) restan--;
    }
    return { fecha, salteados, finesDeSemana, corridos: aDia(fecha) - aDia(desde) };
  }

  /* Días hábiles entre dos fechas: sin contar la de partida y contando la de llegada, así
     sumarHabiles(a, habilesEntre(a, b)) da b cuando b es hábil. Si b es anterior a a, da negativo. */
  function habilesEntre(a, b, opciones) {
    aDia(a); aDia(b); validarAnio(a); validarAnio(b);
    const o = opc(opciones);
    if (aDia(b) < aDia(a)) {
      const r = habilesEntre(b, a, o);
      return Object.assign(r, { habiles: -r.habiles, corridos: -r.corridos });
    }
    let habiles = 0, finesDeSemana = 0;
    const noHabiles = [], otros = [];
    for (let d = aDia(a) + 1; d <= aDia(b); d++) {
      const iso = aIso(d);
      const motivos = POR_FECHA.get(iso) || [];
      if (esHabil(iso, o)) { habiles++; if (motivos.length) otros.push({ fecha: iso, motivos }); }
      else if (esFinDeSemana(iso)) finesDeSemana++;
      else noHabiles.push({ fecha: iso, motivos });
    }
    return { habiles, corridos: aDia(b) - aDia(a), finesDeSemana, noHabiles, habilesConAviso: otros };
  }

  function proximoFeriado(iso) {
    return FERIADOS.find((f) => f.fecha >= iso && TIPOS[f.tipo].feriado) || null;
  }

  // --- JSON y C# --------------------------------------------------------------------------------

  function json() {
    const lista = FERIADOS.map((f) => {
      const o = { fecha: f.fecha, nombre: f.nombre, tipo: f.tipo, feriado: TIPOS[f.tipo].feriado };
      if (f.original) o.original = f.original;
      o.fuente = f.fuente;
      if (f.nota) o.nota = f.nota;
      if (f.aConfirmar) o.aConfirmar = true;
      return o;
    });
    const pendiente = [];
    for (const [a, info] of Object.entries(ANIOS)) for (const p of info.pendiente) pendiente.push(`${a}: ${p}`);
    return JSON.stringify({
      fuente: URL, consultado: CONSULTADO, desde: PRIMER_ANIO, hasta: ULTIMO_ANIO,
      completoHasta: Math.max(...Object.entries(ANIOS).filter(([, i]) => i.completo).map(([a]) => +a)),
      pendiente,
      tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.nombre])),
      feriados: lista,
    }, null, 2) + "\n";
  }

  const TIPO_CS = { inamovible: "Inamovible", trasladable: "Trasladable", turistico: "FeriadoTuristico", puente: "NoLaborableTuristico", "no laborable": "NoLaborable" };
  const cadenaCs = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const fechaCs = (iso) => { const p = partes(iso); return `${p.anio}, ${p.mes}, ${p.dia}`; };

  function csharp() {
    const filas = [];
    let anio = 0;
    for (const f of FERIADOS) {
      const a = partes(f.fecha).anio;
      if (a !== anio) {
        if (anio) filas.push("");
        anio = a;
        const info = ANIOS[a];
        filas.push(`        // ${a}: ${info.normas.join("; ")}.${info.completo ? "" : " INCOMPLETO, ver arriba."}`);
      }
      const args = [fechaCs(f.fecha), cadenaCs(f.nombre), `TipoFeriado.${TIPO_CS[f.tipo]}`, cadenaCs(f.fuente)];
      if (f.original) args.push(`original: new DateOnly(${fechaCs(f.original)})`);
      filas.push(`        F(${args.join(", ")}),${f.aConfirmar ? " // a confirmar: cae sábado" : ""}`);
    }
    const pendientes = [];
    for (const [a, info] of Object.entries(ANIOS)) for (const p of info.pendiente) pendientes.push(`//   - ${a}: ${p}`);
    return `// CalendarioArgentino: feriados nacionales de Argentina de ${PRIMER_ANIO} a ${ULTIMO_ANIO} y cuentas de días hábiles.
// Sale de ${URL}
// Lista consultada el ${partes(CONSULTADO).dia}/${partes(CONSULTADO).mes}/${partes(CONSULTADO).anio}. Fuentes: Ley 27.399 y los decretos y resoluciones que figuran en cada feriado.
// Lo que falta confirmar:
${pendientes.join("\n")}
// Cada diciembre hay que agregar el año que viene (sale la resolución de los puentes) y subir UltimoAnio.
// No incluye feriados provinciales ni municipales, ni las ferias judiciales.
//
// Uso:
//   var cal = new CalendarioArgentino();                        // puentes no hábiles, Jueves Santo hábil
//   cal.EsHabil(new DateOnly(2026, 11, 20));                    // true: Soberanía se pasó al lunes 23
//   cal.SumarHabiles(new DateOnly(2026, 10, 15), 10);           // 2026-10-29
//   cal.HabilesEntre(new DateOnly(2026, 9, 30), new DateOnly(2026, 10, 31)); // 21 (no cuenta el 30/9, sí el 31/10)
//   CalendarioArgentino.QueEs(new DateOnly(2026, 3, 23));       // el puente de la Resolución 164/2025

using System;
using System.Collections.Generic;
using System.Linq;

public enum TipoFeriado
{
    /// <summary>Feriado de fecha fija (Ley 27.399).</summary>
    Inamovible,
    /// <summary>Feriado que se corre a un lunes según el art. 6 de la Ley 27.399.</summary>
    Trasladable,
    /// <summary>Feriado puente con fines turísticos (2024 y antes): es feriado, no se trabaja.</summary>
    FeriadoTuristico,
    /// <summary>Día no laborable con fines turísticos (puente desde 2025): el Estado no trabaja, en el privado decide el empleador.</summary>
    NoLaborableTuristico,
    /// <summary>Día no laborable (Jueves Santo): optativo para el empleador privado.</summary>
    NoLaborable,
}

public sealed record Feriado(DateOnly Fecha, string Nombre, TipoFeriado Tipo, string Fuente, DateOnly? Original = null)
{
    /// <summary>True si es feriado (no se trabaja y, si se trabaja, se paga doble); false si es día no laborable.</summary>
    public bool EsFeriado => Tipo is TipoFeriado.Inamovible or TipoFeriado.Trasladable or TipoFeriado.FeriadoTuristico;
}

public sealed class CalendarioArgentino
{
    public const int PrimerAnio = ${PRIMER_ANIO};
    public const int UltimoAnio = ${ULTIMO_ANIO};

    private static readonly Feriado[] Lista =
    {
${filas.join("\n")}
    };

    private static readonly ILookup<DateOnly, Feriado> PorFecha = Lista.ToLookup(f => f.Fecha);

    private readonly bool _puentesNoHabiles;
    private readonly bool _juevesSantoNoHabil;

    /// <param name="puentesNoHabiles">Los días no laborables con fines turísticos cuentan como no hábiles (lo que hace el Estado).</param>
    /// <param name="juevesSantoNoHabil">El Jueves Santo cuenta como no hábil.</param>
    public CalendarioArgentino(bool puentesNoHabiles = true, bool juevesSantoNoHabil = false)
    {
        _puentesNoHabiles = puentesNoHabiles;
        _juevesSantoNoHabil = juevesSantoNoHabil;
    }

    /// <summary>Todos los feriados y días no laborables cargados, en orden.</summary>
    public static IReadOnlyList<Feriado> Todos => Lista;

    public static IEnumerable<Feriado> DelAnio(int anio)
    {
        Validar(anio);
        return Lista.Where(f => f.Fecha.Year == anio);
    }

    /// <summary>Qué hay ese día (vacío si es un día común). Puede haber dos: en 2026 el Jueves Santo cae el 2 de abril.</summary>
    public static IEnumerable<Feriado> QueEs(DateOnly fecha)
    {
        Validar(fecha.Year);
        return PorFecha[fecha];
    }

    public static bool EsFeriado(DateOnly fecha) => QueEs(fecha).Any(f => f.EsFeriado);

    public bool EsHabil(DateOnly fecha)
    {
        Validar(fecha.Year);
        if (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) return false;
        foreach (var f in PorFecha[fecha])
        {
            if (f.EsFeriado) return false;
            if (f.Tipo == TipoFeriado.NoLaborableTuristico && _puentesNoHabiles) return false;
            if (f.Tipo == TipoFeriado.NoLaborable && _juevesSantoNoHabil) return false;
        }
        return true;
    }

    /// <summary>Suma (o resta, con dias negativo) días hábiles. Se cuenta desde el día siguiente:
    /// un hábil después del viernes es el lunes. Con 0 devuelve el mismo día si es hábil, o el próximo hábil.</summary>
    public DateOnly SumarHabiles(DateOnly desde, int dias)
    {
        var fecha = desde;
        if (dias == 0)
        {
            while (!EsHabil(fecha)) fecha = fecha.AddDays(1);
            return fecha;
        }
        int paso = dias > 0 ? 1 : -1;
        for (int restan = Math.Abs(dias); restan > 0;)
        {
            fecha = fecha.AddDays(paso);
            if (EsHabil(fecha)) restan--;
        }
        return fecha;
    }

    /// <summary>Días hábiles entre dos fechas, sin contar la de partida y contando la de llegada
    /// (así SumarHabiles(desde, HabilesEntre(desde, hasta)) == hasta si hasta es hábil). Negativo si hasta es anterior.</summary>
    public int HabilesEntre(DateOnly desde, DateOnly hasta)
    {
        if (hasta < desde) return -HabilesEntre(hasta, desde);
        Validar(desde.Year);
        Validar(hasta.Year);
        int n = 0;
        for (var d = desde.AddDays(1); d <= hasta; d = d.AddDays(1))
            if (EsHabil(d)) n++;
        return n;
    }

    /// <summary>El mismo día si es hábil, si no el primer hábil que sigue.</summary>
    public DateOnly ProximoHabil(DateOnly fecha) => SumarHabiles(fecha, 0);

    private static void Validar(int anio)
    {
        if (anio < PrimerAnio || anio > UltimoAnio)
            throw new ArgumentOutOfRangeException(nameof(anio), anio,
                $"No hay feriados cargados para {anio}: CalendarioArgentino cubre de {PrimerAnio} a {UltimoAnio}. Bajá la versión nueva de ${URL}");
    }

    private static Feriado F(int anio, int mes, int dia, string nombre, TipoFeriado tipo, string fuente, DateOnly? original = null)
        => new(new DateOnly(anio, mes, dia), nombre, tipo, fuente, original);
}
`;
  }

  const API = {
    PRIMER_ANIO, ULTIMO_ANIO, CONSULTADO, URL, DIAS, DIAS_CORTOS, MESES, TIPOS, CONCEPTOS, ANIOS, FERIADOS, OPCIONES, ErrorFecha,
    aDia, aIso, partes, diaSemana, sumarDias, esFinDeSemana, corta, larga, pascua, trasladar, segunLey, feriadosDe,
    esHabil, infoDia, sumarHabiles, habilesEntre, proximoFeriado, json, csharp,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.Feriados = API;
})(typeof window !== "undefined" ? window : globalThis);
