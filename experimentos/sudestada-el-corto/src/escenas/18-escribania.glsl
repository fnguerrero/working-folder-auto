/* Escena 18: Martes, once. La escribanía Pereyra, en Tigre: el escritorio oscuro con vidrio, el ventilador, el cuadro del velero,
   la ventana con un árbol y sol; Pereyra, Acuña, Martín afeitado con camisa blanca y Verónica en el medio. La lupa sobre la
   fotocopia, la firma de Verónica que se dibuja con la pausa, Martín que le mira la mano, la firma de él al lado. Y afuera, la
   vereda con sol: «¿Las necesitás?». */
float afuera(float t) { return step(55.0, t); }
Clima clima(float t) { if (afuera(t) > 0.5) return Clima(1.0, 0.55, 0.25, 0.0, 0.004, 0.15, vec2(0.0)); return Clima(0.9, 0.4, 0.3, 0.0, 0.0, 0.0, vec2(0.0)); }
vec3 sunDir(float t) { return afuera(t) > 0.5 ? normalize(vec3(-0.4, 0.8, -0.45)) : normalize(vec3(1.0, 0.7, -0.35)); }
float nivelAgua(float t) { return -50.0; }
Luz luz(int i, float t) { if (afuera(t) > 0.5) return Luz(vec3(0.0), vec3(0.0), 0.0); return Luz(vec3(0.0, 2.55, 0.1), vec3(1.0, 0.9, 0.75), 1.6); } /* la lámpara del techo */
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }

/* ---- la firma: «Verónica Beatriz Aldao», en cm sobre el papel. s de 0 a 1 recorre la V, la cola que baja por debajo del renglón
   y vuelve, «erónica», un salto en el aire y «Aldao». arrastre > 0,5 es la mano de Martín: el remate se arrastra hacia abajo. ---- */
