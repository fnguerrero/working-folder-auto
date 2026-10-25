/* Escena 11: sábado a las 16, la cocina de arriba. El teléfono de Ana sobre la mesa, con once por ciento y una raya que viene y va.
   Verónica lo levanta y lo abre: un mensaje del miércoles a las 14.10. Ana en la puerta, con el pelo mojado de la ducha.
   «Es una despedida, Verónica.» … «Leelas mejor.» Se va. */
Clima clima(float t) { return Clima(0.45, 0.0, 0.97, 0.0, 0.03, 0.6, vec2(-0.7, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.2, 0.5, -1.0)); }
float nivelAgua(float t) { return -2.2; } /* el agua a 1,5 m: ya tapó la galería y entra en la planta baja */
Luz luz(int i, float t) { if (i == 0) return Luz(vec3(-1.0, 1.3, -1.05), vec3(0.7, 0.76, 0.9), 2.2 * (1.0 + 0.8 * uFlash)); return Luz(vec3(1.0, 1.3, -1.05), vec3(0.7, 0.76, 0.9), 2.2 * (1.0 + 0.8 * uFlash)); }
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
/* el celular: sobre la mesa hasta que ella lo levanta (3 a 5 s) y lo lee en la mano, de frente a la cara; a los 11,5 lo apoya otra vez */
float enMano(float t) { return smoothstep(3.0, 5.0, t) * (1.0 - smoothstep(11.0, 12.0, t)); }
vec3 posCelu(float t) { return mix(vec3(-0.15, 0.766, -0.22), vec3(-0.48, 1.08, -0.2), enMano(t)); }
/* Ana: en la puerta de 0 a 37, se va por el pasillo */
vec3 posAna(float t) { return mix(vec3(-1.72, 0.0, 0.5), vec3(-2.9, 0.0, 0.5), smoothstep(36.8, 39.5, t)); }
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = cocinaArriba(p);
  if (p.z < -1.3) { vec2 o = orilla(p + vec3(0.0, 0.55, 0.0), t, -24.0, -1.0, 5.0, 0.6); if (o.x < r.x) r = o; }
  float ds = length(p - vec3(6.0, 0.5, -2.0)) - 4.0;
  if (ds < 0.2) r = u2(r, sauce(p - vec3(6.0, -0.55, -2.0), t, 9.0, 0.6)); else if (ds < r.x) r = vec2(ds, 0.0);
  /* sobre la mesa: las dos tazas, la tabla con el pan de la mañana, las libretas apiladas; y el celular */
  float tazas = min(max(sdCil(p - vec3(0.45, 0.8, -0.48), 0.045, 0.04), -sdCil(p - vec3(0.45, 0.82, -0.48), 0.045, 0.035)), max(sdCil(p - vec3(-0.4, 0.8, -0.45), 0.045, 0.04), -sdCil(p - vec3(-0.4, 0.82, -0.45), 0.045, 0.035)));
  if (tazas < r.x) r = vec2(tazas, 20.0);
  float tabla = sdBox3(p - vec3(0.3, 0.77, -0.2), vec3(0.17, 0.01, 0.12)) - 0.005;
  if (tabla < r.x) r = vec2(tabla, 29.0);
  float pan = sdElip(p - vec3(0.33, 0.83, -0.17), vec3(0.08, 0.05, 0.05)) + 0.004 * noise(p.xz * 50.0);
  if (pan < r.x) r = vec2(pan, 55.0);
  float libretas = sdBox3(p - vec3(0.05, 0.79, 0.05), vec3(0.08, 0.02, 0.11)) - 0.004;
  libretas = min(libretas, sdBox3(rotY(p - vec3(0.06, 0.83, 0.06), 0.2), vec3(0.075, 0.018, 0.105)) - 0.004);
  if (libretas < r.x) r = vec2(libretas, 4.0);
  float m = enMano(t);
  vec3 qc = p - posCelu(t); qc.yz = rot(1.15 * m) * qc.yz; qc.xz = rot(-0.2 * m) * qc.xz; /* en la mano, parado, con la pantalla hacia la cara */
  float celu = sdBox3(qc, vec3(0.036, 0.004, 0.075)) - 0.004;
  float pantalla = sdBox3(qc - vec3(0.0, 0.0075, 0.0), vec3(0.032, 0.001, 0.068));
  if (pantalla < 0.01) gPantalla = vec2(qc.x / 0.064 + 0.5, 0.5 - qc.z / 0.136); /* el extremo -z es el de arriba (el que queda lejos de la mano) */
  if (celu < r.x) r = vec2(celu, 34.0);
  if (pantalla < r.x) r = vec2(pantalla, 56.0);
  /* Verónica, sentada en su silla: estira la mano al celular, lo lee, lo apoya; después mira a Ana */
  vec3 pv = vec3(-0.78, 0.0, -0.2);
  float dv = length(p - (pv + vec3(0.0, 0.8, 0.0))) - 1.1;
  if (dv < 0.2) {
    vec3 q = rotY(p - pv, PI);
    Pose P = poseSilla();
    float alcanza = smoothstep(2.0, 3.0, t) * (1.0 - smoothstep(11.5, 12.5, t));
    vec3 celuL = rotY(posCelu(t) - pv, PI) + vec3(0.0, -0.02, 0.0) + vec3(0.0, 0.0, 0.0);
    P.manoD = mix(vec3(-0.32, 0.8, 0.1), celuL + vec3(0.02, -0.03 * m, 0.0), alcanza); P.agarreD = mix(vec3(0.0, -1.0, 0.0), vec3(-0.6, -0.2, 0.0), m);
    P.manoI = vec3(-0.3, 0.8, -0.12); P.agarreI = vec3(0.0, -1.0, 0.0);
    P.codoD = mix(P.codoD, vec3(0.05, 0.75, 0.25), alcanza);
    /* mira la pantalla; después, a Ana en la puerta (a su izquierda, atrás) */
    float aAna = smoothstep(11.5, 12.5, t);
    P.pitch = -0.3 * m - 0.1 * (1.0 - m) * (1.0 - aAna) + 0.08 * aAna; P.yaw = 0.95 * aAna * (1.0 - smoothstep(37.5, 39.0, t)) + 0.04 * sin(t * 0.4);
    P.pecho.x -= 0.06 * m; P.hom.x -= 0.08 * m; P.cab.x -= 0.1 * m; P.homI.x -= 0.08 * m; P.homD.x -= 0.08 * m;
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* Ana, parada en el vano de la puerta con el pelo mojado y una toalla al cuello, los brazos cruzados; se va al final */
  vec3 pa = posAna(t);
  float da = length(p - (pa + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (da < 0.2) {
    float seVa = smoothstep(36.5, 37.3, t);
    vec3 q = rotY(p - pa, mix(PI - 0.25, 2.0 * PI, seVa)); /* mira a la mesa (+x); al irse se da vuelta y camina hacia -x */
    float paso = smoothstep(36.8, 37.3, t) * (1.0 - smoothstep(39.2, 39.6, t));
    Pose P = poseDePie(t * 2.0 * PI / 0.8, paso);
    P = mezclarPose(brazosCruzados(P, 0.0), P, seVa);
    float hombros = 0.03 * smoothstep(16.5, 17.0, t) * (1.0 - smoothstep(18.0, 18.6, t));
    P.hom.y += hombros; P.homI.y += hombros; P.homD.y += hombros;
    P.yaw = 0.1 * sin(t * 0.5) * (1.0 - seVa); P.pitch = -0.1 + 0.08 * smoothstep(33.5, 34.5, t);
    P.cad.z += 0.03; /* apoyada en el marco */
    vec2 v = persona(q, P, aspectoAna());
    /* la toalla al cuello */
    /* la toalla sobre los hombros: una banda chata por la nuca y dos puntas que cuelgan por delante, en el marco escalado del rig */
    vec3 qs = q / 0.92; vec3 H = P.hom;
    float toalla = sdCap(qs, H + vec3(0.04, 0.04, -0.2), H + vec3(0.04, 0.04, 0.2), 0.03);
    toalla = min(toalla, sdCap(qs, H + vec3(0.0, 0.05, -0.2), H + vec3(-0.15, -0.3, -0.12), 0.03));
    toalla = min(toalla, sdCap(qs, H + vec3(0.0, 0.05, 0.2), H + vec3(-0.15, -0.26, 0.12), 0.03));
    v = u2(v, vec2(toalla * 0.92, 24.0));
    r = u2(r, v);
  } else if (da < r.x) r = vec2(da, 0.0);
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.001 * sin(t * 1.1), 0.0012 * sin(t * 0.8 + 1.0));
  vec3 obj; float zoom = 1.4;
  vec3 cabV = vec3(-0.78 + 0.03, 1.22 * 0.94, -0.2), cabA = posAna(t) + vec3(0.0, 1.67 * 0.92, 0.0);
  bool aAna = (t >= 11.5 && t < 14.0) || (t >= 15.5 && t < 24.0) || (t >= 26.5 && t < 29.5) || (t >= 33.5 && t < 37.0);
  bool aVero = (t >= 14.0 && t < 15.5) || (t >= 24.0 && t < 26.5) || (t >= 29.5 && t < 33.5);
  if (t < 3.0) { float a = smoothstep(0.0, 3.0, t); ro = mix(vec3(1.4, 1.65, 0.9), vec3(1.35, 1.6, 0.85), a); obj = vec3(-0.3, 0.9, -0.3); zoom = 1.3; }                  /* la mesa con el celular, ella sentada, la lluvia en la ventana */
  else if (t < 5.5) { ro = vec3(0.35, 1.3, 0.3); obj = vec3(-0.25, 0.85, -0.22); zoom = 2.0; }                                                                        /* la mano que lo levanta */
  else if (t < 11.5) { float a = smoothstep(5.5, 11.5, t); vec3 c = posCelu(t); ro = mix(vec3(-0.6, 1.33, -0.06), vec3(-0.61, 1.32, -0.07), a); obj = c; zoom = 2.6; } /* la pantalla, desde sus ojos */
  else if (aAna) { ro = vec3(-0.45, 1.5, -0.35); obj = cabA + vec3(0.0, -0.1, 0.0); zoom = (t >= 15.5 && t < 24.0) ? 2.0 : 1.6; }                                     /* Ana en la puerta, desde la mesa */
  else if (aVero) { ro = vec3(0.3, 1.45, 0.5); obj = cabV + vec3(0.0, -0.05, 0.0); zoom = 2.0; }                                                                        /* Verónica, de frente, desde el lado de la silla de Ana */
  else { float a = smoothstep(37.0, 40.0, t); ro = mix(vec3(1.45, 1.7, 0.95), vec3(1.4, 1.68, 0.9), a); obj = vec3(-0.9, 1.0, 0.1); zoom = 1.25; }                   /* desde el rincón: Ana que se va por la puerta, Verónica sola en la mesa */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
