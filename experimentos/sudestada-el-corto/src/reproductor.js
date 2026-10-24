/* ---- la línea de tiempo: una escena por shader ---- */
const ESCENAS = [
  { id: "00-portada", nombre: "Portada", dur: 6, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.5, fout: 1.0,
    textos: [{ desde: 1.0, hasta: 5.2, clase: "", html: '<span class="titulo">SUDESTADA</span><br><span class="chico">el corto, a partir de la novela</span>' }],
    sonido: (S) => { S.viento(0, 6, 0.25, 0.25); S.nota(1.2, 73.42, 0.16, 4.5); S.nota(1.25, 110.0, 0.05, 4.0); } },
  { id: "01-lancha", nombre: "La lancha colectiva", dur: 30, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define ALCANCE 90.0", fin: 1.2, fout: 0.8,
    textos: [{ desde: 1.0, hasta: 4.5, clase: "arriba-izq", html: '<span class="cartel">Jueves</span>' }],
    sonido: (S) => { S.viento(0, 30, 0.2, 0.25); S.motor(0, 30); S.oleaje(0, 30, 0.12); S.pajaro(4.5, 1); S.pajaro(14.2, 2); S.pajaro(24.0, 1); } },
  { id: "02-puerta", nombre: "La puerta abierta", dur: 32, defines: "#define NLUCES 1\n#define NSOMBRAS 1\n#define PASOS 100", fin: 0.8, fout: 0.8,
    textos: [],
    sonido: (S) => { S.viento(0, 32, 0.3, 0.45); S.oleaje(0, 32, 0.06); S.pasos(5.5, 15.8, 1.05); S.chapas(0, 32, 0.5); S.canilla(9.5, 17.5); } },
  { id: "03-tinta", nombre: "La tinta", dur: 40, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.5, clase: "arriba-izq", html: '<span class="cartel">Jueves, a la tarde</span>' }],
    sonido: (S) => { S.viento(0, 40, 0.35, 0.55); S.oleaje(0, 40, 0.08); S.chapas(0, 40, 0.6); S.remada(0, 4, 2.4, 0.2, 0.2); S.perro(20.5, 2, 0.2); S.remada(36, 40, 2.4, 0.2, 0.2); } },
  { id: "04-viento", nombre: "El viento gira", dur: 30, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 100", fin: 1.0, fout: 1.0, rayos: [[11.0, -0.45]],
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Jueves, a la noche</span>' }],
    sonido: (S) => { S.viento(0, 30, 0.5, 0.9); S.radio(0.5, 7.5); S.lluvia(8, 30, 0.0, 0.2); S.trueno(11.6); S.vidrios(0, 30); S.oleaje(0, 30, 0.1); S.trueno(26.5); } },
  { id: "05-hombre", nombre: "El hombre de la chata", dur: 33, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define ALCANCE 70.0", fin: 1.2, fout: 0.8,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Viernes, de madrugada</span>' }],
    sonido: (S) => { S.viento(0, 33, 0.35, 0.6); S.lluvia(0, 33, 0.14, 0.14); S.corriente(0, 33, 0.25); S.remada(2, 15, 2.6, 0.12, 0.6); S.perro(9.0, 2, 0.25); S.mate(19.0); S.mate(27.5); } },
  { id: "06-taller", nombre: "Una mano que me conoce", dur: 40, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Viernes, a la tarde</span>' }],
    sonido: (S) => { S.viento(0, 40, 0.3, 0.4, 700); S.lluvia(0, 40, 0.25, 0.25, 2200); S.cajon(8.0); S.papel(12.0); S.papel(31.0); S.trueno(34.0); } },
  { id: "07-escalera", nombre: "El agua sube por la escalera", dur: 32, defines: "#define NLUCES 2\n#define NSOMBRAS 2\n#define PASOS 90\n#define ALCANCE 30.0", fin: 1.0, fout: 0.0,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Viernes, a la noche</span>' }],
    sonido: (S) => { S.viento(0, 32, 0.18, 0.25, 900); S.goteo(0, 32); S.madera(0, 32); S.grupo(0, 20.0); S.motivo(22.5, 0.35); } },
  { id: "08-chata", nombre: "La chata", dur: 32, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100", fin: 0.6, fout: 0.8,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, de madrugada</span>' }],
    sonido: (S) => { S.viento(0, 32, 0.4, 0.6); S.lluvia(0, 32, 0.12, 0.12); S.corriente(0, 32, 0.5); S.remada(0, 9, 1.9, 0.5, 0.3); S.golpe(9.4); S.perro(12.5, 3, 0.4); S.respiracion(2, 24); S.chapoteo(14, 25); } },
  { id: "09-pan", nombre: "El pan", dur: 45, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, a la mañana</span>' }],
    sonido: (S) => { S.viento(0, 45, 0.3, 0.35, 700); S.lluvia(0, 45, 0.3, 0.3, 2000); S.cuchillo(2.0); S.cuchillo(4.0); S.papel(7.0); S.cuchillo(17.0); S.madera(0, 45); } },
  { id: "10-acuna", nombre: "El señor Acuña", dur: 35, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, al mediodía</span>' }],
    sonido: (S) => { S.viento(0, 35, 0.35, 0.4); S.lluvia(0, 35, 0.1, 0.06); S.oleaje(0, 35, 0.12); S.motor(0, 35, 0.5); } },
  { id: "11-mensaje", nombre: "14.10", dur: 40, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, a la tarde</span>' }],
    sonido: (S) => { S.viento(0, 40, 0.3, 0.4, 700); S.lluvia(0, 40, 0.3, 0.3, 2000); S.canilla(0, 10.5); S.trueno(22.0); S.madera(0, 40); } },
  { id: "12-llave", nombre: "Con llave", dur: 35, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, a la noche</span>' }],
    sonido: (S) => { S.viento(0, 35, 0.6, 0.95, 900); S.lluvia(0, 35, 0.3, 0.3, 1800); S.madera(0, 35); S.pasos(17.5, 21.0, 0.5); S.golpe(21.5); S.llave(22.5); S.golpePuerta(24.5); S.golpePuerta(25.3); S.golpePuerta(31.0); } },
  { id: "13-luz", nombre: "La luz en el galpón", dur: 20, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 80\n#define ALCANCE 400.0", fin: 1.0, fout: 1.0,
    textos: [],
    sonido: (S) => { S.viento(0, 20, 0.5, 0.95, 1200); S.lluvia(0, 20, 0.3, 0.3, 1800); S.madera(0, 20); } },
  { id: "14-ella", nombre: "Ella", dur: 45, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 0.5, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, 3.00</span>' }],
    sonido: (S) => { S.viento(0, 45, 0.4, 0.6, 900); S.lluvia(0, 45, 0.2, 0.2, 1800); S.madera(0, 45); S.papel(2.0); S.papel(23.5); S.pasos(36.0, 38.5, 0.6); S.llave(38.5); S.vientoEntra(39.5, 45); } },
  { id: "15-farol", nombre: "Salí del agua", dur: 38, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 110", fin: 1.0, fout: 1.5, rayos: [[2.4, 0.3], [4.55, -0.2], [6.3, -0.5]],
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, 4.20</span>' }],
    sonido: (S) => { S.viento(0, 38, 0.6, 1.0); S.lluvia(0, 38, 0.15, 0.1); S.corriente(0, 38, 0.5); S.trueno(2.9); S.remada(0, 4.2, 1.9, 0.5, 0.4); S.vuelco(4.2); S.trueno(5.0); S.trueno(6.9); S.chapa(8.5); S.perro(9.5, 5, 0.6); S.perro(12.0, 3, 0.5); S.chapoteo(10, 28); S.motivo(19.0, 0.9); } },
  { id: "16-elias", nombre: "La cocina de Elías", dur: 62, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.0, fout: 1.0, falta: true,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, 7.00</span>' }],
    sonido: (S) => { S.viento(0, 62, 0.25, 0.2, 700); S.lluvia(0, 62, 0.12, 0.06, 2000); S.lena(0, 62); S.radio(0.5, 3.5); S.mate(13.5); S.mate(33.0); S.mate(54.0); } },
  { id: "17-barro", nombre: "Barro", dur: 40, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define MARCA 2.1", fin: 1.5, fout: 1.5,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, a la tarde</span>' }],
    sonido: (S) => { S.viento(0, 40, 0.12, 0.1); S.oleaje(0, 40, 0.05); S.pajaro(2.0, 1); S.pajaro(5.5, 3); S.balde(3.0); S.pajaro(9.0, 2); S.balde(12.5); S.balde(24.0); S.pajaro(29.0, 1); S.balde(35.0); } },
  { id: "18-escribania", nombre: "Martes, once", dur: 70, defines: "#define NLUCES 1\n#define NSOMBRAS 1\n#define PASOS 90\n#define ALCANCE 40.0\n#define PAPEL", fin: 1.5, fout: 1.5,
    textos: [{ desde: 1.0, hasta: 4.5, clase: "arriba-izq", html: '<span class="cartel">Martes, 10.50 · Escribanía Pereyra, Tigre</span>' }],
    sonido: (S) => { S.ventilador(0, 55); S.papel(5.0); S.papel(14.0); S.lapicera(44.0, 48.0); S.lapicera(50.5, 53.0); S.motivoMayor(50.5, 0.8); S.calle(55, 70); } },
  { id: "19-cierre", nombre: "Cierre", dur: 22, defines: "#define NLUCES 1\n#define PASOS 40", fin: 0.0, fout: 2.0,
    textos: [{ desde: 2.5, hasta: 9.5, clase: "", html: '«Cuando los hechos dicen lo que una ya pensaba, es cuando menos hay que creerles.»' }, { desde: 10.5, hasta: 14.5, clase: "", html: 'Preguntá. Y después, esperá.' }, { desde: 15.5, hasta: 19.5, clase: "", html: '<span class="titulo">SUDESTADA</span>' }, { desde: 19.7, hasta: 21.8, clase: "", html: '<span class="chico">a partir de la novela · Programador nocturno · 2026</span>' }],
    sonido: (S) => { S.acorde(1.0, 14.0); S.pajaro(16.5, 1); S.viento(0, 22, 0.1, 0.05); } },
];
/* las líneas de diálogo (voces/lineas.json, metidas por build.js como LINEAS): se reparten por escena y, si una línea empieza antes
   de que termine la anterior, se corre; así los tiempos del guion son «no antes de» */
