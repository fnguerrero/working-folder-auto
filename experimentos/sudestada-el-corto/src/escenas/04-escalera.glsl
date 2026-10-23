/* Escena 4: viernes a la noche, adentro. Desde el descanso de la escalera, el agua marrón sube escalón por escalón a la luz
   de la lámpara del grupo electrógeno y de una linterna; por la puerta abierta de abajo se ve la galería con la mesa de la
   abuela flotando patas arriba. Al final se corta la luz. */
float corteLuz(float t) { return 1.0 - smoothstep(19.6, 20.0, t); }
Clima clima(float t) { return Clima(0.0, 0.0, 0.9, 0.0, 0.05, 0.8, vec2(-0.6, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 1.56 + 0.74 * smoothstep(0.0, 22.0, t) + 0.01 * sin(t * 2.0); }
vec3 posLinterna(float t) { return vec3(0.8 + 0.25 * sin(t * 0.6), 3.8, 0.95 + 0.1 * sin(t * 0.45)); }
Luz luz(int i, float t) {
  float cl = corteLuz(t);
  if (i == 0) return Luz(vec3(1.72, 3.2, 1.0), vec3(1.0, 0.75, 0.4), (3.5 + 0.8 * noise(vec2(t * 9.0, 0.0)) + 0.3 * sin(t * 31.0)) * cl); /* la lámpara de pie, amarilla y temblona */
  return Luz(posLinterna(t) + vec3(0.0, -0.4, -0.3), vec3(0.95, 0.95, 1.0), 2.5 * mix(1.0, 2.0, 1.0 - cl));                            /* la linterna */
}
/* la escalera interior: sube de la planta baja (y 1.2) al primer piso (y 3.7) hacia +z, pegada a la pared derecha (x +1.3), con descanso */
vec2 mapaMundo(vec3 p, float t) {
  vec3 h = p;
  vec2 r = vec2(1e3, 0.0);
  float cuarto = max(sdBox3(h - vec3(0.0, 2.95, 0.5), vec3(1.97, 1.92, 2.02)), -sdBox3(h - vec3(0.0, 2.95, 0.5), vec3(1.85, 1.8, 1.9))); /* paredes de 12 cm; la del frente en z -1.4 */
  float puerta = sdBox3(h - vec3(0.0, 2.1, -1.4), vec3(0.4, 0.9, 0.3));
  float ventana = sdBox3(h - vec3(1.85, 2.4, 0.4), vec3(0.3, 0.42, 0.36));
  float pared = max(cuarto, -min(puerta, ventana));
  r = vec2(pared, 30.0);
  float vidrio = sdBox3(h - vec3(1.86, 2.4, 0.4), vec3(0.005, 0.42, 0.36));
  if (vidrio < r.x) r = vec2(vidrio, 39.0);
  /* el entrepiso, con el hueco de la escalera */
  float entre = sdBox3(h - vec3(0.0, 3.72, 0.5), vec3(1.85, 0.06, 1.9));
  entre = max(entre, -min(sdBox3(h - vec3(1.3, 3.72, 0.5), vec3(0.55, 0.2, 1.3)), sdBox3(h - vec3(0.2, 3.72, 1.25), vec3(1.65, 0.2, 0.55))));
  if (entre < r.x) r = vec2(entre, 14.0);
  /* trece escalones hasta el descanso y otros seis que doblan hacia -x */
  float esc = 1e3;
  for (int i = 0; i < 9; i++) { float y = 1.2 + 0.178 * float(i + 1); float z = -0.9 + 0.26 * float(i); esc = min(esc, sdBox3(h - vec3(1.3, y, z), vec3(0.5, 0.02, 0.14))); esc = min(esc, sdBox3(h - vec3(1.3, y - 0.09, z - 0.13), vec3(0.5, 0.09, 0.012))); }
  float descanso = sdBox3(h - vec3(1.0, 2.8, 1.25), vec3(0.8, 0.03, 0.45));
  esc = min(esc, descanso);
  for (int i = 0; i < 5; i++) { float y = 2.8 + 0.18 * float(i + 1); float x = 0.0 - 0.26 * float(i); esc = min(esc, sdBox3(h - vec3(x, y, 1.25), vec3(0.14, 0.02, 0.5))); }
  float zanca = sdBox3(h - vec3(0.8, 2.1, 0.2), vec3(0.03, 1.0, 1.3));
  zanca = max(zanca, (h.y - 1.2) - 0.685 * (h.z + 0.9) - 0.25);
  zanca = max(zanca, -(h.y - 1.2) + 0.685 * (h.z + 0.9) - 0.4);
  esc = min(esc, zanca);
  float pasamanos = sdCap(h, vec3(0.8, 2.1, -0.95), vec3(0.8, 3.7, 1.3), 0.025);
  for (int i = 0; i < 5; i++) { float z = -0.8 + 0.5 * float(i); pasamanos = min(pasamanos, sdCil(h - vec3(0.8, 1.2 + 0.685 * (z + 0.9) + 0.5, z), 0.42, 0.018)); }
  esc = min(esc, pasamanos);
  if (esc < r.x) r = vec2(esc, 14.0);
  /* la lámpara de pie en el descanso, con su pantalla, y el cable */
  float lamp = sdCap(h, vec3(1.72, 2.83, 1.0), vec3(1.72, 2.87, 1.0), 0.1);
  lamp = min(lamp, sdCap(h, vec3(1.72, 2.85, 1.0), vec3(1.72, 3.15, 1.0), 0.015));
  float pantalla = max(sdCil(h - vec3(1.72, 3.25, 1.0), 0.12, 0.12 + 0.45 * (3.25 - h.y)), -sdCil(h - vec3(1.72, 3.25, 1.0), 0.13, 0.1 + 0.45 * (3.25 - h.y)));
  if (lamp < r.x) r = vec2(lamp, 13.0);
  if (pantalla < r.x) r = vec2(pantalla, 35.0);
  /* una silla flotando abajo, de costado, y libros */
  vec3 qs = p - vec3(-0.9, nivelAgua(t) - 0.1 + 0.02 * sin(t * 1.6), -0.3); qs.xz = rot(0.3 + 0.05 * sin(t * 0.8)) * qs.xz; qs.yz = rot(1.3) * qs.yz;
  float silla = sdBox3(qs - vec3(0.0, 0.42, 0.0), vec3(0.2, 0.02, 0.2));
  silla = min(silla, sdBox3(qs - vec3(-0.18, 0.7, 0.0), vec3(0.02, 0.3, 0.2)));
  for (int i = 0; i < 4; i++) { vec3 pata = vec3((i < 2 ? -0.17 : 0.17), 0.21, (mod(float(i), 2.0) < 0.5 ? -0.17 : 0.17)); silla = min(silla, sdBox3(qs - pata, vec3(0.018, 0.21, 0.018))); }
  if (silla < r.x) r = vec2(silla, 29.0);
  /* afuera por la puerta: la galería, la baranda y la mesa flotando patas arriba */
  float galeria = sdBox3(h - vec3(0.0, 1.17, -2.05), vec3(1.9, 0.03, 0.65));
  float baranda = sdCap(h, vec3(-1.85, 1.65, -2.68), vec3(1.85, 1.65, -2.68), 0.025);
  for (int i = 0; i < 7; i++) { float x = -1.85 + 0.617 * float(i); baranda = min(baranda, sdCil(h - vec3(x, 1.42, -2.68), 0.23, 0.03)); }
  if (min(galeria, baranda) < r.x) r = vec2(min(galeria, baranda), 13.0);
  vec3 qm = p - vec3(0.4, nivelAgua(t) + 0.0 + 0.03 * sin(t * 1.5), -2.35); qm.xz = rot(0.3) * qm.xz; qm.xy = rot(0.06 * sin(t * 1.2)) * qm.xy;
  float mesa = sdBox3(qm, vec3(0.45, 0.02, 0.35)) - 0.01;
  for (int i = 0; i < 4; i++) { vec3 pata = vec3((i < 2 ? -0.4 : 0.4), 0.32, (mod(float(i), 2.0) < 0.5 ? -0.3 : 0.3)); mesa = min(mesa, sdBox3(qm - pata, vec3(0.025, 0.32, 0.025))); }
  if (mesa < r.x) r = vec2(mesa, 29.0);
  /* Verónica, en el descanso, con la linterna, mirando el agua */
  vec3 pv = vec3(0.5, 2.83, 1.25);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, -PI * 0.5 - 0.3); /* de espaldas a la cámara, mira a la escalera (-z) girada */
    q = rotY(p - pv, PI * 0.5 + 0.4);
    Pose P = poseDePie(0.0, 0.0);
    P.manoD = vec3(-0.3, 1.1 + 0.03 * sin(t * 0.6), 0.25 + 0.1 * sin(t * 0.6)); P.codoD = vec3(-0.1, 1.15, 0.3); P.agarreD = vec3(0.0, -1.0, 0.0);
    P.pitch = -0.4; P.yaw = 0.2 * sin(t * 0.5);
    vec2 v = persona(q, P, aspectoVeronica());
    vec3 m = P.manoD * 0.94; float lint = sdCilX(q - m - vec3(-0.08, 0.0, 0.0), 0.09, 0.022);
    v = u2(v, vec2(lint, 13.0));
    float foco = length(q - m - vec3(-0.18, 0.0, 0.0)) - 0.02;
    v = u2(v, vec2(foco, 38.0));
    r = u2(r, v);
  } else if (dv < r.x) r = vec2(dv, 0.0);
  return r;
}
vec4 aguaExtra(vec3 pos, float t) {
  vec2 h = pos.xz + vec2(0.1 * t, 0.05 * t);
  float hojas = step(0.82, noise(h * 2.5)) * step(0.5, noise(h * 8.0 + 2.0)) * 0.8;
  return vec4(0.0, 0.0, 0.0, hojas);
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.3), 0.002 * sin(t * 0.9 + 1.0));
  float a = smoothstep(0.0, 22.0, t);
  /* desde arriba de la escalera, mirando hacia abajo; baja despacio hacia el descanso */
  ro = mix(vec3(0.95, 3.5, 2.0), vec3(1.0, 3.38, 1.85), a);
  mirar(ro, vec3(1.1, 1.9, -1.2), uv + tiemblo, 1.1, 0.0, rd);
}
