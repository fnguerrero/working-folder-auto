/* Interfaz. Toda la cuenta vive en lib.js. */
(function () {
  'use strict';
  const PF = window.PF;
  const $ = (id) => document.getElementById(id);
  const CLAVE = 'plazo-fijo-vs-dolar:csv';
  const NOMBRES = { pf: 'Plazo fijo', dolar: 'Dólar oficial', blue: 'Dólar blue', nada: 'Pesos quietos', mezcla: 'Mezcla', empate: 'Empate' };
  const TRAZO = { pf: '', dolar: '7 3', blue: '2 3', nada: '10 4 2 4', mezcla: '4 2' };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let datos;
  let carga = null;
  let sim = null;
  let marcado = 0;

  const nombreMes = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const pesos = (v) => '$ ' +v.toLocaleString('es-AR', { maximumFractionDigits: v < 100 ? 2 : 0 });
  const corto = (v) => '$' + v.toLocaleString('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
  const pct = (v, signo) => (signo && v > 0 ? '+' : '') + v.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';
  const color = (e) => `--c:var(--${e === 'empate' ? 'nada' : e})`;

  function el(tag, attrs, ...hijos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    n.append(...hijos.filter((h) => h !== null && h !== undefined));
    return n;
  }
  function svgEl(tag, attrs, texto) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (texto !== undefined) n.textContent = texto;
    return n;
  }
  const rotulo = (e) => el('span', {}, el('span', { class: 'punto', style: color(e) }), NOMBRES[e]);
  const aviso = (texto) => el('p', { class: 'aviso' }, texto);

  function rango(lista) {
    return lista.length === 1 ? nombreMes(lista[0]) : `${lista.length} meses entre ${nombreMes(lista[0])} y ${nombreMes(lista[lista.length - 1])}`;
  }

  function parametros() {
    return {
      desde: $('desde').value,
      hasta: $('hasta').value,
      monto: PF.leerNumero($('monto').value.replace(/\./g, '')),
      renovacion: $('renovacion').value,
      inflacion: $('inflacion').value,
      estrategias: $('usarMezcla').checked ? ['mezcla'] : [],
      mezcla: {
        pf: Math.max(0, Number($('mPf').value) || 0),
        dolar: Math.max(0, Number($('mDolar').value) || 0),
        blue: datos.blue.size ? Math.max(0, Number($('mBlue').value) || 0) : 0,
        nada: Math.max(0, Number($('mNada').value) || 0),
      },
    };
  }

  function pintarSimulador() {
    const p = parametros();
    sim = PF.simular(datos, p);
    const msj = $('mensajes');
    msj.textContent = '';
    $('tarjetas').textContent = '';
    $('pesos').hidden = !$('usarMezcla').checked;
    const nota = $('notaMezcla');
    nota.hidden = !$('usarMezcla').checked;
    const suma = Object.values(p.mezcla).reduce((a, b) => a + b, 0);
    nota.textContent = suma === 100 ? 'Suma 100 %.' : `Suma ${suma} %: se reparte en proporción.`;
    $('secGrafico').hidden = !!sim.error;
    if (sim.error) { msj.append(aviso(sim.error)); return; }

    if (sim.huecosPeriodo.length) msj.append(aviso(`Sin inflación de referencia para ${rango(sim.huecosPeriodo)}: no calculo la ganancia real. Los pesos nominales sí.`));
    if (sim.huecosHastaHoy.length) msj.append(aviso(`Sin inflación para ${rango(sim.huecosHastaHoy)}: no puedo pasar el resultado a pesos de hoy.`));
    if (p.inflacion === 'indec' && p.desde < '2015-12' && p.hasta >= '2007-01') msj.append(aviso('El período toca 2007-2015, cuando las cifras del INDEC fueron muy cuestionadas por subestimar la inflación. Las cuentas "reales" salen mejores de lo que fueron.'));

    msj.append(el('p', { class: 'suave' },
      `De ${nombreMes(p.desde)} a ${nombreMes(p.hasta)}` + (sim.inflacionPeriodo === null ? '.' : `, la inflación acumulada fue ${pct(sim.inflacionPeriodo)}.`)
      + ` "Hoy" es ${nombreMes(sim.mesHoy)}, el último mes de inflación cargado.`));

    const validos = sim.resultados.filter((r) => !r.sinDato).sort((a, b) => b.nominal - a.nominal);
    for (const r of validos.concat(sim.resultados.filter((x) => x.sinDato))) {
      const t = el('div', { class: 'tarjeta', style: color(r.estrategia), 'data-estrategia': r.estrategia }, el('h3', {}, NOMBRES[r.estrategia]));
      if (r.sinDato) t.append(el('p', { class: 'suave' }, r.estrategia === 'mezcla' && suma === 0 ? 'Poné algún porcentaje.' : 'Faltan datos en ese período.'));
      else {
        t.append(
          el('b', {}, pesos(r.nominal)),
          el('p', { class: 'suave' }, `nominales (${pct(r.variacionNominal, true)})`),
          el('p', {}, r.hoy === null ? 'En pesos de hoy: sin dato' : `En pesos de hoy: ${pesos(r.hoy)}`),
          el('p', {}, r.variacionReal === null ? 'Contra la inflación: sin dato'
            : `Contra la inflación: ${pct(r.variacionReal, true)} ${r.variacionReal >= 0 ? '(le ganó)' : '(perdió)'}`),
        );
      }
      $('tarjetas').append(t);
    }
    marcado = sim.meses.length - 1;
    pintarGrafico();
  }

  let geo = null;
  function series() {
    const campo = $('vista').value === 'hoy' ? 'curvaHoy' : 'curvaNominal';
    return sim.resultados.filter((r) => !r.sinDato).map((r) => ({ e: r.estrategia, v: r[campo] }));
  }

  function pintarGrafico() {
    if (!sim || sim.error) return;
    const svg = $('grafico');
    const ancho = Math.max(280, Math.round(svg.parentElement.clientWidth - 30));
    const alto = ancho < 500 ? 260 : 340;
    const m = { i: 58, d: 10, a: 10, b: 24 };
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    svg.textContent = '';
    const ss = series();
    const todos = ss.flatMap((s) => s.v).filter((v) => v !== null);
    $('leyenda').textContent = '';
    for (const s of ss) $('leyenda').append(rotulo(s.e));
    if (!todos.length) {
      geo = null;
      $('lectura').textContent = 'No hay inflación suficiente para dibujar este período en pesos de hoy.';
      return;
    }
    const log = $('escalaLog').checked;
    const f = log ? Math.log10 : (v) => v;
    let min = Math.min(...todos);
    let max = Math.max(...todos);
    if (max - min < max * 0.02) { min *= 0.98; max *= 1.02; }
    const n = sim.meses.length - 1;
    const x = (i) => m.i + (i / n) * (ancho - m.i - m.d);
    const y = (v) => m.a + (1 - (f(v) - f(min)) / (f(max) - f(min))) * (alto - m.a - m.b);
    for (let k = 0; k <= 4; k++) {
      const t = f(min) + (k / 4) * (f(max) - f(min));
      const v = log ? 10 ** t : t;
      svg.append(svgEl('line', { x1: m.i, x2: ancho - m.d, y1: y(v), y2: y(v), stroke: 'var(--borde)' }),
        svgEl('text', { x: m.i - 6, y: y(v) + 4, 'text-anchor': 'end' }, corto(v)));
    }
    const cortes = Math.min(ancho < 500 ? 2 : 5, n);
    for (let k = 0; k <= cortes; k++) {
      const i = Math.round((k / cortes) * n);
      svg.append(svgEl('text', { x: x(i), y: alto - 6, 'text-anchor': k === 0 ? 'start' : k === cortes ? 'end' : 'middle' }, nombreMes(sim.meses[i])));
    }
    for (const s of ss) {
      let d = '';
      let abierto = false;
      s.v.forEach((v, i) => {
        if (v === null) { abierto = false; return; }
        d += `${abierto ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
        abierto = true;
      });
      svg.append(svgEl('path', { d, fill: 'none', stroke: `var(--${s.e})`, 'stroke-width': 2.5, 'stroke-dasharray': TRAZO[s.e], 'data-serie': s.e }));
    }
    const guia = svgEl('line', { y1: m.a, y2: alto - m.b, stroke: 'var(--tinta)', 'stroke-dasharray': '3 3' });
    svg.append(guia);
    geo = { x, ancho, m, n, guia };
    marcar(marcado);
  }

  function marcar(i) {
    if (!geo) return;
    marcado = Math.max(0, Math.min(geo.n, i));
    geo.guia.setAttribute('x1', geo.x(marcado));
    geo.guia.setAttribute('x2', geo.x(marcado));
    $('lectura').textContent = `${nombreMes(sim.meses[marcado])}: ` + series()
      .map((s) => `${NOMBRES[s.e]} ${s.v[marcado] === null ? 'sin dato' : pesos(s.v[marcado])}`).join(' · ');
  }

  function celdas(tag, valores) {
    return el('tr', {}, ...valores.map((v) => el(tag, {}, v)));
  }

  function pintarVentanas() {
    const n = Number($('largo').value);
    const p = parametros();
    const lista = PF.ventanas(datos, n, { renovacion: p.renovacion, inflacion: p.inflacion });
    const r = PF.resumen(lista);
    const nombres = PF.disponibles(datos);
    const cont = $('resumen');
    cont.textContent = '';
    $('porDecada').textContent = '';
    $('rachas').textContent = '';
    if (!r.total) { cont.append(aviso('No hay ventanas completas con esa duración.')); return; }
    const barra = el('div', { class: 'barra', 'aria-hidden': 'true' });
    const lineas = el('ul', {});
    for (const e of nombres.concat(r.ganadas.empate ? ['empate'] : [])) {
      const g = r.ganadas[e] || 0;
      barra.append(el('i', { style: `${color(e)};width:${(g / r.total) * 100}%` }));
      let t = ` ganó ${g} de ${r.total} (${pct((g / r.total) * 100)})`;
      if (r.conInflacion && e !== 'empate') t += `; le ganó a la inflación en ${r.leGanaron[e] || 0} de ${r.conInflacion} con dato`;
      lineas.append(el('li', {}, rotulo(e), t));
    }
    cont.append(barra, lineas);
    if (datos.blue.size) cont.append(el('p', { class: 'suave' }, 'Con el blue cargado, solo cuentan las ventanas que tienen blue al entrar y en todos los meses.'));

    const decadas = [['2004-2009', '2004', '2009'], ['2010-2019', '2010', '2019'], ['2020 en adelante', '2020', '9999']];
    const tabla = $('porDecada');
    tabla.append(celdas('th', ['Entrada en', 'Ventanas', ...nombres.map((e) => NOMBRES[e])]));
    for (const [nombre, a, b] of decadas) {
      const sub = lista.filter((v) => v.desde.slice(0, 4) >= a && v.desde.slice(0, 4) <= b);
      if (!sub.length) continue;
      const rs = PF.resumen(sub);
      tabla.append(celdas('td', [nombre, String(rs.total), ...nombres.map((e) => String(rs.ganadas[e] || 0))]));
    }
    const t2 = $('rachas');
    t2.append(celdas('th', ['Entrando entre', 'Ganó', 'Meses', 'Margen prom.', 'Margen máx.']));
    for (const u of PF.rachas(lista)) {
      t2.append(celdas('td', [
        u.cantidad === 1 ? nombreMes(u.desdeEntrada) : `${nombreMes(u.desdeEntrada)} a ${nombreMes(u.hastaEntrada)}`,
        rotulo(u.ganador), String(u.cantidad), pct(u.margenPromedio), pct(u.margenMaximo),
      ]));
    }
  }

  function rearmar() {
    datos = PF.armarDatos(window.DATOS, carga);
    const hayBlue = datos.blue.size > 0;
    $('campoBlue').hidden = !hayBlue;
    $('quitar').hidden = !carga;
    $('avisoInventado').hidden = !(carga && carga.inventado);
    $('avisoFalta').hidden = !!carga;
    pintarSimulador();
    pintarVentanas();
  }

  function guardar(texto) {
    try {
      if (texto === null) localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, texto);
      return true;
    } catch (e) { return false; }
  }

  function cargarTexto(texto) {
    const r = PF.leerCargaUsuario(texto);
    const estado = $('estadoCarga');
    estado.textContent = '';
    if (r.errores.length) {
      estado.append(aviso('No cargué nada. ' + r.errores.slice(0, 5).join(' ') + (r.errores.length > 5 ? ` (y ${r.errores.length - 5} errores más)` : '')));
      return;
    }
    carga = r;
    const guardado = guardar(texto);
    estado.append(el('p', {}, `Cargado${r.inventado ? ' (ejemplo INVENTADO)' : ''}: ${r.blue.size} meses de blue.` + (guardado ? '' : ' No se pudo guardar: se pierde al cerrar.')));
    rearmar();
  }

  function iniciar() {
    try {
      const previo = localStorage.getItem(CLAVE);
      if (previo) { const r = PF.leerCargaUsuario(previo); if (!r.errores.length) carga = r; }
    } catch (e) { /* sin almacenamiento: se sigue igual */ }
    datos = PF.armarDatos(window.DATOS, carga);
    for (const id of ['desde', 'hasta']) { $(id).min = datos.desde; $(id).max = datos.hasta; }
    $('desde').value = '2017-01';
    $('hasta').value = datos.hasta;
    $('cobertura').textContent = `Cobertura: plazo fijo y dólar de ${nombreMes(datos.desde)} a ${nombreMes(datos.hasta)}; inflación hasta ${nombreMes(PF.ultimoMes(datos.inflacion.referencia))}.`;

    $('form').addEventListener('submit', (ev) => ev.preventDefault());
    $('form').addEventListener('input', (ev) => {
      pintarSimulador();
      if (['renovacion', 'inflacion'].includes(ev.target.id)) pintarVentanas();
    });
    $('vista').addEventListener('change', pintarGrafico);
    $('escalaLog').addEventListener('change', pintarGrafico);
    $('largo').addEventListener('change', pintarVentanas);
    const svg = $('grafico');
    const puntero = (ev) => {
      if (!geo) return;
      const caja = svg.getBoundingClientRect();
      const px = ((ev.clientX - caja.left) / caja.width) * geo.ancho;
      marcar(Math.round(((px - geo.m.i) / (geo.ancho - geo.m.i - geo.m.d)) * geo.n));
    };
    svg.addEventListener('pointermove', puntero);
    svg.addEventListener('pointerdown', puntero);
    svg.addEventListener('keydown', (ev) => {
      const paso = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12, Home: -9999, End: 9999 }[ev.key];
      if (paso === undefined) return;
      ev.preventDefault();
      marcar(marcado + paso);
    });
    $('archivo').addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      if (f) cargarTexto(await f.text());
      ev.target.value = '';
    });
    $('ejemplo').addEventListener('click', () => cargarTexto(window.DATOS.ejemplo));
    $('quitar').addEventListener('click', () => {
      carga = null;
      guardar(null);
      $('mBlue').value = 0;
      $('estadoCarga').textContent = 'Datos quitados.';
      rearmar();
    });
    let espera;
    window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(pintarGrafico, 120); });
    rearmar();
  }

  iniciar();
})();
