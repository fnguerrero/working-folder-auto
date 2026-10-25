/* Escena 10: sábado al mediodía. Un semirrígido amarrado al muelle hundido, con el motor al ralentí; Acuña, de camisa celeste y seco de
   pies, en la galería con el agua abajo; Verónica en la puerta. «La escritura es el martes a las once. Si no, la seña doble.»
   «¿Cuándo lo vio por última vez?» Al final él vuelve hacia la escalera. */
Clima clima(float t) { return Clima(0.62, 0.0, 0.97, 0.22, 0.03, 0.45, vec2(-0.75, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.3, 0.6, 0.5)); }
float nivelAgua(float t) { return 1.08 + 0.01 * sin(t * 1.7); } /* el muelle (0,3) hundido, la galería (1,2) con el agua abajo */
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec4 aguaExtra(vec3 pos, float t) {
  /* la corriente contra los postes y la estela del motor al ralentí, detrás del semirrígido */
  vec2 h = pos.xz + vec2(0.9 * t, 0.0);
  float basura = step(0.9, noise(h * 1.3)) * step(0.5, noise(h * 5.0 + 1.0)) * 0.5;
  float estela = smoothstep(0.6, 0.0, length(pos.xz - vec2(3.7, -5.4))) * (0.5 + 0.5 * noise(pos.xz * 12.0 + t * 4.0));
  return vec4(0.0, estela * 0.8, 0.0, basura);
}
vec3 posAcuna(float t) { return mix(vec3(0.35, 1.2, -2.3), vec3(0.15, 1.2, -2.55), smoothstep(30.5, 33.5, t)); }
float dirAcuna(float t) { return mix(-PI * 0.5, PI * 0.5 - 0.6, smoothstep(30.0, 31.5, t)); } /* mira a la puerta (+z); al final se da vuelta hacia la escalera */
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 0.0, 1.0, 0.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.45)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.45)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  float alto = 0.15 + 0.2 * smoothstep(-1.0, 3.0, p.z) + 0.06 * fbm4(p.xz * 1.5);
  float tierra = smax(p.y - alto, -(p.z + 0.5 + 0.8 * noise(p.xx * 0.4)), 0.8);
  r = u2(r, vec2(tierra, 17.0));
  /* el semirrígido, amarrado al poste de la esquina del muelle (que asoma apenas), con la proa al muelle */
  vec3 qs = p - vec3(2.3, 1.08, -5.3); qs.y += 0.03 * sin(t * 1.3 + 1.0); qs.xz = rot(0.35) * qs.xz; qs.xy = rot(0.02 * sin(t * 1.1)) * qs.xy; qs.yz = rot(0.025 * sin(t * 0.9)) * qs.yz;
  float dsr = length(qs - vec3(0.0, 0.3, 0.0)) - 3.0;
  if (dsr < 0.2) { vec2 sr = semirrigido(vec3(-qs.x, qs.y, qs.z) / 0.85); sr.x *= 0.85; r = u2(r, sr); } else if (dsr < r.x) r = vec2(dsr, 0.0); /* un semirrígido de 3,9 m */
  float soga = sdCap(p, vec3(0.4, 0.52, -4.5), vec3(0.75, 1.4, -4.85), 0.012);
  if (soga < r.x) r = vec2(soga, 5.0);
  /* la chata de Martín, atada a la baranda, flotando alto */
  vec3 qc = p - vec3(-2.6, 1.06, -3.6); qc.y += 0.02 * sin(t * 1.3); qc.xy = rot(0.02 * sin(t * 1.1)) * qc.xy;
  float dc = length(qc - vec3(0.0, 0.3, 0.0)) - 1.8;
  if (dc < 0.2) r = u2(r, chata(qc)); else if (dc < r.x) r = vec2(dc, 0.0);
  /* Acuña, en la galería frente a la puerta: parado derecho, una mano en el bolsillo, la otra explica */
  vec3 pa = posAcuna(t);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, dirAcuna(t));
    float paso = smoothstep(30.5, 31.0, t) * (1.0 - smoothstep(33.0, 33.5, t));
    Pose P = poseDePie(t * 2.0 * PI / 0.8, paso);
    float habla = smoothstep(4.5, 5.5, t) * (1.0 - smoothstep(12.5, 13.5, t)) + smoothstep(18.0, 19.0, t) * (1.0 - smoothstep(24.0, 25.0, t));
    float gesto = 0.5 + 0.5 * sin(t * 2.3);
    P.manoI = mix(P.manoI, vec3(-0.08, 0.86, -0.19), 1.0 - paso); /* la izquierda en el bolsillo */
    P.manoD = mix(P.manoD, mix(vec3(-0.1, 0.9, 0.2), vec3(-0.3, 1.1 + 0.08 * gesto, 0.1 + 0.05 * gesto), habla), 1.0 - paso); P.agarreD = vec3(0.0, 0.0, -1.0);
    P.codoD = P.homD + vec3(-0.02, -0.26, 0.08); P.codoI = vec3(0.1, 1.1, -0.26);
    P.pitch = 0.05 - 0.08 * smoothstep(14.5, 15.5, t) * (1.0 - smoothstep(18.0, 19.0, t)); P.yaw = 0.06 * sin(t * 0.6) * habla;
    r = u2(r, persona(q, P, aspectoAcuna()));
  } else if (da < r.x) r = vec2(da, 0.0);
  /* Verónica, en el vano de la puerta, de brazos cruzados */
  vec3 pv = vec3(0.05, 1.2, -1.45);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, PI * 0.5 + 0.1);
    Pose P = poseDePie(0.0, 0.0);
    P = brazosCruzados(P, 0.015 * sin(t * 0.8));
    P.pitch = -0.05 + 0.05 * smoothstep(24.5, 26.0, t); P.yaw = 0.04 * sin(t * 0.5) - 0.4 * smoothstep(30.5, 31.5, t); /* al final mira hacia el río */
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0012 * sin(t * 1.1), 0.0016 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 cabA = posAcuna(t) + vec3(0.0, 1.62, 0.0), cabV = vec3(0.05, 1.2 + 1.67 * 0.94, -1.45);
  if (t < 5.0) { float a = smoothstep(0.0, 5.0, t); ro = mix(vec3(6.4, 2.2, -10.6), vec3(6.1, 2.15, -10.2), a); obj = vec3(0.6, 1.7, -3.2); zoom = 1.5; }                /* desde el agua: el semirrígido, el muelle hundido, los dos en la galería */
  else if (t < 13.5) { float a = smoothstep(5.0, 13.5, t); ro = mix(vec3(-0.45, 2.75, -1.7), vec3(-0.4, 2.72, -1.75), a); obj = cabA + vec3(0.0, -0.05, 0.0); zoom = 1.9; } /* Acuña, por encima del hombro de ella */
  else if (t < 18.0) { ro = vec3(0.8, 2.7, -2.5); obj = cabV + vec3(0.0, -0.05, 0.0); zoom = 2.0; }                                                                       /* Verónica en la puerta */
  else if (t < 24.5) { float a = smoothstep(18.0, 24.5, t); ro = mix(vec3(-0.5, 2.7, -1.6), vec3(-0.55, 2.68, -1.65), a); obj = cabA + vec3(0.0, -0.05, 0.0); zoom = 2.1; }  /* Acuña, más cerca */
  else if (t < 30.0) { float a = smoothstep(24.5, 30.0, t); ro = mix(vec3(0.75, 2.72, -2.45), vec3(0.7, 2.7, -2.4), a); obj = cabV + vec3(0.0, -0.06, 0.0); zoom = 2.3; }   /* ella, callada: «Martín estaba vivo» */
  else { float a = smoothstep(30.0, 35.0, t); ro = mix(vec3(5.4, 2.1, -9.8), vec3(5.2, 2.05, -9.5), a); obj = vec3(0.4, 1.75, -3.0); zoom = 1.5; }                        /* otra vez desde el agua: él va a la escalera */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
