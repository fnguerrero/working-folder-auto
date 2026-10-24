/* ---- la línea de tiempo: una escena por shader ---- */
const ESCENAS = [
  { id: "00-portada", dialogos: [{ desde: 1.2, quien: "vero", texto: "Mi hermano llamó un martes a la noche. Dijo: necesito que vengas. No por teléfono." }], nombre: "Portada", dur: 6, defines: "#define NLUCES 1\n#define PASOS 40", fin: 1.5, fout: 1.0,
    textos: [{ desde: 1.0, hasta: 5.2, clase: "", html: '<span class="titulo">SUDESTADA</span><br><span class="chico">el corto, a partir de la novela</span>' }],
    sonido: (S) => { S.viento(0, 6, 0.25, 0.25); S.nota(1.2, 73.42, 0.16, 4.5); S.nota(1.25, 110.0, 0.05, 4.0); } },
  { id: "01-lancha", dialogos: [{ desde: 5.0, quien: "lanchero", texto: "¿Va a lo de Aldao? El arroyo anda alto. La del mediodía es la última que entra hasta el Fraile." }, { desde: 12.5, quien: "veroDice", texto: "Sí. A lo de Aldao." }, { desde: 16.0, quien: "vero", texto: "No por teléfono. Cinco sílabas y una pausa. La venía dando vuelta como se da vuelta un documento contra la luz." }], nombre: "La lancha colectiva", dur: 22, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define ALCANCE 90.0", fin: 1.2, fout: 0.8,
    textos: [{ desde: 1.0, hasta: 4.5, clase: "arriba-izq", html: '<span class="cartel">Jueves</span>' }, { desde: 15.5, hasta: 21.0, clase: "abajo", html: "«Necesito que vengas. No por teléfono.»" }],
    sonido: (S) => { S.viento(0, 22, 0.2, 0.25); S.motor(0, 22); S.oleaje(0, 22, 0.12); S.pajaro(6.5, 1); S.pajaro(12.2, 2); } },
  { id: "02-puerta", dialogos: [{ desde: 1.5, quien: "vero", texto: "La lancha de Martín no estaba. La chata sí. Y la puerta de la galería estaba abierta, con la hoja contra la pared." }, { desde: 9.5, quien: "vero", texto: "En la baranda había una toalla celeste, con flores. En esa casa no hay toallas con flores. Las toallas las compro yo." }, { desde: 15.5, quien: "ana", texto: "Soy la pareja de Martín. ¿Vos sos la hermana?" }], nombre: "La puerta abierta", dur: 20, defines: "#define NLUCES 1\n#define NSOMBRAS 1\n#define PASOS 100", fin: 0.8, fout: 0.8,
    textos: [{ desde: 15.0, hasta: 19.5, clase: "abajo", html: "«Soy la pareja de Martín. ¿Vos sos la hermana?»" }],
    sonido: (S) => { S.viento(0, 20, 0.3, 0.45); S.oleaje(0, 20, 0.06); S.pasos(5.5, 13.5, 0.95); S.chapas(0, 20, 0.5); S.canilla(9.5, 16.0); } },
  { id: "03-viento", dialogos: [{ desde: 2.0, quien: "ana", texto: "Martín salió el miércoles temprano, por un trabajo. No volvió. Tiene el teléfono apagado." }, { desde: 9.0, quien: "vero", texto: "Esa noche el viento giró, y el arroyo empezó a correr al revés." }, { desde: 15.0, quien: "elias", texto: "Viene sudestada, Verónica. Si te vas, andate hoy." }], nombre: "El viento gira", dur: 20, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 100", fin: 1.0, fout: 1.0, rayos: [[11.0, -0.45]],
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Jueves, a la noche</span>' }, { desde: 14.5, hasta: 19.3, clase: "abajo", html: "«Viene sudestada. Si te vas, andate hoy.»" }],
    sonido: (S) => { S.viento(0, 20, 0.5, 0.9); S.radio(0.5, 7.5); S.lluvia(8, 20, 0.0, 0.2); S.trueno(11.6); S.vidrios(0, 20); S.oleaje(0, 20, 0.1); } },
  { id: "04-escalera", dialogos: [{ desde: 1.5, quien: "vero", texto: "El viernes a la noche el agua entró en la planta baja. Subimos lo que quedaba, a oscuras, con linternas." }, { desde: 11.5, quien: "vero", texto: "Sábado cinco de julio. Ella no va a dejarme ir. No lo dice así." }, { desde: 19.9, quien: "ana", texto: "Se cortó la luz." }], nombre: "El agua sube por la escalera", dur: 22, defines: "#define NLUCES 2\n#define NSOMBRAS 2\n#define PASOS 90\n#define ALCANCE 30.0", fin: 1.0, fout: 0.0,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Viernes</span>' }, { desde: 12.0, hasta: 17.5, clase: "abajo", html: "«Ella no va a dejarme ir. No lo dice así.»" }],
    sonido: (S) => { S.viento(0, 22, 0.18, 0.25, 900); S.goteo(0, 22); S.madera(0, 22); S.grupo(0, 19.8); S.motivo(5.0, 0.35); } },
  { id: "05-hombre", dialogos: [{ desde: 2.0, quien: "vero", texto: "A las seis de la mañana, del otro lado del arroyo, entre los sauces del recreo abandonado, había un hombre en una chata." }, { desde: 15.0, quien: "vero", texto: "Remaba raro. Como al revés." }], nombre: "El hombre de la chata", dur: 22, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define ALCANCE 70.0", fin: 1.2, fout: 0.8,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, de madrugada</span>' }, { desde: 15.0, hasta: 20.0, clase: "abajo", html: "«Remaba raro. Como al revés.»" }],
    sonido: (S) => { S.viento(0, 22, 0.35, 0.6); S.lluvia(0, 22, 0.14, 0.14); S.corriente(0, 22, 0.25); S.remada(2, 17, 2.6, 0.12, 0.6); S.perro(9.0, 2, 0.25); } },
  { id: "06-chata", dialogos: [{ desde: 0.8, quien: "vero", texto: "Bajé la escalera sin ponerme las botas. Desaté la chata, calcé los remos, y salí." }, { desde: 9.6, quien: "vero", texto: "Un tronco." }, { desde: 16.5, quien: "ana", texto: "¿Qué querés? ¿Morirte vos también?" }], nombre: "La chata", dur: 22, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100", fin: 0.6, fout: 0.8,
    textos: [{ desde: 16.5, hasta: 21.0, clase: "abajo", html: "«¿Qué querés, morirte vos también?»" }],
    sonido: (S) => { S.viento(0, 22, 0.4, 0.6); S.lluvia(0, 22, 0.12, 0.12); S.corriente(0, 22, 0.5); S.remada(0, 9, 1.9, 0.5, 0.3); S.golpe(9.4); S.perro(12.5, 3, 0.4); S.respiracion(2, 20); } },
  { id: "07-luz", dialogos: [{ desde: 1.5, quien: "vero", texto: "Afuera era la noche de la sudestada: negra, sin orillas, con el ruido." }, { desde: 10.0, quien: "vero", texto: "Y por ese corredor, arroyo abajo, donde tenía que estar el galpón de Elías, vi una luz." }], nombre: "La luz en el galpón", dur: 18, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 80\n#define ALCANCE 400.0", fin: 1.0, fout: 1.0,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Sábado, a la noche</span>' }, { desde: 12.0, hasta: 17.0, clase: "abajo", html: "«Una luz de farol, quieta, que no era un reflejo.»" }],
    sonido: (S) => { S.viento(0, 18, 0.5, 0.95, 1200); S.lluvia(0, 18, 0.3, 0.3, 1800); S.madera(0, 18); } },
  { id: "08-farol", dialogos: [{ desde: 0.8, quien: "veroDice", texto: "¡Ana!" }, { desde: 6.0, quien: "ana", texto: "¡Acá! ¡Agarrate del poste!" }, { desde: 12.0, quien: "vero", texto: "El que lo traía era alto. Venía con el agua al pecho, con el farol en alto." }, { desde: 19.5, quien: "vero", texto: "La gorra. La barba de cuatro días. Los ojos de mi madre." }, { desde: 23.5, quien: "veroDice", texto: "Salí del agua, Martín." }], nombre: "Salí del agua", dur: 28, defines: "#define NLUCES 2\n#define NSOMBRAS 1\n#define PASOS 110", fin: 1.0, fout: 1.5, rayos: [[2.4, 0.3], [4.55, -0.2], [6.3, -0.5]],
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, 4.20</span>' }, { desde: 23.0, hasta: 27.5, clase: "abajo", html: "«Salí del agua, Martín.»" }],
    sonido: (S) => { S.viento(0, 28, 0.6, 1.0); S.lluvia(0, 28, 0.15, 0.1); S.corriente(0, 28, 0.5); S.trueno(2.9); S.remada(0, 4.2, 1.9, 0.5, 0.4); S.vuelco(4.2); S.trueno(5.0); S.trueno(6.9); S.chapa(8.5); S.perro(9.5, 5, 0.6); S.perro(12.0, 3, 0.5); S.chapoteo(10, 20); S.motivo(19.0, 0.9); } },
  { id: "09-barro", dialogos: [{ desde: 1.5, quien: "vero", texto: "El domingo a la tarde el agua bajó. La casa estaba llena de barro, y mi hermano, vivo, baldeando la galería." }, { desde: 8.5, quien: "vero", texto: "Yo vivo de decir si una firma es de quien dice ser. De mi hermano creía saberlo todo." }], nombre: "Barro", dur: 23, defines: "#define NLUCES 1\n#define NSOMBRAS 0\n#define PASOS 100\n#define MARCA 2.1", fin: 1.5, fout: 2.0,
    textos: [{ desde: 1.0, hasta: 4.0, clase: "arriba-izq", html: '<span class="cartel">Domingo, a la tarde</span>' }, { desde: 13.0, hasta: 19.0, clase: "", html: '<span class="titulo">SUDESTADA</span>' }, { desde: 19.6, hasta: 22.6, clase: "", html: '<span class="chico">a partir de la novela · Programador nocturno · 2026</span>' }],
    sonido: (S) => { S.viento(0, 23, 0.12, 0.1); S.oleaje(0, 23, 0.05); S.pajaro(2.0, 1); S.pajaro(5.5, 3); S.pajaro(9.0, 2); S.acorde(12.0, 11.0); S.pajaro(16.0, 1); } },
];
let acum = 0; for (const e of ESCENAS) { e.inicio = acum; acum += e.dur; }
const DUR = acum;

