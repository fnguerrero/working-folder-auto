(function (root) {
  'use strict';
  function num(v, d) { v = Number(v); return isFinite(v) && v >= 0 ? v : (d || 0); }

  // Costo de un viaje en auto. Todos los valores son del usuario; no hay precios incluidos.
  function calcular(e) {
    var km = num(e.km), consumo = num(e.consumo), litro = num(e.precioLitro);
    var tramos = e.idaVuelta ? 2 : 1;
    var personas = Math.max(1, Math.floor(num(e.personas, 1)));
    var kmTotal = km * tramos;
    var nafta = kmTotal * consumo / 100 * litro;
    var peajes = num(e.peajes) * tramos;
    var estacionamiento = num(e.estacionamiento);
    var desgaste = kmTotal * num(e.desgasteKm);
    var sinDesgaste = nafta + peajes + estacionamiento;
    var total = sinDesgaste + desgaste;
    var r = {
      kmTotal: kmTotal, litros: kmTotal * consumo / 100, nafta: nafta, peajes: peajes,
      estacionamiento: estacionamiento, desgaste: desgaste, sinDesgaste: sinDesgaste,
      total: total, personas: personas, porPersona: total / personas,
      porPersonaSinDesgaste: sinDesgaste / personas,
      porKm: kmTotal > 0 ? total / kmTotal : 0
    };
    var alt = e.alternativa == null || e.alternativa === '' ? null : num(e.alternativa);
    if (alt !== null && alt > 0) {
      r.alternativa = alt;
      r.autoConviene = r.porPersona < alt;
      r.diferencia = Math.abs(alt - r.porPersona);
      // desde cuántas personas el auto sale más barato que la alternativa (por persona)
      r.personasParaEmpatar = total > 0 ? Math.floor(total / alt) + 1 : 1;
      if (total / alt === Math.floor(total / alt)) r.personasParaEmpatar = total / alt + 1;
    }
    return r;
  }

  function pesos(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
  }

  function resumen(e, r) {
    var l = ['Viaje de ' + r.kmTotal + ' km en auto (' + r.personas + (r.personas === 1 ? ' persona' : ' personas') + ')',
      'Nafta: ' + pesos(r.nafta) + ' (' + r.litros.toFixed(1).replace('.', ',') + ' litros)'];
    if (r.peajes) l.push('Peajes: ' + pesos(r.peajes));
    if (r.estacionamiento) l.push('Estacionamiento: ' + pesos(r.estacionamiento));
    if (r.desgaste) l.push('Desgaste del auto: ' + pesos(r.desgaste));
    l.push('Total: ' + pesos(r.total) + ' - ' + pesos(r.porPersona) + ' por persona');
    return l.join('\n');
  }

  var api = { calcular: calcular, pesos: pesos, resumen: resumen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Viaje = api;
})(typeof self !== 'undefined' ? self : this);