vec2 tramo(float k, vec2 a, vec2 b, vec2 c, vec2 d, vec2 e, vec2 f) {
  float u = k * 5.0; int i = int(floor(u)); float g = fract(u);
  if (i == 0) return mix(a, b, g); if (i == 1) return mix(b, c, g); if (i == 2) return mix(c, d, g); if (i == 3) return mix(d, e, g); return mix(e, f, min(g + float(i - 4), 1.0));
}
vec2 firmaPunto(float s, float arrastre) {
  if (s < 0.1) { float k = s / 0.1; return vec2(0.55 * k, 1.15 - 1.3 * k + 0.08 * sin(k * PI)); }                       /* la V, bajada */
  if (s < 0.2) { float k = (s - 0.1) / 0.1; return vec2(0.55 + 0.5 * k, -0.15 + 1.35 * k - 0.08 * sin(k * PI)); }       /* la V, subida */
  if (s < 0.38) { float k = (s - 0.2) / 0.18; return tramo(k, vec2(1.05, 1.2), vec2(1.12, 0.35), vec2(0.95, -0.65), vec2(0.6, -0.6), vec2(0.78, -0.05), vec2(1.3, 0.22)); } /* la cola larga */
  if (s < 0.72) { float k = (s - 0.38) / 0.34; float r = 0.13 + 0.12 * step(abs(k - 0.3), 0.07); return vec2(1.3 + 1.9 * k + r * sin(k * 2.0 * PI * 7.0), 0.2 + r * (1.0 - cos(k * 2.0 * PI * 7.0)) * 0.9); } /* erónica */
  if (s < 0.78) { float k = (s - 0.72) / 0.06; return mix(vec2(3.2, 0.22), vec2(3.55, 0.3), k); }                      /* la pluma en el aire */
  if (s < 0.95) { float k = (s - 0.78) / 0.17; float r = 0.13 + 0.3 * exp(-k * k / 0.012); return vec2(3.55 + 1.5 * k + r * sin(k * 2.0 * PI * 5.0), 0.2 + r * (1.0 - cos(k * 2.0 * PI * 5.0)) * 0.9); } /* Aldao */
  float k = (s - 0.95) / 0.05; return vec2(5.05 + (0.25 + 0.55 * arrastre) * k, 0.25 - (0.05 + 0.4 * arrastre) * k);   /* el remate: corto, o arrastrado por el zurdo */
}
float tinta(vec2 uv, float avance, float pausa, float arrastre) {
  if (uv.x < -0.3 || uv.x > 6.2 || uv.y < -1.0 || uv.y > 1.6) return 0.0;
  float d = 1e3; vec2 prev = firmaPunto(0.0, arrastre);
  for (int i = 1; i <= 64; i++) {
    float s = float(i) / 64.0; if (s > avance) break;
    vec2 q = firmaPunto(s, arrastre);
    bool salto = (s > 0.72 && s <= 0.785) || (pausa > 0.5 && s > 0.38 && s <= 0.4);
    if (!salto) { vec2 pa = uv - prev, ba = q - prev; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); d = min(d, length(pa - ba * h)); }
    prev = q;
  }
  return smoothstep(0.05, 0.022, d);
}
/* cuánto de su firma lleva hecho Verónica (44 a 48 s, con la pausa de los nueve años antes de «erónica») y Martín (50,5 a 53, de corrido) */
float avanceVero(float t) { float a = clamp((t - 44.0) / 1.7, 0.0, 1.0) * 0.38; a += clamp((t - 46.0) / 2.0, 0.0, 1.0) * 0.62; return a; }
float avanceMartin(float t) { return clamp((t - 50.5) / 2.6, 0.0, 1.0); }
/* renglones de texto impreso: líneas grises con cortes, para que parezca una escritura */
float impreso(vec2 uv, float desde, float hasta) {
  float fila = fract(uv.y * 2.0); float linea = smoothstep(0.0, 0.08, fila) * smoothstep(0.35, 0.27, fila);
  float palabra = step(0.25, noise(vec2(uv.x * 4.0, floor(uv.y * 2.0) * 3.0)));
  return linea * palabra * step(desde, uv.y) * step(uv.y, hasta) * step(1.8, uv.x) * step(uv.x, 19.4) * 0.55;
}
const vec3 FOTOCOPIA = vec3(0.3, 0.786, -0.2); /* el centro de cada papel sobre el escritorio, del lado de Verónica */
vec3 escrituraEn(float t) { return vec3(mix(-0.17, 0.55, smoothstep(49.0, 49.9, t)), 0.787, -0.2); } /* Pereyra la corre hacia Martín */
#define ESCRITURA escrituraEn(t)
float papel(vec3 p, float t) {
  /* cm desde la esquina de atrás a la izquierda tal como se ve desde la silla de Verónica: x hacia la derecha de la pantalla (el mundo -x,
     porque la cámara mira a +z) e y hacia la cámara (-z) */
  vec2 e = (ESCRITURA.xz - p.xz) * 100.0 + vec2(10.5, 14.8);
  vec2 f = (FOTOCOPIA.xz - p.xz) * 100.0 + vec2(10.5, 14.8);
  float ink = 0.0;
  if (abs(p.x - ESCRITURA.x) < 0.11) {
    ink += impreso(e, 2.5, 12.5);
    /* al pie: la firma de Verónica, y la de Martín al lado, mientras las hacen */
    ink += tinta((e - vec2(1.2, 21.0)) / 1.3, avanceVero(t), 1.0, 0.0);
    ink += tinta((e - vec2(10.5, 21.3)) / 1.2, avanceMartin(t), 0.0, 1.0);
  } else if (abs(p.x - FOTOCOPIA.x) < 0.11) {
    ink += impreso(f, 2.5, 21.0) * 0.8;
    /* las tres firmas del boleto: «Verónica» hecha por Martín (de corrido, con el arrastre), la de él, la de Acuña */
    ink += tinta((f - vec2(1.2, 23.3)) / 1.25, 1.0, 0.0, 1.0);
    ink += tinta((f - vec2(9.5, 23.6)) / 1.1, 1.0, 0.0, 1.0);
    ink += tinta((f - vec2(15.0, 23.6)) / 0.7, 1.0, 0.0, 0.0) * step(0.78, 0.5) + smoothstep(0.05, 0.022, abs((f.y - 24.3) - 0.3 * sin((f.x - 15.0) * 4.0)) * step(15.0, f.x) * step(f.x, 18.0) + 10.0 * (1.0 - step(15.0, f.x) * step(f.x, 18.0)));
  }
  return clamp(ink, 0.0, 1.0);
}