const canvas = document.getElementById("c"), capa = document.getElementById("capa"), textoDiv = document.getElementById("texto"), textoP = document.getElementById("textoP"), avance = document.getElementById("avance"), aviso = document.getElementById("aviso"), cargando = document.getElementById("cargando");
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
  if (corriendo) hablar(e, t);
  usar(e);
  const r = rayo(e, t);
  gl.uniform2f(e.u.uRes, canvas.width, canvas.height); gl.uniform1f(e.u.uT, t); gl.uniform1f(e.u.uFlash, flash(e, t)); gl.uniform3f(e.u.uRayo, r[0], r[1], r[2]); gl.uniform1f(e.u.uFundido, fundido(e, t));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  /* intertítulos */
  let tx = null; for (const x of e.textos || []) if (t >= x.desde && t < x.hasta) tx = x;
  if (tx) { if (textoP.dataset.html !== tx.html) { textoP.innerHTML = tx.html; textoP.dataset.html = tx.html; } textoDiv.className = "texto visible " + (tx.clase || ""); } else textoDiv.classList.remove("visible");
  avance.style.width = (tg / DUR * 100).toFixed(2) + "%";
  return true;
}

/* ---- voces: los diálogos con las voces del propio navegador (speechSynthesis), la de castellano rioplatense si la hay ---- */
const sintesis = "speechSynthesis" in window ? window.speechSynthesis : null;
const subDiv = document.getElementById("sub");
let vocesEs = [];
function cargarVoces() {
  if (!sintesis) return;
  vocesEs = sintesis.getVoices().filter((v) => /^es([-_]|$)/i.test(v.lang));
  const ar = vocesEs.filter((v) => /AR/i.test(v.lang));
  vocesEs = ar.concat(vocesEs.filter((v) => !/AR/i.test(v.lang)));
  const chk = document.getElementById("voces"); const nota = document.getElementById("vocesNota");
  if (chk) { chk.disabled = vocesEs.length === 0; }
  if (nota) nota.textContent = vocesEs.length ? `(${vocesEs[0].name.replace(/^Microsoft |^Google /, "")})` : "(tu navegador no tiene voz en castellano)";
}
if (sintesis) { cargarVoces(); sintesis.onvoiceschanged = cargarVoces; }
const esMujer = (v) => /elena|sabina|helena|laura|paulina|m[oó]nica|luc[ií]a|dalia|elvira|abril|camila|esperanza|isidora|catalina|sofia|mia|teresa|ximena|yolanda|carlota|female|mujer/i.test(v.name);
function vozPara(quien) {
  if (!vocesEs.length) return null;
  const mujeres = vocesEs.filter(esMujer), hombres = vocesEs.filter((v) => !esMujer(v));
  const hombre = quien === "elias" || quien === "lanchero" || quien === "martin";
  const lista = hombre ? (hombres.length ? hombres : vocesEs) : (mujeres.length ? mujeres : vocesEs);
  /* Ana y Verónica con voces distintas si hay dos */
  return lista[quien === "ana" && lista.length > 1 ? 1 : 0];
}
function decir(d) {
  const chk = document.getElementById("voces");
  if (!sintesis || !vocesEs.length || (chk && !chk.checked)) return;
  const u = new SpeechSynthesisUtterance(d.texto);
  const v = vozPara(d.quien); if (v) { u.voice = v; u.lang = v.lang; }
  const perfil = { vero: [0.92, 0.95], veroDice: [1.0, 1.0], ana: [1.0, 1.12], elias: [0.82, 0.7], lanchero: [0.95, 0.8], martin: [0.9, 0.75] }[d.quien] || [0.95, 1.0];
  u.rate = perfil[0]; u.pitch = perfil[1]; u.volume = 1.0;
  if (subDiv) { subDiv.textContent = d.texto; subDiv.classList.add("visible"); u.onend = () => subDiv.classList.remove("visible"); u.onerror = u.onend; }
  sintesis.speak(u);
}
function callarVoces() { if (sintesis) sintesis.cancel(); if (subDiv) subDiv.classList.remove("visible"); for (const e of ESCENAS) for (const d of e.dialogos || []) d.dicho = false; }
function hablar(e, t) { for (const d of e.dialogos || []) { if (!d.dicho && t >= d.desde && t < d.desde + 2.0) { d.dicho = true; decir(d); } else if (t < d.desde) d.dicho = false; } }

