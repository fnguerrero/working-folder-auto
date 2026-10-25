/* Escena 19: el cierre. El arroyo en calma, con sol bajo, después de la sudestada: la cámara va despacio a ras del agua entre los
   sauces; sobre la imagen, la moraleja en dos carteles y el título. */
Clima clima(float t) { return Clima(0.9, 0.55, 0.3, 0.0, 0.02, 0.05, vec2(-0.12, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(1.0, 0.22, 0.35)); }
float nivelAgua(float t) { return 0.0; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec4 aguaExtra(vec3 pos, float t) { vec2 h = pos.xz + vec2(0.12 * t, 0.0); float hojas = step(0.9, noise(h * 1.5)) * step(0.6, noise(h * 6.0 + 2.0)) * 0.4; return vec4(0.0, 0.0, 0.0, hojas); }
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = orilla(p, t, 21.0, 1.0, 3.0, 0.05);     /* la orilla de enfrente */
  r = u2(r, orilla(p, t, -11.0, -1.0, 17.0, 0.05)); /* la de acá */
  /* un poste de muelle viejo, solo, con su pájaro de madera encima (una garza quieta) */
  vec3 qp = p - vec3(14.0, 0.0, 9.5);
  float poste = sdCil(qp - vec3(0.0, 0.3, 0.0), 0.75, 0.07);
  float garza = sdElip(qp - vec3(0.0, 1.22, 0.0), vec3(0.09, 0.13, 0.08));
  garza = smin(garza, sdCap(qp, vec3(0.0, 1.3, 0.0), vec3(-0.06, 1.58, 0.0), 0.022), 0.03);
  garza = smin(garza, sdElip(qp - vec3(-0.08, 1.6, 0.0), vec3(0.05, 0.035, 0.035)), 0.02);
  garza = min(garza, sdCap(qp, vec3(-0.11, 1.6, 0.0), vec3(-0.24, 1.57, 0.0), 0.008));
  if (poste < r.x) r = vec2(poste, 13.0);
  if (garza < r.x) r = vec2(garza, 23.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0008 * sin(t * 0.9), 0.001 * sin(t * 0.7 + 1.0));
  ro = vec3(-2.0 + 0.28 * t, 0.85 + 0.02 * sin(t * 0.5), 4.5);
  vec3 obj = ro + vec3(12.0, -0.6 + 0.25 * smoothstep(0.0, 22.0, t), 0.6);
  mirar(ro, obj, uv + tiemblo, 1.35, 0.0, rd);
}