/* ---- las personas ---- */
Pose poseSilla() {
  /* sentada en una silla (asiento a 0,45), mirando a -x, las manos sobre la mesa o la falda */
  Pose P;
  P.cad = vec3(0.1, 0.52, 0.0); P.pecho = vec3(0.07, 0.78, 0.0); P.hom = vec3(0.05, 0.97, 0.0); P.cab = vec3(0.03, 1.22, 0.0);
  P.homI = P.hom + vec3(0.0, -0.03, -0.18); P.homD = P.hom + vec3(0.0, -0.03, 0.18);
  P.codoI = vec3(0.06, 0.72, -0.24); P.codoD = vec3(0.06, 0.72, 0.24);
  P.manoI = vec3(-0.3, 0.8, -0.12); P.manoD = vec3(-0.3, 0.8, 0.12);
  P.agarreI = vec3(0.0, -1.0, 0.0); P.agarreD = vec3(0.0, -1.0, 0.0);
  P.rodI = vec3(-0.36, 0.5, -0.11); P.rodD = vec3(-0.36, 0.5, 0.11);
  P.pieI = vec3(-0.42, 0.05, -0.12); P.pieD = vec3(-0.42, 0.05, 0.12);
  P.yaw = 0.0; P.pitch = 0.0;
  return P;
}
Aspecto aspMartinCamisa() { return Aspecto(0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 42.0, 1.0); }
Aspecto aspVeroSaco() { return Aspecto(1.0, 0.0, 2.0, 0.0, 0.0, 0.2, 49.0, 0.94); }
Aspecto aspPereyra() { return Aspecto(0.0, 0.0, 1.0, 0.0, 0.0, 0.7, 50.0, 1.0); }
Aspecto aspAcuna() { return Aspecto(0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 43.0, 1.0); }
/* posiciones (pie) y giro del marco local de cada uno (para mirar al ángulo φ del mundo, el marco gira φ + π) */
const vec3 PV = vec3(0.05, 0.0, -0.64), PM = vec3(0.85, 0.0, -0.64), PP = vec3(0.0, 0.0, 0.95), PA = vec3(-1.35, 0.0, 0.55); /* las sillas pegadas al escritorio, para llegar al papel */
const float RV = -PI * 0.5, RM = -PI * 0.5 + 0.25, RP = PI * 0.5, RA = PI - 0.45;
/* la punta de la lapicera en el mundo, siguiendo la firma que se dibuja */
vec3 puntaVero(float t) { vec2 u = firmaPunto(min(avanceVero(t), 0.999), 0.0) * 1.3; vec2 e = u + vec2(1.2, 21.0); return vec3(ESCRITURA.x - (e.x - 10.5) * 0.01, 0.79, ESCRITURA.z - (e.y - 14.8) * 0.01); }
vec3 puntaMartin(float t) { vec2 u = firmaPunto(min(avanceMartin(t), 0.999), 1.0) * 1.2; vec2 e = u + vec2(10.5, 21.3); return vec3(ESCRITURA.x - (e.x - 10.5) * 0.01, 0.79, ESCRITURA.z - (e.y - 14.8) * 0.01); }
float silla(vec3 q) {
  /* silla de madera: asiento, respaldo y cuatro patas; q relativo al centro del asiento a nivel del piso, respaldo hacia +x */
  float d = sdBox3(q - vec3(0.0, 0.45, 0.0), vec3(0.22, 0.02, 0.22)) - 0.01;
  d = min(d, sdBox3(q - vec3(0.2, 0.72, 0.0), vec3(0.02, 0.25, 0.2)) - 0.005);
  for (int i = 0; i < 4; i++) { vec3 pt = vec3(i < 2 ? -0.18 : 0.18, 0.22, mod(float(i), 2.0) < 0.5 ? -0.18 : 0.18); d = min(d, sdBox3(q - pt, vec3(0.02, 0.22, 0.02))); }
  return d;
}
vec2 escribania(vec3 p, float t) {
  vec2 r = vec2(1e3, 0.0);
  /* la sala: una caja hueca de 5 × 3 × 4,4 con la ventana al este (+x) y la puerta atrás (-z) */
  float sala = max(-sdBox3(p - vec3(0.0, 1.5, 0.0), vec3(2.5, 1.5, 2.2)), sdBox3(p - vec3(0.0, 1.5, 0.0), vec3(2.75, 1.75, 2.45)));
  float ventana = sdBox3(p - vec3(2.5, 1.6, 0.3), vec3(0.3, 0.6, 0.5));
  float puerta = sdBox3(p - vec3(0.4, 1.05, -2.2), vec3(0.45, 1.05, 0.3));
  sala = max(sala, -min(ventana, puerta));
  r = vec2(sala, 46.0);
  float piso = sdBox3(p - vec3(0.0, -0.05, 0.0), vec3(2.6, 0.05, 2.3));
  if (piso < r.x) r = vec2(piso, 47.0);
  /* marco de la ventana y el parante del medio */
  float marco = max(sdBox3(p - vec3(2.5, 1.6, 0.3), vec3(0.06, 0.66, 0.56)), -sdBox3(p - vec3(2.5, 1.6, 0.3), vec3(0.2, 0.58, 0.48)));
  marco = min(marco, sdBox3(p - vec3(2.5, 1.6, 0.3), vec3(0.03, 0.6, 0.02)));
  marco = min(marco, sdBox3(p - vec3(2.45, 0.98, 0.3), vec3(0.12, 0.02, 0.6))); /* el alféizar */
  if (marco < r.x) r = vec2(marco, 13.0);
  /* el escritorio: tapa gruesa con vidrio y dos cajoneras */
  float tapa = sdBox3(p - vec3(0.0, 0.755, 0.1), vec3(0.9, 0.025, 0.48)) - 0.005;
  float cajonera = min(sdBox3(p - vec3(-0.6, 0.37, 0.15), vec3(0.22, 0.37, 0.4)), sdBox3(p - vec3(0.6, 0.37, 0.15), vec3(0.22, 0.37, 0.4)));
  float escr = min(tapa, cajonera);
  if (escr < r.x) r = vec2(escr, 45.0);
  /* los papeles: la escritura (doce fojas) y la fotocopia del boleto, al lado */
  float pap = min(sdBox3(p - ESCRITURA, vec3(0.105, 0.004, 0.148)), sdBox3(p - FOTOCOPIA, vec3(0.105, 0.0015, 0.148)));
  float lapicera = sdCap(p - vec3(0.05, 0.795, -0.05), vec3(-0.07, 0.0, 0.0), vec3(0.07, 0.0, 0.0), 0.006) + 10.0 * smoothstep(43.0, 44.0, t); /* la lapicera de Pereyra, sobre el escritorio hasta que se la da */
  if (lapicera < r.x) r = vec2(lapicera, 52.0);
  if (pap < r.x) r = vec2(pap, 44.0);
  /* la carpeta de Pereyra y la lupa de Verónica (apagada, sobre el escritorio, después de que la deja) */
  float carpeta = sdBox3(p - vec3(0.55, 0.79, 0.2), vec3(0.12, 0.008, 0.16)) - 0.003;
  if (carpeta < r.x) r = vec2(carpeta, 25.0);
  float enMano = smoothstep(15.0, 15.6, t) * (1.0 - smoothstep(19.6, 20.4, t));
  vec3 lupaPos = mix(vec3(0.35, 0.8, -0.32), vec3(0.28, 0.85, -0.13), enMano);
  vec3 ql = p - lupaPos; ql.xy = rot(mix(0.0, 0.0, enMano)) * ql.xy;
  float aro = sdToro(ql, 0.045, 0.006); float mango = sdCap(ql, vec3(0.045, 0.0, 0.0), vec3(0.16, -0.02 * (1.0 - enMano), 0.0), 0.009);
  float lupa = min(aro, mango);
  if (lupa < r.x) r = vec2(lupa, 34.0);
  /* el ventilador de techo */
  vec3 qf = p - vec3(0.0, 2.88, 0.1);
  float vent = sdCil(qf, 0.1, 0.07); qf.xz = rot(t * 5.5) * qf.xz;
  float aspas = min(sdBox3(qf - vec3(0.0, -0.06, 0.0), vec3(0.6, 0.006, 0.06)), sdBox3(qf - vec3(0.0, -0.06, 0.0), vec3(0.06, 0.006, 0.6)));
  vent = min(vent, aspas);
  if (vent < r.x) r = vec2(vent, 34.0);
  /* el cuadro del velero, en la pared del fondo, detrás de Pereyra */
  vec3 qc = p - vec3(-0.95, 1.95, 2.18);
  float cuadro = sdBox3(qc, vec3(0.36, 0.27, 0.02));
  float lienzo = sdBox3(qc - vec3(0.0, 0.0, -0.015), vec3(0.32, 0.23, 0.01));
  if (lienzo < 0.01) gCuadro = vec2(qc.x / 0.64 + 0.5, qc.y / 0.46 + 0.5);
  if (cuadro < r.x) r = vec2(cuadro, 13.0);
  if (lienzo < r.x) r = vec2(lienzo, 48.0);
  /* las sillas */
  float sillas = silla(rotY(p - PP, PI)); /* respaldo hacia +z */
  sillas = min(sillas, silla(rotY(p - PV, 0.0)));
  sillas = min(sillas, silla(rotY(p - PM, 0.0)));
  sillas = min(sillas, silla(rotY(p - PA, PI * 0.5)));
  if (sillas < r.x) r = vec2(sillas, 13.0);
  /* afuera, por la ventana: la vereda y un árbol */
  float ds = length(p - vec3(5.0, 2.0, 1.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(5.0, 0.0, 1.0), t, 7.0, 0.1)); else if (ds < r.x) r = vec2(ds, 0.0);
  float calle = sdBox3(p - vec3(6.0, -0.1, 0.0), vec3(4.0, 0.05, 8.0));
  if (calle < r.x) r = vec2(calle, 23.0);
  /* ---- las personas ---- */
  /* Pereyra, detrás del escritorio: las manos sobre la carpeta; lee cuando habla */
  float dp = length(p - (PP + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (dp < 0.2) {
    vec3 q = rotY(p - PP, RP);
    Pose P = poseSilla(); P.manoI = vec3(-0.38, 0.8, -0.1); P.manoD = vec3(-0.38, 0.8, 0.14);
    P.pitch = -0.25 + 0.25 * smoothstep(7.0, 8.0, t) * (1.0 - smoothstep(11.5, 12.5, t)) + 0.2 * smoothstep(36.5, 37.5, t) * (1.0 - smoothstep(39.0, 40.0, t));
    P.yaw = 0.1 * sin(t * 0.3);
    vec2 v = persona(q, P, aspPereyra());
    vec3 hc = q - P.cab; hc = rotY(hc, -P.yaw); hc.xy = rot(-P.pitch) * hc.xy;
    float ant = min(sdToro(vec3(hc.y - 0.004, hc.x + 0.122, hc.z - 0.042), 0.019, 0.0015), sdToro(vec3(hc.y - 0.004, hc.x + 0.122, hc.z + 0.042), 0.019, 0.0015));
    ant = min(ant, sdCap(hc, vec3(-0.122, 0.004, -0.023), vec3(-0.122, 0.004, 0.023), 0.0012));
    ant = min(ant, min(sdCap(hc, vec3(-0.12, 0.006, -0.061), vec3(-0.01, 0.012, -0.095), 0.0012), sdCap(hc, vec3(-0.12, 0.006, 0.061), vec3(-0.01, 0.012, 0.095), 0.0012)));
    v = u2(v, vec2(ant, 51.0));
    r = u2(r, v);
  } else if (dp < r.x) r = vec2(dp, 0.0);
  /* Acuña, a la izquierda, con las manos cruzadas, que no se mueve */
  float da = length(p - (PA + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (da < 0.2) {
    vec3 q = rotY(p - PA, RA);
    Pose P = poseSilla(); P.manoI = vec3(-0.22, 0.72, -0.02); P.manoD = vec3(-0.24, 0.74, 0.04); P.agarreI = vec3(0.0, 0.0, 1.0); P.agarreD = vec3(0.0, 0.0, -1.0);
    P.yaw = -0.35 + 0.25 * smoothstep(30.0, 31.0, t) * (1.0 - smoothstep(34.5, 35.5, t)); P.pitch = 0.05;
    r = u2(r, persona(q, P, aspAcuna()));
  } else if (da < r.x) r = vec2(da, 0.0);
  /* Verónica, en el medio: la lupa, después las manos en la mesa, después firma */
  float dv = length(p - (PV + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (dv < 0.2) {
    vec3 q = rotY(p - PV, RV);
    Pose P = poseSilla();
    float firma = smoothstep(43.0, 44.0, t) * (1.0 - smoothstep(48.3, 49.5, t));
    vec3 manoD = vec3(-0.3, 0.8, 0.12);
    manoD = mix(manoD, rotY(lupaPos + vec3(0.16, 0.0, 0.0) - PV, RV), enMano); P.agarreD = mix(P.agarreD, vec3(0.0, 0.0, -1.0), enMano); /* la lupa en la mano derecha, por el mango */
    vec3 pluma = rotY(puntaVero(t) - PV, RV) + vec3(0.03, 0.045, 0.02);                   /* la mano sobre la lapicera */
    manoD = mix(manoD, pluma, firma); P.manoD = manoD; P.agarreD = mix(vec3(0.0, -1.0, 0.0), vec3(-0.6, -0.8, 0.0), firma);
    P.codoD = mix(P.codoD, vec3(0.0, 0.78, 0.3), max(firma, enMano));
    P.manoI = vec3(-0.32, 0.8, -0.16);
    P.pitch = -0.1 - 0.35 * max(enMano, firma) - 0.15 * smoothstep(53.0, 54.0, t); P.yaw = 0.05 * sin(t * 0.4) - 0.5 * smoothstep(53.0, 54.0, t);
    float inclina = 0.14 * max(firma, enMano); P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina * 1.1; P.homI.x -= inclina; P.homD.x -= inclina;
    P = resolver(P);
    vec2 v = persona(q, P, aspVeroSaco());
    if (firma > 0.01) { vec3 m = P.manoD * 0.94; float lap = sdCap(q, m + vec3(-0.03, -0.045, -0.02), m + vec3(0.06, 0.09, 0.0), 0.006); v = u2(v, vec2(lap, 52.0)); }
    r = u2(r, v);
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* Martín, del lado de la ventana: las manos, la izquierda arriba de la derecha; mira la mano de ella; firma con la izquierda */
  float dm = length(p - (PM + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (dm < 0.2) {
    vec3 q = rotY(p - PM, RM);
    Pose P = poseSilla();
    float firma = smoothstep(49.5, 50.5, t) * (1.0 - smoothstep(53.2, 54.0, t));
    P.manoD = vec3(-0.28, 0.78, 0.06); P.manoI = vec3(-0.3, 0.83, 0.0); P.agarreI = vec3(0.0, -1.0, 0.0);
    vec3 pluma = rotY(puntaMartin(t) - PM, RM) + vec3(0.03, 0.045, -0.02);
    P.manoI = mix(P.manoI, pluma, firma); P.agarreI = mix(P.agarreI, vec3(-0.6, -0.8, 0.0), firma);
    P.codoI = mix(P.codoI, vec3(0.0, 0.8, -0.3), firma);
    float mira = smoothstep(44.0, 45.0, t) * (1.0 - smoothstep(49.5, 50.5, t));
    P.pitch = -0.35 - 0.1 * mira - 0.2 * firma; P.yaw = -0.45 * mira + 0.2 * smoothstep(5.0, 6.0, t) * (1.0 - smoothstep(14.0, 15.0, t));
    float inclina = 0.16 * firma; P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina * 1.1; P.homI.x -= inclina; P.homD.x -= inclina;
    P = resolver(P);
    vec2 v = persona(q, P, aspMartinCamisa());
    if (firma > 0.01) { vec3 m = P.manoI * 1.0; float lap = sdCap(q, m + vec3(-0.03, -0.045, 0.02), m + vec3(0.06, 0.09, 0.0), 0.006); v = u2(v, vec2(lap, 52.0)); }
    r = u2(r, v);
  } else if (dm < r.x) r = vec2(dm, 0.0);
  return r;
}
/* ---- afuera: la vereda, la casa vieja con la placa de bronce, un árbol, sol ---- */
vec2 vereda(vec3 p, float t) {
  vec2 r = vec2(1e3, 0.0);
  float piso = sdBox3(p - vec3(0.0, -0.05, 0.0), vec3(30.0, 0.05, 1.6)); /* la vereda */
  if (piso < r.x) r = vec2(piso, 47.0);
  float calle = sdBox3(p - vec3(0.0, -0.2, -6.0), vec3(30.0, 0.05, 4.5));
  if (calle < r.x) r = vec2(calle, 23.0);
  float cordon = sdBox3(p - vec3(0.0, -0.08, -1.6), vec3(30.0, 0.08, 0.1));
  if (cordon < r.x) r = vec2(cordon, 23.0);
  /* el frente: pared alta con la puerta y una ventana con reja */
  float frente = sdBox3(p - vec3(0.0, 2.2, 2.0), vec3(12.0, 2.2, 0.4));
  frente = max(frente, -sdBox3(p - vec3(0.8, 1.2, 1.6), vec3(0.6, 1.2, 0.3)));
  frente = max(frente, -sdBox3(p - vec3(-2.2, 1.9, 1.6), vec3(0.6, 0.7, 0.3)));
  if (frente < r.x) r = vec2(frente, 46.0);
  float puerta = sdBox3(p - vec3(0.8, 1.2, 1.95), vec3(0.58, 1.18, 0.03));
  if (puerta < r.x) r = vec2(puerta, 1.0);
  float placa = sdBox3(p - vec3(1.75, 1.55, 1.58), vec3(0.14, 0.09, 0.008));
  if (placa < r.x) r = vec2(placa, 51.0);
  float reja = 1e3; for (int i = 0; i < 7; i++) reja = min(reja, sdCilZ(p - vec3(-2.7 + 0.17 * float(i), 1.9, 1.55), 0.02, 0.012) * 0.0 + sdCil(p - vec3(-2.7 + 0.17 * float(i), 1.9, 1.55), 0.7, 0.012));
  if (reja < r.x) r = vec2(reja, 34.0);
  /* el árbol de la vereda y los de enfrente */
  float ds = length(p - vec3(-3.5, 2.0, 0.8)) - 4.5;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-3.5, 0.0, 0.8), t, 5.0, 0.15)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(4.0, 2.0, -12.0)) - 5.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(4.0, 0.0, -12.0), t, 9.0, 0.15)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  /* Martín parado con las manos en los bolsillos, el mentón levantado; Verónica al lado, mirándolo */
  vec3 pm = vec3(0.3, 0.0, 0.6), pv = vec3(-0.75, 0.0, 0.5);
  float dm = length(p - (pm + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dm < 0.2) {
    vec3 q = rotY(p - pm, PI * 0.5 + 0.3); /* mira a -z, a la calle, un poco hacia ella */
    Pose P = poseDePie(0.0, 0.0);
    P.manoI = vec3(-0.08, 0.86, -0.19); P.manoD = vec3(-0.08, 0.86, 0.19); P.codoI = vec3(0.1, 1.1, -0.26); P.codoD = vec3(0.1, 1.1, 0.26);
    P.pitch = 0.18 - 0.1 * smoothstep(61.0, 62.0, t); P.yaw = 0.35 * smoothstep(57.5, 58.5, t);
    r = u2(r, persona(q, P, aspMartinCamisa()));
  } else if (dm < r.x) r = vec2(dm, 0.0);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, PI * 0.5 - 0.9); /* de frente a él, de costado a la cámara */
    Pose P = poseDePie(0.0, 0.0);
    P.manoI = vec3(-0.05, 0.88, -0.2); P.manoD = vec3(-0.12, 0.95, 0.16); P.codoD = vec3(0.05, 1.1, 0.26);
    P.yaw = 0.1 * sin(t * 0.5); P.pitch = 0.08;
    r = u2(r, persona(q, P, aspVeroSaco()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
vec2 mapaMundo(vec3 p, float t) { return afuera(t) > 0.5 ? vereda(p, t) : escribania(p, t); }
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0012 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.3;
  if (t < 8.0) { float a = smoothstep(0.0, 8.0, t); ro = mix(vec3(0.35, 1.55, -2.05), vec3(0.3, 1.5, -1.75), a); obj = vec3(0.0, 1.0, 0.6); zoom = 1.05; }                 /* desde la puerta: la sala entera */
  else if (t < 16.0) { float a = smoothstep(8.0, 16.0, t); ro = mix(vec3(-0.75, 1.35, -0.4), vec3(-0.7, 1.33, -0.3), a); obj = vec3(0.0, 1.17, 0.95); zoom = 1.8; }        /* Pereyra, por encima del hombro de Verónica */
  else if (t < 20.0) { float a = smoothstep(16.0, 20.0, t); ro = mix(vec3(0.3, 1.22, -0.66), vec3(0.3, 1.14, -0.6), a); obj = vec3(0.3, 0.79, -0.27); zoom = 2.2; }          /* la lupa sobre la fotocopia */
  else if (t < 30.5) { float a = smoothstep(20.0, 30.5, t); ro = mix(vec3(-0.7, 1.3, 0.55), vec3(-0.6, 1.28, 0.45), a); obj = vec3(0.05, 1.15, -0.64); zoom = 1.7; }        /* Verónica, desde el lado de Pereyra */
  else if (t < 36.5) { ro = vec3(0.35, 1.28, -0.35); obj = vec3(-1.35, 1.15, 0.55); zoom = 1.8; }                                                                           /* Acuña */
  else if (t < 44.0) { float a = smoothstep(36.5, 44.0, t); ro = mix(vec3(-2.0, 1.4, -0.95), vec3(-1.9, 1.35, -0.85), a); obj = vec3(0.1, 1.05, 0.2); zoom = 1.35; }       /* los dos, de costado */
  else if (t < 48.7) { float a = smoothstep(44.0, 48.7, t); ro = mix(vec3(0.12, 1.18, 0.18), vec3(0.1, 1.14, 0.12), a); obj = vec3(-0.12, 0.79, -0.27); zoom = 2.2; }   /* desde el lado de Pereyra, la mano y la lapicera de frente */   /* la firma de Verónica, de cerca */
  else if (t < 50.5) { ro = vec3(0.1, 1.2, -0.15); obj = vec3(0.85, 1.2, -0.64); zoom = 2.1; }                                                                                /* Martín que le mira la mano */
  else if (t < 55.0) { float a = smoothstep(50.5, 55.0, t); ro = mix(vec3(0.3, 1.18, 0.2), vec3(0.3, 1.28, -0.66), smoothstep(0.55, 1.0, a)); obj = mix(vec3(0.5, 0.79, -0.27), vec3(0.55, 0.79, -0.24), a); zoom = mix(2.2, 2.1, a); } /* la firma de Martín, y las dos juntas */
  else { float a = smoothstep(55.0, 70.0, t); ro = mix(vec3(-1.2, 1.5, -3.2), vec3(-0.9, 1.45, -2.6), a); obj = vec3(-0.1, 1.25, 0.55); zoom = 1.4; }                     /* la vereda, con sol */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
