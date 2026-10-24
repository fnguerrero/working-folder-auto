/* Escena 6: sábado, 6.00. Verónica rema tras el hombre; la corriente la lleva, un tronco, el remo que se escapa, la chata
   gira y la casa pasa por delante con la galería a la altura del río; Ana en la galería con la soga. Cámara en la chata. */
#define NIVEL 1.1
Clima clima(float t) { return Clima(0.4, 0.1, 0.9, 0.4, 0.04, 0.6, vec2(-1.3, 0.1)); }
vec3 sunDir(float t) { return normalize(vec3(-0.6, 0.08, -1.0)); }
float nivelAgua(float t) { return NIVEL; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
float golpe(float t) { return smoothstep(9.3, 9.6, t); }
float giro(float t) { return 2.0 * PI * 1.35 * smoothstep(9.4, 14.5, t) + 0.3 * smoothstep(14.5, 22.0, t); }
vec3 posChata(float t) {
  float x = -13.0 + 1.1 * t - 0.4 * smoothstep(9.3, 10.0, t);
  float z = -6.2 - 0.6 * smoothstep(9.0, 16.0, t) + 1.4 * smoothstep(16.0, 22.0, t);
  return vec3(x, NIVEL - 0.05 - 0.03 * sin(t * 1.9), z);
}
mat2 rotChata(float t) { return rot(PI + giro(t)); } /* mira a -x (rema contra la corriente) hasta que el tronco la hace girar */
vec3 aChata(vec3 p, float t) {
  vec3 q = p - posChata(t);
  q.xz = rotChata(t) * q.xz;
  q.yz = rot(0.06 * sin(t * 1.3) + 0.25 * golpe(t) * exp(-(t - 9.3) * 1.5) * sin((t - 9.3) * 9.0)) * q.yz;
  q.xy = rot(0.04 * sin(t * 1.7 + 1.0)) * q.xy;
  return q;
}
vec3 deChata(vec3 q, float t) {
  q.xy = rot(-0.04 * sin(t * 1.7 + 1.0)) * q.xy;
  q.yz = rot(-(0.06 * sin(t * 1.3) + 0.25 * golpe(t) * exp(-(t - 9.3) * 1.5) * sin((t - 9.3) * 9.0))) * q.yz;
  q.xz = rot(-(PI + giro(t))) * q.xz;
  return q + posChata(t);
}
float remo(float t) { return sin(t * 2.0 * PI / 1.9 + 0.4 * sin(t * 2.3)); }
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 1.0, 0.0, 0.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.6)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.6)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  r = u2(r, orilla(p, t, -31.0, -1.0, 21.0, 0.6));
  /* la mesa de la abuela flotando patas arriba contra la baranda */
  vec3 qm = p - vec3(1.2, NIVEL + 0.02 + 0.03 * sin(t * 1.5), -2.5); qm.xz = rot(0.4) * qm.xz; qm.xy = rot(0.05 * sin(t * 1.2)) * qm.xy;
  float dmesa = length(qm) - 0.9;
  if (dmesa < 0.2) {
    float mesa = sdBox3(qm, vec3(0.45, 0.02, 0.35)) - 0.01;
    for (int i = 0; i < 4; i++) { vec3 pata = vec3((i < 2 ? -0.4 : 0.4), 0.32, (mod(float(i), 2.0) < 0.5 ? -0.3 : 0.3)); mesa = min(mesa, sdBox3(qm - pata, vec3(0.025, 0.32, 0.025))); }
    r = u2(r, vec2(mesa, 29.0));
  } else if (dmesa < r.x) r = vec2(dmesa, 0.0);
  /* el tronco que viene con la corriente */
  vec3 qt = p - vec3(-3.2 - 0.9 * max(t - 9.3, 0.0) * 0.5 + 0.9 * t * 0.0, NIVEL - 0.1, -6.9); qt = vec3(qt.x - (-0.3 * t), qt.y, qt.z);
  qt.xz = rot(0.4 + 0.1 * sin(t)) * qt.xz;
  float tronco = sdCap(qt, vec3(-1.3, 0.0, 0.0), vec3(1.3, 0.0, 0.0), 0.17 + 0.03 * noise(vec2(qt.x * 4.0, atan(qt.y, qt.z) * 3.0)));
  tronco = min(tronco, sdCap(qt, vec3(0.6, 0.0, 0.0), vec3(1.1, 0.35, 0.25), 0.05));
  r = u2(r, vec2(tronco, 16.0));
  /* Ana en la galería con la soga, en la segunda mitad */
  if (t > 12.0) {
    vec3 pa = vec3(-0.3, 1.2, -2.3);
    float da = length(p - (pa + vec3(0.0, 1.0, 0.0))) - 1.3;
    if (da < 0.2) {
      vec3 q = rotY(p - pa, PI * 0.5);
      Pose P = poseDePie(0.0, 0.0);
      float tira = sin(t * 2.0 * PI / 1.3);
      P.manoI = vec3(-0.4 + 0.1 * tira, 1.4, -0.15); P.manoD = vec3(-0.25 - 0.1 * tira, 1.25, 0.15); P.codoI = vec3(-0.15, 1.25, -0.3); P.codoD = vec3(-0.05, 1.15, 0.3);
      P.agarreI = vec3(-0.3, -1.0, 0.0); P.agarreD = vec3(-0.3, -1.0, 0.0); P.pitch = -0.3; P.pecho.x -= 0.05; P.hom.x -= 0.1; P.cab.x -= 0.12; P.homI.x -= 0.1; P.homD.x -= 0.1;
      r = u2(r, persona(q, P, aspectoAna()));
    } else if (da < r.x) r = vec2(da, 0.0);
    /* la soga, de su mano a la proa de la chata */
    vec3 a = vec3(-0.65, 2.55, -2.65); vec3 b = deChata(vec3(1.25, 0.35, 0.0), t);
    float lazo = smoothstep(14.0, 15.5, t);
    vec3 bb = mix(a + vec3(0.0, -0.6, -0.5), b, lazo);
    vec3 medio = (a + bb) * 0.5 - vec3(0.0, 0.35 * (1.0 - lazo) + 0.12, 0.0);
    float soga = min(sdCap(p, a, medio, 0.012), sdCap(p, medio, bb, 0.012));
    r = u2(r, vec2(soga, 36.0));
  }
  /* la chata con Verónica remando; después del golpe pierde el remo izquierdo */
  vec3 pc = posChata(t);
  float dc = length(p - (pc + vec3(0.0, 0.4, 0.0))) - 2.9;
  if (dc < 0.2) {
    vec3 q = aChata(p, t);
    vec2 m = chata(q);
    float a = remo(t) * (1.0 - golpe(t) * 0.7);
    Pose P = poseRemando(a);
    float perdido = smoothstep(9.5, 10.5, t);
    /* sin remo, la mano izquierda se agarra de la borda y el cuerpo se encoge */
    P.manoI = mix(P.manoI, vec3(0.35, 0.42, -0.36), perdido); P.codoI = mix(P.codoI, vec3(0.2, 0.55, -0.3), perdido);
    P.cab.y -= 0.05 * perdido; P.pitch = 0.35 * perdido - 0.1; P.yaw = 1.25 - 0.2 * sin(t * 0.7) - 0.6 * perdido; /* mira por encima del hombro derecho, hacia donde va */
    m = u2(m, persona(q, P, aspectoVeronica()));
    vec3 chumI = vec3(0.0, 0.46, -0.42), chumD = vec3(0.0, 0.46, 0.42);
    vec3 dD = normalize(chumD - P.manoD); vec3 palaD = chumD + dD * 2.1;
    float remoD = min(sdCap(q, P.manoD, palaD, 0.025), sdCap(q, palaD - dD * 0.45, palaD, 0.06));
    m = u2(m, vec2(remoD, 5.0));
    if (perdido < 0.99) { vec3 dI = normalize(chumI - P.manoI); vec3 palaI = chumI + dI * 2.1; float remoI = min(sdCap(q, P.manoI, palaI, 0.025), sdCap(q, palaI - dI * 0.45, palaI, 0.06)); m = u2(m, vec2(remoI * (1.0 - perdido) + perdido * 1e2, 5.0)); }
    r = u2(r, m);
  } else if (dc < r.x) r = vec2(dc, 0.0);
  /* el remo perdido, flotando lejos */
  if (t > 9.5) { vec3 qr = p - (pc + vec3(-1.5 - 0.8 * (t - 9.5), 0.02, 0.9 + 0.3 * (t - 9.5))); qr.xz = rot(0.8 + 0.2 * t) * qr.xz; float rl = sdCap(qr, vec3(-1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), 0.025); r = u2(r, vec2(rl, 5.0)); }
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  vec3 q = aChata(pos, t);
  float estela = (1.0 - golpe(t)) * exp(-abs(q.z) * 2.5) * exp(-max(-q.x, 0.0) * 0.6) * step(q.x, 1.2) * 0.6 * sin(q.x * 18.0 - t * 6.0);
  float esp = smoothstep(0.55, 0.3, abs(q.z)) * step(-1.5, q.x) * step(q.x, 1.5) * 0.35 * noise(q.xz * 5.0 + t * 3.0);
  esp += golpe(t) * exp(-(t - 9.3) * 0.8) * smoothstep(2.0, 0.5, length(pos.xz - posChata(t).xz)) * noise(pos.xz * 5.0 + t * 7.0);
  vec2 h = pos.xz + vec2(1.3 * t, 0.0);
  float hojas = step(0.84, noise(h * 1.5)) * step(0.55, noise(h * 6.0 + 2.0)) * 0.7;
  return vec4(estela, esp, estela * 0.5, hojas);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  /* en la popa de la chata, bajo, mirando hacia adelante por encima de Verónica; la cámara gira con la chata */
  vec3 roL = vec3(-1.3, 0.72, -0.5), objL = vec3(1.2, 0.6, 0.25);
  ro = deChata(roL, t); vec3 obj = deChata(objL, t);
  vec2 tiemblo = vec2(0.004 * sin(t * 1.3) + 0.01 * golpe(t) * exp(-(t - 9.3) * 2.0) * sin((t - 9.3) * 25.0), 0.004 * sin(t * 0.9 + 1.0));
  mirar(ro, obj, uv + tiemblo, 1.15, 0.03 * sin(t * 1.3), rd);
}