for (const e of ESCENAS) {
  e.lineas = (typeof LINEAS !== "undefined" ? LINEAS : []).filter((l) => l.escena === e.id).map((l) => ({ ...l })); let fin = 0;
  for (const l of e.lineas) { l.t = Math.max(l.t, fin); fin = l.t + (l.dur || 2) + 0.35; }
  if (e.falta) e.textos.push({ desde: 0.3, hasta: e.dur - 0.3, clase: "nota", html: 'escena todavía sin imagen: por ahora, el diálogo' });
}
let acum = 0; for (const e of ESCENAS) { e.inicio = acum; acum += e.dur; }
const DUR = acum;

const canvas = document.getElementById("c"), capa = document.getElementById("capa"), textoDiv = document.getElementById("texto"), textoP = document.getElementById("textoP"), subDiv = document.getElementById("sub"), subP = document.getElementById("subP"), avance = document.getElementById("avance"), aviso = document.getElementById("aviso"), cargando = document.getElementById("cargando");
const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
const paralelo = gl && gl.getExtension("KHR_parallel_shader_compile");
let gpu = ""; try { const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info"); if (dbg) gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \(|\)$/g, "").slice(0, 60); } catch (e) { /* sin dato */ }
let buf;
const fuente = (id) => { const s = document.getElementById(id); return s ? s.textContent : null; };
/* arma y compila el programa de una escena: cabecera + comun + escena + main; si la escena no tiene shader todavía, usa el de la portada */
function compilar(i) {
  const e = ESCENAS[i]; if (e.prog) return e;
  const cuerpo = fuente("glsl-" + e.id) || fuente("glsl-00-portada");
  const src = (e.defines || "") + "\n" + fuente("glsl-comun") + "\n" + cuerpo + "\n" + fuente("glsl-main");
  const vs = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  const mk = (tipo, s) => { const sh = gl.createShader(tipo); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  const prog = gl.createProgram(); const fsh = mk(gl.FRAGMENT_SHADER, src); gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, fsh); gl.linkProgram(prog);
  e.prog = prog; e.fsh = fsh; e.src = src; e.lista = false; e.t0 = performance.now();
  return e;
}
/* devuelve la escena lista para dibujar, o null si todavía se está compilando en segundo plano (KHR_parallel_shader_compile) */
function asegurar(i, esperar) {
  const e = compilar(i); if (e.lista) return e;
  if (paralelo && !esperar && !gl.getProgramParameter(e.prog, paralelo.COMPLETION_STATUS_KHR)) return null;
  if (!gl.getProgramParameter(e.prog, gl.LINK_STATUS)) { const log = gl.getShaderInfoLog(e.fsh) || gl.getProgramInfoLog(e.prog); throw new Error("escena " + e.id + ": " + log); }
  if (e.t0) console.log(`escena ${e.id} compilada en ${Math.round(performance.now() - e.t0)} ms`);
  e.u = {}; for (const n of ["uRes", "uT", "uFlash", "uRayo", "uFundido"]) e.u[n] = gl.getUniformLocation(e.prog, n);
  e.loc = gl.getAttribLocation(e.prog, "p"); e.lista = true;
  return e;
}
function usar(e) { gl.useProgram(e.prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(e.loc); gl.vertexAttribPointer(e.loc, 2, gl.FLOAT, false, 0, 0); }
/* escala de render: fija según el selector o automática */
let escalaAuto = 1.0, tiempos = [];
function escala() { const cal = document.getElementById("calidad"); const v = cal ? cal.value : "1"; return v === "auto" ? escalaAuto : parseFloat(v); }
function ajustar() {
  const dpr = Math.min(escala(), Math.min(devicePixelRatio || 1, 2));
  const w = Math.max(160, Math.round(canvas.clientWidth * dpr)), h = Math.max(90, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  const est = document.getElementById("estado"); if (est) est.textContent = `${w}×${h}${gpu ? " · " + gpu : ""}`;
}
function adaptar(ms) {
  const cal = document.getElementById("calidad"); if (!cal || cal.value !== "auto") return;
  tiempos.push(ms); if (tiempos.length < 12) return;
  const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length; tiempos = [];
  if (prom > 45 && escalaAuto > 0.3) escalaAuto = Math.max(0.3, escalaAuto * 0.75);
  else if (prom < 18 && escalaAuto < 1.5) escalaAuto = Math.min(1.5, escalaAuto * 1.15);
}
/* relámpagos por escena: [instante, x en pantalla] */
function flash(e, t) { let f = 0; for (const [r] of e.rayos || []) { const d = t - r; if (d >= 0) f += Math.exp(-d * 14) + 0.6 * Math.exp(-Math.max(0, d - 0.12) * 18) * (d > 0.1 ? 1 : 0); } return Math.min(1.2, f); }
function rayo(e, t) { const rs = e.rayos || []; for (let i = 0; i < rs.length; i++) { const d = t - rs[i][0]; if (d >= 0 && d < 0.22) return [rs[i][1], d < 0.08 ? 1 : d < 0.11 ? 0.2 : Math.max(0, 1 - (d - 0.11) / 0.11), i * 17.3 + rs[i][0]]; } return [0, 0, 0]; }
const suave = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
function fundido(e, t) { const fin = e.fin ?? 1.0, fout = e.fout ?? 0.8; let f = 1; if (fin > 0) f *= suave(0, fin, t); if (fout > 0) f *= 1 - suave(e.dur - fout, e.dur, t); return f; }
function escenaEn(tg) { let i = ESCENAS.length - 1; while (i > 0 && ESCENAS[i].inicio > tg) i--; return i; }
let actual = -1;
function dibujar(tg, esperar) {
  tg = Math.max(0, Math.min(DUR - 0.001, tg));
  const i = escenaEn(tg); const e = asegurar(i, esperar);
  if (!e) { cargando.textContent = `Preparando «${ESCENAS[i].nombre}»…`; return false; }
  cargando.textContent = "";
  const t = tg - e.inicio;
  if (i !== actual) { actual = i; marcarEscena(i); if (corriendo && i + 1 < ESCENAS.length) compilar(i + 1); }
  usar(e);
  const r = rayo(e, t);
  gl.uniform2f(e.u.uRes, canvas.width, canvas.height); gl.uniform1f(e.u.uT, t); gl.uniform1f(e.u.uFlash, flash(e, t)); gl.uniform3f(e.u.uRayo, r[0], r[1], r[2]); gl.uniform1f(e.u.uFundido, fundido(e, t));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  /* intertítulos */
  let tx = null; for (const x of e.textos || []) if (t >= x.desde && t < x.hasta) tx = x;
  if (tx) { if (textoP.dataset.html !== tx.html) { textoP.innerHTML = tx.html; textoP.dataset.html = tx.html; } textoDiv.className = "texto visible " + (tx.clase || ""); } else textoDiv.classList.remove("visible");
  /* subtítulo de la línea que se está diciendo */
  let ln = null; for (const l of e.lineas || []) if (t >= l.t - 0.1 && t < l.t + (l.dur || 2) + 0.25) ln = l;
  if (ln) { if (subP.dataset.id !== ln.id) { subP.textContent = ln.texto; subP.dataset.id = ln.id; } subDiv.classList.add("visible"); } else { subDiv.classList.remove("visible"); subP.dataset.id = ""; }
  avance.style.width = (tg / DUR * 100).toFixed(2) + "%";
  return true;
}

/* ---- reproducción ---- */
let inicio = 0, raf = 0, corriendo = false, ultimo = 0;
function cuadro(now) {
  const tg = (now - inicio) / 1000;
  if (ultimo) adaptar(now - ultimo); ultimo = now;
  ajustar();
  try { dibujar(tg); } catch (e) { console.error(e); aviso.textContent = String(e.message || e); aviso.style.display = "block"; detener(); return; }
  if (tg < DUR) raf = requestAnimationFrame(cuadro); else terminar();
}
let pedido = 0;
async function reproducir(desde) {
  if (!gl) return;
  desde = desde || 0; const mio = ++pedido;
  capa.classList.add("oculta"); corriendo = true; cancelAnimationFrame(raf);
  /* con compilación en paralelo, se mandan a compilar todas las escenas de entrada y el driver las prepara de fondo */
  if (paralelo) for (let i = 0; i < ESCENAS.length; i++) compilar(i);
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); destinoGrab = actx.createMediaStreamDestination(); }
  if (actx.state === "suspended") actx.resume();
  try { await cargarVoces(actx, (n, total) => { cargando.textContent = `Cargando voces… ${n}/${total}`; }); } catch (e) { console.warn("sin voces:", e); }
  if (mio !== pedido) return; /* mientras cargaban, se pidió otra cosa */
  sonar(desde);
  inicio = performance.now() - desde * 1000; ultimo = 0; tiempos = []; raf = requestAnimationFrame(cuadro);
}
function detener() { corriendo = false; cancelAnimationFrame(raf); callar(); }
function terminar() { detener(); textoDiv.classList.remove("visible"); capa.querySelector("h1").textContent = "Fin"; capa.querySelector("p").textContent = "Sudestada, el corto. ¿Otra vez?"; document.getElementById("play").textContent = "↻ Otra vez"; capa.classList.remove("oculta"); if (grabadora && grabadora.state === "recording") grabadora.stop(); }
function saltar(tg) { if (corriendo) reproducir(tg); else { ajustar(); try { dibujar(tg, true); } catch (e) { console.error(e); } } }

/* ---- sonido ---- */
let actx, maestro, destinoGrab, fuentes = [];
function sonar(desde) {
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); destinoGrab = actx.createMediaStreamDestination(); }
  if (actx.state === "suspended") actx.resume();
  callar();
  maestro = cadenaMaestra(actx, [actx.destination, destinoGrab]);
  fuentes = programar(actx, maestro, actx.currentTime + 0.05 - desde, desde);
}
function callar() { for (const f of fuentes) { try { f.stop(); } catch (e) { /* ya parada */ } } fuentes = []; if (maestro) { try { maestro.disconnect(); } catch (e) { /* nada */ } } }
/* la cadena maestra: un compresor suave que empareja las escenas y un limitador para que nada sature (ni el trueno ni un grito) */
function cadenaMaestra(ctx, destinos) {
  const m = ctx.createGain(); m.gain.value = 1.0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  const sal = ctx.createGain(); sal.gain.value = 1.15;
  m.connect(comp); comp.connect(lim); lim.connect(sal); for (const d of destinos) sal.connect(d);
  return m;
}
/* las voces: archivos .ogg en voces/, decodificados una vez por contexto */
const vocesCache = new WeakMap();
async function cargarVoces(ctx, avance) {
  let cache = vocesCache.get(ctx); if (!cache) { cache = {}; vocesCache.set(ctx, cache); }
  const faltan = []; for (const e of ESCENAS) for (const l of e.lineas) if (!cache[l.id]) faltan.push(l);
  let n = 0; const total = faltan.length; if (avance && total) avance(0, total);
  const bajar = async (l) => { try { const r = await fetch("voces/" + l.id + ".ogg"); if (!r.ok) throw new Error(r.status); const ab = await r.arrayBuffer(); cache[l.id] = await ctx.decodeAudioData(ab); } catch (e) { cache[l.id] = null; console.warn("voz " + l.id + ": " + (e.message || e)); } n++; if (avance) avance(n, total); };
  /* de a seis a la vez */
  const cola = faltan.slice(); await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) await bajar(cola.shift()); }));
  return cache;
}
/* programa toda la banda de sonido: T0 es el instante absoluto del segundo 0 del corto; desde, los segundos que se saltan.
   Los efectos van por un bus de ambiente que baja mientras alguien habla; las voces van directo al maestro. */
