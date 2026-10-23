/* Escena 5: amanecer gris del sábado; desde la galería (el muelle ya está bajo el agua), Verónica mira a la otra orilla,
   donde un hombre rema una chata entre los sauces del recreo abandonado */
Clima clima(float t) { return Clima(0.38, 0.12, 0.9, 0.45, 0.045, 0.6, vec2(-0.9, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(-0.6, 0.08, -1.0)); }
float nivelAgua(float t) { return 1.0; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
float corte(float t) { return step(11.0, t); }
vec3 posChata(float t) { return vec3(-7.0 + 0.55 * t, 1.0, -26.5 + 0.05 * t); }
float remo(float t) { return sin(t * 2.0 * PI / 2.6); }
vec3 aChata(vec3 p, float t) {
  vec3 q = p - posChata(t);
  q.y -= 0.04 * sin(t * 1.5) + 0.02 * sin(t * 2.9 + q.x);
  q.yz = rot(0.04 * sin(t * 1.2)) * q.yz; q.xy = rot(0.02 * sin(t * 1.6 + 1.0)) * q.xy;
  return q;
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = orilla(p, t, -31.0, -1.0, 21.0, 0.6);   /* el recreo abandonado, enfrente */
  /* la casa, solo en la primera toma */
  if (corte(t) < 0.5) {
    vec2 m = casa(p, 1.0, 0.0, 0.0); if (m.x < r.x) r = m;
    vec3 pv = vec3(0.0, 1.2, -2.3);
    float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.4;
    if (dv < 0.2) {
      vec3 q = rotY(p - pv, PI * 0.5);           /* mira a -z */
      Pose P = poseDePie(0.0, 0.0);
      P.manoI = vec3(-0.28, 1.65, -0.2); P.codoI = vec3(-0.08, 1.35, -0.25); P.agarreI = vec3(0.0, -1.0, 0.0); /* apoyada en la baranda */
      P.manoD = vec3(-0.28, 1.65, 0.2); P.codoD = vec3(-0.08, 1.35, 0.25); P.agarreD = vec3(0.0, -1.0, 0.0);
      P.yaw = -0.25 + 0.15 * smoothstep(3.0, 8.0, t); P.pitch = -0.05;
      vec2 v = persona(q, P, aspectoVeronica()); if (v.x < r.x) r = v;
    } else if (dv < r.x) r = vec2(dv, 0.0);
  }
  /* la chata con el hombre, lejos */
  float db = length(p - (posChata(t) + vec3(0.0, 0.5, 0.0))) - 2.8;
  if (db < 0.2) {
    vec3 q = aChata(p, t);
    vec2 m = chata(q);
    float a = remo(t);
    Pose P = poseRemando(a);
    /* zurdo, rema «al revés»: la mano izquierda va más adelante y el cuerpo gira apenas */
    P.manoI.x -= 0.06; P.manoD.x += 0.04; P.yaw = 0.35; P.pitch = 0.1;
    m = u2(m, persona(q, P, aspectoMartin()));
    m = u2(m, vec2(remos(q, P, vec3(0.0, 0.46, -0.42), vec3(0.0, 0.46, 0.42), 2.1), 5.0));
    r = u2(r, m);
  } else if (db < r.x) r = vec2(db, 0.0);
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  vec3 q = aChata(pos, t);
  float estela = exp(-abs(q.z) * 2.5) * exp(-max(-q.x, 0.0) * 0.6) * step(q.x, 1.2) * 0.6 * sin(q.x * 18.0 - t * 6.0);
  float espuma = smoothstep(0.5, 0.3, abs(q.z)) * step(-3.0, q.x) * step(q.x, -1.2) * 0.3 * noise(q.xz * 5.0 + t * 2.0);
  /* hojas y ramas que lleva la corriente */
  vec2 h = pos.xz + vec2(0.9 * t, 0.0);
  float hojas = step(0.86, noise(h * 1.5)) * step(0.6, noise(h * 6.0 + 2.0)) * 0.7;
  return vec4(estela, espuma, estela * 0.5, hojas);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.1), 0.002 * sin(t * 0.8 + 1.0));
  if (corte(t) < 0.5) {
    /* detrás de Verónica, en la galería, por encima de su hombro hacia la otra orilla */
    float a = smoothstep(0.0, 11.0, t);
    ro = vec3(mix(0.7, 0.9, a), 2.55, -1.5);
    vec3 obj = vec3(mix(-2.5, -1.0, a), 1.5, -26.0);
    mirar(ro, obj, uv + tiemblo, mix(0.9, 1.15, a), 0.0, rd);
  } else {
    /* teleobjetivo sobre el hombre, desde el agua, siguiéndolo */
    vec3 c = posChata(t);
    ro = vec3(c.x - 9.0, 1.7, c.z + 7.5);
    mirar(ro, c + vec3(0.1, 0.8, 0.0), uv + tiemblo * 1.5, 2.6, 0.0, rd);
  }
}
