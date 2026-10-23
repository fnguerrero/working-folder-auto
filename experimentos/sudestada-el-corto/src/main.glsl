void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  float t = uT;
  Clima c = clima(t);
  vec3 ro, rd; camara(t, uv, ro, rd);
  float nivel = nivelAgua(t);
  vec3 hzCol = sky(normalize(vec3(rd.x, 0.004, rd.z)), t);
  vec3 col;
  float tw = (rd.y < 0.0 && ro.y > nivel) ? (nivel - ro.y) / rd.y : 1e5;
  vec2 hit = marchar(ro, rd, t, tw);
  if (hit.x > 0.0) {
    vec3 p = ro + rd * hit.x; vec3 n = normal(p, t);
    col = sombrear(p, n, rd, hit.y, t);
    col = mix(col, hzCol, (1.0 - exp(-hit.x * c.niebla)) * 0.6);
  } else if (tw > 1e4) {
    col = sky(rd, t);
    col = mix(col, hzCol, (1.0 - smoothstep(0.0, 0.12, rd.y)) * mix(1.0, 0.7, max(c.luz, c.alba)));
    if (uRayo.y > 0.001) {
      float yy = clamp((uv.y + 0.02) / 0.5, 0.0, 1.0);
      float x0 = uRayo.x + 0.07 * (noise(vec2(yy * 7.0 + uRayo.z, 0.0)) - 0.5) + 0.03 * (noise(vec2(yy * 23.0 + uRayo.z, 3.0)) - 0.5);
      float dx = abs(uv.x - x0);
      float nucleo = smoothstep(0.0025, 0.0, dx), halo = smoothstep(0.08, 0.0, dx) * 0.35;
      float enAltura = step(-0.02, uv.y) * step(uv.y, 0.4) * smoothstep(0.4, 0.28, uv.y);
      float x1 = x0 + 0.05 + 0.12 * yy; float rama = smoothstep(0.0018, 0.0, abs(uv.x - x1)) * step(0.15, yy) * step(yy, 0.5) * 0.7;
      col += vec3(0.85, 0.9, 1.0) * (nucleo + halo + rama) * enAltura * uRayo.y * 2.5;
    }
  } else {
    col = agua(ro, rd, tw, t, hzCol);
  }
  /* halo de las luces en el aire húmedo, si nada las tapa */
  for (int i = 0; i < NLUCES; i++) {
    Luz L = luz(i, t); if (L.inten <= 0.0) continue;
    vec3 lv = L.pos - ro; float ld = length(lv); float ang = max(dot(rd, lv / ld), 0.0);
    if (hit.x > 0.0 && hit.x < ld - 0.2) continue;
    col += L.col * (pow(ang, 900.0) * 1.2 + pow(ang, 60.0) * 0.08) * min(L.inten, 1.5) * (0.5 + 0.5 * c.lluvia);
  }
  /* lluvia en pantalla */
  if (c.lluvia > 0.001) {
    for (int k = 0; k < 3; k++) {
      float capa = float(k); float esc = 60.0 + capa * 50.0;
      vec2 ru = (frag / uRes.y) * vec2(esc, esc * 0.22);
      ru.x += ru.y * (0.3 + 0.7 * c.viento) + capa * 7.0; ru.y += t * (9.0 + capa * 3.5);
      vec2 cell = floor(ru); float rnd = hash(cell + capa * 11.0); float xoff = fract(ru.x) - 0.5;
      float gota = step(0.72 + capa * 0.06, rnd) * smoothstep(0.07, 0.0, abs(xoff)) * smoothstep(0.0, 0.25, fract(ru.y)) * smoothstep(1.0, 0.55, fract(ru.y));
      col += vec3(0.55, 0.6, 0.75) * gota * c.lluvia * (0.18 - capa * 0.04) * (1.0 + uFlash) * (0.4 + 0.6 * c.luz + 0.6 * (1.0 - c.luz));
    }
  }
#ifdef GOTAS_VIDRIO
  /* gotas sobre el vidrio de la ventana (solo donde el rayo pasó por la ventana): quietas, que brillan, y algunas que corren hacia abajo */
  if (hit.x < 0.0 || hit.x > GOTAS_VIDRIO) {
    vec2 g = frag / uRes.y * 28.0; vec2 cel = floor(g); vec2 f = fract(g) - 0.5;
    float hayGota = step(0.55, hash(cel + 3.0)); vec2 off = (vec2(hash(cel + 7.0), hash(cel + 11.0)) - 0.5) * 0.6;
    float d = length((f - off) * vec2(1.0, 0.8)); float rg = 0.05 + 0.1 * hash(cel + 5.0);
    float gota = hayGota * smoothstep(rg, rg * 0.6, d);
    float brillo = hayGota * smoothstep(rg * 0.5, 0.0, length(f - off - vec2(rg * 0.3, rg * 0.35)));
    vec2 gs = frag / uRes.y * vec2(40.0, 6.0); vec2 cs = floor(gs + vec2(0.0, t * 0.5 * (1.0 + hash(floor(gs).xx))));
    float corre = step(0.93, hash(cs + 1.0)) * smoothstep(0.08, 0.02, abs(fract(gs.x) - 0.5)) * smoothstep(0.0, 0.3, fract(gs.y + t * 0.5));
    col = mix(col, col * 0.75 + vec3(0.05, 0.06, 0.08), min(gota + corre, 1.0));
    col += vec3(0.35, 0.33, 0.3) * brillo * 0.35;
  }
#endif
  vec2 q = frag / uRes;
  float vig = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.22);
  col *= mix(0.55, 1.0, vig);
  col += (hash(frag + fract(t * 13.0)) - 0.5) * 0.02;
  col = max(col, 0.0) * 0.95;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(col, vec3(1.0 / 1.05));
  col *= uFundido;
  gl_FragColor = vec4(col, 1.0);
}