/* ---- reproducción ---- */
let inicio = 0, raf = 0, corriendo = false, ultimo = 0;
function cuadro(now) {
  const tg = (now - inicio) / 1000;
  if (ultimo) adaptar(now - ultimo); ultimo = now;
  ajustar();
  try { dibujar(tg); } catch (e) { console.error(e); aviso.textContent = String(e.message || e); aviso.style.display = "block"; detener(); return; }
  if (tg < DUR) raf = requestAnimationFrame(cuadro); else terminar();
}
function reproducir(desde) {
  if (!gl) return;
  desde = desde || 0;
  capa.classList.add("oculta"); corriendo = true; callarVoces();
  /* con compilación en paralelo, se mandan a compilar todas las escenas de entrada y el driver las prepara de fondo */
  if (paralelo) for (let i = 0; i < ESCENAS.length; i++) compilar(i);
  sonar(desde);
  inicio = performance.now() - desde * 1000; ultimo = 0; tiempos = []; cancelAnimationFrame(raf); raf = requestAnimationFrame(cuadro);
}
function detener() { corriendo = false; cancelAnimationFrame(raf); callar(); callarVoces(); }
function terminar() { detener(); textoDiv.classList.remove("visible"); capa.querySelector("h1").textContent = "Fin"; capa.querySelector("p").textContent = "Sudestada, el corto. ¿Otra vez?"; document.getElementById("play").textContent = "↻ Otra vez"; capa.classList.remove("oculta"); if (grabadora && grabadora.state === "recording") grabadora.stop(); }
function saltar(tg) { if (corriendo) reproducir(tg); else { ajustar(); try { dibujar(tg, true); } catch (e) { console.error(e); } } }

