/* Escena 6: viernes a la tarde, el taller de Martín. Un galpón de chapa con el bote dado vuelta sobre caballetes, la radio apagada,
   las herramientas colgadas y la luz gris de la ventana con lluvia. Verónica sola abre el cajón de las herramientas finas: la
   lata con los dólares, el recibo, el boleto. En primer plano, el papel con las tres firmas: la suya, la V con la cola larga, se
   dibuja sola. Lo guarda en el forro de la campera. Un trueno. */
Clima clima(float t) { return Clima(0.42, 0.0, 0.95, 0.0, 0.0, 0.3, vec2(0.0)); }
vec3 sunDir(float t) { return normalize(vec3(1.0, 0.4, 0.2)); }
float nivelAgua(float t) { return -50.0; }
Luz luz(int i, float t) { return Luz(vec3(2.55, 1.55, 0.3), vec3(0.72, 0.78, 0.9), 3.2 * (1.0 + 0.6 * uFlash)); } /* la luz gris que entra por la ventana */
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }

/* ---- el recorrido ---- */
/* 1-6,5 camina de la puerta al mesón; 6,5-7,5 queda de frente al mesón (+x); 8-9,5 abre el cajón; 12,5-14 saca la lata; 15-16,5 el
   boleto al mesón; 17-30 lo mira (y la firma se vuelve a dibujar); 30-32,5 lo guarda en el forro; después se queda quieta */
const vec3 MESON = vec3(2.68, 0.9, 0.3);       /* centro de la tapa del mesón */
float cajonAbierto(float t) { return 0.32 * smoothstep(8.0, 9.5, t); }
vec3 posVero(float t) { return mix(vec3(0.2, 0.0, -1.5), vec3(2.03, 0.0, 0.3), smoothstep(1.0, 6.5, t)); }
float dirVero(float t) { return mix(3.92, PI, smoothstep(6.3, 7.5, t)); }
const vec3 PAPEL_MESON = vec3(2.45, 0.934, 0.3); /* la tapa llega a 0,93 */ /* el boleto, sobre el mesón, del lado de ella */
vec3 posLata(float t) { return mix(vec3(2.72, 0.76, 0.2), vec3(2.78, 0.992, 0.78), smoothstep(12.5, 14.0, t)); }
vec3 posBoleto(float t) {
  vec3 p = mix(vec3(2.62, 0.78, 0.4), PAPEL_MESON, smoothstep(15.0, 16.5, t));
  return mix(p, vec3(2.0, 1.3, 0.22), smoothstep(30.0, 32.3, t)); /* al forro de la campera */
}
float boletoVisible(float t) { return 1.0 - smoothstep(32.2, 32.5, t); }
/* la tinta del boleto: renglones impresos y tres firmas; la de Verónica (hecha por Martín, de corrido) se vuelve a dibujar de 18 a 24 */
float avanceFirma(float t) { return t < 18.0 ? 1.0 : clamp((t - 18.0) / 5.8, 0.0, 1.0); }
float papel(vec3 p, float t) {
  vec3 c = posBoleto(t);
  /* cm sobre el papel, visto desde el lado de ella: x hacia +z del mundo, y hacia +x (hacia la pared) */
  vec2 f = vec2((p.z - c.z) * 100.0 + 10.5, (c.x - p.x) * 100.0 + 14.8); /* de frente a +x, su derecha es +z (se lee hacia +z); hacia ella es -x */
  float ink = impreso(f, 2.5, 20.0) * 0.8;
  ink += tinta((f - vec2(1.2, 22.8)) / 1.25, avanceFirma(t), 0.0, 1.0);
  ink += tinta((f - vec2(9.5, 23.1)) / 1.1, 1.0, 0.0, 1.0);
  ink += smoothstep(0.05, 0.022, abs((f.y - 23.8) - 0.3 * sin((f.x - 15.0) * 4.0)) + 10.0 * (1.0 - step(15.0, f.x) * step(f.x, 18.0)));
  return clamp(ink, 0.0, 1.0);
}

