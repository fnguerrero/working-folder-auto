/* Escena 2: la casa con la puerta abierta y la toalla en la baranda; Verónica sube con la bolsa */
Clima clima(float t) { return Clima(0.8, 0.0, 0.92, 0.0, 0.015, 0.45, vec2(-0.3, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.3, 0.6, 0.5)); }
float nivelAgua(float t) { return 0.05; }
Luz luz(int i, float t) { return Luz(vec3(0.3, 3.3, 0.4), vec3(1.0, 0.8, 0.55), 0.9); } /* la lamparita de la cocina */
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
/* el recorrido de Verónica: parada en el muelle, camina hasta el pie de la escalera, la sube escalón por escalón (los pies en
   los escalones reales, la mano derecha en el pasamanos) y se detiene en el último, mirando a la puerta */
float avanceMuelle(float t) { return smoothstep(5.0, 9.0, t); }
/* niveles de la subida: 0 el muelle, 1 a 5 los cinco escalones, 6 el último escalón otra vez (para que el segundo pie lo alcance). xy = (z, y del piso) */
vec2 nivel(float k) { k = clamp(k, 0.0, 6.0); if (k < 0.5) return vec2(-3.98, 0.325); if (k > 5.5) return vec2(-2.66, 1.12); return vec2(-3.75 + 0.26 * (k - 1.0), 0.40 + 0.18 * (k - 1.0)); }
float subida(float t) { return clamp((t - 9.2) / 1.1, 0.0, 6.0); } /* niveles subidos: 1,1 s por escalón, con la bolsa */
float avanceEsc(float t) { return subida(t) / 6.0; }
vec3 posVero(float t) {
  float a = avanceMuelle(t), u = subida(t);
  float k = floor(u), f = u - k;
  vec2 n0 = nivel(k), n1 = nivel(k + 1.0);
  /* el cuerpo avanza parejo y sube con el empuje de la pierna de atrás (más tarde que el pie) */
  vec3 p = vec3(mix(-1.7, 0.25, a), 0.325, mix(-4.2, -3.98, a));
  if (u > 0.0) { p.z = mix(n0.x, n1.x, f); p.y = mix(n0.y, n1.y, smoothstep(0.15, 0.85, f)); }
  return p;
}
/* pie que apoya o pasa de un escalón al siguiente: paridad 0 pisa los niveles pares, 1 los impares; devuelve (z, y) en el mundo */
vec2 pieEnEscalera(float u, float par) {
  float k = floor(u), f = u - k;
  if (mod(k, 2.0) == par) return nivel(k) + vec2(0.0, 0.08); /* apoyado (0,08: la bota, el escalón mide 2 cm de alto desde su centro) */
  vec2 de = nivel(max(k - 1.0, 0.0)), a = nivel(min(k + 1.0, 6.0));
  float g = smoothstep(0.0, 1.0, f);
  return mix(de, a, g) + vec2(0.0, 0.08 + 0.14 * sin(PI * f)); /* por el aire, por encima de la nariz del escalón del medio */
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
    float u = subida(t);
    float paso = smoothstep(0.0, 0.3, avanceMuelle(t) * (1.0 - avanceMuelle(t)) * 4.0);
    float fase = t * 2.0 * PI / 1.0;
    Pose P = poseDePie(fase, paso);
    float sube = smoothstep(0.0, 0.4, u) * (1.0 - smoothstep(5.6, 6.0, u));
    if (u > 0.0) {
      /* los pies en los escalones: el marco local mira a +z del mundo, así que adelante es -x local y el costado derecho es +z local */
      vec2 fI = pieEnEscalera(u, 1.0), fD = pieEnEscalera(u, 0.0);
      P.pieI = vec3(-(fI.x - pv.z), fI.y - pv.y, -0.11); P.pieD = vec3(-(fD.x - pv.z), fD.y - pv.y, 0.11);
      P.rodI = vec3(P.pieI.x - 0.12, 0.5, -0.1); P.rodD = vec3(P.pieD.x - 0.12, 0.5, 0.1); /* pistas: la rodilla adelante */
      float agacha = 0.05 * sube; P.cad.y -= agacha; P.pecho.y -= agacha; P.hom.y -= agacha; P.cab.y -= agacha; P.homI.y -= agacha; P.homD.y -= agacha;
    }
    P.pecho.x -= 0.04 * sube; P.hom.x -= 0.07 * sube; P.cab.x -= 0.08 * sube;
    P.homI.x -= 0.07 * sube; P.homD.x -= 0.07 * sube;
    /* la bolsa en la mano izquierda; la derecha agarra el pasamanos de la derecha (x 0,5), un poco adelante del cuerpo */
    P.manoI = P.homI + vec3(0.03, -0.54, -0.06); P.codoI = P.homI + vec3(0.03, -0.29, -0.05); P.agarreI = vec3(1.0, 0.0, 0.0);
    if (sube > 0.01) {
      float zr = min(pv.z + 0.3, -2.85); float yr = 0.9 + (zr + 3.85) + 0.03; /* el pasamanos va de (0,5, 0,9, -3,85) a (0,5, 2,0, -2,75) */
      vec3 pasamanos = vec3(-(zr - pv.z), yr - pv.y, 0.5 - pv.x);
      P.manoD = mix(P.manoD, pasamanos, sube); P.codoD = mix(P.codoD, P.homD + vec3(0.05, -0.25, 0.12), sube); P.agarreD = vec3(-1.0, 0.0, 0.0);
    }
    P.yaw = 0.3 * smoothstep(15.8, 17.0, t) - 0.3 * smoothstep(1.0, 3.0, t) * (1.0 - smoothstep(4.0, 5.5, t));
    P.pitch = -0.15 * sube + 0.1 * smoothstep(15.8, 17.0, t);
    P = resolver(P);
    vec2 v = persona(q, P, aspectoVeronica());
    /* la bolsa de siempre: de tela, llena, que cuelga de la mano por dos manijas */
    vec3 mb = P.manoI * 0.94 + vec3(0.0, -0.04, 0.0);
    vec3 cb = mb + vec3(0.0, -0.36, 0.0);
    vec3 qb = q - cb; qb.x *= 1.0 - 0.15 * smoothstep(-0.2, 0.2, qb.y);
    float bolsa = sdBox3(qb, vec3(0.14, 0.17, 0.06 + 0.03 * smoothstep(0.15, -0.15, qb.y))) - 0.035;
    bolsa = smin(bolsa, sdElip(qb - vec3(0.0, -0.08, 0.0), vec3(0.15, 0.12, 0.1)), 0.05);
    bolsa += 0.004 * noise(qb.xy * 40.0 + qb.z * 30.0);
    for (int k = 0; k < 2; k++) { float sx = k == 0 ? -0.09 : 0.09; bolsa = min(bolsa, sdCap(q, mb, cb + vec3(sx, 0.16, 0.03), 0.011)); bolsa = min(bolsa, sdCap(q, mb, cb + vec3(sx, 0.16, -0.03), 0.011)); }
    r = u2(r, u2(v, vec2(bolsa, 35.0)));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* Ana, de espaldas en la cocina, lavando una taza; se la ve por la puerta */
  vec3 pa = vec3(-0.05, 1.26, 0.78);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    /* lava de espaldas y, cuando oye los pasos en el último escalón, se da vuelta con la taza en las manos */
    float giro = smoothstep(16.3, 17.8, t);
    vec3 q = rotY(p - pa, mix(-PI * 0.5, PI * 0.5, giro));
    Pose P = poseDePie(0.0, 0.0);
    P.manoI = vec3(-0.3, 0.98, -0.12); P.manoD = vec3(-0.3, 1.0, 0.1); P.codoI = vec3(-0.08, 1.05, -0.22); P.codoD = vec3(-0.08, 1.05, 0.22);
    P.manoI.y += 0.02 * sin(t * 6.0) * (1.0 - giro); P.manoD.x -= 0.02 * sin(t * 6.0) * (1.0 - giro);
    P.manoI = mix(P.manoI, vec3(-0.22, 1.08, -0.06), giro); P.manoD = mix(P.manoD, vec3(-0.22, 1.1, 0.06), giro); P.agarreI = vec3(0.0, 1.0, 0.0); P.agarreD = vec3(0.0, 1.0, 0.0);
    P.pitch = mix(-0.25, 0.05, giro); P.yaw = 0.15 * giro * sin(t * 0.7);
    r = u2(r, persona(q, P, Aspecto(1.0, 0.0, 3.0, 0.0, 0.0, 0.0, 41.0, 0.92)));
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.1), 0.002 * sin(t * 0.8 + 1.0));
  vec3 pv = posVero(t);
  float a = smoothstep(4.5, 9.5, t), b = smoothstep(9.5, 15.5, t), c = smoothstep(15.5, 19.5, t);
  /* desde atrás, a la derecha, baja; acompaña por el muelle y sube detrás de ella; al final se asoma por encima del hombro a la puerta */
  vec3 ro0 = vec3(1.1, 1.25, -7.2), ro1 = vec3(1.6, 1.5, -5.6), ro2 = vec3(0.9, 2.5, -4.4), ro3 = vec3(0.7, 2.7, -3.55);
  ro = mix(mix(mix(ro0, ro1, a), ro2, b), ro3, c);
  vec3 obj0 = vec3(-0.9, 1.5, -2.2), obj1 = vec3(pv.x * 0.5, 1.9, -1.8), obj2 = vec3(-0.1, 2.1, -1.4), obj3 = vec3(-0.1, 1.95, 0.8);
  vec3 obj = mix(mix(mix(obj0, obj1, a), obj2, b), obj3, c);
  mirar(ro, obj, uv + tiemblo, mix(1.3, 1.6, c), 0.0, rd);
}
