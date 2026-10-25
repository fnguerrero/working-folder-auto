/* Escena 16: domingo a las 7, adentro del galpón de Elías. La cocina a leña prendida, mantas, el mate, el VHF con la voz de
   Prefectura. Los cuatro alrededor de la mesa: Martín cuenta mirándose las manos; Ana con la manta hasta el cuello; Elías de
   espaldas a la cocina; Verónica enfrente de Martín. «Me salía. La mano la hizo sola…» … «No sé qué querés que haga. Por eso te llamé.» */
Clima clima(float t) { return Clima(0.42, 0.0, 0.95, 0.0, 0.0, 0.2, vec2(0.0)); }
vec3 sunDir(float t) { return normalize(vec3(-1.0, 0.4, 0.3)); }
float nivelAgua(float t) { return -50.0; }
Luz luz(int i, float t) {
  if (i == 0) return Luz(vec3(2.2, 0.75, 1.9), vec3(1.0, 0.55, 0.2), 3.2 + 0.6 * noise(vec2(t * 7.0, 0.0)) + 0.3 * sin(t * 23.0)); /* la boca de la cocina a leña */
  if (i == 1) return Luz(vec3(-2.75, 1.5, -0.3), vec3(0.6, 0.68, 0.85), 3.2); /* la mañana gris por la ventana */
  return Luz(vec3(0.5, 0.88, -0.3), vec3(1.0, 0.72, 0.38), 1.3); /* el farol de Martín, sobre la mesa, todavía prendido */
}
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
/* la mesa en el medio (0, 0,75, 0), 1,4 × 0,8. Martín en -z mirando a +z, Verónica enfrente en +z, Elías en +x (de espaldas a la cocina, que está en +x),
   Ana en -x (del lado de la ventana). Sillas a 0,45. */