vec2 mapaMundo(vec3 p, float t) {
  vec2 r = vec2(1e3, 0.0);
  /* el galpón: caja hueca de 6 × 2,8 × 4,5, puerta en -z, ventana en +x sobre el mesón */
  float caja = max(sdBox3(p - vec3(0.0, 1.4, 0.0), vec3(3.1, 1.5, 2.35)), -sdBox3(p - vec3(0.0, 1.4, 0.0), vec3(3.0, 1.4, 2.25)));
  float puerta = sdBox3(p - vec3(-1.5, 1.0, -2.3), vec3(0.45, 1.0, 0.3));
  float ventana = sdBox3(p - vec3(3.0, 1.5, 0.3), vec3(0.3, 0.4, 0.5));
  caja = max(caja, -min(puerta, ventana));
  r = vec2(caja, 32.0);
  float piso = sdBox3(p - vec3(0.0, -0.05, 0.0), vec3(3.1, 0.06, 2.35));
  if (piso < r.x) r = vec2(piso, 14.0);
  float marco = max(sdBox3(p - vec3(3.0, 1.5, 0.3), vec3(0.06, 0.45, 0.55)), -sdBox3(p - vec3(3.0, 1.5, 0.3), vec3(0.2, 0.38, 0.48)));
  marco = min(marco, sdBox3(p - vec3(3.0, 1.5, 0.3), vec3(0.03, 0.4, 0.02)));
  if (marco < r.x) r = vec2(marco, 13.0);
  float vidrio = sdBox3(p - vec3(3.03, 1.5, 0.3), vec3(0.005, 0.38, 0.48));
  if (vidrio < r.x) r = vec2(vidrio, 38.0);
  /* la puerta abierta hacia afuera, y afuera la lluvia gris */
  float hoja = sdBox3(rotY(p - vec3(-1.95, 1.0, -2.3), 1.2), vec3(0.45, 0.98, 0.02));
  if (hoja < r.x) r = vec2(hoja, 13.0);
  /* el bote dado vuelta sobre dos caballetes */
  vec3 qb = p - vec3(-0.8, 0.98, 0.3); qb.y = -qb.y; qb.xz = rot(0.06) * qb.xz;
  float db = length(qb - vec3(0.0, -0.2, 0.0)) - 1.9;
  if (db < 0.2) r = u2(r, chata(qb)); else if (db < r.x) r = vec2(db, 0.0);
  float cab = 1e3;
  for (int i = 0; i < 2; i++) {
    vec3 c = p - vec3(-1.65 + 1.7 * float(i), 0.0, 0.3);
    cab = min(cab, sdBox3(c - vec3(0.0, 0.62, 0.0), vec3(0.03, 0.04, 0.55)));
    cab = min(cab, sdCap(c, vec3(0.0, 0.6, 0.5), vec3(-0.22, 0.0, 0.6), 0.025)); cab = min(cab, sdCap(c, vec3(0.0, 0.6, 0.5), vec3(0.22, 0.0, 0.6), 0.025));
    cab = min(cab, sdCap(c, vec3(0.0, 0.6, -0.5), vec3(-0.22, 0.0, -0.6), 0.025)); cab = min(cab, sdCap(c, vec3(0.0, 0.6, -0.5), vec3(0.22, 0.0, -0.6), 0.025));
  }
  if (cab < r.x) r = vec2(cab, 13.0);
  /* el mesón contra la pared de la ventana, con el cajón de las herramientas finas que se abre hacia la pieza */
  float tapa = sdBox3(p - MESON, vec3(0.3, 0.025, 0.8)) - 0.005;
  float patas = min(sdBox3(p - vec3(2.9, 0.43, -0.45), vec3(0.03, 0.43, 0.03)), sdBox3(p - vec3(2.9, 0.43, 1.05), vec3(0.03, 0.43, 0.03)));
  patas = min(patas, min(sdBox3(p - vec3(2.42, 0.43, -0.45), vec3(0.03, 0.43, 0.03)), sdBox3(p - vec3(2.42, 0.43, 1.05), vec3(0.03, 0.43, 0.03))));
  patas = min(patas, sdBox3(p - vec3(2.68, 0.2, 0.3), vec3(0.28, 0.015, 0.75))); /* el estante de abajo */
  float meson = min(tapa, patas);
  if (meson < r.x) r = vec2(meson, 7.0);
  float ab = cajonAbierto(t);
  vec3 qc = p - vec3(2.66 - ab, 0.79, 0.3);
  float cajon = max(sdBox3(qc, vec3(0.22, 0.06, 0.22)), -sdBox3(qc - vec3(0.0, 0.02, 0.0), vec3(0.2, 0.06, 0.2)));
  float tirador = sdCap(qc, vec3(-0.225, 0.0, -0.03), vec3(-0.225, 0.0, 0.03), 0.012);
  if (cajon < r.x) r = vec2(cajon, 29.0);
  if (tirador < r.x) r = vec2(tirador, 34.0);
  /* la lata, el recibo y el boleto */
  vec3 ql = p - posLata(t);
  float lata = sdCil(ql, 0.06, 0.07);
  if (lata < r.x) r = vec2(lata, 23.0);
  float recibo = sdBox3(p - vec3(2.75, 0.934, -0.1), vec3(0.06, 0.002, 0.09));
  if (recibo < r.x) r = vec2(recibo, 35.0);
  if (boletoVisible(t) > 0.5) {
    vec3 qp = p - posBoleto(t); float dobla = smoothstep(30.0, 31.5, t);
    qp.xy = rot(-1.3 * dobla) * qp.xy;
    float boleto = sdBox3(qp, vec3(0.148 * (1.0 - 0.5 * dobla), 0.0015 + 0.003 * dobla, 0.105 * (1.0 - 0.5 * dobla))); /* a lo alto hacia la pared */
    if (boleto < r.x) r = vec2(boleto, 44.0);
  }
  /* la radio en un estante de la pared del fondo, apagada; herramientas colgadas sobre la ventana y al lado */
  float estante = sdBox3(p - vec3(1.4, 1.75, 2.18), vec3(0.45, 0.015, 0.14));
  float radio = sdBox3(p - vec3(1.4, 1.86, 2.16), vec3(0.17, 0.09, 0.08)) - 0.01;
  radio = min(radio, sdCap(p, vec3(1.52, 1.95, 2.16), vec3(1.75, 2.35, 2.05), 0.006));
  if (estante < r.x) r = vec2(estante, 13.0);
  if (radio < r.x) r = vec2(radio, 34.0);
  float herr = 1e3;
  for (int i = 0; i < 5; i++) {
    float z = -1.3 + 0.28 * float(i); float largo = 0.18 + 0.1 * hash1(float(i) * 3.3);
    herr = min(herr, sdCap(p, vec3(2.96, 2.0, z), vec3(2.96, 2.0 - largo, z), 0.012));                       /* mangos colgados */
    herr = min(herr, sdBox3(p - vec3(2.96, 2.0 - largo - 0.05, z), vec3(0.01, 0.05, 0.03 + 0.03 * hash1(float(i) * 7.1)))); /* la cabeza */
  }
  herr = min(herr, sdBox3(p - vec3(2.96, 1.75, 1.6), vec3(0.008, 0.06, 0.3))); /* el serrucho */
  herr = min(herr, sdBox3(p - vec3(2.96, 2.1, -1.0), vec3(0.015, 0.03, 0.25)));
  if (herr < r.x) r = vec2(herr, 34.0);
  /* bidón, soga enrollada y baldes por el piso */
  float bidon = sdBox3(p - vec3(2.6, 0.2, -1.8), vec3(0.15, 0.2, 0.12)) - 0.02;
  float soga = sdToro(p - vec3(1.0, 0.04, -1.9), 0.17, 0.045);
  float balde = max(sdCil(p - vec3(-2.5, 0.15, 1.6), 0.15, 0.15), -sdCil(p - vec3(-2.5, 0.2, 1.6), 0.15, 0.13));
  if (bidon < r.x) r = vec2(bidon, 21.0);
  if (soga < r.x) r = vec2(soga, 5.0);
  if (balde < r.x) r = vec2(balde, 28.0);
  /* Verónica */
  vec3 pv = posVero(t);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    float a = dirVero(t);
    vec3 q = rotY(p - pv, a);
    float camina = smoothstep(1.0, 1.4, t) * (1.0 - smoothstep(6.0, 6.5, t));
    Pose P = poseDePie(t * 2.0 * PI / 0.75, camina);
    /* las manos: en el tirador, en la lata, en el boleto, en el forro de la campera */
    float tira = smoothstep(7.4, 8.0, t) * (1.0 - smoothstep(9.6, 10.4, t));
    vec3 tirador = rotY(vec3(2.66 - cajonAbierto(t) - 0.225, 0.79, 0.3) - pv, a) + vec3(0.0, 0.0, 0.0);
    float lataM = smoothstep(12.0, 12.5, t) * (1.0 - smoothstep(14.0, 14.6, t));
    vec3 lata = rotY(posLata(t) - pv, a) + vec3(0.0, 0.07, 0.0);
    float bol = smoothstep(14.6, 15.0, t) * (1.0 - smoothstep(16.5, 17.2, t)) + smoothstep(29.5, 30.0, t) * (1.0 - smoothstep(32.3, 33.0, t));
    vec3 boleto = rotY(posBoleto(t) - pv, a) + vec3(0.0, 0.03, 0.0);
    float mira = smoothstep(17.0, 17.6, t) * (1.0 - smoothstep(29.5, 30.0, t)); /* las dos manos en los bordes del papel */
    vec3 bordeI = rotY(PAPEL_MESON + vec3(-0.13, 0.0, 0.2) - pv, a), bordeD = rotY(PAPEL_MESON + vec3(-0.13, 0.0, -0.2) - pv, a); /* de frente a +x, su derecha queda en -z; las manos por fuera del papel para no taparlo */
    float en = max(max(tira, lataM), max(bol, mira));
    vec3 manoD = P.manoD, manoI = P.manoI;
    manoD = mix(manoD, tirador, tira); manoD = mix(manoD, lata, lataM); manoD = mix(manoD, boleto, bol); manoD = mix(manoD, bordeD, mira);
    manoI = mix(manoI, bordeI, mira); manoI = mix(manoI, P.homI + vec3(-0.08, -0.45, -0.05), max(tira, max(lataM, bol))); /* la izquierda apoyada en el mesón */
    manoI = mix(manoI, rotY(MESON + vec3(-0.25, 0.04, -0.05) - pv, a), max(tira, max(lataM, bol)));
    P.manoD = manoD; P.manoI = manoI;
    P.agarreD = mix(P.agarreD, vec3(0.0, -1.0, 0.0), en); P.agarreI = mix(P.agarreI, vec3(0.0, -1.0, 0.0), en);
    P.codoD = mix(P.codoD, P.homD + vec3(-0.1, -0.25, 0.14), en); P.codoI = mix(P.codoI, P.homI + vec3(-0.1, -0.25, -0.14), en);
    /* se inclina sobre el cajón y sobre el papel; al final se queda quieta mirando el bote */
    float inclina = 0.1 * max(tira, lataM) + 0.14 * mira + 0.05 * bol;
    P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina * 1.15; P.homI.x -= inclina; P.homD.x -= inclina;
    float alBote = smoothstep(33.5, 35.0, t);
    P.pitch = -0.35 * max(tira, lataM) - 0.5 * mira - 0.25 * bol + 0.0 * alBote; P.yaw = 0.9 * alBote + 0.05 * sin(t * 0.4) * (1.0 - alBote);
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0012 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.3;
  if (t < 7.5) { float a = smoothstep(0.0, 7.5, t); ro = mix(vec3(-2.75, 1.7, -2.05), vec3(-2.6, 1.65, -1.95), a); obj = vec3(0.7, 1.0, 0.3); zoom = 1.1; }        /* desde la puerta: el galpón entero, el bote, ella que va al mesón */
  else if (t < 12.0) { float a = smoothstep(7.5, 12.0, t); ro = mix(vec3(1.25, 1.55, 1.95), vec3(1.3, 1.5, 1.85), a); obj = vec3(2.35, 1.05, 0.3); zoom = 1.5; }      /* de costado: el cajón que se abre */
  else if (t < 17.0) { float a = smoothstep(12.0, 17.0, t); ro = mix(vec3(2.75, 1.55, 1.6), vec3(2.72, 1.52, 1.5), a); obj = vec3(2.5, 0.95, 0.35); zoom = 1.6; }    /* desde la punta del mesón: las manos, la lata, el recibo, el boleto */
  else if (t < 30.0) { float a = smoothstep(17.0, 30.0, t); ro = mix(vec3(2.36, 1.46, 0.32), vec3(2.37, 1.44, 0.31), a); obj = vec3(2.395, 0.934, 0.3); zoom = 2.4; }  /* desde sus ojos: el boleto derecho, las firmas al pie, en el medio del cuadro */   /* el boleto, de cerca, desde el lado de la pared: las tres firmas y sus manos en los bordes */
  else if (t < 34.0) { float a = smoothstep(30.0, 34.0, t); ro = mix(vec3(2.7, 1.65, 1.75), vec3(2.65, 1.62, 1.7), a); obj = vec3(2.05, 1.3, 0.3); zoom = 1.7; }      /* lo guarda en el forro, de tres cuartos */
  else { float a = smoothstep(34.0, 40.0, t); ro = mix(vec3(-2.6, 1.45, 1.75), vec3(-2.5, 1.45, 1.7), a); obj = vec3(1.4, 1.1, 0.25); zoom = 1.2; }                    /* desde atrás del bote: ella quieta, chica, en el galpón */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
