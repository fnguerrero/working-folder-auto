/* Escena 12: sábado a las 23, el pico del agua. Adentro, a la luz de una vela: Ana baja con la capucha puesta por el tramo de arriba;
   Verónica en el descanso le cierra el paso. Forcejeo. La empuja escalera arriba hasta la pieza de Martín, cierra la puerta y
   da vuelta la llave; se sienta en el pasillo con las libretas. «¡Verónica, abrí la puerta!» «Mañana. Cuando baje el agua.» */
Clima clima(float t) { return Clima(0.08, 0.0, 0.95, 0.0, 0.03, 0.95, vec2(-0.9, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 2.48 + 0.015 * sin(t * 2.3) + 0.01 * sin(t * 3.7); } /* el agua a 30 cm del descanso */
/* la vela: en el poste del pasamanos del descanso hasta que Verónica la lleva arriba (19 a 22,5) y la deja en el borde de la ventana del pasillo */
vec3 posVela(float t) { return mix(vec3(0.82, 3.28, 1.3), vec3(-1.72, 4.45, 1.2), smoothstep(19.0, 22.5, t)); }
Luz luz(int i, float t) { return Luz(posVela(t) + vec3(0.0, 0.14, 0.0), vec3(1.0, 0.72, 0.4), 4.2 + 0.7 * noise(vec2(t * 9.0, 0.0)) + 0.3 * sin(t * 31.0)); }
vec4 aguaExtra(vec3 pos, float t) { vec2 h = pos.xz + vec2(0.1 * t, 0.05 * t); float hojas = step(0.82, noise(h * 2.5)) * step(0.5, noise(h * 8.0 + 2.0)) * 0.8; return vec4(0.0, 0.0, 0.0, hojas); }
float puertaAbierta(float t) { return 1.0 - smoothstep(21.0, 21.6, t); } /* abierta hasta el golpe */
/* ---- Ana: baja el tramo de arriba (0 a 4), se planta en el descanso, forcejea (17,5 a 19,5), retrocede escalera arriba hasta la puerta (19,5 a 21) y adentro ---- */
vec3 posAna(float t) {
  vec3 p = mix(vec3(-1.45, 3.7, 1.25), vec3(0.45, 2.83, 1.25), smoothstep(0.0, 4.0, t));
  p = mix(p, vec3(0.62, 2.83, 1.25), smoothstep(17.3, 17.8, t));
  p.x += 0.04 * sin(t * 9.0) * smoothstep(17.5, 18.0, t) * (1.0 - smoothstep(19.3, 19.8, t)); /* el forcejeo */
  p = mix(p, vec3(-1.4, 3.7, 0.95), smoothstep(19.5, 21.0, t));
  p = mix(p, vec3(-1.4, 3.7, -0.15), smoothstep(20.6, 21.4, t)); /* adentro de la pieza */
  return p;
}
vec3 posVero(float t) {
  vec3 p = vec3(1.4, 2.83, 1.1);
  p = mix(p, vec3(1.15, 2.83, 1.25), smoothstep(17.3, 17.8, t));
  p.x += 0.04 * sin(t * 9.0 + 0.5) * smoothstep(17.5, 18.0, t) * (1.0 - smoothstep(19.3, 19.8, t));
  p = mix(p, vec3(-0.75, 3.7, 1.05), smoothstep(19.5, 21.0, t));  /* sube detrás de ella */
  p = mix(p, vec3(-1.15, 3.7, 0.75), smoothstep(21.0, 21.5, t));  /* cierra la puerta */
  p = mix(p, vec3(-1.58, 3.7, 1.35), smoothstep(23.5, 26.5, t));  /* se aparta hasta la pared del rellano, bajo la ventana */
  return p;
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = interiorCasa(p, puertaAbierta(t));
  float sentada = smoothstep(26.0, 27.5, t);
  /* la vela, las libretas (en el piso del pasillo desde que se sienta) */
  vec3 pv = posVela(t);
  float dvl = length(p - (pv + vec3(0.0, 0.1, 0.0))) - 0.3;
  if (dvl < 0.05) r = u2(r, vela(p - pv, t)); else if (dvl < r.x) r = vec2(dvl, 0.0);
  if (sentada > 0.5) {
    float libretas = sdBox3(p - vec3(-1.25, 3.72, 1.7), vec3(0.08, 0.015, 0.11)) - 0.004;
    libretas = min(libretas, sdBox3(rotY(p - vec3(-1.6, 3.72, 0.85), 0.4), vec3(0.08, 0.012, 0.11)) - 0.004);
    if (libretas < r.x) r = vec2(libretas, 4.0);
  }
  /* la mesa de la abuela flotando abajo, de costado, y una silla */
  vec3 qm = p - vec3(0.2, nivelAgua(t) + 0.03 * sin(t * 1.5), -0.6); qm.xz = rot(0.5) * qm.xz; qm.xy = rot(0.06 * sin(t * 1.2)) * qm.xy;
  float mesa = sdBox3(qm, vec3(0.45, 0.02, 0.35)) - 0.01;
  for (int i = 0; i < 4; i++) { vec3 pata = vec3((i < 2 ? -0.4 : 0.4), 0.32, (mod(float(i), 2.0) < 0.5 ? -0.3 : 0.3)); mesa = min(mesa, sdBox3(qm - pata, vec3(0.025, 0.32, 0.025))); }
  if (mesa < r.x) r = vec2(mesa, 29.0);
  /* Ana, con la capucha del impermeable */
  vec3 pa = posAna(t);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    float baja = 1.0 - smoothstep(3.6, 4.0, t), empujada = smoothstep(19.5, 19.9, t) * (1.0 - smoothstep(20.9, 21.3, t));
    float a = mix(PI, PI, baja); a = mix(a, PI, 1.0); /* siempre de frente a +x: baja hacia +x y retrocede hacia -x */
    vec3 q = rotY(p - pa, a);
    Pose P = poseDePie(t * 2.0 * PI / 0.9, max(baja, empujada) * 0.7);
    float forcejeo = smoothstep(17.5, 18.0, t) * (1.0 - smoothstep(19.6, 20.0, t));
    float habla = smoothstep(3.5, 4.5, t) * (1.0 - smoothstep(9.5, 10.5, t));
    /* las manos: al bajar, una en el pasamanos; parada, caídas y cerradas; en el forcejeo, contra los brazos de Verónica */
    P.manoI = mix(P.manoI, vec3(-0.35, 1.25, -0.2), forcejeo); P.manoD = mix(P.manoD, vec3(-0.35, 1.2, 0.2), forcejeo);
    P.agarreI = mix(P.agarreI, vec3(-1.0, 0.0, 0.0), forcejeo); P.agarreD = mix(P.agarreD, vec3(-1.0, 0.0, 0.0), forcejeo);
    P.manoD = mix(P.manoD, vec3(-0.25, 1.05, 0.15), habla * (0.5 + 0.5 * sin(t * 2.0))); /* un gesto corto mientras habla */
    float inclina = 0.12 * forcejeo - 0.08 * empujada; P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina; P.homI.x -= inclina; P.homD.x -= inclina;
    P.pitch = -0.1 * baja + 0.05 * habla - 0.15 * forcejeo; P.yaw = 0.05 * sin(t * 0.7);
    P = resolver(P);
    vec2 v = persona(q, P, aspectoAna());
    /* la capucha: un casquete alrededor de la cabeza, abierto adelante */
    vec3 hc = q / 0.92 - P.cab;
    float capucha = max(length(hc * vec3(1.0, 0.95, 1.0) - vec3(0.02, 0.0, 0.0)) - 0.165, -(length(hc - vec3(0.02, 0.0, 0.0)) - 0.145));
    capucha = max(capucha, (P.cab.x - 0.07) - (q.x / 0.92)); /* abierta en la cara */
    capucha = min(capucha, sdCap(q / 0.92, P.cab + vec3(0.05, -0.15, -0.14), P.hom + vec3(-0.05, 0.0, -0.17), 0.05));
    capucha = min(capucha, sdCap(q / 0.92, P.cab + vec3(0.05, -0.15, 0.14), P.hom + vec3(-0.05, 0.0, 0.17), 0.05));
    v = u2(v, vec2(capucha * 0.92, 26.0));
    r = u2(r, v);
  } else if (da < r.x) r = vec2(da, 0.0);
  /* Verónica */
  vec3 pw = posVero(t);
  float dv = length(p - (pw + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    float sube = smoothstep(19.5, 19.9, t) * (1.0 - smoothstep(20.9, 21.3, t)), camina = smoothstep(23.5, 23.9, t) * (1.0 - smoothstep(26.2, 26.6, t));
    float cierra = smoothstep(21.0, 21.5, t) * (1.0 - smoothstep(23.0, 23.5, t));
    float a = 0.0; a = mix(a, PI * 0.5, smoothstep(20.8, 21.3, t)); a = mix(a, 0.0, smoothstep(23.4, 23.9, t)); a = mix(a, -PI, smoothstep(26.0, 26.8, t)); /* mira a Ana (-x); a la puerta (-z); camina a -x; sentada contra la pared del oeste mira a +x */
    vec3 q = rotY(p - pw, a);
    Pose P = poseDePie(t * 2.0 * PI / 0.85, max(sube, camina) * 0.7);
    float forcejeo = smoothstep(17.5, 18.0, t) * (1.0 - smoothstep(19.6, 20.0, t));
    float bloquea = smoothstep(10.0, 12.0, t) * (1.0 - smoothstep(17.3, 17.8, t));
    P = mezclarPose(P, brazosCruzados(P, 0.0), bloquea);
    P.manoI = mix(P.manoI, vec3(-0.42, 1.35, -0.17), forcejeo); P.manoD = mix(P.manoD, vec3(-0.42, 1.3, 0.17), forcejeo); /* las manos en los hombros de Ana */
    P.agarreI = mix(P.agarreI, vec3(-1.0, 0.0, 0.0), forcejeo); P.agarreD = mix(P.agarreD, vec3(-1.0, 0.0, 0.0), forcejeo);
    vec3 picaporte = rotY(vec3(-1.08, 4.65, 0.22) - pw, a), llave = rotY(vec3(-1.08, 4.58, 0.27) - pw, a);
    float enLlave = smoothstep(22.2, 22.6, t) * (1.0 - smoothstep(23.0, 23.4, t));
    P.manoD = mix(P.manoD, mix(picaporte, llave, enLlave), cierra); P.agarreD = mix(P.agarreD, vec3(0.0, 0.0, -1.0), cierra);
    vec3 velaL = rotY(posVela(t) - pw, a) + vec3(0.0, -0.02, 0.0);
    float conVela = smoothstep(19.0, 19.4, t) * (1.0 - smoothstep(22.3, 22.7, t));
    P.manoI = mix(P.manoI, velaL, conVela); P.agarreI = mix(P.agarreI, vec3(0.0, 1.0, 0.0), conVela);
    float inclina = 0.14 * forcejeo; P.pecho.x -= inclina * 0.6; P.hom.x -= inclina; P.cab.x -= inclina; P.homI.x -= inclina; P.homD.x -= inclina;
    P.pitch = -0.08 - 0.1 * forcejeo - 0.1 * cierra; P.yaw = 0.04 * sin(t * 0.5);
    /* sentada en el pasillo, la espalda contra la pared del fondo, las libretas al lado; mira la puerta de Ana */
    if (sentada > 0.0) {
      Pose S = poseSilla(); S.cad = vec3(0.12, 0.1, 0.0); S.pecho = vec3(0.1, 0.36, 0.0); S.hom = vec3(0.1, 0.56, 0.0); S.cab = vec3(0.08, 0.81, 0.0);
      S.homI = S.hom + vec3(0.0, -0.03, -0.18); S.homD = S.hom + vec3(0.0, -0.03, 0.18);
      S.rodI = vec3(-0.3, 0.42, -0.12); S.rodD = vec3(-0.3, 0.42, 0.12); S.pieI = vec3(-0.6, 0.05, -0.13); S.pieD = vec3(-0.62, 0.05, 0.13); /* las rodillas levantadas */
      S.manoI = vec3(-0.3, 0.45, -0.14); S.manoD = vec3(-0.3, 0.45, 0.14); S.codoI = vec3(-0.05, 0.4, -0.25); S.codoD = vec3(-0.05, 0.4, 0.25);
      S.pitch = -0.15 + 0.1 * smoothstep(31.0, 31.5, t); S.yaw = 0.0;
      P = mezclarPose(P, S, sentada);
    }
    P = resolver(P);
    vec2 v = persona(q, P, aspectoVeronica());
    r = u2(r, v);
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.3), 0.002 * sin(t * 0.9 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 cabA = posAna(t) + vec3(0.0, 1.67 * 0.92, 0.0), cabV = posVero(t) + vec3(0.0, 1.67 * 0.94, 0.0);
  if (t < 4.0) { float a = smoothstep(0.0, 4.0, t); ro = mix(vec3(1.55, 3.45, 0.75), vec3(1.5, 3.4, 0.8), a); obj = cabA + vec3(0.0, -0.3, 0.0); zoom = 1.3; }          /* desde el descanso, por detrás de Verónica: Ana que baja con la capucha */
  else if (t < 10.5) { float a = smoothstep(4.0, 10.5, t); ro = mix(vec3(1.55, 4.3, 1.75), vec3(1.5, 4.27, 1.7), a); obj = cabA + vec3(0.0, -0.05, 0.0); zoom = 1.9; }  /* Ana: «voy a lo de Elías» */
  else if (t < 17.3) { float a = smoothstep(10.5, 17.3, t); ro = mix(vec3(0.15, 4.25, 0.95), vec3(0.2, 4.23, 0.9), a); obj = cabV + vec3(0.0, -0.05, 0.0); zoom = 1.9; } /* Verónica: «nadie sale de esta casa» */
  else if (t < 19.6) { ro = vec3(1.7, 3.95, 1.85); obj = vec3(0.8, 3.85, 1.2); zoom = 1.0; }                                                                              /* el forcejeo, de costado */
  else if (t < 23.5) { float a = smoothstep(19.6, 23.5, t); ro = mix(vec3(0.7, 4.95, 1.5), vec3(0.4, 4.9, 1.45), a); obj = vec3(-1.25, 4.55, 0.4); zoom = 1.35; }       /* desde el pasillo: la empuja adentro, cierra, la llave */
  else if (t < 27.5) { float a = smoothstep(23.5, 27.5, t); ro = mix(vec3(0.6, 4.95, 0.55), vec3(0.4, 4.9, 0.6), a); obj = vec3(-1.45, 4.7, 1.1); zoom = 1.2; }           /* se aparta hasta la pared del rellano y se sienta */
  else { float a = smoothstep(27.5, 35.0, t); ro = mix(vec3(0.35, 4.5, 1.25), vec3(0.25, 4.45, 1.3), a); obj = vec3(-1.55, 4.2, 1.2); zoom = 1.7; }                       /* sentada contra la pared, la vela arriba, la puerta de Ana a la izquierda */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
