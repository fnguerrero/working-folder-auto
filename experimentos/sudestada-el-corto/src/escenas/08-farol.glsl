/* Escena 8: el muelle de Elías a las 4.20. Ana agarrada a un poste con el agua al pecho; Verónica llega en la chata y la chata
   se da vuelta; la puerta de chapa del galpón se abre y sale un farol que baja hasta el agua; el Negro ladra en el pallet;
   el que trae el farol lo cuelga del gancho del poste y la luz cae sobre los tres. */
#define NIVEL 1.35
Clima clima(float t) { return Clima(0.0, 0.0, 0.9, 0.55, 0.07, 1.0, vec2(-1.2, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return NIVEL; }
float suelo(vec3 p) { return -0.3 + 0.28 * clamp(p.z, 0.0, 5.0) + 0.05 * fbm4(p.xz * 1.5); }
/* el farol: adentro del galpón, baja a la puerta, viene por el agua en alto y queda colgado del gancho del poste */
float abrePuerta(float t) { return smoothstep(8.5, 9.8, t); }
vec3 posMartin(float t) {
  float a = smoothstep(10.5, 17.5, t);
  vec3 p = vec3(mix(0.25, 0.35, a), 0.0, mix(4.85, 2.05, a));
  p.y = suelo(p) - 0.02;
  return p;
}
vec3 posFarol(float t) {
  vec3 m = posMartin(t);
  vec3 enMano = m + vec3(-0.3, 1.72, -0.35) + vec3(0.02 * sin(t * 3.0), 0.03 * sin(t * 2.3), 0.03 * sin(t * 2.7));
  vec3 adentro = vec3(1.2, 1.9, 6.5);
  vec3 gancho = vec3(0.12, 2.1, 1.05);
  vec3 p = mix(adentro, m + vec3(-0.28, 1.2, -0.3), smoothstep(8.8, 10.2, t));
  p = mix(p, enMano, smoothstep(10.2, 10.8, t));
  p = mix(p, gancho, smoothstep(17.6, 19.0, t));
  return p;
}
Luz luz(int i, float t) {
  if (i == 0) return Luz(posFarol(t) + vec3(0.0, 0.1, 0.0), vec3(1.0, 0.72, 0.38), 3.2 * (0.9 + 0.1 * noise(vec2(t * 9.0, 0.0))) * smoothstep(8.6, 9.2, t));
  return Luz(vec3(-1.0, 2.0, 7.0), vec3(1.0, 0.75, 0.45), 0.3 * smoothstep(8.6, 9.4, t)); /* el resplandor adentro del galpón */
}
/* la chata de Verónica: llega remando desde la izquierda, se da vuelta a los 4.2 y queda panza arriba yéndose con la corriente */
float vuelco(float t) { return smoothstep(4.2, 5.1, t); }
vec3 posChata(float t) {
  float v = vuelco(t);
  vec3 p = vec3(-9.0 + 1.75 * min(t, 4.2) + 0.45 * max(t - 5.1, 0.0), NIVEL - 0.05 - 0.35 * v + 0.25 * sin(v * PI), -0.6 + 0.3 * smoothstep(5.0, 12.0, t));
  return p;
}
vec3 aChata(vec3 p, float t) {
  vec3 q = p - posChata(t);
  float v = vuelco(t);
  q.yz = rot(PI * v + 0.05 * sin(t * 1.4)) * q.yz;
  q.y -= 0.03 * sin(t * 1.9 + q.x);
  q.xy = rot(0.03 * sin(t * 1.6) + 0.15 * sin(v * PI)) * q.xy;
  return q;
}
float remo(float t) { return sin(t * 2.0 * PI / 1.9 + 0.3 * sin(t * 1.7)); }
vec2 galpon(vec3 p, float t) {
  vec3 g = p - vec3(0.0, 1.1, 7.0);
  float caja = sdBox3(g - vec3(0.0, 1.5, 0.0), vec3(2.6, 1.5, 2.0));
  caja = max(caja, -sdBox3(g - vec3(0.0, 1.5, 0.0), vec3(2.5, 1.45, 1.9)));     /* hueco */
  caja = max(caja, -sdBox3(g - vec3(0.0, 1.05, -2.0), vec3(0.85, 1.1, 0.3)));    /* el hueco de la puerta */
  float techo = max(max((g.y - 3.0) + 0.3 * abs(g.x) - 0.85, -(g.y - 2.98)), max(abs(g.x) - 2.8, abs(g.z) - 2.3));
  vec2 r = vec2(min(caja, techo), 32.0);
  /* la puerta corrediza: corre hacia +x por un riel */
  float ab = abrePuerta(t);
  float puerta = sdBox3(g - vec3(1.72 * ab, 1.05, -2.1), vec3(0.88, 1.1, 0.03));
  float riel = sdBox3(g - vec3(0.9, 2.25, -2.1), vec3(1.9, 0.04, 0.06));
  if (min(puerta, riel) < r.x) r = vec2(min(puerta, riel), 32.0);
  return r;
}
vec2 mapaMundo(vec3 p, float t) {
  float s = suelo(p);
  vec2 r = vec2(p.y - s, 17.0);
  /* el galpón y, más alta y a la izquierda, la casa de Elías, apagada */
  float dg = length(p - vec3(0.0, 2.5, 7.0)) - 4.5;
  if (dg < 0.2) r = u2(r, galpon(p, t)); else if (dg < r.x) r = vec2(dg, 0.0);
  float dcasa = length(p - vec3(-9.0, 4.5, 12.0)) - 7.5;
  if (dcasa < 0.2) r = u2(r, casa(p - vec3(-9.0, 1.2, 12.0), 0.0, 0.0, 0.0)); else if (dcasa < r.x) r = vec2(dcasa, 0.0);
  /* el muelle hundido: tablas bajo el agua y seis postes altos con un gancho */
  float muelle = sdBox3(p - vec3(0.0, 0.3, 0.6), vec3(2.0, 0.025, 1.0));
  float postes = 1e3;
  for (int i = 0; i < 3; i++) { float x = -1.5 + 1.5 * float(i); postes = min(postes, min(sdCil(p - vec3(x, 1.1, 0.0), 1.25, 0.06), sdCil(p - vec3(x, 1.1, 1.2), 1.25, 0.06))); }
  float gancho = sdCap(p, vec3(0.0, 2.3, 1.2), vec3(0.12, 2.38, 1.05), 0.012);
  r = u2(r, vec2(min(muelle, min(postes, gancho)), 13.0));
  /* el pallet atado a la puerta, flotando, con el Negro parado encima */
  vec3 qp = p - vec3(1.7, NIVEL - 0.04 + 0.03 * sin(t * 1.7), 4.35); qp.xy = rot(0.04 * sin(t * 1.3)) * qp.xy;
  float dp = length(qp - vec3(0.0, 0.3, 0.0)) - 1.3;
  if (dp < 0.2) {
    float pallet = sdBox3(qp, vec3(0.6, 0.06, 0.4));
    pallet = max(pallet, -min(sdBox3(qp - vec3(-0.3, 0.0, 0.0), vec3(0.06, 0.03, 0.5)), sdBox3(qp - vec3(0.3, 0.0, 0.0), vec3(0.06, 0.03, 0.5))));
    float ladra = smoothstep(9.3, 9.6, t) * (0.5 + 0.5 * sin(t * 14.0)) * step(fract(t * 0.5), 0.6);
    vec2 d = perro(rotY(qp - vec3(0.05, 0.06, -0.05), PI * 0.5 + 0.3), ladra);
    r = u2(r, u2(vec2(pallet, 33.0), d));
  } else if (dp < r.x) r = vec2(dp, 0.0);
  /* la chata y Verónica remando hasta el vuelco */
  vec3 pc = posChata(t);
  float dc = length(p - (pc + vec3(0.0, 0.3, 0.0))) - 2.7;
  if (dc < 0.2) {
    vec3 q = aChata(p, t);
    vec2 m = chata(q);
    if (t < 4.6) {
      Pose P = poseRemando(remo(t));
      m = u2(m, persona(q, P, aspectoVeronica()));
      m = u2(m, vec2(remos(q, P, vec3(0.0, 0.46, -0.42), vec3(0.0, 0.46, 0.42), 2.1), 5.0));
    }
    r = u2(r, m);
  } else if (dc < r.x) r = vec2(dc, 0.0);
  /* Ana, agarrada al poste de adelante; Verónica sale del agua al lado, del otro lado del poste */
  vec3 pa = vec3(0.38, suelo(vec3(0.38, 0.0, 1.25)) + 0.1, 1.25);
  float da = length(p - (pa + vec3(0.0, 1.0, 0.0))) - 1.2;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, PI);  /* mira al poste, hacia -x */
    Pose P = poseDePie(0.0, 0.0);
    P.manoI = vec3(-0.36, 1.55, 0.05); P.manoD = vec3(-0.36, 1.45, -0.05); P.codoI = vec3(-0.2, 1.3, -0.25); P.codoD = vec3(-0.2, 1.2, 0.25);
    P.agarreI = vec3(-1.0, 0.0, 0.0); P.agarreD = vec3(-1.0, 0.0, 0.0);
    P.cab.y += 0.04 * sin(t * 1.7); P.pitch = 0.25 - 0.2 * smoothstep(17.0, 19.0, t); P.yaw = -0.3 + 0.5 * smoothstep(9.0, 11.0, t);
    r = u2(r, persona(q, P, aspectoAna()));
  } else if (da < r.x) r = vec2(da, 0.0);
  if (t > 5.0) {
    float sube = smoothstep(5.2, 6.4, t);
    vec3 pv = vec3(-0.45, suelo(vec3(-0.45, 0.0, 1.3)) + 0.1 - 0.9 * (1.0 - sube), 1.3);
    float dv = length(p - (pv + vec3(0.0, 1.0, 0.0))) - 1.2;
    if (dv < 0.2) {
      vec3 q = rotY(p - pv, 0.0); /* mira a -x: hacia el poste y Ana... el poste le queda atrás: gira */
      q = rotY(p - pv, PI * 0.9);
      Pose P = poseDePie(0.0, 0.0);
      P.manoI = vec3(-0.3, 1.5, -0.15); P.manoD = vec3(-0.32, 1.4, 0.12); P.codoI = vec3(-0.15, 1.25, -0.28); P.codoD = vec3(-0.15, 1.15, 0.28);
      P.agarreI = vec3(-1.0, 0.0, 0.0); P.agarreD = vec3(-1.0, 0.0, 0.0);
      P.cab.y += 0.03 * sin(t * 2.1 + 1.0); P.yaw = 0.5 * smoothstep(9.0, 11.0, t) - 0.4 * smoothstep(19.0, 21.0, t); P.pitch = 0.2;
      r = u2(r, persona(q, P, aspectoVeronica()));
    } else if (dv < r.x) r = vec2(dv, 0.0);
  }
  /* Martín: sale del galpón con el farol en alto, viene con el agua al pecho y lo cuelga del gancho */
  if (t > 8.9) {
    vec3 pm = posMartin(t);
    float dm = length(p - (pm + vec3(0.0, 1.2, 0.0))) - 1.5;
    if (dm < 0.2) {
      vec3 q = rotY(p - pm, PI * 0.5); /* mira a -z */
      float cam = smoothstep(10.5, 11.0, t) * (1.0 - smoothstep(17.0, 17.5, t));
      float fase = t * 2.0 * PI / 1.6;
      Pose P = poseDePie(fase, cam * 0.5);
      float alto = smoothstep(10.2, 10.8, t) * (1.0 - smoothstep(18.6, 19.4, t));
      vec3 enMano = vec3(-0.35, 2.0, 0.3), colgando = vec3(-0.5, 1.5, 0.28);
      P.manoD = mix(vec3(-0.3, 1.25, 0.28), mix(colgando, enMano, alto), smoothstep(9.0, 9.4, t));
      P.manoD = mix(P.manoD, vec3(-0.3, 1.3, 0.25), smoothstep(19.0, 19.8, t));
      P.codoD = mix(P.homD + vec3(-0.1, -0.3, 0.1), vec3(-0.18, 1.62, 0.35), alto); P.agarreD = vec3(0.0, 1.0, 0.0);
      /* el brazo izquierdo abre el agua */
      P.manoI = vec3(-0.45 - 0.1 * sin(fase * 0.5) * cam, 1.25, -0.3); P.codoI = vec3(-0.2, 1.3, -0.3); P.agarreI = vec3(-1.0, 0.0, 0.0);
      P.yaw = 0.15 * sin(t * 0.8); P.pitch = -0.1 + 0.3 * smoothstep(19.0, 21.0, t);
      vec2 m = persona(q, P, aspectoMartin());
      r = u2(r, m);
    } else if (dm < r.x) r = vec2(dm, 0.0);
  }
  /* el farol, con su asa, donde esté */
  vec3 pf = posFarol(t);
  float df = length(p - (pf + vec3(0.0, 0.12, 0.0))) - 0.45;
  if (df < 0.2) { vec3 qf = p - pf; qf.xz = rot(t * 0.3) * qf.xz; r = u2(r, farol(qf)); } else if (df < r.x) r = vec2(df, 0.0);
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  /* espuma contra los postes y la chata, y hojas que pasan */
  float esp = 0.0;
  for (int i = 0; i < 3; i++) { float x = -1.5 + 1.5 * float(i); esp += smoothstep(0.35, 0.08, length(pos.xz - vec2(x, 0.0))) + smoothstep(0.35, 0.08, length(pos.xz - vec2(x, 1.2))); }
  vec3 q = aChata(pos, t);
  esp += smoothstep(0.55, 0.3, abs(q.z)) * step(-1.5, q.x) * step(q.x, 1.5) * 0.4 * noise(q.xz * 5.0 + t * 3.0);
  esp += (1.0 - smoothstep(4.2, 7.0, t)) * smoothstep(4.15, 4.5, t) * smoothstep(2.5, 0.5, length(pos.xz - posChata(t).xz)) * noise(pos.xz * 4.0 + t * 6.0) * 1.5;
  float estela = step(t, 4.3) * exp(-abs(q.z) * 2.5) * exp(-max(-q.x, 0.0) * 0.6) * step(q.x, 1.2) * 0.6 * sin(q.x * 18.0 - t * 6.0);
  vec2 h = pos.xz + vec2(1.2 * t, 0.0);
  float hojas = step(0.85, noise(h * 1.5)) * step(0.55, noise(h * 6.0 + 2.0)) * 0.7;
  return vec4(estela, esp * (0.4 + 0.6 * noise(pos.xz * 7.0 + t * 4.0)), estela * 0.5, hojas);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.003 * sin(t * 1.4) + 0.002 * sin(t * 3.1), 0.004 * sin(t * 1.1 + 1.0));
  float a = smoothstep(8.0, 19.0, t), b = smoothstep(19.5, 24.0, t);
  /* desde el agua, a la izquierda del muelle; se acerca despacio mientras viene el farol; al final, la cara de Martín bajo la luz */
  vec3 ro1 = mix(vec3(-3.6, 1.95, -2.6), vec3(-2.2, 1.85, -1.2), a);
  vec3 obj1 = mix(vec3(0.3, 1.7, 2.5), vec3(0.3, 1.8, 2.2), a);
  vec3 ro2 = vec3(-0.75, 1.85, 0.35), obj2 = vec3(0.3, 1.75, 2.0);
  ro = mix(ro1, ro2, b); vec3 obj = mix(obj1, obj2, b);
  mirar(ro, obj, uv + tiemblo, mix(1.25, 1.9, b), 0.0, rd);
}