function programar(ctx, m, T0, desde) {
  const todas = []; const cache = vocesCache.get(ctx) || {};
  const amb = ctx.createGain(); amb.gain.value = 1.0; amb.connect(m);
  for (const e of ESCENAS) {
    if (e.inicio + e.dur <= desde) continue;
    const S = sonidos(ctx, amb, T0 + e.inicio, Math.max(0, desde - e.inicio), e.dur);
    e.sonido(S);
    for (const l of e.lineas) {
      const b = cache[l.id]; const t0 = e.inicio + l.t, t1 = t0 + (b ? b.duration : (l.dur || 2));
      if (t1 <= desde) continue;
      const vol = l.variante === "off" ? 0.95 : 1.0;
      const chk = document.getElementById("voces"); if (chk && !chk.checked) continue; /* sin voces: quedan los subtítulos */
      if (b) { const src = ctx.createBufferSource(); src.buffer = b; const g = ctx.createGain(); g.gain.value = vol; src.connect(g); g.connect(m); src.start(T0 + Math.max(t0, desde), Math.max(0, desde - t0)); S.fuentes.push(src); }
      /* el ambiente baja a la mitad mientras habla y vuelve despacio */
      const baja = l.variante === "grito" ? 0.7 : 0.45;
      amb.gain.setTargetAtTime(baja, T0 + Math.max(t0 - 0.15, desde), 0.06); amb.gain.setTargetAtTime(1.0, T0 + Math.max(t1 + 0.1, desde), 0.3);
    }
    for (const f of S.fuentes) todas.push(f);
  }
  return todas;
}

