/* Escena 9: sábado a las 9, la cocina de arriba. Las dos secas, una contra la otra en la mesa; afuera el arroyo marrón ya tapó la
   planta baja y llueve. Ana corta el pan con la derecha; Verónica pone el boleto sobre la mesa. Plano y contraplano:
   «Martín te lo iba a decir.» … «Sé cómo firma.» «Sí. Eso lo sabés.» */
Clima clima(float t) { return Clima(0.55, 0.0, 0.97, 0.0, 0.03, 0.55, vec2(-0.7, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.2, 0.5, -1.0)); }
float nivelAgua(float t) { return -2.6; } /* el agua a 1,1 m del suelo: el muelle hundido, la galería (1,2) todavía seca; el piso de arriba está a 3,7 */
Luz luz(int i, float t) { if (i == 0) return Luz(vec3(-1.0, 1.3, -1.05), vec3(0.72, 0.78, 0.9), 2.4); return Luz(vec3(1.0, 1.3, -1.05), vec3(0.72, 0.78, 0.9), 2.4); } /* la luz gris de las dos ventanas */
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
/* lo que hace cada una: Ana corta de 0 a 6 y vuelve a cortar de 36 a 45; Verónica pone el boleto sobre la mesa entre 6 y 7,5 */
float corta(float t) { return (1.0 - smoothstep(5.0, 6.0, t)) + smoothstep(36.0, 37.0, t); }
float vaiven(float t) { return sin(t * 2.0 * PI / 1.1); }
vec3 posBoleto(float t) { return mix(vec3(-0.62, 0.95, -0.05), vec3(-0.22, 0.762, -0.08), smoothstep(6.0, 7.5, t)); }
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = cocinaArriba(p);
  /* afuera, por las ventanas: la otra orilla con los sauces, y un sauce cerca del costado */
  if (p.z < -1.3) { vec2 o = orilla(p + vec3(0.0, 0.9, 0.0), t, -24.0, -1.0, 5.0, 0.55); if (o.x < r.x) r = o; }
  float ds = length(p - vec3(6.0, 0.5, -2.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(6.0, -0.9, -2.0), t, 9.0, 0.55)); else if (ds < r.x) r = vec2(ds, 0.0);
  /* sobre la mesa: la tabla, el pan, las rebanadas, el cuchillo (en la mano de Ana cuando corta), dos tazas, el boleto */
  float tabla = sdBox3(p - vec3(0.3, 0.77, -0.2), vec3(0.17, 0.01, 0.12)) - 0.005;
  if (tabla < r.x) r = vec2(tabla, 29.0);
  float pan = sdElip(p - vec3(0.33, 0.83, -0.17), vec3(0.11, 0.05, 0.05));
  pan += 0.004 * noise(p.xz * 50.0);
  if (pan < r.x) r = vec2(pan, 55.0);
  float rebanadas = 1e3;
  for (int i = 0; i < 3; i++) { float k = float(i); rebanadas = min(rebanadas, sdBox3(p - vec3(0.2, 0.79 + 0.006 * k, -0.27 + 0.01 * k), vec3(0.045, 0.006, 0.04)) - 0.003); }
  if (rebanadas < r.x) r = vec2(rebanadas, 55.0);
  float tazas = min(max(sdCil(p - vec3(0.45, 0.8, -0.48), 0.045, 0.04), -sdCil(p - vec3(0.45, 0.82, -0.48), 0.045, 0.035)), max(sdCil(p - vec3(-0.4, 0.8, -0.45), 0.045, 0.04), -sdCil(p - vec3(-0.4, 0.82, -0.45), 0.045, 0.035)));
  if (tazas < r.x) r = vec2(tazas, 20.0);
  vec3 pb = posBoleto(t); vec3 qb = p - pb; qb.xz = rot(0.25) * qb.xz; qb.xy = rot(-0.6 * (1.0 - smoothstep(6.8, 7.5, t)) * smoothstep(5.5, 6.0, t)) * qb.xy;
  float boleto = sdBox3(qb, vec3(0.105, 0.0015, 0.074)) + 10.0 * (1.0 - step(5.5, t)); /* doblado al medio; antes de los 5,5 s está en el forro */
  if (boleto < r.x) r = vec2(boleto, 35.0);
  /* Ana, en +x mirando a -x: corta el pan con la derecha, la izquierda sujeta el pan */
  vec3 pa = vec3(0.78, 0.0, -0.2);
  float da = length(p - (pa + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, 0.0);
    Pose P = poseSilla();
    float c = corta(t);
    /* el cuchillo va y viene sobre el pan (el pan está en x 0,33 del mundo = local -0,45) */
    vec3 cuchilloM = vec3(-0.45 + 0.06 * vaiven(t) * c, 0.86, 0.1); vec3 panM = vec3(-0.4, 0.86, -0.12);
    P.manoD = mix(vec3(-0.3, 0.8, 0.12), cuchilloM, c); P.manoI = mix(vec3(-0.3, 0.8, -0.12), panM, c);
    P.agarreD = vec3(0.0, -1.0, 0.0); P.agarreI = vec3(0.0, -1.0, 0.0);
    P.codoD = mix(P.codoD, vec3(0.0, 0.72, 0.3), c); P.codoI = mix(P.codoI, vec3(0.0, 0.72, -0.3), c);
    /* mira el pan cuando corta, a Verónica cuando habla, y la mira fijo en «¿vos pensás que yo…?» */
    float habla = smoothstep(5.5, 6.5, t) * (1.0 - smoothstep(35.5, 36.5, t));
    P.pitch = -0.4 * c + 0.0 * habla - 0.1 * smoothstep(21.0, 22.0, t) * (1.0 - smoothstep(24.0, 25.0, t));
    P.yaw = 0.05 * sin(t * 0.5) * habla;
    P.pecho.x -= 0.05 * c; P.hom.x -= 0.08 * c; P.cab.x -= 0.08 * c; P.homI.x -= 0.08 * c; P.homD.x -= 0.08 * c;
    P = resolver(P);
    vec2 v = persona(q, P, aspectoAna());
    if (c > 0.01) {
      vec3 m = P.manoD * 0.92; vec3 mango = m + vec3(0.0, -0.02, 0.0);
      float cuchillo = sdCap(q, mango + vec3(0.04, 0.0, 0.0), mango - vec3(0.06, 0.0, 0.0), 0.011);
      float hoja = sdBox3(q - (mango - vec3(0.17, 0.005, 0.0)), vec3(0.11, 0.012, 0.0015));
      v = u2(v, u2(vec2(cuchillo, 34.0), vec2(hoja, 23.0)));
    }
    r = u2(r, v);
  } else if (da < r.x) r = vec2(da, 0.0);
  /* Verónica, en -x mirando a +x: las manos sobre la mesa; pone el boleto; después las manos quietas una sobre otra */
  vec3 pv = vec3(-0.78, 0.0, -0.2);
  float dv = length(p - (pv + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, PI);
    Pose P = poseSilla();
    float pone = smoothstep(5.5, 6.0, t) * (1.0 - smoothstep(7.5, 8.2, t));
    vec3 boletoL = rotY(posBoleto(t) - pv, PI) + vec3(0.0, 0.03, 0.0);
    P.manoD = mix(vec3(-0.32, 0.8, 0.1), boletoL, pone); P.manoI = vec3(-0.3, 0.8, -0.12);
    P.manoD = mix(P.manoD, vec3(-0.3, 0.82, -0.08), smoothstep(8.2, 9.5, t)); /* la derecha sobre la izquierda */
    P.agarreD = vec3(0.0, -1.0, 0.0); P.agarreI = vec3(0.0, -1.0, 0.0);
    P.pitch = -0.08 - 0.2 * pone; P.yaw = 0.04 * sin(t * 0.4);
    float inclina = 0.06 * smoothstep(23.0, 25.0, t); P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina; P.homI.x -= inclina; P.homD.x -= inclina;
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0012 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 cabA = vec3(0.78 - 0.03, 1.22 * 0.92, -0.2), cabV = vec3(-0.78 + 0.03, 1.22 * 0.94, -0.2);
  /* plano y contraplano: a Ana se la ve desde el hombro de Verónica y al revés */
  bool aAna = (t >= 6.0 && t < 9.0) || (t >= 16.0 && t < 18.0) || (t >= 21.5 && t < 24.5) || (t >= 29.0 && t < 32.0) || (t >= 35.0 && t < 40.0);
  bool aVero = (t >= 9.0 && t < 16.0) || (t >= 18.0 && t < 21.5) || (t >= 24.5 && t < 29.0) || (t >= 32.0 && t < 35.0);
  if (t < 6.0) { float a = smoothstep(0.0, 6.0, t); ro = mix(vec3(1.55, 1.75, 1.05), vec3(1.45, 1.7, 1.0), a); obj = vec3(-0.2, 0.95, -0.45); zoom = 1.25; }      /* desde el rincón de la cocina: la mesa, las dos, las ventanas con lluvia */
  else if (aAna) { ro = vec3(-0.55, 1.42, -0.55); obj = cabA + vec3(0.0, -0.08, 0.0); zoom = 1.9; }
  else if (aVero) { ro = vec3(0.55, 1.42, 0.15); obj = cabV + vec3(0.0, -0.08, 0.0); zoom = 1.9; }
  else { float a = smoothstep(40.0, 45.0, t); ro = mix(vec3(-1.5, 1.6, 0.95), vec3(-1.45, 1.62, 0.9), a); obj = vec3(0.2, 0.95, -0.45); zoom = 1.3; }                  /* desde el otro rincón: las dos calladas, la ventana */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
