/* Asado para cuántos: lógica pura, sin DOM. Calcula cuánto comprar (carne, achuras, pan, ensaladas, bebidas,
   carbón), el orden y los tiempos en la parrilla, la lista de compras en texto y el costo con precios que pone
   el usuario. Las cantidades son las que se usan de costumbre en Argentina (ver README); se redondean a lo que se
   puede comprar. Se usa desde index.html y desde los tests (Node). */
(function (raiz) {
  "use strict";

  // Gramos de carne (cortes + achuras) por persona según cómo come.
  const GRAMOS = { adulto: 450, comilon: 650, chico: 250 };

  // Cortes y achuras: gramos por unidad (si se compra por unidad), tiempo en parrilla y notas.
  const CORTES = {
    tira: { nombre: "Asado de tira", tipo: "carne", minutos: 75, fuego: "medio", nota: "Del lado del hueso primero, 2/3 del tiempo; se da vuelta una sola vez." },
    vacio: { nombre: "Vacío", tipo: "carne", minutos: 100, fuego: "suave", nota: "Lento y del lado del cuero (la grasa) primero. Es el que más tarda." },
    entrana: { nombre: "Entraña", tipo: "carne", minutos: 18, fuego: "fuerte", nota: "Fuego fuerte y poco tiempo; va al final, jugosa." },
    matambre: { nombre: "Matambre", tipo: "carne", minutos: 90, fuego: "suave", nota: "Se puede tiernizar en leche antes. A la pizza, los últimos 10 minutos." },
    bondiola: { nombre: "Bondiola", tipo: "carne", minutos: 90, fuego: "suave", nota: "Grasa hacia abajo primero. Tiene que quedar bien cocida." },
    pollo: { nombre: "Pollo", tipo: "carne", minutos: 60, fuego: "medio", nota: "Del lado de la piel primero. Cocido del todo, sin rosado en el hueso." },
    colita: { nombre: "Colita de cuadril", tipo: "carne", minutos: 50, fuego: "medio", nota: "Entera, sellada fuerte y después a fuego medio; a punto." },
    chorizo: { nombre: "Chorizo", tipo: "achura", unidad: 110, minutos: 25, fuego: "medio", nota: "Sin pinchar. Van primero: el choripán de entrada." },
    morcilla: { nombre: "Morcilla", tipo: "achura", unidad: 120, minutos: 12, fuego: "suave", nota: "Ya viene cocida: solo se calienta, para que no explote." },
    chinchulines: { nombre: "Chinchulines", tipo: "achura", minutos: 40, fuego: "medio", nota: "Trenzados, con limón; crocantes por fuera." },
    mollejas: { nombre: "Mollejas", tipo: "achura", minutos: 35, fuego: "medio", nota: "Sal y limón; doradas y crocantes." },
    rinon: { nombre: "Riñón", tipo: "achura", minutos: 20, fuego: "medio", nota: "En vinagre un rato antes. Poco tiempo." },
    provoleta: { nombre: "Provoleta", tipo: "extra", unidad: 1, minutos: 10, fuego: "medio", nota: "Orégano y ají molido; cuando se forma la costra, se da vuelta una vez." },
  };

  const BEBIDAS = {
    cerveza: { nombre: "Cerveza", mlAdulto: 700, envase: 1000, envaseNombre: "litro", plural: "litros" },
    vino: { nombre: "Vino", mlAdulto: 250, envase: 750, envaseNombre: "botella", plural: "botellas" },
    gaseosa: { nombre: "Gaseosa", mlAdulto: 400, mlChico: 400, envase: 2250, envaseNombre: "botella de 2,25 L", plural: "botellas de 2,25 L" },
    agua: { nombre: "Agua", mlAdulto: 300, mlChico: 300, envase: 2000, envaseNombre: "bidón de 2 L", plural: "bidones de 2 L" },
    fernet: { nombre: "Fernet", mlAdulto: 80, envase: 750, envaseNombre: "botella", plural: "botellas" },
  };

  const DEFAULT = {
    adultos: 6, comilones: 0, chicos: 0, vegetarianos: 0,
    cortes: ["tira", "vacio"], achuras: ["chorizo", "morcilla"], provoleta: true,
    pan: true, ensaladas: true, bebidas: ["cerveza", "gaseosa", "agua"],
    combustible: "carbon", duracion: "normal",
  };

  function redondear(valor, paso) { return Math.round(valor / paso) * paso; }
  function arriba(valor, paso) { return Math.ceil(valor / paso - 1e-9) * paso; }
  function kg(gramos) { return Math.round(gramos / 50) * 50 / 1000; }

  function calcular(entrada) {
    const e = Object.assign({}, DEFAULT, entrada || {});
    const adultos = Math.max(0, e.adultos | 0), comilones = Math.max(0, e.comilones | 0), chicos = Math.max(0, e.chicos | 0), vegetarianos = Math.max(0, e.vegetarianos | 0);
    const comensales = adultos + comilones + chicos + vegetarianos;
    const carnivoros = adultos + comilones + chicos;
    const factorDuracion = e.duracion === "larga" ? 1.15 : e.duracion === "corta" ? 0.9 : 1;
    const gramosTotales = (adultos * GRAMOS.adulto + comilones * GRAMOS.comilon + chicos * GRAMOS.chico) * factorDuracion;

    const achuras = (e.achuras || []).filter((a) => CORTES[a]);
    const cortes = (e.cortes || []).filter((c) => CORTES[c]);
    const items = [];
    let gramosAchuras = 0;
    // Achuras por unidad: chorizo 1 por persona (los comilones, 1,5), morcilla 1 cada 2; las de peso, 80 g por persona.
    const unidadesChorizo = Math.ceil((adultos + chicos * 0.5 + comilones * 1.5) * factorDuracion);
    const unidadesMorcilla = Math.ceil(((adultos + comilones) * 0.5 + chicos * 0.5) * factorDuracion);
    achuras.forEach((a) => {
      const c = CORTES[a];
      let gramos, unidades = null;
      if (a === "chorizo") { unidades = carnivoros ? Math.max(unidadesChorizo, carnivoros ? 1 : 0) : 0; gramos = unidades * c.unidad; }
      else if (a === "morcilla") { unidades = carnivoros ? Math.max(unidadesMorcilla, 1) : 0; gramos = unidades * c.unidad; }
      else { gramos = carnivoros * 80 * factorDuracion; }
      gramosAchuras += gramos;
      items.push({ clave: a, nombre: c.nombre, tipo: "achura", gramos, unidades, kg: kg(gramos), minutos: c.minutos, fuego: c.fuego, nota: c.nota });
    });
    // Lo que queda va a los cortes, en partes iguales, con un mínimo de 500 g por corte si hay comensales.
    const gramosCortes = Math.max(0, gramosTotales - Math.min(gramosAchuras, gramosTotales * 0.4));
    cortes.forEach((k) => {
      const c = CORTES[k];
      let gramos = cortes.length ? gramosCortes / cortes.length : 0;
      if (k === "pollo") gramos *= 1.25; // el pollo tiene hueso y piel: rinde menos
      if (carnivoros && gramos < 500) gramos = 500;
      items.push({ clave: k, nombre: c.nombre, tipo: "carne", gramos, unidades: null, kg: kg(gramos), minutos: c.minutos, fuego: c.fuego, nota: c.nota });
    });
    const totalCarneKg = items.reduce((s, i) => s + i.kg, 0);

    const extras = [];
    if (e.provoleta && comensales) {
      const unidades = Math.max(1, Math.ceil((carnivoros / 4 + vegetarianos / 2) * factorDuracion));
      extras.push({ clave: "provoleta", nombre: "Provoleta", unidades, detalle: `${unidades} ${unidades === 1 ? "provoleta" : "provoletas"} (una cada 4; los vegetarianos, una cada 2)`, minutos: 10, fuego: "medio", nota: CORTES.provoleta.nota });
    }
    if (vegetarianos) {
      extras.push({ clave: "verduras", nombre: "Verduras para la parrilla", detalle: `${formatoKg(redondear(vegetarianos * 400, 100) / 1000)} (morrón, zapallito, berenjena, cebolla, choclo, papa)`, kg: redondear(vegetarianos * 400, 100) / 1000, minutos: 25, fuego: "medio", nota: "Van cuando el fuego está medio; aceite, sal y orégano." });
    }
    if (e.pan && comensales) {
      const unidades = Math.ceil(comensales * 1.2 * factorDuracion);
      extras.push({ clave: "pan", nombre: "Pan", unidades, detalle: `${unidades} pancitos o ${formatoKg(arriba(comensales * 0.1 * factorDuracion, 0.5))} de flautitas (uno y pico por persona, más si hay choripán)` });
    }
    if (e.ensaladas && comensales) {
      const gramos = redondear(comensales * 160 * factorDuracion, 100);
      extras.push({ clave: "ensaladas", nombre: "Ensaladas", kg: gramos / 1000, detalle: `${formatoKg(gramos / 1000)} en total (unos 160 g por persona): mixta, rusa o criolla; tomate, lechuga, cebolla, huevo, papa` });
    }
    extras.push({ clave: "chimi", nombre: "Chimichurri y salsa criolla", detalle: comensales > 8 ? "Un frasco grande de cada uno, o hacerlos: perejil, ajo, orégano, ají molido, vinagre y aceite" : "Un frasco de cada uno, o hacerlos" });
    extras.push({ clave: "sal", nombre: "Sal parrillera", detalle: "Un paquete (gruesa o entrefina), y limón para las achuras" });

    const bebidas = (e.bebidas || []).filter((b) => BEBIDAS[b]).map((b) => {
      const d = BEBIDAS[b];
      const ml = ((adultos + comilones + vegetarianos) * d.mlAdulto + (d.mlChico ? chicos * d.mlChico : 0)) * factorDuracion;
      const envases = Math.ceil(ml / d.envase);
      const litros = (ml / 1000).toFixed(1).replace(".", ",");
      return { clave: b, nombre: d.nombre, ml, envases, envaseNombre: d.envaseNombre, detalle: envases + " " + (envases === 1 ? d.envaseNombre : d.plural) + " (" + litros + " L)" };
    });
    if (chicos && !bebidas.some((b) => b.clave === "gaseosa" || b.clave === "agua")) bebidas.push({ clave: "jugo", nombre: "Jugo o gaseosa para los chicos", ml: chicos * 400, envases: Math.ceil(chicos * 400 / 2250), envaseNombre: "botella de 2,25 L", detalle: `${Math.ceil(chicos * 400 / 2250)} botella${Math.ceil(chicos * 400 / 2250) > 1 ? "s" : ""} de 2,25 L` });
    bebidas.push({ clave: "hielo", nombre: "Hielo", detalle: `${Math.max(1, Math.ceil(comensales / 4))} bolsa${comensales > 4 ? "s" : ""} (una cada 4 personas; el doble si hace calor)` });

    // Fuego: a carbón, más o menos 1 kg por kg de carne (mínimo 3); a leña, el doble. Prender 45 minutos antes.
    const carne = totalCarneKg + (extras.find((x) => x.clave === "verduras")?.kg || 0) * 0.3;
    const combustible = e.combustible === "lena"
      ? { nombre: "Leña", kg: Math.max(6, arriba(carne * 2, 1)), detalle: "El doble que de carbón: la leña hace menos brasa por kilo. Prendela una hora antes.", prenderMinutos: 60 }
      : { nombre: "Carbón", kg: Math.max(3, arriba(carne * 1.1, 1)), detalle: "Más o menos un kilo por kilo de carne, y una bolsa de más no sobra nunca. Prendelo 45 minutos antes de poner la carne.", prenderMinutos: 45 };

    // Orden en la parrilla: cada cosa entra para que todas terminen juntas, salvo las achuras, que son la entrada.
    const aLaParrilla = items.concat(extras.filter((x) => x.minutos).map((x) => ({ nombre: x.nombre, tipo: "extra", minutos: x.minutos, fuego: x.fuego, nota: x.nota })));
    const principal = aLaParrilla.filter((i) => i.tipo === "carne");
    const deEntrada = aLaParrilla.filter((i) => i.tipo !== "carne");
    const maxPrincipal = principal.length ? Math.max(...principal.map((i) => i.minutos)) : 0;
    const maxEntrada = deEntrada.length ? Math.max(...deEntrada.map((i) => i.minutos)) : 0;
    // La entrada se sirve a los 30 minutos de empezar; el plato principal, a los maxPrincipal minutos (o 30 después de la entrada).
    const servirEntrada = deEntrada.length ? maxEntrada : 0;
    const servirPrincipal = Math.max(maxPrincipal, servirEntrada + 40);
    const plan = [];
    deEntrada.forEach((i) => plan.push({ minuto: servirEntrada - i.minutos, nombre: i.nombre, minutos: i.minutos, fuego: i.fuego, nota: i.nota, momento: "entrada" }));
    principal.forEach((i) => plan.push({ minuto: servirPrincipal - i.minutos, nombre: i.nombre, minutos: i.minutos, fuego: i.fuego, nota: i.nota, momento: "principal" }));
    plan.sort((a, b) => a.minuto - b.minuto || b.minutos - a.minutos);
    const tiempos = { prenderMinutos: combustible.prenderMinutos, servirEntrada, servirPrincipal, plan };

    return { entrada: e, comensales, carnivoros, gramosTotales, items, totalCarneKg: Math.round(totalCarneKg * 100) / 100, extras, bebidas, combustible, tiempos,
      gramosPorPersona: carnivoros ? Math.round(gramosTotales / carnivoros) : 0 };
  }

  function formatoKg(k) { return (Math.round(k * 100) / 100).toString().replace(".", ",") + " kg"; }

  function listaCompras(r) {
    const l = [];
    l.push(`Asado para ${r.comensales} (${describirGente(r.entrada)})`);
    if (r.items.length) {
      l.push("", "Carnicería:");
      r.items.forEach((i) => l.push(`- ${i.nombre}: ${i.unidades ? `${i.unidades} u. (${formatoKg(i.kg)})` : formatoKg(i.kg)}`));
      l.push(`  Total: ${formatoKg(r.totalCarneKg)}`);
    }
    l.push("", "Lo demás:");
    r.extras.forEach((x) => l.push(`- ${x.nombre}: ${x.detalle}`));
    l.push("", "Bebidas:");
    r.bebidas.forEach((b) => l.push(`- ${b.nombre}: ${b.detalle}`));
    l.push("", "Fuego:", `- ${r.combustible.nombre}: ${r.combustible.kg} kg`);
    return l.join("\n");
  }

  function describirGente(e) {
    const p = [];
    if (e.adultos) p.push(`${e.adultos} adulto${e.adultos > 1 ? "s" : ""}`);
    if (e.comilones) p.push(`${e.comilones} comil${e.comilones > 1 ? "ones" : "ón"}`);
    if (e.chicos) p.push(`${e.chicos} chico${e.chicos > 1 ? "s" : ""}`);
    if (e.vegetarianos) p.push(`${e.vegetarianos} vegetariano${e.vegetarianos > 1 ? "s" : ""}`);
    return p.join(", ") || "nadie";
  }

  /** Costo con precios por kg (carne) o por unidad/envase (lo demás). precios: {clave: número}. */
  function costo(r, precios) {
    const p = precios || {};
    const lineas = [];
    let total = 0;
    r.items.forEach((i) => { const pr = +p[i.clave] || 0; const sub = pr * i.kg; if (pr) { lineas.push({ nombre: i.nombre, cantidad: formatoKg(i.kg), precio: pr, subtotal: sub }); total += sub; } });
    r.extras.forEach((x) => { const pr = +p[x.clave] || 0; const cant = x.unidades || x.kg || 1; const sub = pr * cant; if (pr) { lineas.push({ nombre: x.nombre, cantidad: x.unidades ? `${x.unidades} u.` : x.kg ? formatoKg(x.kg) : "1", precio: pr, subtotal: sub }); total += sub; } });
    r.bebidas.forEach((b) => { const pr = +p[b.clave] || 0; const cant = b.envases || 1; const sub = pr * cant; if (pr) { lineas.push({ nombre: b.nombre, cantidad: `${cant} ${b.envaseNombre || "u."}`, precio: pr, subtotal: sub }); total += sub; } });
    const prC = +p.combustible || 0;
    if (prC) { lineas.push({ nombre: r.combustible.nombre, cantidad: `${r.combustible.kg} kg`, precio: prC, subtotal: prC * r.combustible.kg }); total += prC * r.combustible.kg; }
    const pagan = Math.max(1, r.entrada.adultos + r.entrada.comilones + r.entrada.vegetarianos);
    return { lineas, total, pagan, porPersona: total / pagan };
  }

  function pesos(n) { return "$ " + Math.round(n).toLocaleString("es-AR"); }

  Object.assign(raiz, { calcular, listaCompras, costo, formatoKg, pesos, describirGente, CORTES, BEBIDAS, DEFAULT, GRAMOS });
})(typeof module !== "undefined" ? module.exports : (window.Asado = {}));
