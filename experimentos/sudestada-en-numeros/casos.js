/* Casos históricos. "publicado" sale de fuentes que se abrieron (ver FUENTES);
   "viento" es SUPUESTO salvo en 2013, donde está leído de un gráfico publicado. */
(function (raiz) {
  'use strict';
  const FUENTES = {
    donofrio: { texto: 'D’Onofrio, Fiore y Pousa (2008), Changes in the regime of storm surges at Buenos Aires, Journal of Coastal Research 24(1A): 260-265',
      url: 'https://api.naturalis.fcnym.unlp.edu.ar/server/api/core/bitstreams/7d262cd0-f66a-4ed4-aa6a-45447d42f505/content' },
    falco: { texto: 'Falco, Robledo, Moreira y otros, Anticipando la crecida, segundo capítulo (IFRH 2014, INA)',
      url: 'https://www.ina.gob.ar/ifrh-2014/Eje3/3.36.pdf' },
    lanacion: { texto: 'La Nación, 2/11/2014, con datos del Servicio de Hidrografía Naval y pronóstico del SMN',
      url: 'https://www.lanacion.com.ar/buenos-aires/el-rio-de-la-plata-crecio-hasta-los-340-metros-por-una-sudestada-nid1740677/' },
    infobae: { texto: 'Infobae, 19/12/2023, con datos del Servicio de Hidrografía Naval',
      url: 'https://www.infobae.com/america/medio-ambiente/2023/12/19/la-mayor-sudestada-en-los-ultimos-13-anos-provoco-que-el-rio-de-la-plata-llegara-a-los-362-metros/' },
    esnota: { texto: 'Es Nota, 19/12/2023',
      url: 'https://www.esnotadiario.com/2023/12/19/en-una-crecida-record-por-la-sudestada-el-rio-de-la-plata-llego-a-los-362-metros-de-altura/' }
  };

  const CASOS = [
    { id: '1989', nombre: '12 de noviembre de 1989',
      resumen: 'Ciclogénesis sobre la costa; la segunda altura más alta del siglo XX en Buenos Aires.',
      viento: { dir: 135, kmh: 70, inicio: 6, horas: 30 },
      sobreViento: 'La fuente solo dice que hubo temporal fuerte del sudeste. Los 70 km/h y las 30 horas son supuestos nuestros.',
      publicado: [
        { punto: 'riachuelo', valor: 4.06, que: 'Buenos Aires, sobre el cero del Riachuelo', fuente: 'donofrio' },
        { punto: 'riachuelo', valor: 4.07, que: 'Mareógrafo de Palermo, 15:00', fuente: 'falco' }
      ] },
    { id: '2013', nombre: '13 al 17 de septiembre de 2013',
      resumen: 'Sudestada moderada con serie horaria publicada de viento y nivel en Bernal. Es la prueba más exigente, y el modelo la reprueba.',
      serie: { km: 265, lugar: 'Bernal', fuente: 'falco', desde: 'viernes 13/9, 0 h',
        nivel: [1.64,1.57,1.49,1.43,1.31,1.24,1.2,1.28,1.63,null,null,2.22,2.31,2.31,2.26,2.15,2.05,1.93,1.93,1.91,2.14,2.37,2.53,2.64,2.67,2.63,2.49,2.22,2.01,1.76,1.62,1.5,1.43,1.36,1.44,1.52,1.65,1.7,1.64,1.57,1.46,1.33,1.26,1.24,1.41,1.67,1.95,2.17,2.31,2.38,2.38,2.2,1.97,1.78,1.62,1.5,1.45,1.48,1.67,1.91,1.98,2.05,2.05,1.93,1.84,1.76,1.69,1.64,1.73,1.93,2.21,2.46,2.63,2.81,2.89,2.88,2.79,2.47,2.23,1.99,1.86,1.69,1.57,1.66,1.84,1.93,2.04,1.84,1.71,1.68,1.61,1.53,1.47,1.42,1.52,2.0,2.2,2.28,null,2.41,2.27,2.17,2.07,1.79,1.62,1.53],
        vel: [37,38,38,29,21,20,36,36,33,null,null,31,32,29,28,27,23,21,22,25,26,21,25,26,26,24,19,22,20,20,19,21,25,29,24,20,17,19,20,22,29,27,35,32,36,36,28,25,23,24,27,25,22,25,22,23,20,22,22,28,23,21,24,29,27,31,28,25,20,21,26,31,29,28,24,21,20,32,29,26,22,27,23,25,27,31,42,51,47,43,42,41,36,35,32,37,40,36,null,32,31,35,36,33,30,32],
        dir: [247,247,247,337,247,247,201,247,224,null,null,201,201,179,45,224,270,156,179,247,201,179,247,179,22,179,224,112,22,201,270,135,270,247,112,337,247,291,270,226,179,179,179,179,179,179,156,201,270,135,89,291,179,179,247,112,179,224,224,247,66,270,89,156,247,179,224,179,135,201,201,201,201,135,224,112,179,247,201,224,89,291,291,337,1,201,201,247,201,224,224,201,247,247,247,247,247,247,247,270,270,270,247,270,270,270] },
      sobreViento: 'Viento medido en la costa de Bernal, leído punto por punto del gráfico publicado (error estimado de lectura: unos 3 km/h y 0,05 m). La hora de la marea se ajustó solo con las primeras 24 horas.',
      publicado: [
        { punto: 'bernal', valor: 2.91, que: 'Bernal, lunes 16/9 a las 2:00', fuente: 'falco' },
        { punto: 'riachuelo', valor: 3.0, que: 'Buenos Aires, 16/9 (leído del gráfico, aproximado)', fuente: 'falco' },
        { punto: 'riachuelo', valor: 3.1, que: 'Alerta del SHN para esa crecida (leída del gráfico, aproximada)', fuente: 'falco', alerta: true }
      ] },
    { id: '2014', nombre: '1 y 2 de noviembre de 2014',
      resumen: 'Crecida con viento del este; el agua llegó más alto en San Fernando.',
      viento: { dir: 90, kmh: 57, inicio: 6, horas: 24 },
      sobreViento: 'El SMN pronosticaba viento persistente del este de 45 a 70 km/h. Usamos el valor del medio; la duración (24 h) es supuesta.',
      publicado: [
        { punto: 'sanfernando', valor: 3.40, que: 'San Fernando (más de)', fuente: 'lanacion' },
        { punto: 'riachuelo', valor: 3.20, que: 'Aeroparque', fuente: 'lanacion' },
        { punto: 'tigre', valor: 2.80, que: 'Puerto de Tigre', fuente: 'lanacion' }
      ] },
    { id: '2023', nombre: '18 y 19 de diciembre de 2023',
      resumen: 'La mayor crecida en Buenos Aires en trece años, según la prensa.',
      viento: { dir: 135, kmh: 55, inicio: 6, horas: 30 },
      sobreViento: 'Se publicó viento del sudeste de más de 50 km/h. Los 55 km/h sostenidos y las 30 horas son supuestos.',
      publicado: [
        { punto: 'riachuelo', valor: 3.62, que: 'Puerto de Buenos Aires, 18/12 22:45', fuente: 'infobae' },
        { punto: 'sanfernando', valor: 3.60, que: 'Puerto de San Fernando, 19/12 1:00', fuente: 'infobae' },
        { punto: 'laplata', valor: 3.50, que: 'La Plata, 22:00', fuente: 'infobae' }
      ] }
  ];

  const api = { CASOS, FUENTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.SudestadaCasos = api;
})(this);
