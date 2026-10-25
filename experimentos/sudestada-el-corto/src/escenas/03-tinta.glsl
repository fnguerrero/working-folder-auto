/* Escena 3: jueves a las 14.30, la galería. Elías amarra la chata al muelle, sube la escalera despacio (setenta y un años) y se
   sienta en el banco con la gorra en la rodilla; Ana en el vano de la puerta, de brazos cruzados; Verónica parada en la galería.
   «Viene sudestada, Verónica. Grande.» Al irse, desde arriba de la escalera, mira el cielo. */
Clima clima(float t) { return Clima(0.85, 0.0, 0.96, 0.0, 0.016, 0.45 + 0.25 * smoothstep(20.0, 44.0, t), vec2(-0.35, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.3, 0.6, 0.5)); }
float nivelAgua(float t) { return 0.07; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }

/* ---- el recorrido de Elías ---- */
/* 0-4 amarra la chata en el poste del muelle; 4-5,2 se endereza y se da vuelta; 5,2-12,4 sube los seis niveles (1,2 s por escalón);
   12,4-14,4 camina hasta el banco; 14,4-15,6 se sienta; 40-41,5 se levanta; desde 41,5 (corte) está otra vez en el muelle y mira el cielo */
vec2 nivel(float k) { k = clamp(k, 0.0, 6.0); if (k < 0.5) return vec2(-3.98, 0.325); if (k > 5.5) return vec2(-2.66, 1.12); return vec2(-3.75 + 0.26 * (k - 1.0), 0.40 + 0.18 * (k - 1.0)); }
float subida(float t) { return clamp((t - 5.2) / 1.2, 0.0, 6.0); }
vec2 pieEnEscalera(float u, float par) {
  float k = floor(u), f = u - k;
  if (mod(k, 2.0) == par) return nivel(k) + vec2(0.0, 0.08);
  vec2 de = nivel(max(k - 1.0, 0.0)), a = nivel(min(k + 1.0, 6.0));
  float g = smoothstep(0.0, 1.0, f);
  return mix(de, a, g) + vec2(0.0, 0.08 + 0.14 * sin(PI * f));
}
float sentado(float t) { return smoothstep(14.4, 15.6, t) * (1.0 - smoothstep(40.0, 41.5, t)); }
float enEscalera(float t) { return step(41.5, t); }
const vec3 POSTE = vec3(0.4, 0.55, -4.5);  /* la punta del poste de la esquina del muelle, donde ata */
const vec3 BANCO = vec3(-1.1, 1.2, -1.72); /* el pie del marco local cuando está sentado */
vec3 posElias(float t) {
  if (t >= 41.5) return vec3(0.1, 0.325, -4.1); /* de vuelta en el muelle, al lado de la chata */
  float u = subida(t);
  vec3 p = mix(vec3(0.1, 0.325, -4.05), vec3(0.0, 0.325, -3.98), smoothstep(4.0, 5.0, t));
  if (u > 0.0) { float k = floor(u), f = u - k; vec2 n0 = nivel(k), n1 = nivel(k + 1.0); p = vec3(0.0, mix(n0.y, n1.y, smoothstep(0.15, 0.85, f)), mix(n0.x, n1.x, f)); }
  float camina = smoothstep(12.4, 14.4, t);
  if (t > 12.4) p = mix(vec3(0.0, 1.2, -2.6), vec3(-1.1, 1.2, -1.9), camina);
  p = mix(p, BANCO, smoothstep(14.4, 15.6, t));
  if (t > 40.0) p = mix(BANCO, vec3(-1.1, 1.2, -1.9), smoothstep(40.0, 41.5, t));
  return p;
}
float dirElias(float t) {
  /* ángulo del marco local (para mirar al ángulo φ del mundo, el marco gira φ + π) */
  if (t >= 41.5) return PI;                                    /* mira a +x, hacia su chata, de costado a la galería */
  float a = mix(2.16, 4.71, smoothstep(4.0, 5.2, t));          /* del poste a la escalera (+z) */
  a = mix(a, 5.78, smoothstep(12.2, 13.0, t));                 /* camina hacia el banco */
  a = mix(a, 7.85, smoothstep(13.8, 14.8, t));                 /* se da vuelta y mira al río (-z) */
  return a;
}
vec2 elias(vec3 p, float t) {
  vec3 pe = posElias(t);
  float u = subida(t), sent = sentado(t), esc = enEscalera(t);
  vec3 q = rotY(p - pe, dirElias(t));
  float camina = smoothstep(12.4, 12.7, t) * (1.0 - smoothstep(14.1, 14.4, t));
  float paso = camina * 0.8;
  Pose P = poseDePie(t * 2.0 * PI / 1.25, paso);
  /* amarrando: agachado hacia el poste, las dos manos en la soga */
  float ata = 1.0 - smoothstep(3.2, 4.3, t);
  if (ata > 0.0) {
    vec3 soga = rotY(POSTE - pe, dirElias(t));
    P.cad.y -= 0.2 * ata; P.pecho += vec3(-0.3, -0.3, 0.0) * ata; P.hom += vec3(-0.46, -0.42, 0.0) * ata; P.cab += vec3(-0.6, -0.54, 0.0) * ata;
    P.homI = P.hom + vec3(0.0, -0.03, -0.17); P.homD = P.hom + vec3(0.0, -0.03, 0.17);
    float tira = 0.03 * sin(t * 5.0);
    P.manoI = mix(P.manoI, soga + vec3(-0.02, 0.06 + tira, -0.06), ata); P.manoD = mix(P.manoD, soga + vec3(0.03, 0.02 - tira, 0.06), ata);
    P.agarreI = vec3(0.0, -1.0, 0.0); P.agarreD = vec3(0.0, -1.0, 0.0);
    P.pitch = -0.5 * ata;
  }
  if (u > 0.0 && t < 12.4) {
    vec2 fI = pieEnEscalera(u, 1.0), fD = pieEnEscalera(u, 0.0);
    P.pieI = vec3(-(fI.x - pe.z), fI.y - pe.y, -0.11); P.pieD = vec3(-(fD.x - pe.z), fD.y - pe.y, 0.11);
    P.rodI = vec3(P.pieI.x - 0.12, 0.5, -0.1); P.rodD = vec3(P.pieD.x - 0.12, 0.5, 0.1);
    float sube = 1.0 - smoothstep(5.6, 6.0, u);
    float agacha = 0.06 * sube; P.cad.y -= agacha; P.pecho.y -= agacha; P.hom.y -= agacha; P.cab.y -= agacha; P.homI.y -= agacha; P.homD.y -= agacha;
    P.pecho.x -= 0.05 * sube; P.hom.x -= 0.09 * sube; P.cab.x -= 0.1 * sube; P.homI.x -= 0.09 * sube; P.homD.x -= 0.09 * sube;
    /* la mano derecha en el pasamanos de la derecha (x 0,5); la izquierda colgando */
    float zr = min(pe.z + 0.3, -2.85); float yr = 0.9 + (zr + 3.85) + 0.03;
    vec3 pasamanos = vec3(-(zr - pe.z), yr - pe.y, 0.5 - pe.x);
    P.manoD = mix(P.manoD, pasamanos, sube); P.codoD = mix(P.codoD, P.homD + vec3(0.05, -0.25, 0.12), sube); P.agarreD = vec3(-1.0, 0.0, 0.0);
    P.pitch = -0.2 * sube;
  }
  /* sentado en el banco: la gorra en la rodilla derecha, la mano encima; la izquierda en la otra rodilla */
  if (sent > 0.0) {
    Pose S = poseSilla();
    S.manoD = S.rodD + vec3(-0.02, 0.1, 0.05); S.manoI = S.rodI + vec3(-0.04, 0.06, -0.02); S.agarreD = vec3(0.0, -1.0, 0.0); S.agarreI = vec3(0.0, -1.0, 0.0);
    S.codoD = S.homD + vec3(-0.05, -0.25, 0.1); S.codoI = S.homI + vec3(-0.05, -0.25, -0.1);
    S.pecho.x -= 0.03; S.hom.x -= 0.05; S.cab.x -= 0.05; S.homI.x -= 0.05; S.homD.x -= 0.05;
    /* habla mirándola a ella (a +x, a su izquierda) y al cielo cuando dice «viene sudestada» */
    float habla1 = smoothstep(15.5, 16.5, t) * (1.0 - smoothstep(21.8, 22.8, t)), habla2 = smoothstep(29.3, 30.3, t) * (1.0 - smoothstep(36.5, 37.5, t));
    S.yaw = -0.45 * max(habla1, habla2) - 0.25 * (1.0 - max(habla1, habla2)) * smoothstep(23.0, 24.0, t) * (1.0 - smoothstep(37.5, 38.5, t));
    S.pitch = -0.1 + 0.35 * smoothstep(30.3, 31.3, t) * (1.0 - smoothstep(32.8, 33.8, t)) + 0.1 * habla1;
    S.cab.y += 0.01 * sin(t * 1.7);
    P = mezclarPose(P, S, sent);
  }
  if (esc > 0.5) {
    /* en el muelle, antes de desatar: se acomoda la gorra con la derecha y mira el cielo */
    float acomoda = smoothstep(41.6, 42.2, t) * (1.0 - smoothstep(42.8, 43.4, t));
    P.manoD = mix(P.manoD, P.cab + vec3(-0.12, 0.09, 0.08), acomoda); P.codoD = mix(P.codoD, P.homD + vec3(-0.2, -0.1, 0.15), acomoda); P.agarreD = mix(P.agarreD, vec3(0.0, 1.0, 0.0), acomoda);
    P.manoI = P.homI + vec3(0.02, -0.5, -0.03);
    P.pitch = 0.42 * smoothstep(42.6, 43.8, t); P.yaw = 0.15 * smoothstep(43.0, 44.0, t);
    P.cab.x -= 0.03; P.hom.x -= 0.02;
  }
  P = resolver(P);
  float conGorra = (sent > 0.5 && esc < 0.5) ? 0.0 : 1.0;
  Aspecto A = aspectoElias(); if (conGorra < 0.5) A = aspectoEliasSinGorra();
  vec2 v = persona(q, P, A);
  if (conGorra < 0.5) {
    vec3 g = q - (P.rodD * 0.97 + vec3(-0.02, 0.05, 0.05)); g.xy = rot(0.3) * g.xy;
    v = u2(v, vec2(gorraSuelta(g) * 0.97, 28.0));
  }
  return v;
}

vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 0.0, 1.0, 1.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.5)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.5)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  float alto = 0.15 + 0.2 * smoothstep(-1.0, 3.0, p.z) + 0.06 * fbm4(p.xz * 1.5);
  float tierra = smax(p.y - alto, -(p.z + 0.5 + 0.8 * noise(p.xx * 0.4)), 0.8);
  r = u2(r, vec2(tierra, 17.0));
  /* el banco de la galería, contra la pared, a la izquierda de la puerta */
  float banco = sdBox3(p - vec3(-1.1, 1.63, -1.62), vec3(0.55, 0.02, 0.17)) - 0.01;
  banco = min(banco, min(sdBox3(p - vec3(-1.55, 1.42, -1.62), vec3(0.02, 0.22, 0.15)), sdBox3(p - vec3(-0.65, 1.42, -1.62), vec3(0.02, 0.22, 0.15))));
  if (banco < r.x) r = vec2(banco, 29.0);
  /* la chata de Martín, amarrada a la izquierda del muelle */
  vec3 qc = p - vec3(-2.6, 0.05, -5.1); qc.y += 0.02 * sin(t * 1.3); qc.xy = rot(0.02 * sin(t * 1.1)) * qc.xy;
  float dc = length(qc - vec3(0.0, 0.3, 0.0)) - 1.8;
  if (dc < 0.2) r = u2(r, chata(qc)); else if (dc < r.x) r = vec2(dc, 0.0);
  /* la chata de Elías, recién llegada, a la derecha, con el Negro sentado en la popa; la soga va de la proa al poste */
  vec3 qe = p - vec3(1.75, 0.05, -5.0); qe.y += 0.025 * sin(t * 1.1 + 2.0); qe.xz = rot(0.25) * qe.xz; qe.xy = rot(0.025 * sin(t * 0.9)) * qe.xy;
  float de = length(qe - vec3(0.0, 0.3, 0.0)) - 1.9;
  if (de < 0.2) {
    vec2 ch = chata(vec3(-qe.x, qe.y, qe.z)); /* la proa hacia el muelle (-x) */
    vec3 qp = qe - vec3(0.75, 0.1, 0.0); qp = rotY(qp, PI); qp *= 1.6;
    vec2 pr = perro(qp, 0.0); pr.x /= 1.6;
    r = u2(r, u2(ch, pr));
  } else if (de < r.x) r = vec2(de, 0.0);
  float soga = sdCap(p, POSTE + vec3(0.0, -0.02, 0.0), vec3(0.72, 0.28, -4.72), 0.012);
  soga = min(soga, sdToro(vec3(p.x - 0.4, (p.y - 0.5) * 2.0, p.z + 4.5), 0.06, 0.012));
  if (soga < r.x) r = vec2(soga, 5.0);
  /* Elías */
  vec3 pe = posElias(t);
  float dv = length(p - (pe + vec3(0.0, 0.85, 0.0))) - 1.35;
  if (dv < 0.2) r = u2(r, elias(p, t)); else if (dv < r.x) r = vec2(dv, 0.0);
  /* Verónica, parada en la galería con los brazos cruzados, mirando a Elías; se da vuelta hacia Ana cuando le habla */
  vec3 pv = vec3(0.75, 1.2, -2.3);
  float dvv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dvv < 0.2) {
    float aAna = smoothstep(22.5, 23.5, t) * (1.0 - smoothstep(28.5, 29.5, t)) + smoothstep(36.8, 37.6, t) * (1.0 - smoothstep(39.5, 40.5, t));
    vec3 q = rotY(p - pv, -0.3 + 0.35 * aAna);
    Pose P = poseDePie(0.0, 0.0);
    P = brazosCruzados(P, 0.02 * sin(t * 0.9));
    P.yaw = 0.55 * aAna; P.pitch = -0.08 + 0.04 * sin(t * 0.6);
    P.pecho.x += 0.02; P.hom.x += 0.03; P.cab.x += 0.02; P.homI.x += 0.03; P.homD.x += 0.03;
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dvv < r.x) r = vec2(dvv, 0.0);
  /* Ana, en el vano de la puerta, de brazos cruzados, apoyada en el marco; se encoge de hombros en «¿Importa?» */
  vec3 pa = vec3(0.12, 1.2, -1.42);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, PI * 0.5 - 0.35);
    Pose P = poseDePie(0.0, 0.0);
    float hombros = 0.04 * smoothstep(28.0, 28.5, t) * (1.0 - smoothstep(29.0, 29.8, t));
    P.hom.y += hombros; P.homI.y += hombros; P.homD.y += hombros;
    P = brazosCruzados(P, 0.0);
    P.cad.z -= 0.03; P.pecho.z -= 0.01; /* el peso en una pierna */
    float aVero = smoothstep(22.5, 23.5, t) * (1.0 - smoothstep(29.5, 30.5, t)) + smoothstep(38.0, 38.8, t);
    P.yaw = -0.2 + 0.25 * aVero; P.pitch = -0.05;
    r = u2(r, persona(q, P, aspectoAna()));
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0012 * sin(t * 1.1), 0.0016 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 pe = posElias(t);
  if (t < 5.0) { float a = smoothstep(0.0, 5.0, t); ro = mix(vec3(2.5, 1.4, -7.0), vec3(2.3, 1.4, -6.8), a); obj = vec3(0.1, 0.95, -4.1); zoom = 1.4; }                              /* desde el agua: Elías atando en el muelle, la casa detrás */
  else if (t < 12.4) { ro = vec3(-2.4, 1.7 + 0.5 * (pe.y - 0.325), -4.3); obj = pe + vec3(0.0, 0.95, 0.0); zoom = 1.25; }                                                        /* desde el costado, la subida */
  else if (t < 16.0) { float a = smoothstep(12.4, 16.0, t); ro = mix(vec3(1.05, 2.3, -5.3), vec3(0.95, 2.28, -5.1), a); obj = vec3(-0.5, 2.1, -1.9); zoom = 1.4; }                /* desde el río: la galería, Ana en la puerta, Elías al banco */
  else if (t < 22.8) { float a = smoothstep(16.0, 22.8, t); ro = mix(vec3(-0.15, 2.2, -3.15), vec3(-0.25, 2.18, -3.05), a); obj = vec3(-1.1, 2.1, -1.7); zoom = 1.7; }            /* Elías: «lo vi salir» */
  else if (t < 29.4) { float a = smoothstep(22.8, 29.4, t); ro = mix(vec3(-1.45, 2.3, -2.55), vec3(-1.4, 2.28, -2.5), a); obj = vec3(0.4, 2.5, -1.85); zoom = 1.4; }              /* desde el lado de Elías: Verónica y Ana */
  else if (t < 36.8) { float a = smoothstep(29.4, 36.8, t); ro = mix(vec3(-0.3, 2.25, -2.75), vec3(-0.4, 2.27, -2.7), a); obj = vec3(-1.1, 2.3, -1.7); zoom = 2.0; }               /* Elías, más cerca: «viene sudestada» */
  else if (t < 38.3) { ro = vec3(-0.05, 2.55, -2.55); obj = vec3(0.75, 2.72, -2.3); zoom = 2.1; }                                                                                   /* Verónica: «me quedo» */
  else if (t < 40.0) { ro = vec3(-0.55, 2.55, -2.3); obj = vec3(0.12, 2.7, -1.42); zoom = 2.0; }                                                                                    /* Ana: «ya sé» */
  else if (t < 41.5) { ro = vec3(0.1, 2.15, -3.3); obj = vec3(-1.1, 1.9, -1.8); zoom = 1.2; }                                                                                      /* se levanta */
  else { float a = smoothstep(41.5, 44.0, t); ro = mix(vec3(1.95, 1.25, -4.45), vec3(1.85, 1.22, -4.4), a); obj = vec3(0.1, 1.9, -4.1); zoom = 1.7; }                               /* desde abajo, en el muelle: Elías se acomoda la gorra y mira el cielo; detrás, el río y el cielo gris */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
