/* Escena 2: la casa con la puerta abierta y la toalla en la baranda; Verónica sube con la bolsa */
Clima clima(float t) { return Clima(0.8, 0.0, 0.92, 0.0, 0.015, 0.45, vec2(-0.3, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.3, 0.6, 0.5)); }
float nivelAgua(float t) { return 0.05; }
Luz luz(int i, float t) { return Luz(vec3(0.3, 3.3, 0.4), vec3(1.0, 0.8, 0.55), 0.9); } /* la lamparita de la cocina */
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
/* el recorrido de Verónica: parada en el muelle, camina hasta la escalera, sube, se detiene en el último escalón */
float avanceMuelle(float t) { return smoothstep(5.0, 9.0, t); }
float avanceEsc(float t) { return smoothstep(9.0, 13.5, t); }
vec3 posVero(float t) {
  float a = avanceMuelle(t), b = avanceEsc(t);
  vec3 p = vec3(mix(-1.7, 0.0, a), 0.33, mix(-4.2, -3.95, a));
  p.z = mix(p.z, -2.75, b); p.y = mix(0.33, 1.12, b) + 0.015 * sin(b * 5.0 * 2.0 * PI) * step(0.01, b) * step(b, 0.99);
  return p;
}
float dirVero(float t) { return mix(mix(-PI * 0.5 + 0.6, -PI, smoothstep(4.0, 5.5, t)), -PI * 0.5, smoothstep(8.0, 9.5, t)); } /* mira a la casa (+z), camina a +x, sube hacia +z: para mirar al ángulo φ del mundo, el marco local gira φ + π */
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 0.0, 1.0, 1.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.45)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.45)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  /* la barranca detrás de la casa */
  float alto = 0.15 + 0.2 * smoothstep(-1.0, 3.0, p.z) + 0.06 * fbm4(p.xz * 1.5);
  float tierra = smax(p.y - alto, -(p.z + 0.5 + 0.8 * noise(p.xx * 0.4)), 0.8);
  r = u2(r, vec2(tierra, 17.0));
  /* la chata amarrada al muelle */
  vec3 qc = p - vec3(-2.6, 0.03, -5.1); qc.y += 0.02 * sin(t * 1.3); qc.xy = rot(0.02 * sin(t * 1.1)) * qc.xy;
  float dc = length(qc - vec3(0.0, 0.3, 0.0)) - 1.8;
  if (dc < 0.2) r = u2(r, chata(qc)); else if (dc < r.x) r = vec2(dc, 0.0);
  /* Verónica */
  vec3 pv = posVero(t);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.4;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, dirVero(t));
    float paso = max(avanceMuelle(t) * (1.0 - avanceMuelle(t)) * 4.0, avanceEsc(t) * (1.0 - avanceEsc(t)) * 4.0);
    paso = smoothstep(0.0, 0.3, paso);
    float fase = t * 2.0 * PI / 0.95;
    Pose P = poseDePie(fase, paso);
    float sube = avanceEsc(t) * (1.0 - avanceEsc(t)) * 4.0;
    P.pecho.x -= 0.04 * sube; P.hom.x -= 0.07 * sube; P.cab.x -= 0.08 * sube;
    P.homI.x -= 0.07 * sube; P.homD.x -= 0.07 * sube;
    /* la bolsa en la mano izquierda, la derecha en el pasamanos al subir */
    P.manoI = P.homI + vec3(0.03, -0.56, -0.06); P.codoI = P.homI + vec3(0.03, -0.29, -0.05); P.agarreI = vec3(1.0, 0.0, 0.0);
    if (sube > 0.1) { P.manoD = vec3(-0.35, 0.98, 0.5); P.codoD = vec3(-0.12, 0.95, 0.38); P.agarreD = vec3(-1.0, 0.0, 0.0); }
    P.yaw = 0.3 * smoothstep(13.5, 15.0, t) - 0.3 * smoothstep(1.0, 3.0, t) * (1.0 - smoothstep(4.0, 5.5, t));
    P.pitch = -0.15 * sube + 0.1 * smoothstep(13.5, 15.0, t);
    vec2 v = persona(q, P, aspectoVeronica());
    vec3 mb = P.manoI * 0.94;
    float bolsa = sdBox3(q - (mb + vec3(0.0, -0.3, 0.0)), vec3(0.13, 0.19, 0.07)) - 0.03;
    bolsa = min(bolsa, sdCap(q, mb + vec3(0.0, -0.12, 0.0), mb + vec3(0.0, -0.12, 0.0) + vec3(0.1, 0.0, 0.0), 0.012));
    bolsa = min(bolsa, sdCap(q, mb + vec3(0.0, -0.12, 0.0), mb + vec3(0.0, -0.12, 0.0) + vec3(-0.1, 0.0, 0.0), 0.012));
    r = u2(r, u2(v, vec2(bolsa, 35.0)));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* Ana, de espaldas en la cocina, lavando una taza; se la ve por la puerta */
  vec3 pa = vec3(-0.05, 1.26, 0.78);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, -PI * 0.5);
    Pose P = poseDePie(0.0, 0.0);
    P.manoI = vec3(-0.3, 0.98, -0.12); P.manoD = vec3(-0.3, 1.0, 0.1); P.codoI = vec3(-0.08, 1.05, -0.22); P.codoD = vec3(-0.08, 1.05, 0.22);
    P.manoI.y += 0.02 * sin(t * 6.0); P.manoD.x -= 0.02 * sin(t * 6.0);
    P.pitch = -0.25;
    r = u2(r, persona(q, P, Aspecto(1.0, 0.0, 3.0, 0.0, 0.0, 0.0, 41.0, 0.92)));
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.1), 0.002 * sin(t * 0.8 + 1.0));
  vec3 pv = posVero(t);
  float a = smoothstep(4.5, 9.5, t), b = smoothstep(9.5, 14.0, t), c = smoothstep(14.0, 19.5, t);
  /* desde atrás, a la derecha, baja; acompaña por el muelle y sube detrás de ella; al final se asoma por encima del hombro a la puerta */
  vec3 ro0 = vec3(1.1, 1.25, -7.2), ro1 = vec3(1.6, 1.5, -5.6), ro2 = vec3(0.9, 2.5, -4.4), ro3 = vec3(0.7, 2.7, -3.55);
  ro = mix(mix(mix(ro0, ro1, a), ro2, b), ro3, c);
  vec3 obj0 = vec3(-0.9, 1.5, -2.2), obj1 = vec3(pv.x * 0.5, 1.9, -1.8), obj2 = vec3(-0.1, 2.1, -1.4), obj3 = vec3(-0.1, 1.95, 0.8);
  vec3 obj = mix(mix(mix(obj0, obj1, a), obj2, b), obj3, c);
  mirar(ro, obj, uv + tiemblo, mix(1.3, 1.6, c), 0.0, rd);
}
