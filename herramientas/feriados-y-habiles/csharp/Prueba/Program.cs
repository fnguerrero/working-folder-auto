// Los mismos plazos calculados a mano que tests/logica.test.js, contra la clase C# que copia la página.
using System;
using System.Linq;

var fallas = 0;
var pruebas = 0;
void Igual<T>(T esperado, T real, string que)
{
    pruebas++;
    if (!Equals(esperado, real)) { fallas++; Console.WriteLine($"FALLA {que}: esperaba {esperado}, dio {real}"); }
}
DateOnly D(int a, int m, int d) => new(a, m, d);

var cal = new CalendarioArgentino();
var sinPuentes = new CalendarioArgentino(puentesNoHabiles: false);
var conJueves = new CalendarioArgentino(juevesSantoNoHabil: true);

// Sumar hábiles
Igual(D(2026, 10, 29), cal.SumarHabiles(D(2026, 10, 15), 10), "10 hábiles después del 15/10/2026");
Igual(D(2026, 11, 25), cal.SumarHabiles(D(2026, 11, 19), 3), "Soberanía 2026 pasa al lunes 23: el viernes 20 es hábil");
Igual(D(2026, 3, 25), cal.SumarHabiles(D(2026, 3, 20), 1), "puente del 23/3 más el 24/3");
Igual(D(2026, 3, 23), sinPuentes.SumarHabiles(D(2026, 3, 20), 1), "sin contar puentes, el 23/3 es hábil");
Igual(D(2026, 4, 6), cal.SumarHabiles(D(2026, 3, 31), 2), "Malvinas y Viernes Santo 2026");
Igual(D(2027, 2, 10), cal.SumarHabiles(D(2027, 2, 5), 1), "Carnaval 2027");
Igual(D(2025, 10, 13), cal.SumarHabiles(D(2025, 10, 9), 1), "12/10/2025 adelantado al viernes 10");
Igual(D(2025, 4, 17), cal.SumarHabiles(D(2025, 4, 16), 1), "Jueves Santo hábil por defecto");
Igual(D(2025, 4, 21), conJueves.SumarHabiles(D(2025, 4, 16), 1), "Jueves Santo no hábil");
Igual(D(2027, 1, 4), cal.SumarHabiles(D(2026, 12, 30), 2), "cambio de año con Año Nuevo viernes");
Igual(D(2026, 7, 8), cal.SumarHabiles(D(2026, 7, 13), -1), "para atrás: puente del 10/7 y el 9/7");
Igual(D(2026, 11, 24), cal.SumarHabiles(D(2026, 11, 21), 0), "0 hábiles desde el sábado es el próximo hábil");
Igual(D(2024, 6, 24), cal.SumarHabiles(D(2024, 6, 14), 3), "2024: Güemes lunes 17, Belgrano jueves 20 y feriado puente 21");
Igual(D(2024, 6, 24), sinPuentes.SumarHabiles(D(2024, 6, 14), 3), "en 2024 el puente era feriado: no depende de la opción");

// Hábiles entre
Igual(243, cal.HabilesEntre(D(2025, 12, 31), D(2026, 12, 31)), "hábiles de 2026");
Igual(246, sinPuentes.HabilesEntre(D(2025, 12, 31), D(2026, 12, 31)), "hábiles de 2026 sin contar puentes");
Igual(21, cal.HabilesEntre(D(2026, 9, 30), D(2026, 10, 31)), "hábiles de octubre 2026");
Igual(-21, cal.HabilesEntre(D(2026, 10, 31), D(2026, 9, 30)), "al revés da negativo");
Igual(0, cal.HabilesEntre(D(2026, 7, 8), D(2026, 7, 12)), "del 8 al 12/7/2026 no hay hábiles");

// EsHabil, QueEs, EsFeriado
Igual(true, cal.EsHabil(D(2026, 11, 20)), "20/11/2026 es hábil");
Igual(false, cal.EsHabil(D(2026, 11, 23)), "23/11/2026 no es hábil");
Igual(true, CalendarioArgentino.EsFeriado(D(2026, 11, 23)), "23/11/2026 es feriado");
Igual(false, CalendarioArgentino.EsFeriado(D(2026, 3, 23)), "el puente no es feriado");
Igual(2, CalendarioArgentino.QueEs(D(2026, 4, 2)).Count(), "2/4/2026 es Malvinas y Jueves Santo");
Igual(D(2026, 11, 20), CalendarioArgentino.QueEs(D(2026, 11, 23)).Single().Original, "fecha original de Soberanía 2026");
Igual(TipoFeriado.FeriadoTuristico, CalendarioArgentino.QueEs(D(2024, 10, 11)).Single().Tipo, "puente 2024");
Igual(16, CalendarioArgentino.DelAnio(2026).Count(f => f.EsFeriado), "feriados de 2026: 12 inamovibles y 4 trasladables");
Igual(77, CalendarioArgentino.Todos.Count, "filas cargadas");
Igual(D(2026, 12, 9), cal.ProximoHabil(D(2026, 12, 5)), "próximo hábil después del finde largo de diciembre");

// Fuera de rango
pruebas++;
try { cal.EsHabil(D(2028, 1, 3)); fallas++; Console.WriteLine("FALLA: 2028 tendría que tirar excepción"); }
catch (ArgumentOutOfRangeException e) when (e.Message.Contains("2028")) { }
pruebas++;
try { cal.SumarHabiles(D(2027, 12, 30), 3); fallas++; Console.WriteLine("FALLA: pasarse de 2027 tendría que tirar excepción"); }
catch (ArgumentOutOfRangeException) { }

Console.WriteLine(fallas == 0 ? $"OK: {pruebas} pruebas" : $"{fallas} de {pruebas} fallaron");
return fallas == 0 ? 0 : 1;
