/* ¿Cuotas o contado? — la cuenta.
   Todo en tasas mensuales efectivas (fracción, 0.02 = 2 %). Sin dependencias; se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  /** Tasa efectiva por período de `dias` a partir de una TNA en %, como la liquida un plazo fijo (TNA · días / 365). */
  function temDesdeTna(tnaPct, dias) { return (tnaPct / 100) * ((dias || 30) / 365); }
  /** TNA en % equivalente a una tasa mensual efectiva (fracción), con meses de 30 días. */
  function tnaDesdeTem(tem) { return tem * (365 / 30) * 100; }
  /** TEA en % equivalente a una tasa mensual efectiva (fracción): capitalizando 12 veces. */
  function teaDesdeTem(tem) { return (Math.pow(1 + tem, 12) - 1) * 100; }

  /** Valor presente de n cuotas iguales descontadas a `tasa` mensual; `d` es 1 si la primera cuota es a los 30 días y 0 si es hoy. */
  function valorPresente(cuota, n, d, tasa) {
    let vp = 0;
    for (let k = 0; k < n; k++) vp += cuota / Math.pow(1 + tasa, k + d);
    return vp;
  }

  /** La tasa mensual que hace que las cuotas valgan hoy lo mismo que el contado (la TEM «escondida» en el plan).
      Devuelve null cuando no hay tasa que lo cumpla (una sola cuota hoy que no coincide con el contado). */
  function tasaImplicita(contado, cuota, n, d) {
    if (!(contado > 0) || !(cuota > 0) || !(n >= 1)) return null;
    if (n === 1 && d === 0) return Math.abs(cuota - contado) < 1e-9 ? 0 : null; // pagar hoy contra pagar hoy: no hay tasa
    // f(i) = VP(i) − contado es decreciente en i. Buscamos la raíz por bisección.
    const f = (i) => valorPresente(cuota, n, d, i) - contado;
    let lo = -0.95, hi = 10;
    if (f(lo) < 0) return null; // cuotas ridículamente baratas: ni con −95 % mensual llega
    if (f(hi) > 0) return null; // ni con 1000 % mensual
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
      if (hi - lo < 1e-12) break;
    }
    return (lo + hi) / 2;
  }

  /** Mes a mes: qué pasa con la plata del contado si en vez de pagar la ponés a rendir a `r` mensual y vas pagando cada cuota de ahí. */
  function simularInversion(contado, cuota, n, d, r) {
    const filas = [];
    let saldo = contado;
    const ultimo = n - 1 + d;
    for (let m = 0; m <= ultimo; m++) {
      if (m > 0) saldo *= 1 + r;
      const paga = m >= d ? cuota : 0;
      saldo -= paga;
      filas.push({ mes: m, cuota: paga, saldo });
    }
    return filas;
  }

  /**
   * La comparación completa.
   * @param {object} p
   * @param {number} p.contado       precio pagando hoy (ya con el descuento, si hay)
   * @param {number} p.cuota         valor de cada cuota
   * @param {number} p.n             cantidad de cuotas
   * @param {number} p.primeraEn     0 = la primera cuota se paga hoy; 1 = a los 30 días (tarjeta)
   * @param {number} p.inflacion     inflación mensual esperada, en %
   * @param {number} p.rendimiento   lo que rinde la plata por mes si la ponés a trabajar, en %
   * @param {string} p.situacion     "rinde" | "quieta" | "sueldo"
   */
  function comparar(p) {
    const contado = +p.contado, cuota = +p.cuota, n = Math.max(1, Math.round(+p.n)), d = p.primeraEn ? 1 : 0;
    const pi = (+p.inflacion || 0) / 100, r = (+p.rendimiento || 0) / 100;
    const situacion = p.situacion || "rinde";
    const total = cuota * n;
    const extraNominal = total - contado;
    const tem = tasaImplicita(contado, cuota, n, d);
    const meses = n - 1 + d;
    const vpInflacion = valorPresente(cuota, n, d, pi);
    const vpRendimiento = valorPresente(cuota, n, d, r);
    const sim = simularInversion(contado, cuota, n, d, r);
    const sobraNominal = sim[sim.length - 1].saldo;
    const sobraReal = sobraNominal / Math.pow(1 + pi, meses);
    const filas = [];
    for (let k = 0; k < n; k++) {
      const mes = k + d;
      filas.push({ numero: k + 1, mes, nominal: cuota, enPlataDeHoy: cuota / Math.pow(1 + pi, mes), acumulado: cuota * (k + 1), saldoInvertido: sim[mes].saldo });
    }
    // La tasa de referencia según la situación: contra qué se compara la tasa implícita.
    const referencia = situacion === "rinde" ? r : situacion === "sueldo" ? pi : 0;
    const costoCuotasRef = situacion === "rinde" ? vpRendimiento : situacion === "sueldo" ? vpInflacion : total;
    const diferencia = contado - costoCuotasRef; // > 0: las cuotas salen más baratas
    const umbral = Math.max(1, contado * 0.002); // menos de 0,2 % es empate
    const gana = Math.abs(diferencia) < umbral ? "empate" : diferencia > 0 ? "cuotas" : "contado";
    // La cuota que dejaría todo igual con la tasa de referencia: cuota · Σ 1/(1+ref)^(k+d) = contado.
    const factor = valorPresente(1, n, d, referencia);
    const cuotaEquilibrio = contado / factor;
    const totalEquilibrio = cuotaEquilibrio * n;
    // Y el contado que habría que conseguir (descuento) para que convenga pagar hoy con esas cuotas.
    const contadoEquilibrio = costoCuotasRef;
    return {
      contado, cuota, n, d, total, extraNominal, extraPct: contado > 0 ? extraNominal / contado * 100 : 0,
      sinInteres: Math.abs(extraNominal) < 0.5,
      implicita: tem == null ? null : { tem, tna: tnaDesdeTem(tem), tea: teaDesdeTem(tem) },
      inflacion: pi, rendimiento: r, situacion, referencia, meses,
      vpInflacion, ahorroReal: contado - vpInflacion,
      vpRendimiento, sobraNominal, sobraReal,
      costoCuotasRef, diferencia, diferenciaPct: contado > 0 ? diferencia / contado * 100 : 0, gana,
      cuotaEquilibrio, totalEquilibrio, contadoEquilibrio,
      filas, simulacion: sim,
    };
  }

  // ---- texto ----
  const fmtPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const fmtPct = (x, dec) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec == null ? 1 : dec, maximumFractionDigits: dec == null ? 1 : dec }).format(x) + " %";
  function pesos(x) { return fmtPesos.format(Math.round(x)).replace(/ /g, " "); }

  /** El veredicto en una frase y el porqué, para la página. */
  function veredicto(c) {
    const que = c.situacion === "rinde" ? "poniendo la plata a rendir al " + fmtPct(c.rendimiento * 100, 2) + " mensual"
      : c.situacion === "sueldo" ? "pagando cada cuota con el sueldo del mes, con una inflación del " + fmtPct(c.inflacion * 100) + " mensual"
      : "con la plata quieta en la cuenta";
    if (c.gana === "empate") return { titulo: "Da lo mismo", detalle: "Entre pagar hoy y pagar en " + c.n + " cuotas no hay diferencia que valga la pena (" + pesos(Math.abs(c.diferencia)) + "), " + que + "." };
    if (c.gana === "cuotas") return { titulo: "Conviene en cuotas", detalle: "Te sale " + pesos(c.diferencia) + " menos (" + fmtPct(c.diferenciaPct) + " del contado) " + que + "." };
    return { titulo: "Conviene contado", detalle: "Las cuotas te salen " + pesos(-c.diferencia) + " más (" + fmtPct(-c.diferenciaPct) + " del contado) " + que + "." };
  }

  const api = { temDesdeTna, tnaDesdeTem, teaDesdeTem, valorPresente, tasaImplicita, simularInversion, comparar, veredicto, pesos, fmtPct };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.CuotasOContado = api;
})(typeof window !== "undefined" ? window : globalThis);
