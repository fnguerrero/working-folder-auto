/* Lo que te corresponde — lógica pura, sin DOM.
   Cálculos de liquidación final, aguinaldo y vacaciones según la Ley de Contrato de
   Trabajo (20.744) con las reformas de la Ley 27.742 (2024). Se carga en el navegador
   (queda en window.Laboral) y en Node (module.exports) para correr los tests con
   `node --test` sin nada más.

   Convenciones:
   - Las fechas son texto "AAAA-MM-DD" y se operan en UTC, así no interviene el huso.
   - Los importes son números en pesos con decimales; se redondean al centavo al final.
   - Todo lo que es un criterio (no una regla literal de la ley) está marcado "criterio". */
(function (raiz, fabrica) {
  if (typeof module === "object" && module && module.exports) module.exports = fabrica();
  else raiz.Laboral = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const APORTES = { jubilacion: 0.11, pami: 0.03, obraSocial: 0.03 }; // 17 % en total
  const TOTAL_APORTES = APORTES.jubilacion + APORTES.pami + APORTES.obraSocial;
  const PRUEBA_MESES = 6; // art. 92 bis, texto según Ley 27.742
  const PISO_VIZZOTI = 0.67; // CSJN, "Vizzoti" (2004): el tope no puede recortar más del 33 %
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];

  /* ------------------------------------------------------------ fechas */
  const esFecha = (f) => typeof f === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(f)
    && !Number.isNaN(aUTC(f)) && deUTC(aUTC(f)) === f;

  function aUTC(f) {
    const [a, m, d] = String(f).split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  }
  function deUTC(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }
  const partes = (f) => { const [a, m, d] = f.split("-").map(Number); return { a, m, d }; };
  const diasDelMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate(); // m de 1 a 12
  const esBisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const diasDelAnio = (a) => (esBisiesto(a) ? 366 : 365);
  const DIA = 86400000;

  // Días corridos entre dos fechas contando las dos puntas (del 1 al 31 de enero: 31).
  function diasInclusive(desde, hasta) {
    if (hasta < desde) return 0;
    return Math.round((aUTC(hasta) - aUTC(desde)) / DIA) + 1;
  }
  function sumarMeses(f, n) {
    const { a, m, d } = partes(f);
    const total = a * 12 + (m - 1) + n;
    const a2 = Math.floor(total / 12), m2 = (total % 12) + 1;
    return deUTC(Date.UTC(a2, m2 - 1, Math.min(d, diasDelMes(a2, m2))));
  }
  function fechaHoy() {
    const h = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(h.getDate())}`;
  }
  function fechaLarga(f) {
    const { a, m, d } = partes(f);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  }

  /* ------------------------------------------------------------ antigüedad */
  // Años, meses y días completos desde el ingreso hasta el egreso, contando el día de
  // egreso como trabajado (ingreso 1/3/2020, egreso 29/2/2024: 4 años justos).
  function antiguedad(ingreso, egreso) {
    const fin = deUTC(aUTC(egreso) + DIA);
    let i = partes(ingreso), e = partes(fin);
    let anios = e.a - i.a, meses = e.m - i.m, dias = e.d - i.d;
    if (dias < 0) {
      meses -= 1;
      const mPrev = e.m === 1 ? 12 : e.m - 1, aPrev = e.m === 1 ? e.a - 1 : e.a;
      dias += diasDelMes(aPrev, mPrev);
    }
    if (meses < 0) { anios -= 1; meses += 12; }
    return { anios, meses, dias, totalDias: diasInclusive(ingreso, egreso) };
  }
  function textoAntiguedad(ant) {
    const t = [];
    if (ant.anios) t.push(`${ant.anios} ${ant.anios === 1 ? "año" : "años"}`);
    if (ant.meses) t.push(`${ant.meses} ${ant.meses === 1 ? "mes" : "meses"}`);
    if (ant.dias || !t.length) t.push(`${ant.dias} ${ant.dias === 1 ? "día" : "días"}`);
    return t.join(", ");
  }
  // Art. 245: un mes por cada año de servicio o fracción mayor de tres meses.
  function aniosIndemnizables(ant) {
    const fraccionMayorATres = ant.meses > 3 || (ant.meses === 3 && ant.dias > 0);
    return ant.anios + (fraccionMayorATres ? 1 : 0);
  }
  // Art. 92 bis: período de prueba (6 meses por defecto; el convenio puede llevarlo a 8 o 12).
  function enPeriodoDePrueba(ingreso, egreso, meses = PRUEBA_MESES) {
    return aUTC(egreso) < aUTC(sumarMeses(ingreso, meses));
  }
  // Art. 231: preaviso que debe dar el empleador, en meses de sueldo.
  function mesesDePreaviso(ingreso, egreso, mesesPrueba = PRUEBA_MESES) {
    if (enPeriodoDePrueba(ingreso, egreso, mesesPrueba)) return 0.5; // 15 días
    const ant = antiguedad(ingreso, egreso);
    const masDeCinco = ant.anios > 5 || (ant.anios === 5 && (ant.meses > 0 || ant.dias > 0));
    return masDeCinco ? 2 : 1;
  }

  /* ------------------------------------------------------------ vacaciones */
  // Art. 150: días corridos según la antigüedad al 31 de diciembre del año.
  function diasDeVacaciones(aniosAl31) {
    if (aniosAl31 > 20) return 35;
    if (aniosAl31 > 10) return 28;
    if (aniosAl31 > 5) return 21;
    return 14;
  }
  // Antigüedad en años completos al 31 de diciembre del año dado.
  function aniosAl31(ingreso, anio) {
    return antiguedad(ingreso, `${anio}-12-31`).anios;
  }
  // Art. 153: con menos de la mitad del año trabajado, un día por cada 20 efectivamente
  // trabajados. Criterio: los días "efectivamente trabajados" se aproximan con 5/7 de los
  // días corridos del período, que es lo que se usa cuando no hay registro de asistencia.
  function vacaciones({ ingreso, anio, sueldo, diasTrabajadosReales }) {
    const inicio = aUTC(ingreso) > aUTC(`${anio}-01-01`) ? ingreso : `${anio}-01-01`;
    const corridos = diasInclusive(inicio, `${anio}-12-31`);
    const mitadDelAnio = corridos * 2 >= diasDelAnio(anio);
    const anios = aniosAl31(ingreso, anio);
    let dias, regla;
    if (mitadDelAnio) {
      dias = diasDeVacaciones(anios);
      regla = "art. 150";
    } else {
      const efectivos = diasTrabajadosReales != null ? diasTrabajadosReales : Math.floor(corridos * 5 / 7);
      dias = Math.floor(efectivos / 20);
      regla = "art. 153";
    }
    const valorDia = sueldo / 25; // art. 155 inc. a
    const bruto = valorDia * dias;
    const plus = (valorDia - sueldo / 30) * dias; // lo que se cobra de más por ser vacaciones
    return {
      anio, anios, dias, regla, mitadDelAnio, corridos,
      valorDia: redondear(valorDia), bruto: redondear(bruto), plus: redondear(plus),
      aportes: redondear(bruto * TOTAL_APORTES), neto: redondear(bruto * (1 - TOTAL_APORTES)),
      ventana: { desde: `${anio}-10-01`, hasta: `${anio + 1}-04-30` }, // art. 154
    };
  }

  /* ------------------------------------------------------------ aguinaldo */
  function semestreDe(fecha) {
    const { a, m } = partes(fecha);
    return m <= 6
      ? { n: 1, anio: a, desde: `${a}-01-01`, hasta: `${a}-06-30`, pago: `${a}-06-30` }
      : { n: 2, anio: a, desde: `${a}-07-01`, hasta: `${a}-12-31`, pago: `${a}-12-18` };
  }
  // Ley 23.041 y art. 122 LCT: la mitad de la mejor remuneración mensual del semestre,
  // proporcional al tiempo trabajado en el semestre si no se trabajó completo.
  // Criterio: la proporción se hace por días corridos sobre los días reales del semestre.
  function aguinaldo({ mejorSueldo, fecha, ingreso, egreso, diasSinGoce = 0 }) {
    const sem = semestreDe(fecha || egreso || fechaHoy());
    const desde = ingreso && aUTC(ingreso) > aUTC(sem.desde) ? ingreso : sem.desde;
    const hasta = egreso && aUTC(egreso) < aUTC(sem.hasta) ? egreso : sem.hasta;
    const diasSemestre = diasInclusive(sem.desde, sem.hasta);
    const diasTrabajados = Math.max(0, diasInclusive(desde, hasta) - Math.max(0, diasSinGoce));
    const completo = diasTrabajados >= diasSemestre;
    const bruto = (mejorSueldo / 2) * (completo ? 1 : diasTrabajados / diasSemestre);
    return {
      semestre: sem, desde, hasta, diasSemestre, diasTrabajados, completo,
      bruto: redondear(bruto), aportes: redondear(bruto * TOTAL_APORTES),
      neto: redondear(bruto * (1 - TOTAL_APORTES)),
    };
  }

  /* ------------------------------------------------------------ liquidación final */
  const MOTIVOS = {
    despido: "Despido sin causa",
    renuncia: "Renuncia",
    "con-causa": "Despido con causa o mutuo acuerdo",
  };

  function validarLiquidacion(e) {
    const errores = {};
    if (!esFecha(e.ingreso)) errores.ingreso = "Poné la fecha de ingreso.";
    if (!esFecha(e.egreso)) errores.egreso = "Poné la fecha de egreso.";
    if (!errores.ingreso && !errores.egreso && aUTC(e.egreso) < aUTC(e.ingreso)) errores.egreso = "El egreso no puede ser antes del ingreso.";
    if (!(e.sueldo > 0)) errores.sueldo = "Poné el sueldo bruto mensual.";
    if (e.mejorSueldo != null && e.mejorSueldo !== "" && !(e.mejorSueldo > 0)) errores.mejorSueldo = "Tiene que ser mayor que cero.";
    if (e.tope != null && e.tope !== "" && !(e.tope > 0)) errores.tope = "Tiene que ser mayor que cero.";
    if (!MOTIVOS[e.motivo]) errores.motivo = "Elegí el motivo.";
    return errores;
  }

  /* Entrada:
       ingreso, egreso: "AAAA-MM-DD"
       sueldo: sueldo bruto mensual actual (remunerativo, sin SAC)
       mejorSueldo: mejor remuneración mensual, normal y habitual del último año (opcional; si falta, el sueldo)
       motivo: "despido" | "renuncia" | "con-causa"
       preavisoOtorgado: true si el empleador avisó con la anticipación del art. 231 y se trabajó el preaviso
       tope: tope del art. 245 (3 × promedio del convenio), opcional
       mesesPrueba: duración del período de prueba (6 por defecto)
     Salida: lista de conceptos con cálculo, totales bruto/aportes/neto y avisos. */
  function liquidacionFinal(e) {
    const errores = validarLiquidacion(e);
    if (Object.keys(errores).length) return { errores };

    const sueldo = Number(e.sueldo);
    const mejor = e.mejorSueldo > 0 ? Number(e.mejorSueldo) : sueldo;
    const mesesPrueba = e.mesesPrueba > 0 ? Number(e.mesesPrueba) : PRUEBA_MESES;
    const ant = antiguedad(e.ingreso, e.egreso);
    const prueba = enPeriodoDePrueba(e.ingreso, e.egreso, mesesPrueba);
    const despido = e.motivo === "despido";
    const eg = partes(e.egreso);
    const ultimoDia = diasDelMes(eg.a, eg.m);
    const conceptos = [];
    const avisos = [];
    const agregar = (c) => { c.monto = redondear(c.monto); conceptos.push(c); };

    // 1. Días trabajados del mes de egreso (art. 74). Criterio: mes de 30 días; si el egreso
    // es el último día del mes se paga el mes entero, sea de 28, 30 o 31.
    const diasMes = eg.d === ultimoDia ? 30 : eg.d;
    agregar({
      id: "dias", nombre: `Días trabajados de ${MESES[eg.m - 1]}`, remunerativo: true,
      calculo: diasMes === 30 ? "sueldo completo (egreso el último día del mes)" : `${fmt(sueldo)} / 30 × ${diasMes} días`,
      monto: sueldo / 30 * diasMes,
    });

    // 2. SAC proporcional del semestre en curso (art. 123).
    const sac = aguinaldo({ mejorSueldo: mejor, fecha: e.egreso, ingreso: e.ingreso, egreso: e.egreso });
    agregar({
      id: "sac", nombre: `SAC proporcional del ${sac.semestre.n}° semestre`, remunerativo: true,
      calculo: `${fmt(mejor)} / 2 × ${sac.diasTrabajados} / ${sac.diasSemestre} días`,
      monto: sac.bruto,
    });

    // 3. Vacaciones no gozadas (art. 156): proporcionales a la fracción del año trabajada.
    const vacAnio = eg.a;
    const inicioAnio = aUTC(e.ingreso) > aUTC(`${vacAnio}-01-01`) ? e.ingreso : `${vacAnio}-01-01`;
    const diasAnio = diasInclusive(inicioAnio, e.egreso);
    const diasVac = diasDeVacaciones(aniosAl31(e.ingreso, vacAnio));
    const diasProp = diasVac * diasAnio / diasDelAnio(vacAnio);
    const vacMonto = sueldo / 25 * diasProp;
    agregar({
      id: "vacaciones", nombre: "Vacaciones no gozadas", remunerativo: false,
      calculo: `${diasVac} días × ${diasAnio} / ${diasDelAnio(vacAnio)} = ${diasProp.toFixed(2).replace(".", ",")} días, a ${fmt(sueldo)} / 25 por día`,
      monto: vacMonto,
    });
    agregar({ id: "sac-vacaciones", nombre: "SAC sobre vacaciones no gozadas", remunerativo: false,
      calculo: `${fmt(vacMonto)} / 12`, monto: vacMonto / 12 });

    if (despido) {
      // 4. Indemnización por antigüedad (art. 245). No hay en el período de prueba (art. 92 bis).
      if (prueba) {
        avisos.push(`El egreso cae dentro del período de prueba (${mesesPrueba} meses desde el ingreso), así que no hay indemnización por antigüedad ni integración del mes. El preaviso es de 15 días.`);
      } else {
        const anios = Math.max(1, aniosIndemnizables(ant));
        let base = mejor, nota = "";
        if (e.tope > 0 && Number(e.tope) < mejor) {
          const piso = mejor * PISO_VIZZOTI;
          base = Math.max(Number(e.tope), piso);
          nota = base === piso
            ? ` (tope ${fmt(Number(e.tope))} recortaba más del 33 %: se usa el 67 % del sueldo, fallo Vizzoti)`
            : ` (se aplica el tope del convenio: ${fmt(base)})`;
        }
        agregar({
          id: "antiguedad", nombre: "Indemnización por antigüedad", remunerativo: false,
          calculo: `${fmt(base)} × ${anios} ${anios === 1 ? "año" : "años"}${nota}`,
          monto: base * anios,
        });
      }

      // 5. Preaviso (arts. 231 y 232) e integración del mes de despido (art. 233).
      const mesesPre = mesesDePreaviso(e.ingreso, e.egreso, mesesPrueba);
      if (e.preavisoOtorgado) {
        avisos.push(`Como el preaviso se otorgó y se trabajó, no corresponde la indemnización sustitutiva ni la integración del mes. Esos días ya van en el sueldo.`);
      } else {
        const preMonto = sueldo * mesesPre;
        agregar({
          id: "preaviso", nombre: "Indemnización sustitutiva de preaviso", remunerativo: false,
          calculo: mesesPre === 0.5 ? `15 días: ${fmt(sueldo)} / 2` : `${mesesPre} ${mesesPre === 1 ? "mes" : "meses"} de ${fmt(sueldo)}`,
          monto: preMonto,
        });
        agregar({ id: "sac-preaviso", nombre: "SAC sobre preaviso", remunerativo: false,
          calculo: `${fmt(preMonto)} / 12`, monto: preMonto / 12 });

        if (!prueba && eg.d !== ultimoDia) {
          const faltan = ultimoDia - eg.d;
          const intMonto = sueldo / 30 * faltan;
          agregar({
            id: "integracion", nombre: "Integración del mes de despido", remunerativo: false,
            calculo: `${fmt(sueldo)} / 30 × ${faltan} días que faltan hasta el ${ultimoDia}`,
            monto: intMonto,
          });
          agregar({ id: "sac-integracion", nombre: "SAC sobre integración", remunerativo: false,
            calculo: `${fmt(intMonto)} / 12`, monto: intMonto / 12 });
        }
      }
    } else if (e.motivo === "renuncia") {
      avisos.push("Con renuncia no hay indemnización por antigüedad ni preaviso a favor tuyo. Lo que corresponde es lo trabajado, el aguinaldo y las vacaciones proporcionales.");
    } else {
      avisos.push("Con despido con causa o mutuo acuerdo (art. 241) no hay indemnización por antigüedad ni preaviso. Si fue mutuo acuerdo, lo que se pacte de más es aparte.");
    }

    const remunerativo = conceptos.filter((c) => c.remunerativo).reduce((s, c) => s + c.monto, 0);
    const noRemunerativo = conceptos.filter((c) => !c.remunerativo).reduce((s, c) => s + c.monto, 0);
    const bruto = remunerativo + noRemunerativo;
    const aportes = remunerativo * TOTAL_APORTES;

    return {
      conceptos, avisos, motivo: e.motivo, prueba, antiguedad: ant, textoAntiguedad: textoAntiguedad(ant),
      aniosIndemnizables: despido && !prueba ? Math.max(1, aniosIndemnizables(ant)) : 0,
      mesesPreaviso: despido ? mesesDePreaviso(e.ingreso, e.egreso, mesesPrueba) : 0,
      totales: {
        remunerativo: redondear(remunerativo), noRemunerativo: redondear(noRemunerativo),
        bruto: redondear(bruto), aportes: redondear(aportes), neto: redondear(bruto - aportes),
      },
    };
  }

  /* ------------------------------------------------------------ formato */
  function redondear(n) { return Math.round(n * 100) / 100; }
  // Lee "1.250.000", "1250000,50", "$ 1.250.000,50" o "1250000.50". Devuelve NaN si no es un número.
  function parsearPesos(texto) {
    if (typeof texto === "number") return texto;
    let t = String(texto == null ? "" : texto).replace(/[\s$]/g, "");
    if (!t) return NaN;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, "");
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }
  function fmt(n) {
    const fijo = redondear(n).toFixed(2);
    const [ent, dec] = fijo.split(".");
    const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `$ ${conPuntos},${dec}`;
  }

  return {
    APORTES, TOTAL_APORTES, PRUEBA_MESES, PISO_VIZZOTI, MESES, MOTIVOS,
    esFecha, diasInclusive, sumarMeses, diasDelMes, diasDelAnio, fechaHoy, fechaLarga,
    antiguedad, textoAntiguedad, aniosIndemnizables, enPeriodoDePrueba, mesesDePreaviso,
    diasDeVacaciones, aniosAl31, vacaciones, semestreDe, aguinaldo,
    validarLiquidacion, liquidacionFinal, redondear, fmt, parsearPesos,
  };
});
