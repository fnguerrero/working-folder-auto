/* Escena 3: jueves a la noche. La casa con la cocina prendida; en la galería Ana levanta el teléfono buscando señal; empieza
   la lluvia y un relámpago; después, de cerca, las hojas que lleva el arroyo se frenan y empiezan a ir al revés. */
float corte(float t) { return step(11.0, t); }
float velCorriente(float t) { return mix(-0.8, 0.6, smoothstep(13.0, 17.5, t)); }
float desplaz(float t) { /* integral de la velocidad de la corriente */
  float a = min(t, 13.0) * -0.8;
  float u = clamp(t - 13.0, 0.0, 4.5);
  a += -0.8 * u + 1.4 * (u * u * (3.0 * 4.5 - 2.0 * u) / (6.0 * 4.5 * 4.5)) * 4.5; /* integral de smoothstep en [0, 4.5] */
  a += 0.6 * max(t - 17.5, 0.0);
  return a;
}
Clima clima(float t) { return Clima(0.0, 0.0, 0.85, smoothstep(8.0, 13.0, t) * 0.7, 0.03, 0.4 + 0.5 * smoothstep(6.0, 14.0, t), vec2(desplaz(t) / max(t, 0.01), 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 0.15 + 0.004 * t; }
Luz luz(int i, float t) {
  if (i == 0) return Luz(vec3(1.0, 2.35, -1.55), vec3(1.0, 0.78, 0.45), 1.4);          /* la cocina */
  return Luz(vec3(-1.0, 4.85, -1.55), vec3(1.0, 0.8, 0.5), 0.5);                      /* la pieza de arriba, donde lee Verónica */
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 3.0, 0.0, 0.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.7)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.7)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  float alto = 0.15 + 0.2 * smoothstep(-1.0, 3.0, p.z) + 0.06 * fbm4(p.xz * 1.5);
  float tierra = smax(p.y - alto, -(p.z + 0.5 + 0.8 * noise(p.xx * 0.4)), 0.8);
  r = u2(r, vec2(tierra, 17.0));
  vec3 qc = p - vec3(-2.6, 0.18, -5.1); qc.y += 0.03 * sin(t * 1.3); qc.xy = rot(0.03 * sin(t * 1.1)) * qc.xy;
  float dc = length(qc - vec3(0.0, 0.3, 0.0)) - 1.8;
  if (dc < 0.2) r = u2(r, chata(qc)); else if (dc < r.x) r = vec2(dc, 0.0);
  /* Ana en la galería, de espaldas al viento, con el teléfono levantado; lo baja, lo mira y se lo guarda */
  vec3 pa = vec3(0.7, 1.2, -2.35);
  float da = length(p - (pa + vec3(0.0, 1.0, 0.0))) - 1.3;
  if (da < 0.2) {
    vec3 q = rotY(p - pa, PI * 0.5 - 0.35);   /* mira a -z, apenas girada */
    Pose P = poseDePie(0.0, 0.0);
    float baja = smoothstep(6.5, 7.8, t), guarda = smoothstep(9.0, 10.3, t);
    vec3 arriba = vec3(-0.12, 1.98, 0.22), mira = vec3(-0.3, 1.35, 0.1), bolsillo = vec3(-0.05, 0.9, 0.2);
    P.manoD = mix(mix(arriba, mira, baja), bolsillo, guarda);
    P.codoD = mix(mix(vec3(-0.05, 1.5, 0.3), vec3(-0.1, 1.15, 0.3), baja), vec3(0.05, 1.12, 0.3), guarda);
    P.agarreD = vec3(-1.0, 0.0, 0.0);
    P.manoI = vec3(0.02, 0.85, -0.24); P.codoI = vec3(0.04, 1.12, -0.24);
    P.pitch = mix(mix(0.35, -0.3, baja), 0.0, guarda); P.yaw = 0.1 * sin(t * 0.7);
    vec2 v = persona(q, P, aspectoAna());
    vec3 tel = P.manoD * 0.92 + vec3(-0.04, 0.05, 0.0);
    float telef = sdBox3(q - tel, vec3(0.008, 0.07, 0.035)) - 0.004;
    v = u2(v, vec2(telef, guarda > 0.9 ? 1e3 : 22.0));
    r = u2(r, v);
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  vec2 h = pos.xz - vec2(desplaz(t), 0.0);
  float hojas = step(0.8, noise(h * 1.6)) * step(0.5, noise(h * 7.0 + 2.0)) * 0.8;
  float flecos = step(0.9, noise(h * 4.0 + 9.0)) * 0.6 + step(0.84, noise(h * vec2(0.7, 2.5) + 4.0)) * 0.35; /* espuma y basura clara */
  return vec4(0.0, flecos, 0.0, hojas);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.002 * sin(t * 1.3), 0.0025 * sin(t * 0.9 + 1.0));
  if (corte(t) < 0.5) {
    float a = smoothstep(0.0, 11.0, t);
    ro = mix(vec3(4.0, 1.5, -10.0), vec3(3.2, 1.6, -8.0), a);
    mirar(ro, vec3(0.5, 2.2, -1.5), uv + tiemblo, mix(1.3, 1.6, a), 0.0, rd);
  } else {
    /* el agua de cerca, con la casa reflejada al fondo */
    ro = vec3(-5.5, 1.0, -8.5);
    mirar(ro, vec3(-4.8, 0.15, -6.0), uv + tiemblo * 0.5, 1.4, 0.0, rd);
  }
}
