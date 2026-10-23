precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uFlash; uniform vec3 uRayo; uniform float uFundido;
#define PI 3.14159265
#ifndef NLUCES
#define NLUCES 1
#endif
#ifndef NSOMBRAS
#define NSOMBRAS NLUCES
#endif
#ifndef PASOS
#define PASOS 110
#endif
#ifndef ALCANCE
#define ALCANCE 60.0
#endif

/* ---------- ruido y primitivas ---------- */
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float fbm4(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdBox3(vec3 p, vec3 b) { vec3 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0); }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdCil(vec3 p, float h, float r) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdCilZ(vec3 p, float h, float r) { vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdCilX(vec3 p, float h, float r) { vec2 d = abs(vec2(length(p.yz), p.x)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdToro(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdElip(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 rotY(vec3 p, float a) { p.xz = rot(a) * p.xz; return p; }
vec2 u2(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

/* ---------- lo que define cada escena ---------- */
struct Clima { float luz; float alba; float nubes; float lluvia; float niebla; float viento; vec2 corriente; };
struct Luz { vec3 pos; vec3 col; float inten; };
vec2 mapaMundo(vec3 p, float t);
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd);
Clima clima(float t);
float nivelAgua(float t);
Luz luz(int i, float t);
vec3 sunDir(float t);
vec4 aguaExtra(vec3 pos, float t); /* xz: perturbación de la normal; y: espuma; w: hojas y basura oscura */

/* ---------- personas: rig por postura y aspecto, en un marco local que mira a -x ---------- */
struct Pose { vec3 cad, pecho, hom, cab, homI, homD, codoI, codoD, manoI, manoD, rodI, rodD, pieI, pieD, agarreI, agarreD; float yaw, pitch; };
struct Aspecto { float mujer, barba, pelo, gorra, sombrero, panza, matRopa, escala; };
/* el último punto de piel evaluado cerca de la superficie, para pintar barba, pelo y ojos */
vec3 gHC; float gBarba = 0.0, gPelo = 0.0, gMujer = 0.0; vec3 gToalla;

Pose poseDePie(float fase, float paso) {
  /* parada o caminando hacia -x; fase en radianes, paso 0 (quieta) a 1 (caminando) */
  Pose P;
  float s = sin(fase), c = cos(fase);
  float sube = 0.02 * paso * abs(cos(fase));
  P.cad = vec3(0.0, 0.93 + sube, 0.0); P.pecho = vec3(-0.02, 1.2 + sube, 0.0); P.hom = vec3(-0.03, 1.42 + sube, 0.0); P.cab = vec3(-0.03, 1.67 + sube, 0.0);
  P.homI = P.hom + vec3(0.0, -0.03, -0.17); P.homD = P.hom + vec3(0.0, -0.03, 0.17);
  float bI = 0.3 * paso * s, bD = -0.3 * paso * s;
  P.codoI = P.homI + vec3(0.04 + 0.2 * bI, -0.28, -0.03); P.codoD = P.homD + vec3(0.04 + 0.2 * bD, -0.28, 0.03);
  P.manoI = P.codoI + vec3(0.02 + 0.22 * bI, -0.26, -0.01); P.manoD = P.codoD + vec3(0.02 + 0.22 * bD, -0.26, 0.01);
  P.agarreI = vec3(1.0, 0.0, 0.0); P.agarreD = vec3(1.0, 0.0, 0.0);
  float pI = paso * s, pD = -paso * s;
  P.rodI = vec3(-0.3 * pI * 0.6 - 0.02 - 0.05 * paso * max(c, 0.0), 0.5 + 0.08 * paso * max(c, 0.0), -0.1); P.rodD = vec3(-0.3 * pD * 0.6 - 0.02 - 0.05 * paso * max(-c, 0.0), 0.5 + 0.08 * paso * max(-c, 0.0), 0.1);
  P.pieI = vec3(-0.32 * pI, 0.06 + 0.07 * paso * max(c, 0.0) * abs(s), -0.11); P.pieD = vec3(-0.32 * pD, 0.06 + 0.07 * paso * max(-c, 0.0) * abs(s), 0.11);
  P.yaw = 0.0; P.pitch = 0.0;
  return P;
}
Pose poseRemando(float a) {
  /* sentada en el banco de la chata (y 0.3), mirando a -x, remando hacia +x; a = -1 recobro, +1 tirón */
  Pose P;
  vec3 cad = vec3(0.12, 0.36, 0.0); float lean = -0.2 * a;
  P.cad = cad; P.pecho = vec3(0.12 + lean * 0.6, 0.62, 0.0); P.hom = vec3(0.12 + lean, 0.8, 0.0);
  P.cab = P.hom + vec3(-0.035 - 0.03 * a, 0.25, 0.0);
  P.homI = P.hom + vec3(0.0, -0.04, -0.2); P.homD = P.hom + vec3(0.0, -0.04, 0.2);
  P.manoI = vec3(0.12 - 0.2 - 0.24 * a, 0.62 + 0.08 * a, -0.19); P.manoD = P.manoI * vec3(1.0, 1.0, -1.0);
  P.codoI = mix(P.homI, P.manoI, 0.5) + vec3(0.1 + 0.08 * a, -0.1, -0.05); P.codoD = P.codoI * vec3(1.0, 1.0, -1.0);
  P.agarreI = vec3(-0.4, -1.0, 0.0); P.agarreD = vec3(-0.4, -1.0, 0.0);
  P.rodI = vec3(0.12 - 0.38, 0.46, -0.12); P.rodD = P.rodI * vec3(1.0, 1.0, -1.0);
  P.pieI = vec3(0.12 - 0.6, 0.1, -0.13); P.pieD = P.pieI * vec3(1.0, 1.0, -1.0);
  P.yaw = 0.0; P.pitch = 0.0;
  return P;
}
Pose poseSentada() {
  /* sentada en un banco a la altura 0.3 (como el de la chata), mirando a -x, con las manos en la falda */
  Pose P;
  P.cad = vec3(0.1, 0.36, 0.0); P.pecho = vec3(0.08, 0.62, 0.0); P.hom = vec3(0.07, 0.8, 0.0); P.cab = vec3(0.05, 1.05, 0.0);
  P.homI = P.hom + vec3(0.0, -0.03, -0.18); P.homD = P.hom + vec3(0.0, -0.03, 0.18);
  P.codoI = vec3(0.05, 0.55, -0.22); P.codoD = vec3(0.05, 0.55, 0.22);
  P.manoI = vec3(-0.25, 0.5, -0.1); P.manoD = vec3(-0.25, 0.5, 0.1);
  P.agarreI = vec3(0.0, -1.0, 0.0); P.agarreD = vec3(0.0, -1.0, 0.0);
  P.rodI = vec3(-0.35, 0.45, -0.11); P.rodD = vec3(-0.35, 0.45, 0.11);
  P.pieI = vec3(-0.42, 0.05, -0.12); P.pieD = vec3(-0.42, 0.05, 0.12);
  P.yaw = 0.0; P.pitch = 0.0;
  return P;
}
Aspecto aspectoMartin() { return Aspecto(0.0, 1.0, 1.0, 1.0, 0.0, 0.5, 2.0, 1.0); }
Aspecto aspectoMartinSombrero() { return Aspecto(0.0, 1.0, 1.0, 0.0, 1.0, 0.6, 2.0, 1.0); }
Aspecto aspectoVeronica() { return Aspecto(1.0, 0.0, 2.0, 0.0, 0.0, 0.2, 25.0, 0.94); }
Aspecto aspectoAna() { return Aspecto(1.0, 0.0, 3.0, 0.0, 0.0, 0.0, 26.0, 0.92); }

/* cabeza en el marco local de la cabeza (la cara mira a -x); devuelve (piel, pelo-geometría, gorra/sombrero) */
vec3 cabeza(vec3 hc, Aspecto A) {
  float m = A.mujer;
  vec3 e = hc; e.z /= 1.0 - 0.06 * m; e.y /= 1.0 + 0.02 * m;
  float craneo = sdElip(e - vec3(0.01, 0.01, 0.0), vec3(0.115, 0.11, 0.092));
  float mandibula = sdBox3(e - vec3(-0.025, -0.072, 0.0), vec3(0.08, 0.038 - 0.008 * m, 0.044 - 0.008 * m)) - 0.02;
  float cab = smin(craneo, mandibula, 0.025 + 0.015 * m);
  float menton = sdElip(e - vec3(-0.085, -0.1 + 0.004 * m, 0.0), vec3(0.04, 0.03, 0.045 - 0.01 * m));
  cab = smin(cab, menton, 0.035);
  float pomulos = min(sdElip(e - vec3(-0.08, -0.015, -0.062), vec3(0.022, 0.014, 0.014)), sdElip(e - vec3(-0.08, -0.015, 0.062), vec3(0.022, 0.014, 0.014)));
  cab = smin(cab, pomulos, 0.03 + 0.01 * m);
  vec3 nz = e; nz.z *= 1.35 + 0.1 * m;
  float puente = sdCap(nz, vec3(-0.1, 0.035, 0.0), vec3(-0.136, -0.025, 0.0), 0.011 - 0.002 * m);
  float punta = sdElip(nz - vec3(-0.14, -0.032, 0.0), vec3(0.018, 0.015, 0.016) * (1.0 - 0.1 * m));
  float aletas = min(sdElip(nz - vec3(-0.124, -0.04, -0.02), vec3(0.014, 0.011, 0.012)), sdElip(nz - vec3(-0.124, -0.04, 0.02), vec3(0.014, 0.011, 0.012)));
  float nariz = smin(smin(puente, punta, 0.006), aletas, 0.006);
  nariz = smax(nariz, -sdBox3(nz - vec3(-0.128, -0.055, 0.0), vec3(0.02, 0.006, 0.01)), 0.004);
  cab = smin(cab, nariz, 0.006);
  float cuencas = min(length(e - vec3(-0.1, 0.012, -0.042)) - 0.026, length(e - vec3(-0.1, 0.012, 0.042)) - 0.026);
  cab = smax(cab, -cuencas, 0.01);
  float globos = min(length(e - vec3(-0.088, 0.01, -0.042)) - 0.019, length(e - vec3(-0.088, 0.01, 0.042)) - 0.019);
  float parpados = min(sdElip(e - vec3(-0.095, 0.024, -0.042), vec3(0.016, 0.009, 0.022)), sdElip(e - vec3(-0.095, 0.024, 0.042), vec3(0.016, 0.009, 0.022)));
  cab = smin(cab, smin(globos, parpados, 0.006), 0.006);
  float cejas = min(sdCap(e, vec3(-0.1, 0.045, -0.065), vec3(-0.108, 0.05, -0.02), 0.009 - 0.004 * m), sdCap(e, vec3(-0.1, 0.045, 0.065), vec3(-0.108, 0.05, 0.02), 0.009 - 0.004 * m));
  cab = smin(cab, cejas, 0.008);
  for (int lado = 0; lado < 2; lado++) {
    float sg = lado == 0 ? -1.0 : 1.0;
    vec3 oc = e - vec3(0.005, -0.005, sg * 0.1); oc.xy = rot(0.25) * oc.xy;
    float pabellon = sdElip(oc, vec3(0.022, 0.04, 0.012) * (1.0 - 0.1 * m));
    float concha = sdElip(oc - vec3(-0.004, -0.004, sg * 0.012), vec3(0.013, 0.026, 0.012));
    float oreja = smax(pabellon, -concha, 0.004);
    oreja = smin(oreja, length(oc - vec3(0.0, -0.038, 0.0)) - 0.011, 0.005);
    cab = smin(cab, oreja, 0.004);
  }
  float labios = min(sdElip(e - vec3(-0.104, -0.053, 0.0), vec3(0.006, 0.0045 + 0.002 * m, 0.03 - 0.004 * m)), sdElip(e - vec3(-0.102, -0.063, 0.0), vec3(0.006, 0.005 + 0.003 * m, 0.026 - 0.004 * m)));
  cab = smin(cab, labios, 0.008);
  cab = smax(cab, -sdBox3(e - vec3(-0.112, -0.058, 0.0), vec3(0.018, 0.0025, 0.027)), 0.002);
  /* pelo con volumen: corto (casquete), recogido (rodete atrás) o suelto y mojado (cae hasta los hombros) */
  float pelo = 1e3;
  if (A.pelo > 0.5) {
    float casquete = max(sdElip(e - vec3(0.015, 0.02, 0.0), vec3(0.125, 0.12, 0.1)), -0.035 - e.x - 0.5 * e.y); /* no tapa la cara */
    pelo = casquete;
    if (A.pelo > 1.5 && A.pelo < 2.5) pelo = smin(pelo, sdElip(e - vec3(0.1, -0.01, 0.0), vec3(0.045, 0.04, 0.045)), 0.02); /* rodete */
    if (A.pelo > 2.5) { float largo = max(sdElip(e - vec3(0.06, -0.12, 0.0), vec3(0.085, 0.24, 0.105)), -0.055 - e.x); largo = max(largo, -sdElip(e - vec3(0.02, 0.0, 0.0), vec3(0.11, 0.1, 0.085))); pelo = smin(pelo, largo, 0.02); }
  }
  /* gorra: copa sobre el cráneo y visera adelante; sombrero: ala y copa */
  float tapa = 1e3;
  if (A.gorra > 0.5) {
    float copa = max(length(e - vec3(0.015, 0.01, 0.0)) - 0.128, 0.035 - e.y);
    vec3 vi = e - vec3(-0.12, 0.05, 0.0); vi.xy = rot(0.18) * vi.xy;
    float visera = sdBox3(vi, vec3(0.07, 0.004, 0.072 - 0.25 * max(-vi.x, 0.0))) - 0.003;
    tapa = min(copa, visera);
  }
  if (A.sombrero > 0.5) {
    vec3 sh = e - vec3(0.0, 0.085, 0.0); sh.xy = rot(-0.12) * sh.xy;
    vec2 alaXZ = sh.xz * vec2(0.85, 1.0); float rAla = length(alaXZ);
    float caida = -0.028 * smoothstep(0.09, 0.17, rAla) * (0.3 + 0.7 * abs(sh.x) / max(rAla, 0.001)) + 0.012 * smoothstep(0.09, 0.17, rAla) * (abs(sh.z) / max(rAla, 0.001));
    float ala = max(rAla - 0.17, abs(sh.y - caida) - 0.006) - 0.003;
    vec3 cp = sh - vec3(0.0, 0.068, 0.0); cp.z *= 1.12; cp.xz *= 1.0 + 0.3 * clamp((cp.y + 0.06) / 0.12, 0.0, 1.0);
    float copa = sdCil(cp, 0.062, 0.1) - 0.01;
    copa = smax(copa, -sdElip(cp - vec3(-0.01, 0.085, 0.0), vec3(0.1, 0.035, 0.028)), 0.012);
    tapa = min(ala, copa);
  }
  return vec3(cab, pelo, tapa);
}
float mano(vec3 q, vec3 codo, vec3 m, vec3 agarre, float r) {
  vec3 f = normalize(m - codo);
  vec3 cu = normalize(agarre - f * dot(agarre, f) + vec3(1e-4, 0.0, 0.0));
  vec3 z = normalize(cross(f, cu));
  float palma = sdCap(q, m - f * 0.01, m + f * 0.055, r * 0.78);
  palma = smin(palma, sdElip(q - m - f * 0.03, vec3(r * 1.1)), 0.02);
  float dedos = 1e3;
  for (int k = 0; k < 3; k++) {
    float fz = (-1.0 + float(k)) * r * 0.62;
    vec3 base = m + f * 0.06 + z * fz;
    dedos = min(dedos, sdCap(q, base, base + f * 0.035 + cu * 0.03, r * 0.3));
    dedos = min(dedos, sdCap(q, base + f * 0.035 + cu * 0.03, base + f * 0.03 + cu * 0.065, r * 0.27));
  }
  float pulgar = sdCap(q, m + f * 0.02 - z * r * 0.9, m + f * 0.05 - z * r * 0.8 + cu * 0.04, r * 0.34);
  return smin(palma, smin(dedos, pulgar, 0.008), 0.01);
}
/* devuelve (distancia, material); material 3 piel, A.matRopa ropa, 9 botas, 27 pelo, 28 gorra, 4 sombrero */
vec2 persona(vec3 q, Pose P, Aspecto A) {
  q /= A.escala;
  float m = A.mujer;
  float torso = sdCap(q, P.cad, P.pecho, 0.15 - 0.02 * m);
  torso = smin(torso, sdCap(q, P.pecho, P.hom, 0.135 - 0.015 * m), 0.08);
  torso = smin(torso, sdElip(q - (P.cad + P.pecho) * 0.5 - vec3(-0.035, 0.0, 0.0), vec3(0.17, 0.15, 0.16) * (0.8 + 0.25 * A.panza)), 0.08);
  torso = smin(torso, sdElip(q - P.cad, vec3(0.14, 0.12, 0.15 + 0.03 * m)), 0.06);
  if (m > 0.5) torso = smin(torso, sdElip(q - (P.pecho + vec3(-0.08, 0.02, 0.0)), vec3(0.07, 0.06, 0.13)), 0.05);
  torso = smin(torso, length(q - P.homI) - 0.085 + 0.01 * m, 0.07);
  torso = smin(torso, length(q - P.homD) - 0.085 + 0.01 * m, 0.07);
  vec3 cab = P.cab;
  vec3 ejeCuello = normalize(cab - P.hom);
  float cuello = sdCap(q, P.hom, cab - ejeCuello * 0.08, 0.058 - 0.008 * m);
  float collar = sdCap(q, P.hom + ejeCuello * 0.07, P.hom + ejeCuello * 0.13, 0.1 - 0.01 * m) ;
  torso = smin(torso, collar, 0.03);
  float rb = 0.062 - 0.008 * m, ra = 0.052 - 0.007 * m;
  float brazos = min(smin(sdCap(q, P.homI, P.codoI, rb), sdCap(q, P.codoI, P.manoI, ra), 0.04), smin(sdCap(q, P.homD, P.codoD, rb), sdCap(q, P.codoD, P.manoD, ra), 0.04));
  float manos = min(mano(q, P.codoI, P.manoI, P.agarreI, 0.045 - 0.005 * m), mano(q, P.codoD, P.manoD, P.agarreD, 0.045 - 0.005 * m));
  float rp = 0.08 - 0.008 * m, rc = 0.065 - 0.007 * m;
  float piernas = min(smin(sdCap(q, P.cad + vec3(0.0, 0.0, -0.1), P.rodI, rp), sdCap(q, P.rodI, P.pieI, rc), 0.05), smin(sdCap(q, P.cad + vec3(0.0, 0.0, 0.1), P.rodD, rp), sdCap(q, P.rodD, P.pieD, rc), 0.05));
  vec3 fw = vec3(-1.0, 0.0, 0.0);
  float botas = min(smin(sdCap(q, P.pieI, P.pieI + fw * 0.13 + vec3(0.0, -0.01, 0.0), 0.058 - 0.006 * m), sdCap(q, P.pieI + vec3(0.0, 0.1, 0.0), P.pieI, 0.068 - 0.006 * m), 0.03), smin(sdCap(q, P.pieD, P.pieD + fw * 0.13 + vec3(0.0, -0.01, 0.0), 0.058 - 0.006 * m), sdCap(q, P.pieD + vec3(0.0, 0.1, 0.0), P.pieD, 0.068 - 0.006 * m), 0.03));
  float ropa = smin(smin(torso, brazos, 0.03), piernas, 0.04);
  /* la cabeza, girada por yaw y pitch */
  vec3 hc = q - cab; hc = rotY(hc, -P.yaw); hc.xy = rot(-P.pitch) * hc.xy;
  vec3 cz = cabeza(hc, A);
  float nuez = length(q - (cab - ejeCuello * 0.13 + vec3(-0.045, 0.0, 0.0))) - 0.018 * (1.0 - m);
  float piel = min(cz.x, min(manos, smin(cuello, nuez, 0.015)));
  if (min(piel, cz.y) < 0.01) { gHC = hc; gBarba = A.barba; gPelo = A.pelo; gMujer = m; }
  vec2 r = vec2(ropa, A.matRopa);
  if (botas < r.x) r = vec2(botas, 9.0);
  if (piel < r.x) r = vec2(piel, 3.0);
  if (cz.y < r.x) r = vec2(cz.y, 27.0);
  if (cz.z < r.x) r = vec2(cz.z, A.gorra > 0.5 ? 28.0 : 4.0);
  r.x *= A.escala;
  return r;
}

/* ---------- la chata (marco local: eje x, proa en +x) ---------- */
vec2 chata(vec3 q) {
  vec3 h = q; h.z *= 1.0 / (1.0 - 0.42 * pow(abs(h.x) / 1.35, 2.2)); h.y -= 0.17;
  float casco = sdBox3(h, vec3(1.3, 0.17, 0.36)) - 0.06;
  float hueco = sdBox3(h - vec3(0.0, 0.12, 0.0), vec3(1.2, 0.17, 0.3)) - 0.04;
  casco = max(casco, -hueco) * 0.55;
  vec2 r = vec2(casco, 1.0);
  float banco = sdBox3(q - vec3(0.12, 0.3, 0.0), vec3(0.09, 0.02, 0.36)) - 0.01;
  if (banco < r.x) r = vec2(banco, 7.0);
  float horq = min(sdCap(q, vec3(0.0, 0.3, -0.4), vec3(0.0, 0.5, -0.42), 0.015), sdCap(q, vec3(0.0, 0.3, 0.4), vec3(0.0, 0.5, 0.42), 0.015));
  if (horq < r.x) r = vec2(horq, 13.0);
  return r;
}
float remos(vec3 q, Pose P, vec3 chumI, vec3 chumD, float largo) {
  vec3 dI = normalize(chumI - P.manoI), dD = normalize(chumD - P.manoD);
  vec3 palaI = chumI + dI * largo, palaD = chumD + dD * largo;
  float r = min(sdCap(q, P.manoI, palaI, 0.025), sdCap(q, P.manoD, palaD, 0.025));
  return min(r, min(sdCap(q, palaI - dI * 0.45, palaI, 0.06), sdCap(q, palaD - dD * 0.45, palaD, 0.06)));
}
/* farol a kerosene: base, tubo de vidrio emisivo, tapa y asa */
vec2 farol(vec3 q) {
  float base = sdCil(q, 0.025, 0.055);
  float vidrio = sdCil(q - vec3(0.0, 0.1, 0.0), 0.075, 0.045);
  float tapa = sdCil(q - vec3(0.0, 0.2, 0.0), 0.02, 0.05);
  tapa = min(tapa, sdCil(q - vec3(0.0, 0.235, 0.0), 0.02, 0.025));
  float asa = sdToro(vec3(q.x, (q.y - 0.26) * 1.0, q.z * 0.5), 0.07, 0.008);
  asa = max(asa, -q.y + 0.25);
  vec2 r = vec2(min(min(base, tapa), asa), 13.0);
  if (vidrio < r.x) r = vec2(vidrio, 6.0);
  return r;
}

/* ---------- el perro (marco local: mira a -x, parado sobre y = 0) ---------- */
vec2 perro(vec3 q, float ladra) {
  float cab = 0.03 * ladra;
  float cuerpo = sdCap(q, vec3(-0.2, 0.42, 0.0), vec3(0.22, 0.4, 0.0), 0.13);
  cuerpo = smin(cuerpo, sdElip(q - vec3(-0.15, 0.4, 0.0), vec3(0.16, 0.15, 0.14)), 0.05); /* pecho */
  vec3 h = q - vec3(-0.42, 0.56 + cab, 0.0); h.xy = rot(-0.2 * ladra) * h.xy;
  float cabeza = sdElip(h, vec3(0.1, 0.085, 0.08));
  cabeza = smin(cabeza, sdCap(h, vec3(-0.05, -0.02, 0.0), vec3(-0.2, -0.05, 0.0), 0.04), 0.03); /* hocico */
  cabeza = smin(cabeza, sdElip(h - vec3(0.03, 0.06, -0.08), vec3(0.03, 0.06, 0.015)), 0.01);   /* orejas */
  cabeza = smin(cabeza, sdElip(h - vec3(0.03, 0.06, 0.08), vec3(0.03, 0.06, 0.015)), 0.01);
  float cuello = sdCap(q, vec3(-0.22, 0.45, 0.0), vec3(-0.4, 0.55, 0.0), 0.08);
  float d = smin(cuerpo, smin(cuello, cabeza, 0.04), 0.04);
  float patas = 1e3;
  for (int i = 0; i < 4; i++) { vec3 b = vec3(i < 2 ? -0.17 : 0.17, 0.3, (i == 0 || i == 2) ? -0.08 : 0.08); patas = min(patas, smin(sdCap(q, b, b + vec3(0.0, -0.15, 0.0), 0.035), sdCap(q, b + vec3(0.0, -0.15, 0.0), b + vec3(-0.03, -0.3, 0.0), 0.03), 0.02)); }
  d = smin(d, patas, 0.03);
  float cola = sdCap(q, vec3(0.3, 0.45, 0.0), vec3(0.45, 0.65 + 0.05 * sin(ladra * 20.0), 0.0), 0.025);
  d = smin(d, cola, 0.02);
  return vec2(d, 34.0);
}

/* ---------- la lancha colectiva (marco local: eje x, proa en +x, 9 m de eslora) ---------- */
vec2 lancha(vec3 q) {
  /* casco con arrufo y proa afinada */
  vec3 h = q; float x01 = clamp((h.x + 4.5) / 9.0, 0.0, 1.0);
  float ancho = 1.0 - 0.75 * pow(max(h.x - 1.5, 0.0) / 3.2, 1.8) - 0.15 * pow(max(-h.x - 3.2, 0.0) / 1.3, 2.0);
  h.z /= max(ancho, 0.05);
  float arrufo = 0.12 * pow(abs(h.x) / 4.5, 2.0);
  float casco = sdBox3(h - vec3(0.0, 0.6 + arrufo * 0.5, 0.0), vec3(4.5, 0.6 + arrufo * 0.5, 1.25)) - 0.08;
  casco = max(casco, -(sdBox3(h - vec3(-0.3, 1.15, 0.0), vec3(4.0, 0.5, 1.1)) - 0.05)); /* ahuecado */
  casco = smax(casco, -(-h.y + 0.25 - 0.25 * abs(h.z)), 0.3); /* el fondo en V suave */
  casco *= 0.7;
  vec2 r = vec2(casco, 19.0);
  float banda = max(casco - 0.03, abs(q.y - 1.05 - arrufo * 0.3) - 0.07);
  if (banda < r.x - 0.001) r = vec2(banda, 21.0);
  /* cabina: paredes con ventanas repetidas, techo, timonera adelante */
  float cab = sdBox3(q - vec3(-0.6, 1.72, 0.0), vec3(3.1, 0.62, 1.05)) - 0.03;
  float xv = mod(q.x + 0.6 + 0.65, 1.3) - 0.65;
  float ventanas = sdBox3(vec3(xv, q.y - 1.9, 0.0), vec3(0.48, 0.3, 2.0));
  ventanas = max(ventanas, -(abs(q.x + 0.6) - 2.6)); /* sin ventanas en los extremos */
  float paredes = max(cab, -ventanas);
  paredes = max(paredes, -sdBox3(q - vec3(-0.6, 1.72, 0.0), vec3(2.95, 0.55, 0.95)));
  if (paredes < r.x) r = vec2(paredes, 20.0);
  float vidrio = max(sdBox3(q - vec3(-0.6, 1.9, 0.0), vec3(3.0, 0.3, 1.03)), -sdBox3(q - vec3(-0.6, 1.9, 0.0), vec3(3.0, 0.4, 1.0)));
  vidrio = max(vidrio, ventanas);
  if (vidrio < r.x) r = vec2(vidrio, 22.0);
  float techo = sdBox3(q - vec3(-0.6, 2.38, 0.0), vec3(3.3, 0.05, 1.2)) - 0.03;
  techo = min(techo, sdBox3(q - vec3(-0.6, 2.42, 0.0), vec3(3.2, 0.1 - 0.07 * abs(q.z), 1.1)));
  if (techo < r.x) r = vec2(techo, 23.0);
  float timon = sdBox3(q - vec3(2.9, 1.75, 0.0), vec3(0.5, 0.7, 0.85)) - 0.04;
  timon = max(timon, -sdBox3(q - vec3(2.9, 2.0, 0.0), vec3(0.6, 0.3, 0.7)));
  if (timon < r.x) r = vec2(timon, 20.0);
  float vidT = sdBox3(q - vec3(2.9, 2.0, 0.0), vec3(0.45, 0.3, 0.8));
  if (vidT < r.x) r = vec2(vidT, 22.0);
  float techoT = sdBox3(q - vec3(2.9, 2.5, 0.0), vec3(0.65, 0.04, 1.0));
  if (techoT < r.x) r = vec2(techoT, 23.0);
  float mastil = sdCap(q, vec3(2.9, 2.5, 0.0), vec3(2.9, 3.4, 0.0), 0.02);
  mastil = min(mastil, sdCap(q, vec3(2.9, 3.2, -0.25), vec3(2.9, 3.2, 0.25), 0.012));
  if (mastil < r.x) r = vec2(mastil, 13.0);
  float baranda = sdCap(q, vec3(3.4, 1.35, -0.6), vec3(4.3, 1.35, 0.0), 0.02);
  baranda = min(baranda, sdCap(q, vec3(3.4, 1.35, 0.6), vec3(4.3, 1.35, 0.0), 0.02));
  baranda = min(baranda, sdCap(q, vec3(-4.3, 1.3, -0.9), vec3(-4.3, 1.3, 0.9), 0.02));
  if (baranda < r.x) r = vec2(baranda, 13.0);
  /* neumáticos como defensas */
  float def = 1e3;
  for (int i = 0; i < 3; i++) { float x = -2.5 + 1.8 * float(i); def = min(def, sdCilZ(vec3(q.x - x, q.y - 0.75, abs(q.z) - 1.25 * ancho), 0.1, 0.25)); }
  def = max(def, -sdCilZ(vec3(q.x - (-2.5 + 1.8 * floor((q.x + 3.4) / 1.8)), q.y - 0.75, abs(q.z) - 1.25 * ancho), 0.2, 0.13));
  if (def < r.x) r = vec2(def, 9.0);
  return r;
}

/* ---------- la casa: dos plantas sobre pilotes, galería al frente (-z), escalera al muelle; h relativo al pie ---------- */
/* materiales: 10 paredes, 11 techo, 12 ventana prendida, 39 ventana apagada, 13 postes, 14 tablas, 24 toalla */
vec2 casa(vec3 h, float ventanas /* bits: 1 cocina, 2 arriba izq, 4 arriba der */, float puertaAbierta, float toalla) {
  vec2 r = vec2(1e3, 0.0);
  float postes = 1e3;
  for (int i = 0; i < 3; i++) { float x = -1.6 + 1.6 * float(i); postes = min(postes, min(sdCil(h - vec3(x, 0.6, -1.2), 0.66, 0.08), sdCil(h - vec3(x, 0.6, 1.2), 0.66, 0.08))); }
  r = vec2(postes, 13.0);
  /* planta baja: 1.2 a 3.7; primer piso: 3.7 a 6.1 */
  float cuerpo = sdBox3(h - vec3(0.0, 3.65, 0.0), vec3(1.9, 2.45, 1.4)) - 0.01;
  float hv = 1e3; /* huecos de ventanas y puerta */
  hv = min(hv, sdBox3(h - vec3(-1.5, 2.35, -1.4), vec3(0.26, 0.45, 0.2)));    /* angosta, a la izquierda de la puerta */
  hv = min(hv, sdBox3(h - vec3(1.0, 2.35, -1.4), vec3(0.38, 0.45, 0.2)));     /* la cocina */
  hv = min(hv, sdBox3(h - vec3(0.0, 2.1, -1.4), vec3(0.4, 0.9, 0.2)));        /* la puerta */
  hv = min(hv, sdBox3(h - vec3(-1.0, 4.85, -1.4), vec3(0.36, 0.45, 0.2)));    /* arriba */
  hv = min(hv, sdBox3(h - vec3(1.0, 4.85, -1.4), vec3(0.36, 0.45, 0.2)));
  hv = min(hv, sdBox3(h - vec3(-1.9, 2.35, 0.3), vec3(0.2, 0.42, 0.36)));     /* costados */
  hv = min(hv, sdBox3(h - vec3(1.9, 4.85, 0.3), vec3(0.2, 0.42, 0.36)));
  cuerpo = max(cuerpo, -hv);
  cuerpo = max(cuerpo, -sdBox3(h - vec3(0.0, 3.65, 0.0), vec3(1.8, 2.5, 1.3)));           /* hueca */
  if (cuerpo < r.x) r = vec2(cuerpo, 10.0);
  float pisos = min(sdBox3(h - vec3(0.0, 1.22, 0.0), vec3(1.85, 0.04, 1.35)), sdBox3(h - vec3(0.0, 3.68, 0.0), vec3(1.85, 0.05, 1.35)));
  if (pisos < r.x) r = vec2(pisos, 14.0);
  float tabique = sdBox3(h - vec3(0.0, 2.45, 1.32), vec3(1.85, 1.25, 0.03)); /* pared del fondo de la cocina */
  tabique = min(tabique, sdBox3(h - vec3(0.4, 2.0, 1.05), vec3(0.9, 0.05, 0.3)));  /* la mesada */
  if (tabique < r.x) r = vec2(tabique, 30.0);
  /* marcos que sobresalen y parante del medio */
  float marcos = 1e3;
  for (int i = 0; i < 4; i++) {
    vec3 c = vec3(i == 0 ? -1.5 : i == 2 ? -1.0 : 1.0, i < 2 ? 2.35 : 4.85, -1.4);
    float an = i == 0 ? 0.26 : 0.38;
    float mk = sdBox3(h - c, vec3(an + 0.05, 0.5, 0.04)); mk = max(mk, -sdBox3(h - c, vec3(an - 0.01, 0.44, 0.2)));
    mk = min(mk, sdBox3(h - c, vec3(0.015, 0.45, 0.03)));
    marcos = min(marcos, mk);
  }
  if (marcos < r.x) r = vec2(marcos, 13.0);
  /* vidrios: prendidos o apagados */
  float vCoc = sdBox3(h - vec3(1.0, 2.35, -1.34), vec3(0.38, 0.45, 0.005));
  float vDer = sdBox3(h - vec3(-1.5, 2.35, -1.34), vec3(0.26, 0.45, 0.005));
  float vAI = sdBox3(h - vec3(-1.0, 4.85, -1.34), vec3(0.36, 0.45, 0.005));
  float vAD = sdBox3(h - vec3(1.0, 4.85, -1.34), vec3(0.36, 0.45, 0.005));
  float vLat = min(sdBox3(h - vec3(-1.84, 2.35, 0.3), vec3(0.005, 0.42, 0.36)), sdBox3(h - vec3(1.84, 4.85, 0.3), vec3(0.005, 0.42, 0.36)));
  float coc = mod(ventanas, 2.0), ai = mod(floor(ventanas / 2.0), 2.0), ad = mod(floor(ventanas / 4.0), 2.0);
  if (vCoc < r.x) r = vec2(vCoc, coc > 0.5 ? 12.0 : 39.0);
  if (vDer < r.x) r = vec2(vDer, 39.0);
  if (vAI < r.x) r = vec2(vAI, ai > 0.5 ? 12.0 : 39.0);
  if (vAD < r.x) r = vec2(vAD, ad > 0.5 ? 12.0 : 39.0);
  if (vLat < r.x) r = vec2(vLat, 39.0);
  /* la puerta: cerrada en el hueco, o abierta contra la pared de afuera, a la izquierda del hueco */
  float puerta = puertaAbierta > 0.5 ? sdBox3(h - vec3(-0.8, 2.1, -1.45), vec3(0.4, 0.88, 0.02)) : sdBox3(h - vec3(0.0, 2.1, -1.33), vec3(0.39, 0.88, 0.02));
  if (puerta < r.x) r = vec2(puerta, 13.0);
  /* entrepiso visible desde afuera: una línea de tablas */
  float cornisa = sdBox3(h - vec3(0.0, 3.7, -1.42), vec3(1.92, 0.04, 0.04));
  if (cornisa < r.x) r = vec2(cornisa, 13.0);
  /* techo a dos aguas sobre el eje x, chapa, con alero y chimenea */
  float techo = max(max((h.y - 6.05) + 0.6 * abs(h.z) - 1.0, -(h.y - 6.02)), abs(h.x) - 2.15);
  techo = max(techo, abs(h.z) - 1.75);
  if (techo < r.x) r = vec2(techo, 11.0);
  float chimenea = sdBox3(h - vec3(1.2, 6.7, 0.4), vec3(0.12, 0.35, 0.12));
  if (chimenea < r.x) r = vec2(chimenea, 10.0);
  /* galería al frente con baranda y una mesa */
  float galeria = sdBox3(h - vec3(0.0, 1.17, -2.05), vec3(1.9, 0.03, 0.65));
  if (galeria < r.x) r = vec2(galeria, 14.0);
  float baranda = sdCap(h, vec3(-1.85, 1.65, -2.68), vec3(1.85, 1.65, -2.68), 0.025);
  baranda = min(baranda, sdCap(h, vec3(-1.85, 1.65, -2.68), vec3(-1.85, 1.65, -1.45), 0.025));
  baranda = min(baranda, sdCap(h, vec3(1.85, 1.65, -2.68), vec3(1.85, 1.65, -1.45), 0.025));
  for (int i = 0; i < 7; i++) { float x = -1.85 + 0.617 * float(i); if (i != 3) baranda = min(baranda, sdCil(h - vec3(x, 1.42, -2.68), 0.23, 0.03)); }
  baranda = min(baranda, min(sdCil(h - vec3(-1.85, 1.42, -2.0), 0.23, 0.03), sdCil(h - vec3(1.85, 1.42, -2.0), 0.23, 0.03)));
  /* columnas de la galería que sostienen el alero del primer piso */
  baranda = min(baranda, min(sdCil(h - vec3(-1.85, 2.45, -2.66), 1.25, 0.05), sdCil(h - vec3(1.85, 2.45, -2.66), 1.25, 0.05)));
  if (baranda < r.x) r = vec2(baranda, 13.0);
  float alero = sdBox3(h - vec3(0.0, 3.75, -2.05), vec3(1.95, 0.03, 0.7));
  if (alero < r.x) r = vec2(alero, 14.0);
  /* la mesa de la abuela, en la galería a la derecha */
  float mesa = sdBox3(h - vec3(1.1, 1.85, -2.1), vec3(0.45, 0.02, 0.35)) - 0.01;
  for (int i = 0; i < 4; i++) { vec3 pata = vec3(1.1 + (i < 2 ? -0.4 : 0.4), 1.5, -2.1 + (mod(float(i), 2.0) < 0.5 ? -0.3 : 0.3)); mesa = min(mesa, sdBox3(h - pata, vec3(0.025, 0.32, 0.025))); }
  if (mesa < r.x) r = vec2(mesa, 29.0);
  /* la escalera: cinco escalones del muelle (y 0.3) a la galería (1.2), bajando hacia -z, en el hueco de la baranda */
  float esc = 1e3;
  for (int i = 0; i < 5; i++) { float y = 0.38 + 0.18 * float(i); float z = -3.75 + 0.26 * float(i); esc = min(esc, sdBox3(h - vec3(0.0, y, z), vec3(0.5, 0.02, 0.14))); }
  esc = min(esc, min(sdBox3(h - vec3(-0.5, 0.8, -3.2), vec3(0.025, 0.55, 0.65)), sdBox3(h - vec3(0.5, 0.8, -3.2), vec3(0.025, 0.55, 0.65)))); /* zancas */
  esc = min(esc, min(sdCap(h, vec3(-0.5, 0.9, -3.85), vec3(-0.5, 2.0, -2.75), 0.025), sdCap(h, vec3(0.5, 0.9, -3.85), vec3(0.5, 2.0, -2.75), 0.025))); /* pasamanos */
  if (esc < r.x) r = vec2(esc, 14.0);
  /* el muelle, al pie de la escalera y hacia la izquierda, con sus postes */
  float muelle = sdBox3(h - vec3(-0.8, 0.3, -4.1), vec3(1.6, 0.025, 0.45));
  if (muelle < r.x) r = vec2(muelle, 14.0);
  float pm = 1e3;
  for (int i = 0; i < 3; i++) { float x = -2.2 + 1.3 * float(i); pm = min(pm, min(sdCil(h - vec3(x, 0.05, -4.5), 0.45, 0.05), sdCil(h - vec3(x, 0.05, -3.7), 0.45, 0.05))); }
  if (pm < r.x) r = vec2(pm, 13.0);
  /* la toalla colgada en la baranda, a la derecha de la escalera, que se mueve con el viento */
  if (toalla > 0.5) {
    vec3 tq = h - vec3(0.9, 1.4, -2.68);
    float ondula = 0.03 * sin(tq.y * 9.0 + uT * 3.0) * smoothstep(0.0, -0.4, tq.y) + 0.02 * sin(tq.x * 11.0 - uT * 4.1) * smoothstep(0.0, -0.3, tq.y);
    float toa = sdBox3(tq - vec3(0.0, 0.0, ondula - 0.02 * smoothstep(0.0, -0.4, tq.y)), vec3(0.3, 0.27, 0.012 + 0.025 * smoothstep(-0.05, 0.05, tq.y) * step(-0.05, tq.y))) - 0.01;
    if (toa < 0.01) gToalla = tq;
    if (toa < r.x) r = vec2(toa, 24.0);
  }
  return r;
}
/* sauce: c relativo al pie del tronco */
vec2 sauce(vec3 c, float t, float semilla, float viento) {
  float esc = 0.85 + 0.5 * hash1(semilla + 2.0); c /= esc;
  vec2 r = vec2(sdCap(c, vec3(0.0, -0.3, 0.0), vec3(0.05, 2.1, 0.0), 0.14 + 0.03 * semilla / 20.0), 16.0);
  float sway = (0.04 + 0.1 * viento) * sin(t * (1.0 + viento) + semilla);
  vec3 cc = c - vec3(0.05 + sway, 2.6, 0.0);
  float copa = length(cc * vec3(0.85, 1.3, 0.85)) - 1.45 + 0.5 * fbm4(cc.xy * 1.6 + cc.z * 1.3 + semilla) + 0.12 * noise(cc.xz * 7.0 + cc.y * 5.0);
  copa = smin(copa, length((cc - vec3(0.9, -0.3, 0.6)) * vec3(0.9, 1.4, 0.9)) - 0.9 + 0.4 * fbm4(cc.yz * 2.0 + semilla), 0.5);
  copa = smin(copa, length((cc - vec3(-0.8, -0.1, -0.7)) * vec3(0.9, 1.4, 0.9)) - 0.85 + 0.4 * fbm4(cc.xy * 2.0 + semilla + 3.0), 0.5);
  vec3 cu = c - vec3(0.05 + sway * 0.5, 0.0, 0.0);
  vec2 celda = floor(cu.xz * 5.0), loc = fract(cu.xz * 5.0) - 0.5;
  float hay = step(0.5, noise(celda * 0.7 + semilla)) * step(length(celda / 5.0), 1.0);
  float largo = 0.9 + 1.2 * noise(celda * 1.3 + semilla + 5.0);
  float hebra = mix(1.0, length(loc) / 5.0 - 0.018 + 0.5 * (1.0 - hay), hay);
  hebra = max(hebra, max(cu.y - 2.3, (2.45 - largo) - cu.y));
  float foll = min(copa, hebra);
  if (foll < r.x) r = vec2(foll, 15.0);
  r.x *= esc;
  return r;
}
/* una orilla con sauces repetidos a lo largo de x, a la distancia z0 (positivo: enfrente); devuelve (dist, mat) */
vec2 orilla(vec3 p, float t, float z0, float lado, float semilla, float viento) {
  /* barranca de barro */
  float borde = z0 + lado * (5.0 * (noise(p.xx * 0.04 + semilla) - 0.5) + 1.2 * noise(p.xx * 0.25 + semilla) + 0.3 * noise(p.xx * 1.1 + semilla));
  float dz = lado * (p.z - borde);
  float alto = 0.1 + 0.3 * smoothstep(0.0, 3.0, dz) + 0.08 * fbm4(p.xz * 1.6 + semilla);
  float barranca = smax(p.y - alto, -dz, 0.6);
  vec2 r = vec2(barranca, 17.0);
  /* sauces cada 7 m, corridos con ruido */
  float celda = floor(p.x / 7.0);
  vec3 base = vec3(celda * 7.0 + 3.5 + 2.0 * (hash1(celda + semilla) - 0.5), 0.0, borde + lado * (1.6 + 1.5 * hash1(celda * 3.1 + semilla)));
  vec3 c = p - base;
  float ds = length(c - vec3(0.0, 2.2, 0.0)) - 3.6;
  if (ds < 0.2) { vec2 m = sauce(c, t, hash1(celda + semilla * 2.0) * 20.0, viento); if (m.x < r.x) r = m; } else if (ds < r.x) r = vec2(ds, 0.0);
  return r;
}

/* ---------- cielo ---------- */
vec3 skyBase(vec3 d, Clima c, vec3 sd) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 arribaN = vec3(0.012, 0.018, 0.035), horizN = vec3(0.06, 0.07, 0.09);
  vec3 arribaD = vec3(0.40, 0.44, 0.50), horizD = vec3(0.66, 0.67, 0.68);
  vec3 arribaA = vec3(0.22, 0.30, 0.46), horizA = vec3(1.0, 0.62, 0.32);
  vec3 arriba = mix(mix(arribaN, arribaD, c.luz), arribaA, c.alba), horiz = mix(mix(horizN, horizD, c.luz), horizA, c.alba);
  vec3 col = mix(horiz, arriba, pow(h, 0.45));
  float s = max(dot(d, sd), 0.0);
  col += (vec3(1.0, 0.7, 0.4) * pow(s, 18.0) * 1.2 + vec3(1.0, 0.85, 0.6) * pow(s, 400.0) * 2.5) * c.alba;
  return col;
}
vec3 sky(vec3 d, float t) {
  Clima c = clima(t); vec3 sd = sunDir(t);
  vec3 col = skyBase(d, c, sd);
  vec2 uv = d.xz / max(d.y, 0.02);
  float n = fbm(uv * 0.55 + c.corriente * 0.0 + vec2(t * 0.06 * (1.0 + c.viento), t * 0.02)), n2 = fbm4(uv * 1.3 - vec2(t * 0.1 * (1.0 + c.viento), 0.0));
  float cob = c.nubes;
  float cl = smoothstep(cob - 0.45, cob + 0.05, n * 0.7 + n2 * 0.3);
  float s = max(dot(d, sd), 0.0);
  vec3 nubeN = vec3(0.045, 0.05, 0.065), nubeD = vec3(0.52, 0.53, 0.55) * (0.75 + 0.5 * n2), nubeA = vec3(0.9, 0.55, 0.42) * (0.6 + 0.6 * s);
  vec3 nube = mix(mix(nubeN, nubeD, c.luz), nubeA, c.alba * 0.8);
  nube += vec3(1.0, 0.95, 0.9) * uFlash * 0.9 * (0.5 + 0.5 * n);
  col = mix(col, nube, cl * smoothstep(0.0, 0.25, d.y));
  vec2 sp = d.xz / max(d.y, 0.05) * 60.0;
  float st = step(0.9975, hash(floor(sp))) * (1.0 - cl) * (1.0 - c.luz) * (1.0 - c.alba) * smoothstep(0.05, 0.3, d.y);
  col += vec3(0.9, 0.9, 1.0) * st * (0.5 + 0.5 * sin(t * 3.0 + hash(floor(sp)) * 20.0));
  col += vec3(0.75, 0.8, 1.0) * uFlash * 0.35;
  float ang = atan(d.x, d.z);
  float monte = 0.008 + 0.016 * fbm4(vec2(ang * 9.0, 0.0)) + 0.005 * noise(vec2(ang * 60.0, 1.0));
  vec3 colMonte = mix(mix(vec3(0.02, 0.025, 0.035), vec3(0.4, 0.42, 0.42), c.luz), vec3(0.3, 0.22, 0.2), c.alba);
  col = mix(col, colMonte, (1.0 - smoothstep(monte - 0.004, monte + 0.004, d.y)) * step(0.0, d.y) * 0.9);
  return col;
}

/* ---------- marcha, normal, oclusión y sombras ---------- */
bool envolvente(vec3 ro, vec3 rd, vec3 c, float R, out float t0, out float t1) {
  vec3 oc = ro - c; float b = dot(oc, rd), cc = dot(oc, oc) - R * R, h = b * b - cc;
  if (h < 0.0) return false; h = sqrt(h); t0 = max(-b - h, 0.0); t1 = -b + h; return t1 > 0.0;
}
vec2 marchar(vec3 ro, vec3 rd, float t, float tmax) {
  float d = 0.02; float t1 = min(tmax, ALCANCE);
  for (int i = 0; i < PASOS; i++) {
    vec3 p = ro + rd * d;
    vec2 m = mapaMundo(p, t);
    if (m.x < 0.0015 * d) return vec2(d, m.y);
    d += m.x * 0.85;
    if (d > t1) break;
  }
  return vec2(-1.0, 0.0);
}
vec3 normal(vec3 p, float t) {
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(mapaMundo(p + e.xyy, t).x - mapaMundo(p - e.xyy, t).x, mapaMundo(p + e.yxy, t).x - mapaMundo(p - e.yxy, t).x, mapaMundo(p + e.yyx, t).x - mapaMundo(p - e.yyx, t).x));
}
float ao(vec3 p, vec3 n, float t) { float o = 0.0, s = 1.0; for (int i = 1; i <= 5; i++) { float h = 0.015 * float(i); float d = mapaMundo(p + n * h, t).x; o += (h - d) * s; s *= 0.7; } return clamp(1.0 - 2.2 * o, 0.0, 1.0); }
float sombra(vec3 p, vec3 l, float t) {
  float res = 1.0, d = 0.03; vec3 rd = normalize(l - p); float maxd = length(l - p) - 0.1;
  for (int i = 0; i < 14; i++) { float h = mapaMundo(p + rd * d, t).x; res = min(res, 10.0 * h / d); d += clamp(h, 0.02, 0.25); if (res < 0.01 || d > maxd) break; }
  return clamp(res, 0.0, 1.0);
}
float sombraDir(vec3 p, vec3 dir, float t) {
  float res = 1.0, d = 0.05;
  for (int i = 0; i < 16; i++) { float h = mapaMundo(p + dir * d, t).x; res = min(res, 8.0 * h / d); d += clamp(h, 0.03, 0.5); if (res < 0.01 || d > 12.0) break; }
  return clamp(res, 0.0, 1.0);
}

/* ---------- materiales ---------- */
struct Material { vec3 alb; vec3 emis; float brillo; float piel; };
Material material(vec3 p, inout vec3 n, float mat, float t) {
  Material m; m.alb = vec3(0.3); m.emis = vec3(0.0); m.brillo = 0.3; m.piel = 0.0;
  Clima c = clima(t);
  if (mat < 1.5) { m.alb = vec3(0.26, 0.15, 0.08) * (0.8 + 0.4 * noise(p.xy * 30.0 + p.z)); m.brillo = 1.0; }
  else if (mat < 2.5) { m.alb = vec3(0.1, 0.13, 0.1); n = normalize(n + 0.14 * vec3(noise(p.yz * 45.0) - 0.5, noise(p.xz * 45.0 + 3.0) - 0.5, noise(p.xy * 45.0 + 7.0) - 0.5)); m.brillo = 0.5; }
  else if (mat < 3.5) {
    /* piel: barba, pelo, cejas, boca y ojos pintados según la posición en la cabeza */
    mapaMundo(p, t); vec3 hc = gHC;
    float barba = gBarba * smoothstep(-0.02, -0.05, hc.y) * step(hc.x, -0.01) * step(-0.14, hc.y) * (0.5 + 0.5 * noise(hc.yz * 90.0));
    float pelo = step(0.5, gPelo) * smoothstep(0.0, 0.03, hc.x) * step(-0.06, hc.y) * step(hc.y, 0.09);
    pelo = max(pelo, step(0.038, hc.y) * step(hc.y, 0.058) * step(hc.x, -0.09) * step(0.015, abs(hc.z)) * step(abs(hc.z), 0.07));
    vec3 tonoPiel = mix(vec3(0.58, 0.45, 0.38), vec3(0.66, 0.51, 0.44), gMujer);
    m.alb = mix(tonoPiel, vec3(0.14, 0.11, 0.09), max(barba * 0.75, pelo));
    m.alb *= 1.0 - 0.7 * step(abs(hc.y + 0.058), 0.0035) * step(hc.x, -0.098) * step(abs(hc.z), 0.027);
    /* ojos: iris y pupila sobre el globo, debajo del párpado */
    vec2 oz = vec2(hc.y - 0.007, abs(hc.z) - 0.042);
    float almendra = length(oz / vec2(0.0047, 0.013));
    float enGlobo = step(hc.x, -0.095) * step(almendra, 1.0);
    float iris = length(oz / vec2(0.0048, 0.0048));
    m.alb = mix(m.alb, vec3(0.85, 0.82, 0.8), enGlobo);
    m.alb = mix(m.alb, mix(vec3(0.25, 0.17, 0.1), vec3(0.2, 0.3, 0.25), gMujer), enGlobo * step(iris, 1.0));
    m.alb = mix(m.alb, vec3(0.02), enGlobo * step(iris, 0.45));
    m.alb *= 1.0 - 0.35 * step(hc.x, -0.095) * step(abs(almendra - 1.15), 0.2); /* la línea de las pestañas */
    float labio = step(hc.x, -0.098) * step(abs(hc.z), 0.028) * step(abs(hc.y + 0.058), 0.011);
    m.alb = mix(m.alb, vec3(0.5, 0.3, 0.28), labio * (0.25 + 0.3 * gMujer));
    m.brillo = 0.4 + 1.5 * enGlobo; m.piel = 1.0 - max(barba, pelo);
  }
  else if (mat < 4.5) { m.alb = vec3(0.12, 0.1, 0.08) * (0.85 + 0.3 * noise(p.xz * 60.0)); m.brillo = 0.6; }
  else if (mat < 5.5) { m.alb = vec3(0.35, 0.25, 0.14); m.brillo = 0.8; }
  else if (mat < 6.5) { m.emis = vec3(1.0, 0.72, 0.38) * 4.0; }
  else if (mat < 7.5) m.alb = vec3(0.3, 0.2, 0.1);
  else if (mat < 9.5) { m.alb = vec3(0.06, 0.05, 0.05); m.brillo = 1.2; }
  else if (mat < 10.5) {
    float tabla = fract(p.y * 7.0); float junta = smoothstep(0.0, 0.08, tabla) * smoothstep(1.0, 0.92, tabla);
    m.alb = mix(vec3(0.2, 0.26, 0.2), vec3(0.3, 0.24, 0.16), smoothstep(0.4, 0.7, fbm4(p.xy * 3.0 + p.z))) * (0.6 + 0.4 * junta) * (0.85 + 0.3 * noise(p.xy * 40.0 + p.z * 7.0));
    n = normalize(n + 0.25 * vec3(0.0, (junta - 1.0) * 0.5, 0.0) + 0.06 * (noise(p.xy * 50.0) - 0.5)); m.brillo = 0.5;
#ifdef MARCA
    float barro = smoothstep(MARCA + 0.02, MARCA - 0.06, p.y + 0.03 * noise(p.xz * 9.0)); m.alb = mix(m.alb, vec3(0.17, 0.12, 0.075) * (0.7 + 0.5 * noise(p.xy * 25.0)), barro * 0.95); m.alb = mix(m.alb, vec3(0.5, 0.45, 0.35), step(abs(p.y - MARCA), 0.012) * 0.6); m.brillo += 0.5 * barro;
#endif
  }
  else if (mat < 11.5) { float onda = 0.5 + 0.5 * sin(p.x * 60.0); m.alb = vec3(0.16, 0.12, 0.1) * (0.7 + 0.5 * onda) * (0.7 + 0.5 * noise(p.xz * 6.0)); n = normalize(n + 0.2 * vec3(cos(p.x * 60.0), 0.0, 0.0)); m.brillo = 1.2; }
  else if (mat < 12.5) { float cortina = 0.6 + 0.4 * noise(vec2(p.x * 25.0 + p.z * 25.0, p.y * 3.0)); m.emis = vec3(1.0, 0.78, 0.45) * (0.85 + 0.15 * noise(vec2(t * 7.0, 0.0))) * 2.8 * cortina; }
  else if (mat < 13.5) { m.alb = vec3(0.1, 0.08, 0.06) * (0.8 + 0.4 * noise(p.xy * 25.0 + p.z)); m.brillo = 1.0;
#ifdef MARCA
    m.alb = mix(m.alb, vec3(0.16, 0.12, 0.08), smoothstep(MARCA + 0.03, MARCA - 0.1, p.y) * 0.8);
#endif
  }
  else if (mat < 14.5) { float tabla = fract(p.x * 6.0); float junta = smoothstep(0.0, 0.06, tabla) * smoothstep(1.0, 0.94, tabla); m.alb = vec3(0.3, 0.22, 0.14) * (0.5 + 0.5 * junta) * (0.8 + 0.4 * noise(p.xz * 30.0)); m.brillo = 1.0;
#ifdef MARCA
    float barro = smoothstep(MARCA + 0.05, MARCA - 0.1, p.y) * (0.5 + 0.5 * noise(p.xz * 4.0)); m.alb = mix(m.alb, vec3(0.22, 0.16, 0.1), barro * 0.9); m.brillo += barro;
#endif
  }
  else if (mat < 15.5) { m.alb = mix(vec3(0.08, 0.14, 0.06), vec3(0.2, 0.26, 0.1), noise(p.xz * 8.0 + p.y)); n = normalize(n + 0.5 * vec3(noise(p.yz * 30.0) - 0.5, noise(p.xz * 30.0) - 0.5, noise(p.xy * 30.0) - 0.5)); m.brillo = 0.4; }
  else if (mat < 16.5) { m.alb = vec3(0.14, 0.1, 0.07) * (0.7 + 0.5 * noise(vec2(p.y * 20.0, atan(p.x, p.z) * 8.0))); m.brillo = 0.3; }
  else if (mat < 17.5) { float pasto = smoothstep(0.35, 0.6, fbm4(p.xz * 1.5)) * smoothstep(0.15, 0.5, p.y); m.alb = mix(vec3(0.13, 0.09, 0.06) * (0.7 + 0.5 * noise(p.xz * 12.0)), vec3(0.12, 0.16, 0.06) * (0.7 + 0.6 * noise(p.xz * 30.0)), pasto); n = normalize(n + 0.3 * pasto * vec3(noise(p.xz * 40.0) - 0.5, 0.0, noise(p.zx * 40.0) - 0.5)); m.brillo = 0.9 - 0.7 * pasto; }
  else if (mat < 19.5) { m.alb = vec3(0.3, 0.17, 0.08) * (0.75 + 0.5 * noise(vec2(p.x * 3.0 + p.z * 3.0, p.y * 40.0))) * (1.0 - 0.4 * smoothstep(0.7, 0.2, p.y)); m.brillo = 1.4; } /* casco de madera barnizada, con la línea de agua sucia */
  else if (mat < 20.5) { m.alb = vec3(0.78, 0.77, 0.73) * (0.85 + 0.2 * noise(p.xy * 8.0 + p.z)); m.brillo = 0.8; } /* cabina pintada de blanco */
  else if (mat < 21.5) { m.alb = vec3(0.08, 0.16, 0.38); m.brillo = 1.0; }
  else if (mat < 22.5) { m.alb = vec3(0.04, 0.05, 0.06); m.brillo = 3.0; }
  else if (mat < 23.5) { m.alb = vec3(0.6, 0.6, 0.58) * (0.8 + 0.3 * noise(p.xz * 5.0)); m.brillo = 0.6; }
  else if (mat < 24.5) { mapaMundo(p, t); vec3 tq = gToalla; vec2 cel = vec2(fract(tq.x * 10.0) - 0.5, (tq.y + 0.2) * 10.0); float flor = step(length(cel), 0.3) * step(abs(tq.y + 0.2), 0.05); float centro = step(length(cel), 0.1); float tira = step(abs(tq.y + 0.2), 0.065); m.alb = mix(mix(vec3(0.45, 0.68, 0.82), vec3(0.4, 0.6, 0.72), tira), mix(vec3(0.85, 0.45, 0.55), vec3(0.95, 0.85, 0.4), centro), flor) * (0.8 + 0.4 * noise(p.xy * 120.0 + p.z * 120.0)); m.brillo = 0.1; }
  else if (mat < 25.5) { m.alb = vec3(0.16, 0.055, 0.05); n = normalize(n + 0.12 * vec3(noise(p.yz * 45.0) - 0.5, noise(p.xz * 45.0 + 3.0) - 0.5, noise(p.xy * 45.0 + 7.0) - 0.5)); m.brillo = 0.5; }
  else if (mat < 26.5) { m.alb = vec3(0.6, 0.55, 0.35); n = normalize(n + 0.1 * vec3(noise(p.yz * 40.0) - 0.5, noise(p.xz * 40.0 + 3.0) - 0.5, noise(p.xy * 40.0 + 7.0) - 0.5)); m.brillo = 1.6; }
  else if (mat < 27.5) { mapaMundo(p, t); vec3 hc = gHC; float hebra = noise(vec2(atan(hc.z, hc.x) * 40.0, hc.y * 6.0)); m.alb = mix(vec3(0.1, 0.075, 0.06), vec3(0.28, 0.19, 0.12), gMujer * 0.6) * (0.5 + 1.0 * hebra); n = normalize(n + 0.25 * vec3(0.0, hebra - 0.5, 0.0) + 0.15 * (noise(hc.xz * 120.0) - 0.5)); m.brillo = 0.7; }
  else if (mat < 28.5) { m.alb = vec3(0.07, 0.09, 0.16) * (0.85 + 0.3 * noise(p.xz * 60.0)); m.brillo = 0.4; }
  else if (mat < 29.5) { m.alb = vec3(0.42, 0.33, 0.2) * (0.75 + 0.4 * noise(vec2(p.x * 40.0, p.z * 4.0))); m.brillo = 0.4; }
  else if (mat < 30.5) { float tabla = fract(p.y * 6.0); float junta = smoothstep(0.0, 0.06, tabla) * smoothstep(1.0, 0.94, tabla); m.alb = vec3(0.5, 0.56, 0.48) * (0.7 + 0.3 * junta) * (0.9 + 0.2 * noise(p.xy * 30.0 + p.z * 30.0)) * (0.85 + 0.3 * smoothstep(0.3, 0.7, fbm4(p.xz * 2.0 + p.y))); m.brillo = 0.15; } /* pared interior pintada, de tablas */
  else if (mat < 31.5) { m.alb = vec3(0.9, 0.85, 0.7); m.emis = vec3(1.0, 0.7, 0.35) * 0.6; m.brillo = 0.3; }
  else if (mat < 32.5) { float onda = 0.5 + 0.5 * sin(p.x * 50.0 + p.z * 50.0); m.alb = mix(vec3(0.3, 0.3, 0.3), vec3(0.3, 0.16, 0.1), smoothstep(0.4, 0.7, fbm4(p.xy * 2.0 + p.z * 2.0))) * (0.7 + 0.4 * onda); m.brillo = 1.2; }
  else if (mat < 33.5) { float tabla = fract(p.z * 8.0); m.alb = vec3(0.4, 0.33, 0.22) * (0.5 + 0.5 * smoothstep(0.0, 0.1, tabla) * smoothstep(1.0, 0.9, tabla)); m.brillo = 0.8; }
  else if (mat < 34.5) { m.alb = vec3(0.03, 0.028, 0.025); n = normalize(n + 0.3 * vec3(noise(p.yz * 60.0) - 0.5, noise(p.xz * 60.0 + 3.0) - 0.5, noise(p.xy * 60.0 + 7.0) - 0.5)); m.brillo = 1.0; }
  else if (mat < 35.5) { m.alb = vec3(0.6, 0.5, 0.35) * (0.8 + 0.3 * noise(p.xy * 50.0 + p.z * 50.0)); m.brillo = 0.1; }
  else if (mat < 36.5) { m.alb = vec3(0.5, 0.42, 0.3) * (0.7 + 0.5 * noise(vec2(p.x * 80.0 + p.z * 80.0, p.y * 80.0))); m.brillo = 0.2; }
  else if (mat < 38.5) { m.emis = vec3(1.0, 0.95, 0.8) * 5.0; }
  else if (mat < 39.5) { m.alb = vec3(0.03, 0.035, 0.045); m.brillo = 3.5; }
  else if (mat < 41.5) { m.alb = vec3(0.3, 0.33, 0.4); n = normalize(n + 0.1 * vec3(noise(p.yz * 50.0) - 0.5, noise(p.xz * 50.0 + 3.0) - 0.5, noise(p.xy * 50.0 + 7.0) - 0.5)); m.brillo = 0.1; }
  else { m.alb = vec3(0.3); }
  return m;
}

/* ---------- iluminación ---------- */
vec3 ambiente(Clima c) { return mix(mix(vec3(0.03, 0.04, 0.06), vec3(0.5, 0.52, 0.55), c.luz), vec3(0.45, 0.38, 0.38), c.alba * 0.7); }
vec3 sombrear(vec3 p, vec3 n, vec3 rd, float mat, float t) {
  Clima c = clima(t);
  Material m = material(p, n, mat, t);
  if (dot(m.emis, m.emis) > 0.0 && m.brillo < 0.001) return m.emis;
  float oc = ao(p, n, t);
  vec3 amb = ambiente(c) * (0.55 + 0.45 * n.y);
  vec3 col = m.alb * amb * oc + m.emis;
  vec3 sd = sunDir(t); vec3 rf = reflect(rd, n);
  if (c.alba > 0.02) { float sol = max(dot(n, sd), 0.0) * 1.4 * c.alba * sombraDir(p + n * 0.02, sd, t); col += m.alb * vec3(1.0, 0.8, 0.6) * sol; col += vec3(1.0, 0.85, 0.6) * pow(max(dot(rf, sd), 0.0), 60.0) * c.alba * 0.8 * m.brillo; }
  if (c.luz > 0.02 && c.alba < 0.5) { float cen = max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0) * 0.35 * c.luz * (0.4 + 0.6 * sombraDir(p + n * 0.02, normalize(vec3(0.2, 1.0, -0.3)), t)); col += m.alb * vec3(0.95, 0.97, 1.0) * cen; }
  for (int i = 0; i < NLUCES; i++) {
    Luz L = luz(i, t); if (L.inten <= 0.0) continue;
    vec3 lv = L.pos - p; float ld = length(lv); lv /= ld;
    float sh = i < NSOMBRAS ? sombra(p, L.pos, t) : 1.0;
    float dif = max(dot(n, lv), 0.0) * L.inten / (1.0 + ld * ld * 1.2) * sh;
    col += m.alb * L.col * dif * (0.5 + 0.5 * oc);
    col += L.col * pow(max(dot(rf, lv), 0.0), 40.0) * 0.6 * L.inten / (1.0 + ld * ld) * m.brillo * sh;
    col += vec3(0.9, 0.35, 0.2) * m.piel * pow(max(dot(rd, lv), 0.0), 6.0) * 0.5 * L.inten / (1.0 + ld * ld);
  }
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  vec3 cielo = sky(normalize(vec3(n.x, abs(n.y) + 0.2, n.z)), t);
  col += cielo * rim * 0.5 * oc * m.brillo;
  col += vec3(0.7, 0.75, 1.0) * uFlash * max(dot(n, normalize(vec3(-0.3, 1.0, -0.4))), 0.0) * 2.4 * m.alb;
  return col;
}

/* ---------- el agua ---------- */
vec3 agua(vec3 ro, vec3 rd, float tw, float t, vec3 hzCol) {
  Clima c = clima(t);
  vec3 pos = ro + rd * tw;
  float dist = tw;
  float amp = 0.03 + 0.07 * c.viento;
  vec2 wp = pos.xz * 0.8 + c.corriente * t;
  float e = 0.02;
  float h0 = fbm(wp) * amp, hx = fbm(wp + vec2(e, 0.0)) * amp, hz = fbm(wp + vec2(0.0, e)) * amp;
  vec2 wq = pos.xz * 4.0 + c.corriente * t * 2.5 + vec2(0.0, t * 0.6 * c.viento);
  float a2 = 0.004 + 0.01 * c.viento;
  h0 += noise(wq) * a2; hx += noise(wq + vec2(e * 5.0, 0.0)) * a2; hz += noise(wq + vec2(0.0, e * 5.0)) * a2;
  vec3 n = normalize(vec3(h0 - hx, e * 0.9 + 0.012 * dist, h0 - hz));
  float rip = noise(pos.xz * 14.0 + t * 6.0) * c.lluvia * 0.5;
  vec4 ex = aguaExtra(pos, t);
  n = normalize(n + vec3(rip - 0.25 * c.lluvia + ex.x, 0.0, rip * 0.7 + ex.z) * 0.08);
  vec3 refl = reflect(rd, n); refl.y = abs(refl.y) + 0.01;
  vec3 rcol = sky(refl, t);
  vec2 rh = marchar(pos + n * 0.01, refl, t, ALCANCE);
  if (rh.x > 0.0) { vec3 rp = pos + refl * rh.x; vec3 rn = normal(rp, t); vec3 rc = sombrear(rp, rn, refl, rh.y, t); rcol = mix(rcol, mix(rc, hzCol, (1.0 - exp(-rh.x * c.niebla)) * 0.5), 0.9); }
  float fr = mix(0.14, 1.0, pow(1.0 - max(dot(-rd, n), 0.0), 3.5));
  vec3 aguaBase = mix(mix(vec3(0.015, 0.02, 0.03), vec3(0.17, 0.13, 0.085), c.luz), vec3(0.16, 0.11, 0.07), c.alba);
  vec3 col = mix(aguaBase, rcol, fr);
  col = mix(col, vec3(0.75, 0.72, 0.65) * (0.3 + 0.7 * c.luz + 0.4 * c.alba), clamp(ex.y, 0.0, 1.0));
  col = mix(col, vec3(0.1, 0.09, 0.05) * (0.3 + 0.7 * c.luz), clamp(ex.w, 0.0, 1.0));
  for (int i = 0; i < NLUCES; i++) {
    Luz L = luz(i, t); if (L.inten <= 0.0) continue;
    vec3 lv = L.pos - pos; float ld = length(lv); lv /= ld;
    col += L.col * max(dot(n, lv), 0.0) * 0.25 * L.inten / (1.0 + ld * ld * 0.8);
    col += L.col * pow(max(dot(refl, lv), 0.0), 120.0) * 2.0 * L.inten / (1.0 + ld * 0.3);
  }
  vec3 sd = sunDir(t);
  col += vec3(1.0, 0.75, 0.45) * pow(max(dot(refl, sd), 0.0), 60.0) * 1.8 * c.alba;
  col += vec3(0.6, 0.7, 1.0) * pow(max(dot(refl, normalize(vec3(-0.3, 0.5, 1.0))), 0.0), 200.0) * 0.6 * (1.0 - c.luz) * (1.0 - fbm4(pos.xz * 0.3 + t * 0.1));
  vec2 gc = pos.xz * 60.0 + floor(t * 12.0); float drops = step(0.996, hash(floor(gc))) * smoothstep(0.5, 0.2, length(fract(gc) - 0.5)) * c.lluvia;
  col += vec3(0.5, 0.55, 0.65) * drops * (1.0 - smoothstep(0.0, 5.0, dist)) * 0.5;
  col = mix(col, hzCol, (1.0 - exp(-dist * c.niebla)) * 0.9);
  col += vec3(0.7, 0.75, 1.0) * uFlash * 0.2;
  return col;
}
/* cámara que mira a un punto */
void mirar(vec3 ro, vec3 obj, vec2 uv, float zoom, float rollo, out vec3 rd) {
  vec3 f = normalize(obj - ro); vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0))); vec3 u = cross(r, f);
  vec2 q = rot(rollo) * uv;
  rd = normalize(f * zoom + r * q.x + u * q.y);
}
