/* Escena 14: domingo a las 3, el pasillo a la luz de la vela. Las libretas abiertas en el piso y un papel donde Verónica copia las
   fechas: 7/6, 5/7, 2/8, 6/9, 4/10. Primeros sábados. Saca el boleto del forro: la V con la cola larga, el arrastre del zurdo.
   «Él la escribió. Y ella soy yo.» Se levanta, abre la puerta con la llave: la pieza vacía, la ventana abierta sobre el agua. */
Clima clima(float t) { return Clima(0.08, 0.0, 0.95, 0.0, 0.03, 0.7, vec2(-0.9, 0.0)); }
vec3 sunDir(float t) { return normalize(vec3(0.5, 0.1, 1.0)); }
float nivelAgua(float t) { return 2.3; }
const vec3 VELA = vec3(-1.15, 3.7, 0.45); /* en el piso del rellano, del lado de los papeles, para que les dé la luz */
Luz luz(int i, float t) {
  if (i == 0) return Luz(VELA + vec3(0.0, 0.14, 0.0), vec3(1.0, 0.72, 0.4), 3.6 + 0.6 * noise(vec2(t * 9.0, 0.0)) + 0.25 * sin(t * 31.0));
  return Luz(vec3(-1.0, 4.9, -1.2), vec3(0.6, 0.65, 0.85), 1.2 * smoothstep(38.5, 40.0, t) * (1.0 + uFlash)); /* la noche que entra por la ventana abierta */
}
vec4 aguaExtra(vec3 pos, float t) { return vec4(0.0); }
float puertaAbierta(float t) { return smoothstep(38.6, 39.6, t); }
/* las fechas, una por una, con la voz (4 a 9,7 s); el boleto sale del forro a los 20 y queda al lado del papel */
float fechas(float t) { return clamp((t - 4.0) / 5.7 * 5.0, 0.0, 5.0); }
const vec3 PAPELV = vec3(-1.28, 3.722, 0.95);
const vec3 BOLETO = vec3(-1.5, 3.724, 0.62);
float papel(vec3 p, float t) {
  float ink = 0.0;
  if (abs(p.x - PAPELV.x) < 0.11 && abs(p.z - PAPELV.z) < 0.15) {
    /* cm sobre el papel, como lo ve ella sentada contra la pared del oeste (mirando a +x): x hacia +z, y hacia +x */
    vec2 f = vec2((p.z - PAPELV.z) * 100.0 + 7.4, (p.x - PAPELV.x) * 100.0 + 10.5);
    float n = fechas(t);
    for (int i = 0; i < 5; i++) {
      float k = float(i); float y0 = 3.0 + 2.6 * k; float largo = clamp(n - k, 0.0, 1.0) * (3.6 + 0.6 * hash1(k));
      float d = abs(f.y - y0 - 0.25 * sin((f.x - 2.0) * 3.0 + k)) + 10.0 * (1.0 - step(2.0, f.x) * step(f.x, 2.0 + largo));
      ink += smoothstep(0.08, 0.03, d) * step(0.35, noise(vec2(f.x * 3.0, k * 5.0)) + 0.3);
    }
  } else if (abs(p.x - BOLETO.x) < 0.15 && abs(p.z - BOLETO.z) < 0.11) {
    vec2 f = vec2((BOLETO.x - p.x) * 100.0 + 14.8, (p.z - BOLETO.z) * 100.0 + 10.5); /* el boleto, cruzado */
    f = vec2(f.y, 29.6 - f.x);
    ink += impreso(vec2(f.x, f.y), 2.5, 20.0) * 0.7;
    ink += tinta((vec2(f.x, f.y) - vec2(1.2, 22.8)) / 1.25, 1.0, 0.0, 1.0);
    ink += tinta((vec2(f.x, f.y) - vec2(9.5, 23.1)) / 1.1, 1.0, 0.0, 1.0);
  }
  return clamp(ink, 0.0, 1.0);
}
vec3 posVero(float t) {
  vec3 p = vec3(-1.58, 3.7, 1.35);
  p = mix(p, vec3(-1.42, 3.7, 1.1), smoothstep(36.0, 37.0, t));  /* se levanta y va a la puerta, que está ahí nomás */
  p = mix(p, vec3(-1.4, 3.7, 0.72), smoothstep(36.8, 38.6, t));
  p = mix(p, vec3(-1.4, 3.7, 0.2), smoothstep(39.6, 41.0, t));   /* en el vano */
  return p;
}
vec2 mapaMundo(vec3 p, float t) {
  vec2 r = interiorCasa(p, puertaAbierta(t));
  float dvl = length(p - (VELA + vec3(0.0, 0.1, 0.0))) - 0.3;
  if (dvl < 0.05) r = u2(r, vela(p - VELA, t)); else if (dvl < r.x) r = vec2(dvl, 0.0);
  /* las libretas abiertas en el piso, el papel, la lapicera, y el boleto desde los 20 s */
  float libretas = sdBox3(p - vec3(-1.05, 3.715, 1.2), vec3(0.11, 0.008, 0.08)) - 0.004;
  libretas = min(libretas, sdBox3(rotY(p - vec3(-1.6, 3.715, 0.45), 0.5), vec3(0.11, 0.008, 0.08)) - 0.004);
  if (libretas < r.x) r = vec2(libretas, 35.0);
  float hojaL = min(sdBox3(p - vec3(-1.05, 3.726, 1.2), vec3(0.1, 0.001, 0.075)), sdBox3(rotY(p - vec3(-1.6, 3.726, 0.45), 0.5), vec3(0.1, 0.001, 0.075)));
  if (hojaL < r.x) r = vec2(hojaL, 44.0);
  float papelV = sdBox3(p - PAPELV, vec3(0.105, 0.0015, 0.148));
  if (papelV < r.x) r = vec2(papelV, 44.0);
  float lapicera = sdCap(p - vec3(-1.12, 3.73, 0.75), vec3(0.0, 0.0, -0.07), vec3(0.0, 0.0, 0.07), 0.005);
  if (lapicera < r.x) r = vec2(lapicera, 52.0);
  float sale = smoothstep(18.5, 20.5, t);
  if (sale > 0.01) {
    vec3 qb = p - mix(vec3(-1.4, 4.3, 1.1), BOLETO, sale);
    float boleto = sdBox3(qb, vec3(0.148, 0.0015, 0.105));
    if (boleto < r.x) r = vec2(boleto, 44.0);
  }
  /* Verónica: sentada contra la pared del este escribiendo en el papel; después se levanta, abre y se queda en el vano */
  vec3 pv = posVero(t);
  float dv = length(p - (pv + vec3(0.0, 0.9, 0.0))) - 1.3;
  if (dv < 0.2) {
    float sentada = 1.0 - smoothstep(35.5, 36.8, t), camina = smoothstep(36.8, 37.2, t) * (1.0 - smoothstep(38.2, 38.6, t)) + smoothstep(39.6, 39.9, t) * (1.0 - smoothstep(40.7, 41.0, t));
    float a = mix(PI, PI * 0.5, smoothstep(36.4, 37.2, t)); /* sentada mira a +x; se da vuelta hacia la puerta (-z) */
    vec3 q = rotY(p - pv, a);
    Pose P = poseDePie(t * 2.0 * PI / 0.85, camina * 0.7);
    if (sentada > 0.0) {
      Pose S = poseSilla(); S.cad = vec3(0.12, 0.1, 0.0); S.pecho = vec3(0.08, 0.36, 0.0); S.hom = vec3(0.06, 0.56, 0.0); S.cab = vec3(0.02, 0.81, 0.0);
      S.homI = S.hom + vec3(0.0, -0.03, -0.18); S.homD = S.hom + vec3(0.0, -0.03, 0.18);
      S.rodI = vec3(-0.3, 0.42, -0.12); S.rodD = vec3(-0.35, 0.3, 0.14); S.pieI = vec3(-0.6, 0.05, -0.13); S.pieD = vec3(-0.75, 0.05, 0.16);
      float escribe = smoothstep(3.0, 4.0, t) * (1.0 - smoothstep(10.0, 11.0, t));
      vec3 lapiz = rotY(vec3(PAPELV.x - 0.075 + 0.026 * floor(fechas(t)), 3.75, PAPELV.z - 0.054 + 0.04 * clamp(fechas(t) - floor(fechas(t)), 0.0, 1.0)) - pv, a);
      S.manoD = mix(vec3(-0.35, 0.3, 0.2), lapiz + vec3(0.03, 0.03, 0.0), escribe); S.agarreD = mix(vec3(0.0, -1.0, 0.0), vec3(-0.6, -0.8, 0.0), escribe);
      S.manoI = vec3(-0.45, 0.06, -0.1); S.agarreI = vec3(0.0, -1.0, 0.0); S.codoD = vec3(-0.05, 0.3, 0.3); S.codoI = vec3(-0.1, 0.3, -0.25);
      float forro = smoothstep(17.5, 18.5, t) * (1.0 - smoothstep(20.5, 21.5, t)); /* la mano al forro de la campera */
      S.manoD = mix(S.manoD, S.pecho + vec3(-0.14, 0.08, -0.08), forro);
      float mira = smoothstep(21.0, 22.0, t) * (1.0 - smoothstep(34.0, 35.0, t));
      S.pitch = -0.55 * max(escribe, mira) - 0.3 * (1.0 - max(escribe, mira)); S.yaw = 0.0;
      float incl = 0.1 * escribe; S.pecho.x -= incl; S.hom.x -= incl * 1.5; S.cab.x -= incl * 2.0; S.homI.x -= incl * 1.5; S.homD.x -= incl * 1.5;
      P = mezclarPose(P, S, sentada);
      if (escribe > 0.01) { P = resolver(P); vec3 m = P.manoD * 0.94; float lap = sdCap(q, m + vec3(-0.03, -0.045, 0.0), m + vec3(0.06, 0.09, 0.0), 0.005); r = u2(r, vec2(lap, 52.0)); }
    }
    float llave = smoothstep(38.2, 38.6, t) * (1.0 - smoothstep(39.4, 39.8, t));
    vec3 picaporte = rotY(vec3(-1.08, 4.65, 0.32) - pv, a);
    P.manoD = mix(P.manoD, picaporte, llave); P.agarreD = mix(P.agarreD, vec3(0.0, 0.0, -1.0), llave);
    P.pitch = mix(P.pitch, 0.05, smoothstep(39.6, 40.0, t)); P.yaw = mix(P.yaw, -0.3 * sin((t - 40.0) * 1.5), smoothstep(40.0, 41.0, t));
    P = resolver(P);
    r = u2(r, persona(q, P, aspectoVeronica()));
  } else if (dv < r.x) r = vec2(dv, 0.0);
  /* adentro de la pieza, la ventana abierta: la hoja girada hacia adentro y la cortina que vuela */
  if (t > 38.0) {
    vec3 qh = p - vec3(-1.36, 4.85, -1.4); qh = rotY(qh, 1.9);
    float hoja = sdBox3(qh - vec3(0.36, 0.0, 0.0), vec3(0.35, 0.44, 0.01));
    if (hoja < r.x) r = vec2(hoja, 39.0);
    vec3 qc = p - vec3(-0.8, 4.85, -1.3);
    float vuela = 0.25 * sin(t * 4.0 + qc.y * 6.0) * smoothstep(0.4, -0.4, qc.y) + 0.1 * sin(t * 6.3 + qc.x * 9.0);
    float cortina = sdBox3(qc - vec3(0.0, 0.0, 0.3 * smoothstep(0.4, -0.4, qc.y) + vuela), vec3(0.3, 0.5, 0.008 + 0.02 * smoothstep(0.4, -0.4, qc.y)));
    if (cortina < r.x) r = vec2(cortina, 20.0);
  }
  return r;
}
void camara(float t, vec2 uv, out vec3 ro, out vec3 rd) {
  vec2 tiemblo = vec2(0.0015 * sin(t * 1.3), 0.002 * sin(t * 0.9 + 1.0));
  vec3 obj; float zoom = 1.4;
  if (t < 13.0) { float a = smoothstep(0.0, 13.0, t); ro = mix(vec3(-1.42, 4.42, 1.08), vec3(-1.4, 4.38, 1.06), a); obj = PAPELV; zoom = 2.2; }       /* el papel desde arriba, desde sus ojos: las fechas que aparecen */
  else if (t < 20.5) { float a = smoothstep(13.0, 20.5, t); ro = mix(vec3(0.5, 4.6, 0.5), vec3(0.4, 4.55, 0.55), a); obj = vec3(-1.4, 4.1, 1.15); zoom = 1.6; }            /* ella sentada contra la pared del rellano, la vela, las libretas */
  else if (t < 35.5) { float a = smoothstep(20.5, 35.5, t); ro = mix(vec3(-1.2, 4.3, 0.95), vec3(-1.18, 4.25, 0.92), a); obj = mix(BOLETO, PAPELV, 0.35); zoom = 2.0; }    /* el boleto al lado del papel: la V con la cola, las fechas */
  else if (t < 39.5) { float a = smoothstep(35.5, 39.5, t); ro = mix(vec3(0.7, 5.0, 1.3), vec3(0.5, 4.95, 1.2), a); obj = vec3(-1.3, 4.85, 0.6); zoom = 1.1; }             /* se levanta y va a la puerta, desde el pasillo */
  else { float a = smoothstep(39.5, 45.0, t); ro = mix(vec3(-1.15, 5.15, 0.95), vec3(-1.2, 5.1, 0.75), a); obj = vec3(-1.35, 4.45, -1.3); zoom = 1.2; } /* por encima de su hombro, a través del vano */                 /* por encima de su hombro: la pieza vacía, la ventana abierta, la cortina */
  mirar(ro, obj, uv + tiemblo, zoom, 0.0, rd);
}