const vec3 PM = vec3(0.0, 0.0, -0.78), PV = vec3(0.0, 0.0, 0.78), PE = vec3(1.08, 0.0, 0.0), PA = vec3(-1.08, 0.0, 0.0);
const float RM = -PI * 0.5, RV = PI * 0.5, RE = 0.0, RA = PI; /* cada uno mira al centro de la mesa: para mirar al ángulo φ, el marco gira φ + π */
/* el mate va de mano en mano: Elías lo tiene; a los 13,5 se lo pasa a Verónica; a los 33 vuelve a Elías; a los 54 a Martín */
vec3 posMate(float t) {
  vec3 p = vec3(0.75, 0.78, 0.3);                                   /* al lado de Elías, sobre la mesa */
  p = mix(p, vec3(0.3, 0.78, 0.5), smoothstep(13.0, 14.5, t));     /* delante de Verónica */
  p = mix(p, vec3(0.75, 0.78, 0.3), smoothstep(32.5, 34.0, t));
  p = mix(p, vec3(0.3, 0.78, -0.5), smoothstep(53.5, 55.0, t));    /* delante de Martín */
  return p;
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = vec2(1e3, 0.0);
  /* el galpón: 5,2 × 3 × 4, chapa por fuera, tablas por dentro; la ventana en -x, la puerta corrediza en -z (cerrada) */
  float caja = max(sdBox3(p - vec3(0.0, 1.5, 0.0), vec3(2.75, 1.6, 2.15)), -sdBox3(p - vec3(0.0, 1.5, 0.0), vec3(2.6, 1.5, 2.0)));
  float ventana = sdBox3(p - vec3(-2.6, 1.5, -0.3), vec3(0.3, 0.4, 0.5));
  caja = max(caja, -ventana);
  r = vec2(caja, 33.0);
  float piso = sdBox3(p - vec3(0.0, -0.05, 0.0), vec3(2.7, 0.05, 2.1));
  if (piso < r.x) r = vec2(piso, 14.0);
  float marco = max(sdBox3(p - vec3(-2.6, 1.5, -0.3), vec3(0.06, 0.45, 0.55)), -sdBox3(p - vec3(-2.6, 1.5, -0.3), vec3(0.2, 0.38, 0.48)));
  marco = min(marco, sdBox3(p - vec3(-2.6, 1.5, -0.3), vec3(0.03, 0.4, 0.02)));
  if (marco < r.x) r = vec2(marco, 13.0);
  float vidrio = sdBox3(p - vec3(-2.63, 1.5, -0.3), vec3(0.005, 0.38, 0.48));
  if (vidrio < r.x) r = vec2(vidrio, 38.0);
  float puerta = sdBox3(p - vec3(0.3, 1.05, -2.02), vec3(0.88, 1.1, 0.03));
  if (puerta < r.x) r = vec2(puerta, 32.0);
  /* la cocina a leña contra la pared de +x: el cuerpo de fundición, la boca con el fuego, el caño que sube, la pava encima; leña apilada al lado */
  vec3 qc = p - vec3(2.2, 0.0, 1.9);
  float cocina = sdBox3(qc - vec3(0.0, 0.45, 0.0), vec3(0.35, 0.45, 0.3)) - 0.02;
  float boca = sdBox3(qc - vec3(-0.36, 0.3, 0.0), vec3(0.06, 0.1, 0.14));
  cocina = max(cocina, -boca);
  float cano = sdCil(qc - vec3(0.1, 1.9, 0.0), 1.0, 0.07);
  float patas = 1e3; for (int i = 0; i < 4; i++) patas = min(patas, sdCil(qc - vec3(i < 2 ? -0.28 : 0.28, 0.05, mod(float(i), 2.0) < 0.5 ? -0.22 : 0.22), 0.06, 0.03));
  if (min(cocina, min(cano, patas)) < r.x) r = vec2(min(cocina, min(cano, patas)), 34.0);
  float fuego = sdBox3(qc - vec3(-0.32, 0.28, 0.0), vec3(0.03, 0.07, 0.12));
  if (fuego < r.x) r = vec2(fuego, 6.0);
  float pava = sdElip(qc - vec3(0.0, 1.0, 0.0), vec3(0.11, 0.09, 0.11)); pava = min(pava, sdCap(qc, vec3(0.0, 1.07, 0.0), vec3(0.0, 1.17, 0.0), 0.012)); pava = min(pava, sdCap(qc, vec3(-0.09, 1.0, 0.0), vec3(-0.18, 1.08, 0.0), 0.012));
  if (pava < r.x) r = vec2(pava, 23.0);
  float lena = 1e3; for (int i = 0; i < 5; i++) { float k = float(i); lena = min(lena, sdCilX(p - vec3(2.3, 0.07 + 0.1 * floor(k / 2.0), 1.1 - 0.12 * mod(k, 2.0) - 0.06 * floor(k / 2.0)), 0.25, 0.05)); }
  if (lena < r.x) r = vec2(lena, 16.0);
  /* la mesa de tablas y las cuatro sillas */
  float mesa = sdBox3(p - vec3(0.0, 0.74, 0.0), vec3(0.7, 0.02, 0.4)) - 0.01;
  for (int i = 0; i < 4; i++) { vec3 pata = vec3(i < 2 ? -0.64 : 0.64, 0.36, mod(float(i), 2.0) < 0.5 ? -0.34 : 0.34); mesa = min(mesa, sdBox3(p - pata, vec3(0.03, 0.36, 0.03))); }
  if (mesa < r.x) r = vec2(mesa, 7.0);
  float sillas = min(min(silla(rotY(p - PM, RM)), silla(rotY(p - PV, RV))), min(silla(rotY(p - PE, RE)), silla(rotY(p - PA, RA)))); /* el respaldo del lado contrario a donde mira */
  if (sillas < r.x) r = vec2(sillas, 13.0);
  /* sobre la mesa: el mate con la bombilla, la pava chica, un plato con duraznos, dos jarros; el VHF en el estante con su antena y la lucecita */
  vec3 qm = p - posMate(t);
  float mate = sdElip(qm - vec3(0.0, 0.04, 0.0), vec3(0.04, 0.045, 0.04)); mate = max(mate, -sdCil(qm - vec3(0.0, 0.085, 0.0), 0.02, 0.028));
  float bombilla = sdCap(qm, vec3(0.0, 0.05, 0.0), vec3(0.05, 0.19, -0.03), 0.004);
  if (mate < r.x) r = vec2(mate, 29.0);
  if (bombilla < r.x) r = vec2(bombilla, 23.0);
  float plato = sdCil(p - vec3(-0.3, 0.765, 0.0), 0.006, 0.12);
  float duraznos = min(min(length(p - vec3(-0.33, 0.81, 0.03)) - 0.038, length(p - vec3(-0.26, 0.81, -0.04)) - 0.036), length(p - vec3(-0.3, 0.86, -0.01)) - 0.034);
  if (plato < r.x) r = vec2(plato, 20.0);
  if (duraznos < r.x) r = vec2(duraznos, 57.0);
  float jarros = max(sdCil(p - vec3(-0.4, 0.8, 0.28), 0.045, 0.04), -sdCil(p - vec3(-0.4, 0.82, 0.28), 0.045, 0.035));
  if (jarros < r.x) r = vec2(jarros, 34.0);
  vec3 qf = p - vec3(0.5, 0.76, -0.3);
  if (length(qf - vec3(0.0, 0.15, 0.0)) < 0.4) r = u2(r, farol(qf));
  float estante = sdBox3(p - vec3(1.2, 1.7, 1.95), vec3(0.5, 0.015, 0.12));
  float vhf = sdBox3(p - vec3(1.2, 1.8, 1.92), vec3(0.14, 0.08, 0.09)) - 0.01;
  vhf = min(vhf, sdCap(p, vec3(1.32, 1.88, 1.92), vec3(1.4, 2.35, 1.92), 0.006));
  if (estante < r.x) r = vec2(estante, 13.0);
  if (vhf < r.x) r = vec2(vhf, 34.0);
  float lucecita = length(p - vec3(1.1, 1.8, 1.82)) - 0.008;
  if (lucecita < r.x) r = vec2(lucecita, 58.0);
  /* mantas colgadas de una soga para que se sequen, y la ropa mojada */
  float soga = sdCap(p, vec3(-2.5, 2.3, 1.5), vec3(1.5, 2.25, 1.9), 0.01);
  if (soga < r.x) r = vec2(soga, 5.0);
  vec3 qr = p - vec3(-1.6, 1.85, 1.6); qr.z += 0.02 * sin(qr.y * 8.0 + t * 1.5);
  float ropa = sdBox3(qr, vec3(0.3, 0.42, 0.015 + 0.01 * noise(qr.xy * 10.0))) - 0.01;
  qr = p - vec3(-0.5, 1.75, 1.72); float ropa2 = sdBox3(qr, vec3(0.22, 0.5, 0.012)) - 0.01;
  if (ropa < r.x) r = vec2(ropa, 36.0);
  if (ropa2 < r.x) r = vec2(ropa2, 25.0);
  /* ---- los cuatro ---- */
  /* Martín: mirándose las manos sobre la mesa; levanta la cabeza en «es el martes, Vero» */
  float dm = length(p - (PM + vec3(0.0, 0.8, 0.0))) - 1.15;
  if (dm < 0.2) {
    vec3 q = rotY(p - PM, RM);
    Pose P = poseSilla();
    P.manoI = vec3(-0.32, 0.8, -0.08); P.manoD = vec3(-0.3, 0.83, 0.04); /* una mano sobre la otra, los pulgares que se frotan */
    P.manoD.x += 0.01 * sin(t * 1.5);
    float habla1 = smoothstep(3.5, 4.5, t) * (1.0 - smoothstep(25.5, 26.5, t)), habla2 = smoothstep(47.5, 48.5, t) * (1.0 - smoothstep(61.0, 62.0, t));
    float levanta = smoothstep(47.5, 48.5, t) * (1.0 - smoothstep(57.0, 58.0, t)) + smoothstep(58.0, 58.8, t);
    P.pitch = -0.45 + 0.45 * levanta + 0.05 * sin(t * 0.7) * habla1; P.yaw = 0.05 * sin(t * 0.5) * habla1;
    float inclina = 0.1 * (1.0 - levanta); P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina * 1.2; P.homI.x -= inclina; P.homD.x -= inclina;
    P = resolver(P);
    vec2 v = persona(q, P, aspectoMartinSinGorra());
    r = u2(r, v);
  } else if (dm < r.x) r = vec2(dm, 0.0);
  /* Verónica, enfrente: las manos en el jarro; toma mate cuando le toca; lo mira a él */
  float dv = length(p - (PV + vec3(0.0, 0.8, 0.0))) - 1.15;
  if (dv < 0.2) {
    vec3 q = rotY(p - PV, RV);
    Pose P = poseSilla();
    float toma = smoothstep(15.0, 16.0, t) * (1.0 - smoothstep(19.0, 20.0, t)) + smoothstep(24.0, 25.0, t) * (1.0 - smoothstep(28.0, 29.0, t));
    vec3 mateL = rotY(posMate(t) - PV, RV);
    vec3 enBoca = P.cab + vec3(-0.14, -0.1, 0.03);
    P.manoD = mix(vec3(-0.3, 0.8, 0.1), mix(mateL + vec3(0.0, 0.06, 0.0), enBoca, toma), smoothstep(13.0, 14.5, t) * (1.0 - smoothstep(32.5, 34.0, t)));
    P.agarreD = vec3(0.0, -1.0, 0.0); P.manoI = vec3(-0.3, 0.8, -0.12);
    P.pitch = -0.1 - 0.1 * toma; P.yaw = 0.04 * sin(t * 0.4);
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* Elías, de espaldas a la cocina, con el mate; ceba cuando lo tiene */
  float de = length(p - (PE + vec3(0.0, 0.8, 0.0))) - 1.15;
  if (de < 0.2) {
    vec3 q = rotY(p - PE, RE);
    Pose P = poseSilla();
    float tiene = (1.0 - smoothstep(13.0, 14.5, t)) + smoothstep(32.5, 34.0, t) * (1.0 - smoothstep(53.5, 55.0, t));
    vec3 mateL = rotY(posMate(t) - PE, RE);
    P.manoD = mix(vec3(-0.3, 0.8, 0.12), mateL + vec3(0.0, 0.06, 0.0), tiene); P.agarreD = vec3(0.0, -1.0, 0.0);
    P.manoI = vec3(-0.28, 0.8, -0.14);
    float habla = smoothstep(27.5, 28.5, t) * (1.0 - smoothstep(34.0, 35.0, t));
    P.pitch = -0.15 + 0.1 * habla; P.yaw = 0.3 * habla + 0.04 * sin(t * 0.5); /* le habla a Verónica, a su izquierda */
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoEliasSinGorra()));
  } else if (de < r.x) r = vec2(de, 0.0);
  /* Ana, con la manta hasta el cuello, agarrándola con las dos manos; mira la mesa; «me voy en la primera colectiva» */
  float da = length(p - (PA + vec3(0.0, 0.8, 0.0))) - 1.15;
  if (da < 0.2) {
    vec3 q = rotY(p - PA, RA);
    Pose P = poseSilla();
    P.manoI = P.hom + vec3(-0.13, -0.08, -0.06); P.manoD = P.hom + vec3(-0.13, -0.1, 0.06); P.agarreI = vec3(0.0, 1.0, 0.0); P.agarreD = vec3(0.0, 1.0, 0.0);
    P.codoI = P.homI + vec3(-0.05, -0.28, -0.02); P.codoD = P.homD + vec3(-0.05, -0.28, 0.02);
    float habla = smoothstep(35.5, 36.5, t) * (1.0 - smoothstep(45.0, 46.0, t));
    P.pitch = -0.3 + 0.25 * habla; P.yaw = -0.35 * habla; /* a Martín, a su derecha */
    P.cab.y += 0.005 * sin(t * 3.0); /* tirita */
    P = resolver(P);
    vec2 v = persona(q, P, aspectoAna());
    /* la manta: un capullo alrededor del torso hasta el cuello */
    vec3 qs = q / 0.92; vec3 c = (P.cad + P.hom) * 0.5 + vec3(-0.02, 0.0, 0.0);
    float manta = sdElip(qs - c, vec3(0.24, 0.3, 0.3)); manta = smin(manta, sdCap(qs, P.hom + vec3(-0.1, 0.06, -0.2), P.hom + vec3(-0.1, 0.06, 0.2), 0.08), 0.05);
    manta += 0.006 * noise(qs.xy * 30.0 + qs.z * 30.0);
    v = u2(v, vec2(manta * 0.92, 36.0));
    r = u2(r, v);
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0012 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 cabM = PM + vec3(0.0, 1.22, -0.03), cabV = PV + vec3(0.0, 1.22 * 0.94, 0.03), cabE = PE + vec3(0.03, 1.22 * 0.97, 0.0), cabA = PA + vec3(-0.03, 1.22 * 0.92, 0.0);
  if (t < 4.0) { float a = smoothstep(0.0, 4.0, t); ro = mix(vec3(-2.1, 1.75, -1.65), vec3(-2.0, 1.7, -1.6), a); obj = vec3(0.3, 0.9, 0.3); zoom = 1.15; }                  /* desde el rincón de la ventana: la mesa con los cuatro, la cocina con el fuego atrás */
  else if (t < 15.0) { float a = smoothstep(4.0, 15.0, t); ro = mix(vec3(0.35, 1.3, 0.6), vec3(0.3, 1.28, 0.55), a); obj = cabM + vec3(0.0, -0.1, 0.0); zoom = 1.9; }        /* Martín, mirándose las manos, desde el lado de Verónica */
  else if (t < 26.0) { float a = smoothstep(15.0, 26.0, t); ro = mix(vec3(-0.45, 1.25, 0.5), vec3(-0.5, 1.23, 0.45), a); obj = cabM + vec3(0.0, -0.12, 0.0); zoom = 2.1; } /* más cerca */
  else if (t < 28.0) { ro = vec3(-0.4, 1.3, -0.5); obj = cabV + vec3(0.0, -0.05, 0.0); zoom = 2.0; }                                                                        /* Verónica que lo escucha */
  else if (t < 35.5) { float a = smoothstep(28.0, 35.5, t); ro = mix(vec3(-0.15, 1.35, -0.55), vec3(-0.2, 1.33, -0.5), a); obj = cabE + vec3(0.0, -0.05, 0.0); zoom = 1.9; } /* Elías, con el fuego detrás */
  else if (t < 46.0) { float a = smoothstep(35.5, 46.0, t); ro = mix(vec3(0.2, 1.35, 0.5), vec3(0.15, 1.33, 0.45), a); obj = cabA + vec3(0.0, -0.08, 0.0); zoom = 1.9; }    /* Ana con la manta, la ventana gris detrás */
  else if (t < 47.5) { ro = vec3(0.35, 1.3, 0.6); obj = cabM + vec3(0.0, -0.1, 0.0); zoom = 1.9; }                                                                          /* Martín: «ya sé» */
  else if (t < 56.5) { float a = smoothstep(47.5, 56.5, t); ro = mix(vec3(0.3, 1.32, 0.7), vec3(0.25, 1.3, 0.65), a); obj = cabM + vec3(0.0, -0.05, 0.0); zoom = 2.0; }    /* Martín levanta la cabeza: «es el martes, Vero» */
  else if (t < 58.0) { ro = vec3(-0.35, 1.32, -0.55); obj = cabV + vec3(0.0, -0.05, 0.0); zoom = 2.0; }                                                                     /* Verónica: «ya sé» */
  else { float a = smoothstep(58.0, 62.0, t); ro = mix(vec3(2.0, 1.7, -1.45), vec3(1.9, 1.68, -1.4), a); obj = vec3(-0.2, 0.9, 0.2); zoom = 1.2; }                        /* desde el lado de la cocina: los cuatro y la ventana con la mañana gris */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
