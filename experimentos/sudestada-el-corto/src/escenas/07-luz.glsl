/* Escena 7: sábado a la noche, el pico del agua. La ventana del pasillo de arriba desde adentro, con la vela en el borde;
   lluvia contra el vidrio; el viento abre un hueco y arroyo abajo, al nivel del agua, se ve una luz chica y amarilla. */
#define GOTAS_VIDRIO 1.3
float hueco(float t) { return smoothstep(8.5, 10.0, t) * (1.0 - smoothstep(11.5, 13.0, t)); }
Clima clima(float t) { float h = hueco(t); return Clima(0.0, 0.0, 0.95, mix(0.8, 0.25, h), mix(0.09, 0.012, h), 1.0, vec2(-1.3, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 2.3; }
Luz luz(int i, float t) {
  if (i == 0) return Luz(vec3(-0.55, 4.56, -1.15), vec3(1.0, 0.7, 0.35), 0.9 * (0.8 + 0.25 * noise(vec2(t * 11.0, 0.0)) + 0.1 * sin(t * 23.0))); /* la vela */
  return Luz(vec3(-9.0, 2.45, -58.0), vec3(1.0, 0.75, 0.4), 22.0 * smoothstep(0.3, 0.8, hueco(t)));                                            /* el farol del galpón, lejos */
}
vec2 mapaMundo(vec3 p, float t) {
  /* el pasillo de arriba: paredes de tablas, piso, techo, la ventana al frente (-z) con marco, parante y el antepecho; sin vidrio en la geometría */
  vec3 h = p;
  vec2 r = vec2(1e3, 0.0);
  float caja = max(sdBox3(h - vec3(-1.0, 4.9, 0.3), vec3(1.52, 1.32, 1.82)), -sdBox3(h - vec3(-1.0, 4.9, 0.3), vec3(1.4, 1.2, 1.7))); /* el cuarto: paredes de 12 cm */
  float hueco = sdBox3(h - vec3(-1.0, 4.85, -1.4), vec3(0.36, 0.45, 0.4));
  float pared = max(caja, -hueco);
  r = vec2(pared, 30.0);
  float marco = sdBox3(h - vec3(-1.0, 4.85, -1.4), vec3(0.43, 0.5, 0.06)); marco = max(marco, -sdBox3(h - vec3(-1.0, 4.85, -1.4), vec3(0.36, 0.44, 0.3)));
  marco = min(marco, sdBox3(h - vec3(-1.0, 4.85, -1.37), vec3(0.015, 0.45, 0.02)));
  marco = min(marco, sdBox3(h - vec3(-1.0, 4.38, -1.3), vec3(0.5, 0.025, 0.12)));  /* el antepecho */
  if (marco < r.x) r = vec2(marco, 13.0);
  /* la vela sobre un plato, a la izquierda del antepecho */
  float plato = sdCil(h - vec3(-0.55, 4.41, -1.15), 0.006, 0.07);
  float vela = sdCil(h - vec3(-0.55, 4.46, -1.15), 0.05 - 0.002 * t, 0.014);
  vela = min(vela, sdElip(h - vec3(-0.55, 4.52 - 0.002 * t + 0.01 * noise(vec2(t * 15.0, 0.0)), -1.15), vec3(0.007, 0.02, 0.007)));
  if (plato < r.x) r = vec2(plato, 13.0);
  if (vela < r.x) r = vec2(vela, 31.0);
  /* afuera: la galería de abajo hundida, el muelle de Elías y el galpón lejos, la otra orilla */
  float alero = sdBox3(h - vec3(0.0, 3.75, -2.05), vec3(1.95, 0.03, 0.7));
  if (alero < r.x) r = vec2(alero, 14.0);
  float dg = length(p - vec3(-9.0, 2.5, -58.0)) - 6.0;
  if (dg < 0.2) {
    vec3 g = p - vec3(-9.0, 1.9, -58.0);
    float galpon = sdBox3(g - vec3(0.0, 1.4, 0.0), vec3(2.6, 1.4, 2.0));
    float farolito = length(g - vec3(0.0, 0.55, -2.2)) - 0.07;
    r = u2(r, u2(vec2(galpon, 32.0), vec2(farolito, 6.0)));
  } else if (dg < r.x) r = vec2(dg, 0.0);
  r = u2(r, orilla(p, t, -64.0, -1.0, 7.0, 1.0));
  return r;
}
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0, 0.0, 0.0, 0.0); }
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.3), 0.002 * sin(t * 0.9 + 1.0));
  float a = smoothstep(0.0, 18.0, t);
  ro = mix(vec3(-0.75, 4.95, -0.25), vec3(-0.9, 4.88, -0.7), a);
  mirar(ro, vec3(-1.0, 4.62, -1.4), uv + tiemblo, mix(1.1, 1.3, a), 0.0, rd);
}
