// CalendarioArgentino: feriados nacionales de Argentina de 2024 a 2027 y cuentas de días hábiles.
// Sale de https://fnguerrero.github.io/working-folder-auto/herramientas/feriados-y-habiles/
// Lista consultada el 25/10/2026. Fuentes: Ley 27.399 y los decretos y resoluciones que figuran en cada feriado.
// Lo que falta confirmar:
//   - 2027: Los días no laborables con fines turísticos (hasta tres por año, en lunes o viernes) todavía no se fijaron.
//   - 2027: El 20/11 (Soberanía Nacional) cae sábado: por el Decreto 614/2025 la Jefatura de Gabinete puede pasarlo al viernes 19 o al lunes 22, o dejarlo donde está.
// Cada diciembre hay que agregar el año que viene (sale la resolución de los puentes) y subir UltimoAnio.
// No incluye feriados provinciales ni municipales, ni las ferias judiciales.
//
// Uso:
//   var cal = new CalendarioArgentino();                        // puentes no hábiles, Jueves Santo hábil
//   cal.EsHabil(new DateOnly(2026, 11, 20));                    // true: Soberanía se pasó al lunes 23
//   cal.SumarHabiles(new DateOnly(2026, 10, 15), 10);           // 2026-10-29
//   cal.HabilesEntre(new DateOnly(2026, 9, 30), new DateOnly(2026, 10, 31)); // 21 (no cuenta el 30/9, sí el 31/10)
//   CalendarioArgentino.QueEs(new DateOnly(2026, 3, 23));       // el puente de la Resolución 164/2025

using System;
using System.Collections.Generic;
using System.Linq;

public enum TipoFeriado
{
    /// <summary>Feriado de fecha fija (Ley 27.399).</summary>
    Inamovible,
    /// <summary>Feriado que se corre a un lunes según el art. 6 de la Ley 27.399.</summary>
    Trasladable,
    /// <summary>Feriado puente con fines turísticos (2024 y antes): es feriado, no se trabaja.</summary>
    FeriadoTuristico,
    /// <summary>Día no laborable con fines turísticos (puente desde 2025): el Estado no trabaja, en el privado decide el empleador.</summary>
    NoLaborableTuristico,
    /// <summary>Día no laborable (Jueves Santo): optativo para el empleador privado.</summary>
    NoLaborable,
}

public sealed record Feriado(DateOnly Fecha, string Nombre, TipoFeriado Tipo, string Fuente, DateOnly? Original = null)
{
    /// <summary>True si es feriado (no se trabaja y, si se trabaja, se paga doble); false si es día no laborable.</summary>
    public bool EsFeriado => Tipo is TipoFeriado.Inamovible or TipoFeriado.Trasladable or TipoFeriado.FeriadoTuristico;
}

public sealed class CalendarioArgentino
{
    public const int PrimerAnio = 2024;
    public const int UltimoAnio = 2027;