/* ---- la barra de tiempo y la lista de escenas ---- */
const barra = document.getElementById("barra"), cortes = document.getElementById("cortes"), listaEsc = document.getElementById("escenas");
for (const e of ESCENAS) { if (e.inicio > 0) { const d = document.createElement("div"); d.className = "corte"; d.style.left = (e.inicio / DUR * 100) + "%"; cortes.appendChild(d); } }
barra.addEventListener("pointerdown", (ev) => { const r = barra.getBoundingClientRect(); saltar((ev.clientX - r.left) / r.width * DUR); });
ESCENAS.forEach((e, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "sec" + (fuente("glsl-" + e.id) ? "" : " falta"); b.textContent = `${i}. ${e.nombre}`; b.title = fuente("glsl-" + e.id) ? `${e.dur} s` : `${e.dur} s · todavía sin imagen, se escucha el diálogo`; b.addEventListener("click", () => saltar(e.inicio)); listaEsc.appendChild(b); e.boton = b; });
function marcarEscena(i) { ESCENAS.forEach((e, k) => e.boton && e.boton.classList.toggle("actual", k === i)); }

/* ---- grabar a webm con el audio ---- */
let grabadora = null;
function grabar() {
  if (!("MediaRecorder" in window) || !canvas.captureStream) { alert("Tu navegador no graba video desde canvas."); return; }
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); destinoGrab = actx.createMediaStreamDestination(); }
  const stream = canvas.captureStream(60); for (const tr of destinoGrab.stream.getAudioTracks()) stream.addTrack(tr);
  const tipo = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const partes = []; grabadora = new MediaRecorder(stream, { mimeType: tipo || undefined, videoBitsPerSecond: 12e6 });
  grabadora.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  grabadora.onstop = () => { const url = URL.createObjectURL(new Blob(partes, { type: "video/webm" })); const a = document.createElement("a"); a.href = url; a.download = "sudestada-el-corto.webm"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
  grabadora.start(100); reproducir(0);
}