/* ---- sonido ---- */
let actx, maestro, destinoGrab, fuentes = [];
function sonar(desde) {
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); destinoGrab = actx.createMediaStreamDestination(); }
  if (actx.state === "suspended") actx.resume();
  callar();
  maestro = actx.createGain(); maestro.connect(actx.destination); maestro.connect(destinoGrab);
  fuentes = programar(actx, maestro, actx.currentTime + 0.05 - desde, desde);
}
function callar() { for (const f of fuentes) { try { f.stop(); } catch (e) { /* ya parada */ } } fuentes = []; if (maestro) { try { maestro.disconnect(); } catch (e) { /* nada */ } } }
/* programa toda la banda de sonido: T0 es el instante absoluto del segundo 0 del corto; desde, los segundos que se saltan */
function programar(ctx, m, T0, desde) {
  const todas = [];
  for (const e of ESCENAS) {
    if (e.inicio + e.dur <= desde) continue;
    const S = sonidos(ctx, m, T0 + e.inicio, Math.max(0, desde - e.inicio), e.dur);
    e.sonido(S); for (const f of S.fuentes) todas.push(f);
  }
  return todas;
}

/* ---- la barra de tiempo y la lista de escenas ---- */
const barra = document.getElementById("barra"), cortes = document.getElementById("cortes"), listaEsc = document.getElementById("escenas");
for (const e of ESCENAS) { if (e.inicio > 0) { const d = document.createElement("div"); d.className = "corte"; d.style.left = (e.inicio / DUR * 100) + "%"; cortes.appendChild(d); } }
barra.addEventListener("pointerdown", (ev) => { const r = barra.getBoundingClientRect(); saltar((ev.clientX - r.left) / r.width * DUR); });
ESCENAS.forEach((e, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "sec" + (fuente("glsl-" + e.id) ? "" : " falta"); b.textContent = `${i}. ${e.nombre}`; b.title = fuente("glsl-" + e.id) ? `${e.dur} s` : "todavía sin escena propia"; b.addEventListener("click", () => saltar(e.inicio)); listaEsc.appendChild(b); e.boton = b; });
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
document.getElementById("voces").addEventListener("change", (ev) => { if (!ev.target.checked) callarVoces(); });
document.getElementById("calidad").addEventListener("change", () => { ajustar(); if (!corriendo) dibujar(Math.max(0.001, (performance.now() - inicio) / 1000 * (inicio ? 1 : 0)), true); });
addEventListener("resize", () => { ajustar(); if (!corriendo) dibujar(actual >= 0 ? Math.max(0.001, (performance.now() - inicio) / 1000) : 0.001, true); });
/* el sonido entero renderizado a WAV sin parlantes (para el .mp4) */
window.__wav = async (desde, hasta) => {
  desde = desde || 0; hasta = hasta || DUR;
  const sr = 44100, off = new OfflineAudioContext(1, Math.ceil(sr * (hasta - desde)), sr); const m = off.createGain(); m.connect(off.destination); programar(off, m, -desde, desde);
  const b = await off.startRendering(); const d = b.getChannelData(0); const out = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + d.length * 2, true); str(8, "WAVE"); str(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, "data"); out.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let bin = ""; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(bin);
};