    private static readonly Feriado[] Lista =
    {
        // 2024: Ley 27.399; Decreto 106/2023 (feriados con fines turísticos).
        F(2024, 1, 1, "Año Nuevo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 2, 12, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 2, 13, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 3, 24, "Día Nacional de la Memoria por la Verdad y la Justicia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 3, 28, "Jueves Santo", TipoFeriado.NoLaborable, "Ley 27.399"),
        F(2024, 3, 29, "Viernes Santo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 4, 1, "Feriado con fines turísticos (puente)", TipoFeriado.FeriadoTuristico, "Decreto 106/2023"),
        F(2024, 4, 2, "Día del Veterano y de los Caídos en la Guerra de Malvinas", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 5, 1, "Día del Trabajador", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 5, 25, "Día de la Revolución de Mayo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 6, 17, "Paso a la Inmortalidad del General Martín Miguel de Güemes", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2024, 6, 20, "Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 6, 21, "Feriado con fines turísticos (puente)", TipoFeriado.FeriadoTuristico, "Decreto 106/2023"),
        F(2024, 7, 9, "Día de la Independencia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 8, 17, "Paso a la Inmortalidad del General José de San Martín", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2024, 10, 11, "Feriado con fines turísticos (puente)", TipoFeriado.FeriadoTuristico, "Decreto 106/2023"),
        F(2024, 10, 12, "Día del Respeto a la Diversidad Cultural", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2024, 11, 18, "Día de la Soberanía Nacional", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2024, 11, 20)),
        F(2024, 12, 8, "Inmaculada Concepción de María", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2024, 12, 25, "Navidad", TipoFeriado.Inamovible, "Ley 27.399"),

        // 2025: Ley 27.399; Decreto 1027/2024 (días no laborables con fines turísticos); Decreto 614/2025 y Resolución 139/2025 (12/10 al viernes 10).
        F(2025, 1, 1, "Año Nuevo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 3, 3, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 3, 4, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 3, 24, "Día Nacional de la Memoria por la Verdad y la Justicia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 4, 2, "Día del Veterano y de los Caídos en la Guerra de Malvinas", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 4, 17, "Jueves Santo", TipoFeriado.NoLaborable, "Ley 27.399"),
        F(2025, 4, 18, "Viernes Santo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 5, 1, "Día del Trabajador", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 5, 2, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Decreto 1027/2024"),
        F(2025, 5, 25, "Día de la Revolución de Mayo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 6, 16, "Paso a la Inmortalidad del General Martín Miguel de Güemes", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2025, 6, 17)),
        F(2025, 6, 20, "Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 7, 9, "Día de la Independencia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 8, 15, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Decreto 1027/2024"),
        F(2025, 8, 17, "Paso a la Inmortalidad del General José de San Martín", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2025, 10, 10, "Día del Respeto a la Diversidad Cultural", TipoFeriado.Trasladable, "Decreto 614/2025 y Resolución 139/2025 (Jefatura de Gabinete)", original: new DateOnly(2025, 10, 12)),
        F(2025, 11, 21, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Decreto 1027/2024"),
        F(2025, 11, 24, "Día de la Soberanía Nacional", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2025, 11, 20)),
        F(2025, 12, 8, "Inmaculada Concepción de María", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2025, 12, 25, "Navidad", TipoFeriado.Inamovible, "Ley 27.399"),

        // 2026: Ley 27.399; Resolución 164/2025 de la Jefatura de Gabinete (días no laborables con fines turísticos).
        F(2026, 1, 1, "Año Nuevo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 2, 16, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 2, 17, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 3, 23, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Resolución 164/2025 (Jefatura de Gabinete)"),
        F(2026, 3, 24, "Día Nacional de la Memoria por la Verdad y la Justicia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 4, 2, "Día del Veterano y de los Caídos en la Guerra de Malvinas", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 4, 2, "Jueves Santo", TipoFeriado.NoLaborable, "Ley 27.399"),
        F(2026, 4, 3, "Viernes Santo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 5, 1, "Día del Trabajador", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 5, 25, "Día de la Revolución de Mayo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 6, 15, "Paso a la Inmortalidad del General Martín Miguel de Güemes", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2026, 6, 17)),
        F(2026, 6, 20, "Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 7, 9, "Día de la Independencia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 7, 10, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Resolución 164/2025 (Jefatura de Gabinete)"),
        F(2026, 8, 17, "Paso a la Inmortalidad del General José de San Martín", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2026, 10, 12, "Día del Respeto a la Diversidad Cultural", TipoFeriado.Trasladable, "Ley 27.399"),
        F(2026, 11, 23, "Día de la Soberanía Nacional", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2026, 11, 20)),
        F(2026, 12, 7, "Día no laborable con fines turísticos (puente)", TipoFeriado.NoLaborableTuristico, "Resolución 164/2025 (Jefatura de Gabinete)"),
        F(2026, 12, 8, "Inmaculada Concepción de María", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2026, 12, 25, "Navidad", TipoFeriado.Inamovible, "Ley 27.399"),

        // 2027: Ley 27.399. INCOMPLETO, ver arriba.
        F(2027, 1, 1, "Año Nuevo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 2, 8, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 2, 9, "Carnaval", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 3, 24, "Día Nacional de la Memoria por la Verdad y la Justicia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 3, 25, "Jueves Santo", TipoFeriado.NoLaborable, "Ley 27.399"),
        F(2027, 3, 26, "Viernes Santo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 4, 2, "Día del Veterano y de los Caídos en la Guerra de Malvinas", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 5, 1, "Día del Trabajador", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 5, 25, "Día de la Revolución de Mayo", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 6, 20, "Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 6, 21, "Paso a la Inmortalidad del General Martín Miguel de Güemes", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2027, 6, 17)),
        F(2027, 7, 9, "Día de la Independencia", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 8, 16, "Paso a la Inmortalidad del General José de San Martín", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2027, 8, 17)),
        F(2027, 10, 11, "Día del Respeto a la Diversidad Cultural", TipoFeriado.Trasladable, "Ley 27.399, art. 6", original: new DateOnly(2027, 10, 12)),
        F(2027, 11, 20, "Día de la Soberanía Nacional", TipoFeriado.Trasladable, "Ley 27.399"), // a confirmar: cae sábado
        F(2027, 12, 8, "Inmaculada Concepción de María", TipoFeriado.Inamovible, "Ley 27.399"),
        F(2027, 12, 25, "Navidad", TipoFeriado.Inamovible, "Ley 27.399"),
    };

    private static readonly ILookup<DateOnly, Feriado> PorFecha = Lista.ToLookup(f => f.Fecha);

    private readonly bool _puentesNoHabiles;
    private readonly bool _juevesSantoNoHabil;

    /// <param name="puentesNoHabiles">Los días no laborables con fines turísticos cuentan como no hábiles (lo que hace el Estado).</param>
    /// <param name="juevesSantoNoHabil">El Jueves Santo cuenta como no hábil.</param>
    public CalendarioArgentino(bool puentesNoHabiles = true, bool juevesSantoNoHabil = false)
    {
        _puentesNoHabiles = puentesNoHabiles;
        _juevesSantoNoHabil = juevesSantoNoHabil;
    }

    /// <summary>Todos los feriados y días no laborables cargados, en orden.</summary>
    public static IReadOnlyList<Feriado> Todos => Lista;

    public static IEnumerable<Feriado> DelAnio(int anio)
    {
        Validar(anio);
        return Lista.Where(f => f.Fecha.Year == anio);
    }

    /// <summary>Qué hay ese día (vacío si es un día común). Puede haber dos: en 2026 el Jueves Santo cae el 2 de abril.</summary>
    public static IEnumerable<Feriado> QueEs(DateOnly fecha)
    {
        Validar(fecha.Year);
        return PorFecha[fecha];
    }

    public static bool EsFeriado(DateOnly fecha) => QueEs(fecha).Any(f => f.EsFeriado);

    public bool EsHabil(DateOnly fecha)
    {
        Validar(fecha.Year);
        if (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) return false;
        foreach (var f in PorFecha[fecha])
        {
            if (f.EsFeriado) return false;
            if (f.Tipo == TipoFeriado.NoLaborableTuristico && _puentesNoHabiles) return false;
            if (f.Tipo == TipoFeriado.NoLaborable && _juevesSantoNoHabil) return false;
        }
        return true;
    }

    /// <summary>Suma (o resta, con dias negativo) días hábiles. Se cuenta desde el día siguiente:
    /// un hábil después del viernes es el lunes. Con 0 devuelve el mismo día si es hábil, o el próximo hábil.</summary>
    public DateOnly SumarHabiles(DateOnly desde, int dias)
    {
        var fecha = desde;
        if (dias == 0)
        {
            while (!EsHabil(fecha)) fecha = fecha.AddDays(1);
            return fecha;
        }
        int paso = dias > 0 ? 1 : -1;
        for (int restan = Math.Abs(dias); restan > 0;)
        {
            fecha = fecha.AddDays(paso);
            if (EsHabil(fecha)) restan--;
        }
        return fecha;
    }

    /// <summary>Días hábiles entre dos fechas, sin contar la de partida y contando la de llegada
    /// (así SumarHabiles(desde, HabilesEntre(desde, hasta)) == hasta si hasta es hábil). Negativo si hasta es anterior.</summary>
    public int HabilesEntre(DateOnly desde, DateOnly hasta)
    {
        if (hasta < desde) return -HabilesEntre(hasta, desde);
        Validar(desde.Year);
        Validar(hasta.Year);
        int n = 0;
        for (var d = desde.AddDays(1); d <= hasta; d = d.AddDays(1))
            if (EsHabil(d)) n++;
        return n;
    }

    /// <summary>El mismo día si es hábil, si no el primer hábil que sigue.</summary>
    public DateOnly ProximoHabil(DateOnly fecha) => SumarHabiles(fecha, 0);

    private static void Validar(int anio)
    {
        if (anio < PrimerAnio || anio > UltimoAnio)
            throw new ArgumentOutOfRangeException(nameof(anio), anio,
                $"No hay feriados cargados para {anio}: CalendarioArgentino cubre de {PrimerAnio} a {UltimoAnio}. Bajá la versión nueva de https://fnguerrero.github.io/working-folder-auto/herramientas/feriados-y-habiles/");
    }

    private static Feriado F(int anio, int mes, int dia, string nombre, TipoFeriado tipo, string fuente, DateOnly? original = null)
        => new(new DateOnly(anio, mes, dia), nombre, tipo, fuente, original);
}