/* ---- arranque ---- */
const qs = new URLSearchParams(location.search);
try {
  if (!gl) throw new Error("sin WebGL");
  buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  escalaAuto = 0.5; ajustar();
  const qe = qs.get("escena"), qt = qs.get("t");
  if (qe !== null || qt !== null) {
    /* un cuadro fijo, para pruebas y para el render: ?t=segundos (global) o ?escena=N&t=segundos (local) */
    document.getElementById("calidad").value = "1"; capa.style.display = "none"; textoDiv.style.transition = "none"; ajustar();
    const tg = qe !== null ? ESCENAS[Math.max(0, Math.min(ESCENAS.length - 1, parseInt(qe, 10)))].inicio + parseFloat(qt || "0") : parseFloat(qt);
    dibujar(tg, true);
  } else dibujar(0.001, true);
} catch (e) { aviso.style.display = "block"; aviso.textContent = "Tu navegador no pudo iniciar WebGL: " + (e.message || e); document.getElementById("play").disabled = true; console.error(e); }
window.__listo = true;
window.__render = (tg) => { document.getElementById("calidad").value = "1"; capa.style.display = "none"; textoDiv.style.transition = "none"; ajustar(); dibujar(tg, true); return true; };
window.__fuente = (i) => compilar(i).src;
window.__escenas = () => ESCENAS.map((e) => ({ id: e.id, nombre: e.nombre, dur: e.dur, inicio: e.inicio, propia: !!fuente("glsl-" + e.id) }));
window.__probarTodas = () => { const r = []; for (let i = 0; i < ESCENAS.length; i++) { try { asegurar(i, true); r.push({ id: ESCENAS[i].id, ok: true }); } catch (e) { r.push({ id: ESCENAS[i].id, ok: false, error: String(e.message || e) }); } } return r; };
document.getElementById("play").addEventListener("click", () => reproducir(0));
document.getElementById("otra").addEventListener("click", () => reproducir(0));
document.getElementById("grabar").addEventListener("click", grabar);
document.getElementById("voces").addEventListener("change", () => { if (corriendo) reproducir(Math.max(0, (performance.now() - inicio) / 1000)); });
document.getElementById("calidad").addEventListener("change", () => { ajustar(); if (!corriendo) dibujar(Math.max(0.001, (performance.now() - inicio) / 1000 * (inicio ? 1 : 0)), true); });
addEventListener("resize", () => { ajustar(); if (!corriendo) dibujar(actual >= 0 ? Math.max(0.001, (performance.now() - inicio) / 1000) : 0.001, true); });
/* el sonido entero renderizado a WAV sin parlantes (para el .mp4) */
window.__wav = async (desde, hasta) => {
  desde = desde || 0; hasta = hasta || DUR;
  const sr = 44100, off = new OfflineAudioContext(1, Math.ceil(sr * (hasta - desde)), sr); await cargarVoces(off); const m = cadenaMaestra(off, [off.destination]); programar(off, m, -desde, desde);
  const b = await off.startRendering(); const d = b.getChannelData(0); const out = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + d.length * 2, true); str(8, "WAVE"); str(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let bin = ""; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(bin);
};
