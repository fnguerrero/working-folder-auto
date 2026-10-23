/* Escena 9: domingo a la tarde, el agua baja y el cielo se abre; la casa con la marca del agua, barro y dos personas baldeando */
Clima clima(float t) { return Clima(0.75, 0.3, 0.55, 0.0, 0.012, 0.15, vec2(-0.25, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(-0.7, 0.25, 0.5)); }
float nivelAgua(float t) { return 0.55 - 0.004 * t; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec4 aguaExtra(vec3 pos, float t) { vec2 h = pos.xz + vec2(0.25 * t, 0.0); float basura = step(0.88, noise(h * 1.2)) * step(0.55, noise(h * 5.0 + 1.0)) * 0.6; return vec4(0.0, 0.0, 0.0, basura); }
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = casa(p, 0.0, 1.0, 0.0);
  float ds = length(p - vec3(-6.0, 1.5, 6.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(-6.0, 0.0, 6.0), t, 4.0, 0.15)); else if (ds < r.x) r = vec2(ds, 0.0);
  float ds2 = length(p - vec3(6.5, 1.5, 4.0)) - 4.0;
  if (ds2 < 0.2) r = u2(r, sauce(p - vec3(6.5, 0.0, 4.0), t, 11.0, 0.15)); else if (ds2 < r.x) r = vec2(ds2, 0.0);
  float alto = 0.15 + 0.2 * smoothstep(-1.0, 3.0, p.z) + 0.06 * fbm4(p.xz * 1.5);
  float tierra = smax(p.y - alto, -(p.z + 0.5 + 0.8 * noise(p.xx * 0.4)), 0.8);
  r = u2(r, vec2(tierra, 17.0));
  /* la chata, atada a la baranda, todavía */
  vec3 qc = p - vec3(-2.9, 0.53, -3.4); qc.y += 0.02 * sin(t * 1.3);
  float dc = length(qc - vec3(0.0, 0.3, 0.0)) - 1.8;
  if (dc < 0.2) r = u2(r, chata(qc)); else if (dc < r.x) r = vec2(dc, 0.0);
  /* Verónica baldea en la galería; Martín, en cuclillas, refriega con un trapo */
  vec3 pv = vec3(-0.9, 1.2, -2.1);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.4;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, PI * 0.5 + 0.5);
    Pose P = poseDePie(0.0, 0.0);
    float sw = sin(t * 2.0 * PI / 1.6);
    P.manoI = vec3(-0.25 - 0.15 * sw, 0.95, -0.28); P.manoD = vec3(-0.3 - 0.15 * sw, 1.0, 0.1); P.codoI = vec3(-0.05, 1.1, -0.3); P.codoD = vec3(-0.08, 1.12, 0.22);
    P.agarreI = vec3(0.0, -1.0, 0.0); P.agarreD = vec3(0.0, -1.0, 0.0);
    P.pecho.x -= 0.05; P.hom.x -= 0.1; P.cab.x -= 0.14; P.cab.y -= 0.04; P.homI.x -= 0.1; P.homD.x -= 0.1; P.pitch = -0.35;
    vec2 v = persona(q, P, aspectoVeronica());
    /* el palo del escobillón */
    vec3 m1 = P.manoI * 0.94, m2 = P.manoD * 0.94; vec3 dir = normalize(m1 - m2);
    float palo = sdCap(q, m2 - dir * 0.3, m1 + dir * 0.9, 0.015);
    vec3 pie = m1 + dir * 0.9; float cepillo = sdBox3(q - pie - vec3(0.0, -0.05, 0.0), vec3(0.06, 0.04, 0.2));
    r = u2(r, u2(v, u2(vec2(palo, 5.0), vec2(cepillo, 13.0))));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  vec3 pm = vec3(1.0, 1.2, -2.4);
  float dm = length(p - (pm + vec3(0.0, 0.7, 0.0))) - 1.3;
  if (dm < 0.2) {
    vec3 q = rotY(p - pm, PI * 0.5 - 0.8);
    Pose P = poseSentada(); P.cad.y -= 0.1; P.pecho.y -= 0.1; P.hom.y -= 0.1; P.cab.y -= 0.12; P.homI.y -= 0.1; P.homD.y -= 0.1; P.rodI.y += 0.05; P.rodD.y += 0.05;
    float sw = sin(t * 2.0 * PI / 1.1);
    P.manoI = vec3(-0.45 + 0.12 * sw, 0.08, -0.15); P.manoD = vec3(-0.3, 0.42, 0.18); P.codoI = vec3(-0.1, 0.35, -0.25); P.codoD = vec3(0.0, 0.5, 0.25);
    P.agarreI = vec3(0.0, -1.0, 0.0); P.agarreD = vec3(0.0, -1.0, 0.0); P.pitch = -0.45;
    vec2 v = persona(q, P, aspectoMartin());
    float balde = sdCil(q - vec3(-0.75, 0.15, 0.25), 0.14, 0.14); balde = max(balde, -sdCil(q - vec3(-0.75, 0.2, 0.25), 0.14, 0.12));
    r = u2(r, u2(v, vec2(balde, 28.0)));
  } else if (dm < r.x) r = vec2(dm, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0015 * sin(t * 0.8 + 1.0));
  float a = smoothstep(0.0, 12.0, t), b = smoothstep(12.5, 20.0, t);
  /* desde el agua, acercándose despacio a la casa; al final la cámara sube al cielo para el título */
  ro = mix(vec3(2.5, 1.3, -14.0), vec3(1.2, 1.6, -8.0), a);
  vec3 obj = mix(vec3(-0.3, 2.3, 0.0), vec3(-2.0, 14.0, 4.0), b * b);
  mirar(ro, obj, uv + tiemblo, 1.35, 0.0, rd);
}
