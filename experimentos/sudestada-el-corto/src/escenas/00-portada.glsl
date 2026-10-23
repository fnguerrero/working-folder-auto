/* Portada: el arroyo de noche con la tormenta lejos, sin nada más; el texto va por encima */
Clima clima(float t) { return Clima(0.0, 0.0, 0.8, 0.25, 0.03, 0.5, vec2(-0.3, 0.1)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 0.0; }
Luz luz(int i, float t) { return Luz(vec3(0.0), vec3(0.0), 0.0); }
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
vec2 mapaMundo(vec3 p, float t) { return orilla(p, t, 34.0, 1.0, 3.0, 0.5); }
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) { ro = vec3(0.0, 0.9, -2.0); mirar(ro, vec3(2.0, 1.3, 30.0), uv + vec2(0.0, 0.002 * sin(t * 0.7)), 1.3, 0.0, rd); }
