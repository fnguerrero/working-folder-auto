/* Escena 1: la lancha colectiva entra al arroyo del Fraile, jueves al mediodía, cielo gris de pared */
Clima clima(float t) { return Clima(0.85, 0.0, 0.9, 0.0, 0.022, 0.35, vec2(-0.4, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.3, 0.6, 0.5)); }
float nivelAgua(float t) { return 0.0; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec3 posLancha(float t) { return vec3(34.0 - 3.1 * t, 0.0 - 0.02 * sin(t * 1.1), 8.0); }
/* al marco local de la lancha: va hacia -x, la proa local (+x) apunta a -x del mundo */
vec3 aLancha(vec3 p, float t) {
  vec3 q = p - posLancha(t); q.x = -q.x; q.z = -q.z;
  q.xy = rot(0.012 * sin(t * 0.9)) * q.xy; q.yz = rot(0.02 * sin(t * 0.7 + 1.0)) * q.yz;
  return q;
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = orilla(p, t, 23.0, 1.0, 1.0, 0.3);          /* la orilla de enfrente */
  r = u2(r, orilla(p, t, -13.0, -1.0, 11.0, 0.3));      /* la de acá */
  float db = length(p - (posLancha(t) + vec3(0.0, 1.5, 0.0))) - 6.2;
  if (db < 0.3) {
    vec3 q = aLancha(p, t);
    vec2 m = lancha(q);
    /* Verónica, sentada junto a la ventana del lado de acá, con la bolsa en la falda */
    vec3 qv = q - vec3(-1.2, 0.78, 0.7); qv.x = -qv.x; qv.z = -qv.z;
    if (length(qv - vec3(0.0, 0.7, 0.0)) < 1.3) {
      Pose P = poseSentada(); P.yaw = 0.35 * smoothstep(3.0, 5.0, t) - 0.25 * smoothstep(8.0, 10.0, t); P.pitch = -0.1;
      vec2 v = persona(qv, P, aspectoVeronica());
      float bolsa = sdBox3(qv - vec3(-0.3, 0.6, 0.0), vec3(0.12, 0.14, 0.2)) - 0.03;
      v = u2(v, vec2(bolsa, 35.0));
      m = u2(m, v);
    }
    /* otro pasajero más adelante, mirando al frente, y el lanchero de pie en la timonera */
    vec3 qp = q - vec3(0.8, 0.78, -0.7); qp.x = -qp.x; qp.z = -qp.z;
    if (length(qp - vec3(0.0, 0.7, 0.0)) < 1.3) m = u2(m, persona(qp, poseSentada(), Aspecto(0.0, 0.3, 1.0, 1.0, 0.0, 0.5, 2.0, 1.02)));
    vec3 ql = q - vec3(2.75, 0.75, 0.0); ql.x = -ql.x; ql.z = -ql.z;
    if (length(ql - vec3(0.0, 0.9, 0.0)) < 1.3) { Pose L = poseDePie(0.0, 0.0); L.manoI = vec3(-0.35, 1.05, -0.18); L.manoD = vec3(-0.35, 1.05, 0.18); L.codoI = vec3(-0.12, 1.1, -0.26); L.codoD = vec3(-0.12, 1.1, 0.26); m = u2(m, persona(ql, L, Aspecto(0.0, 0.6, 1.0, 1.0, 0.0, 0.7, 41.0, 1.0))); }
    float timonD = sdToro(vec3(ql.x + 0.35, ql.z, ql.y - 1.05), 0.2, 0.015);
    m = u2(m, vec2(timonD, 13.0));
    r = u2(r, m);
  } else if (db < r.x) r = vec2(db, 0.0);
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  vec3 q = aLancha(pos, t);
  float b = -q.x - 4.5;                        /* metros detrás de la popa */
  float lat = abs(q.z);
  float brazo = abs(lat - 0.33 * b - 1.3);
  float kelvin = step(0.0, b) * exp(-b * 0.03) * smoothstep(1.6, 0.0, brazo) * sin(5.0 * (lat - 0.33 * b) + b * 0.4) * 0.45;
  float estelaCentro = step(0.0, b) * exp(-b * 0.06) * smoothstep(2.2, 0.4, lat) * (sin(b * 2.5 - t * 4.0 + 3.0 * noise(q.xz * 0.5)) * 0.35 + 0.6 * (noise(q.xz * 2.0 - vec2(t * 1.5, 0.0)) - 0.5));
  float proa = step(2.0, q.x) * step(q.x, 6.0) * smoothstep(2.4, 1.3, lat) * sin((lat + (6.0 - q.x) * 0.5) * 9.0) * 0.6;
  float espuma = smoothstep(1.65, 1.2, lat) * step(-4.6, q.x) * step(q.x, 3.8) * (0.4 + 0.6 * noise(q.xz * 6.0 + t * 3.0));
  espuma += step(0.0, b) * exp(-b * 0.35) * smoothstep(1.5, 0.5, lat) * (0.3 + 0.7 * noise(q.xz * 4.0 - vec2(t * 2.0, 0.0)));
  espuma += step(2.0, q.x) * smoothstep(1.8, 1.1, lat) * exp(-max(q.x - 3.5, 0.0)) * 0.6 * noise(q.xz * 8.0 + t * 5.0);
  return vec4(kelvin + estelaCentro + proa, espuma * 0.8, (kelvin + estelaCentro) * 0.7, 0.0);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.002 * sin(t * 1.3), 0.0025 * sin(t * 0.9 + 1.0));
  if (t < 12.0) {
    /* desde la orilla de acá, a ras del agua, la lancha pasa de derecha a izquierda */
    ro = vec3(0.0, 0.9, -1.5);
    vec3 obj = vec3(posLancha(t).x * 0.6, 1.6, 8.0);
    mirar(ro, obj, uv + tiemblo, 1.4, 0.0, rd);
  } else {
    /* desde la popa, mirando la estela y las orillas que se cierran */
    vec3 q = vec3(-4.3, 2.55, 0.35); vec3 L = posLancha(t);
    ro = L + vec3(-q.x, q.y, -q.z);
    vec3 obj = L + vec3(18.0, 0.0, -2.0);
    mirar(ro, obj, uv + tiemblo * 0.6, 1.1, 0.012 * sin(t * 0.9), rd);
  }
}
