namespace Cronometro;

public sealed record Prod(int Id, int Precio, int Categoria);

/// <summary>Las variantes de cada capítulo. Dentro de un mismo grupo, todas tienen que devolver lo mismo
/// (el modo "verificar" lo comprueba antes de medir).</summary>
public static class Casos
{
    // Datos fijos (semilla 42): se arman una vez y no cambian.
    static int[] Numeros(int n) { var r = new Random(42); return Enumerable.Range(0, n).Select(_ => r.Next(0, 1000)).ToArray(); }
    static readonly int[] A100 = Numeros(100), A10k = Numeros(10_000);
    static readonly List<int> L100 = A100.ToList(), L10k = A10k.ToList();
    static readonly int[] Orden = Enumerable.Range(0, 10_000).ToArray();
    static readonly List<int> OrdenLista = Orden.ToList();
    static readonly Prod[] Prods = Enumerable.Range(0, 10_000).Select(i => new Prod(i, (i * 7919 + 13) % 10_007, i % 20)).ToArray();
    static readonly int[] Pedidos = Enumerable.Range(0, 1000).Select(i => (i * 37) % 2000).ToArray();
    static readonly List<int> Habilitados = Enumerable.Range(0, 1000).Select(i => i * 2).ToList();
    static int _umbral = 500;

    // <codigo:wheresum>
    static long Linq(int[] a) => a.Where(x => x % 2 == 0).Select(x => x * 3).Sum();
    static long Linq(List<int> l) => l.Where(x => x % 2 == 0).Select(x => x * 3).Sum();
    static long For(int[] a)
    {
        int s = 0;
        for (int i = 0; i < a.Length; i++) { int x = a[i]; if (x % 2 == 0) s += x * 3; }
        return s;
    }
    static long For(List<int> l)
    {
        int s = 0;
        for (int i = 0; i < l.Count; i++) { int x = l[i]; if (x % 2 == 0) s += x * 3; }
        return s;
    }
    static long Foreach(List<int> l)
    {
        int s = 0;
        foreach (var x in l) if (x % 2 == 0) s += x * 3;
        return s;
    }
    // </codigo:wheresum>

    // <codigo:any>
    // Una secuencia perezosa: no sabe cuántos elementos tiene hasta que se la recorre.
    static IEnumerable<int> Pares() => OrdenLista.Where(x => x % 2 == 0);
    static bool AnyPerezosa() => Pares().Any();
    static bool CountPerezosa() => Pares().Count() > 0;
    static bool AnyPred() => Orden.Any(x => x == 10);
    static bool CountPred() => Orden.Count(x => x == 10) > 0;
    static bool AnyLista() => OrdenLista.Any();
    static bool CountMetodoLista() => OrdenLista.Count() > 0;
    static bool CountPropiedad() => OrdenLista.Count > 0;
    // </codigo:any>

    // <codigo:tolist>
    static long ToListEnCadaPaso() => A10k.Where(x => x % 2 == 0).ToList().Select(x => x * 3).ToList().Where(x => x > 100).ToList().Sum();
    static long UnaSolaCadena() => A10k.Where(x => x % 2 == 0).Select(x => x * 3).Where(x => x > 100).Sum();
    static long ForeachConToList() { long s = 0; foreach (var x in A10k.Where(x => x > 500).ToList()) s += x; return s; }
    static long ForeachDirecto() { long s = 0; foreach (var x in A10k.Where(x => x > 500)) s += x; return s; }
    static long ContarConToList() => A10k.Where(x => x > 500).ToList().Count;
    static long ContarDirecto() => A10k.Count(x => x > 500);
    // </codigo:tolist>

    // <codigo:first>
    static long ListaFirst() => OrdenLista.First(x => x == 5000);
    static long ListaFind() => OrdenLista.Find(x => x == 5000);
    static long ListaForeach() { foreach (var x in OrdenLista) if (x == 5000) return x; return -1; }
    static long ArrayFirst() => Orden.First(x => x == 5000);
    static long ArrayArrayFind() => Array.Find(Orden, x => x == 5000);
    static long ArrayFor() { for (int i = 0; i < Orden.Length; i++) if (Orden[i] == 5000) return Orden[i]; return -1; }
    // </codigo:first>

    // <codigo:minby>
    static long OrderByFirst() => Prods.OrderBy(p => p.Precio).First().Id;
    static long ConMinBy() => Prods.MinBy(p => p.Precio)!.Id;
    static long MinimoAMano()
    {
        var m = Prods[0];
        for (int i = 1; i < Prods.Length; i++) if (Prods[i].Precio < m.Precio) m = Prods[i];
        return m.Id;
    }
    static long Top10Take() => Prods.OrderByDescending(p => p.Precio).Take(10).ToList().Sum(p => p.Id);
    static long Top10ToListAntes() => Prods.OrderByDescending(p => p.Precio).ToList().Take(10).Sum(p => p.Id);
    // </codigo:minby>

    // <codigo:multiple>
    // "Caro" hace algo de trabajo por elemento: simula una proyección con cálculo.
    static int Caro(Prod p) { int h = p.Precio; for (int i = 0; i < 20; i++) h = unchecked(h * 31 + i); return h & 1023; }
    static IEnumerable<int> Puntajes() => Prods.Select(Caro);

    static long TresRecorridas() { var q = Puntajes(); return q.Count() + (long)q.Sum() + q.Max(); }
    static long Materializada() { var q = Puntajes().ToList(); return q.Count + (long)q.Sum() + q.Max(); }
    static long UnForeach()
    {
        int n = 0, s = 0, max = int.MinValue;
        foreach (var x in Puntajes()) { n++; s += x; if (x > max) max = x; }
        return n + (long)s + max;
    }
    // </codigo:multiple>

    // <codigo:iteradores>
    static long SelectElementAt() => Orden.Select(x => x * 2).ElementAt(5000);
    static long WhereSelectToArray() => A10k.Where(x => x % 2 == 0).Select(x => x * 3).ToArray().Length;
    static long RangeSelectToList() => Enumerable.Range(0, 10_000).Select(x => x * 2).ToList()[9999];
    static long DistinctFirst() => A10k.Distinct().First();
    static long OrderByPrimero() => A10k.OrderBy(x => x).First();
    static long OrderByContains() => A10k.OrderBy(x => x).Contains(A10k[5000]) ? 1 : 0;
    static long ReverseFirst() => Orden.Reverse<int>().First();   // sin <int>, en C# 14 se elige Span.Reverse
    static long AppendCadena()
    {
        IEnumerable<int> q = A100;
        for (int i = 0; i < 100; i++) q = q.Append(i);
        return q.ToArray().Length;
    }
    static long SelectManyCount() => Prods.SelectMany(p => A100).Take(100_000).Count();
    static long SkipTakeToArray() => Orden.Where(x => x >= 0).Skip(100).Take(100).ToArray()[0];
    // </codigo:iteradores>

    // <codigo:contains>
    static long ContainsEnLista() => Pedidos.Count(id => Habilitados.Contains(id));
    static long ContainsEnHashSet() { var set = Habilitados.ToHashSet(); return Pedidos.Count(id => set.Contains(id)); }

    static long BuscarConFirst()
    {
        long s = 0;
        foreach (var id in Pedidos) s += Prods.First(p => p.Id == id).Precio;
        return s;
    }
    static long BuscarConDiccionario()
    {
        var porId = Prods.ToDictionary(p => p.Id);
        long s = 0;
        foreach (var id in Pedidos) s += porId[id].Precio;
        return s;
    }
    // </codigo:contains>

    // <codigo:detalles>
    static long LambdaSinCaptura() => A100.Count(static x => x > 500);
    static long LambdaConCaptura() { int umbral = _umbral; return A100.Count(x => x > umbral); }
    static long WhereCount() => A10k.Where(x => x > 500).Count();
    static long CountConPredicado() => A10k.Count(x => x > 500);

    static long GroupByContar() => Prods.GroupBy(p => p.Categoria).ToDictionary(g => g.Key, g => g.Count())[7];
#if NET9_0_OR_GREATER
    static long CountByContar() => Prods.CountBy(p => p.Categoria).ToDictionary()[7];
#endif
    // </codigo:detalles>

    static Caso C(string cap, string grupo, string id, string nombre, Func<long> op) =>
        new(cap, grupo, id, nombre, n => { long s = 0; for (int i = 0; i < n; i++) s += op(); return s; });
    static Caso B(string cap, string grupo, string id, string nombre, Func<bool> op) => C(cap, grupo, id, nombre, () => op() ? 1 : 0);

    public static IEnumerable<Caso> Todos()
    {
        const string c1 = "wheresum";
        yield return C(c1, "a100", "a100_for", "array de 100 · for", () => For(A100));
        yield return C(c1, "a100", "a100_linq", "array de 100 · Where + Select + Sum", () => Linq(A100));
        yield return C(c1, "a10k", "a10k_for", "array de 10.000 · for", () => For(A10k));
        yield return C(c1, "a10k", "a10k_linq", "array de 10.000 · Where + Select + Sum", () => Linq(A10k));
        yield return C(c1, "a100", "l100_for", "List de 100 · for", () => For(L100));
        yield return C(c1, "a100", "l100_foreach", "List de 100 · foreach", () => Foreach(L100));
        yield return C(c1, "a100", "l100_linq", "List de 100 · Where + Select + Sum", () => Linq(L100));
        yield return C(c1, "a10k", "l10k_for", "List de 10.000 · for", () => For(L10k));
        yield return C(c1, "a10k", "l10k_foreach", "List de 10.000 · foreach", () => Foreach(L10k));
        yield return C(c1, "a10k", "l10k_linq", "List de 10.000 · Where + Select + Sum", () => Linq(L10k));

        const string c2 = "any";
        yield return B(c2, "hay", "any_perezosa", "secuencia perezosa · Any()", AnyPerezosa);
        yield return B(c2, "hay", "count_perezosa", "secuencia perezosa · Count() > 0", CountPerezosa);
        yield return B(c2, "hay", "any_pred", "array · Any(condición)", AnyPred);
        yield return B(c2, "hay", "count_pred", "array · Count(condición) > 0", CountPred);
        yield return B(c2, "hay", "any_lista", "List · Any()", AnyLista);
        yield return B(c2, "hay", "count_lista", "List · Count() > 0", CountMetodoLista);
        yield return B(c2, "hay", "prop_lista", "List · Count > 0 (propiedad)", CountPropiedad);

        const string c3 = "tolist";
        yield return C(c3, "cadena", "cadena_sin", "una sola cadena y Sum()", UnaSolaCadena);
        yield return C(c3, "cadena", "cadena_con", "ToList() en cada paso", ToListEnCadaPaso);
        yield return C(c3, "recorrer", "foreach_sin", "foreach sobre el Where", ForeachDirecto);
        yield return C(c3, "recorrer", "foreach_con", "foreach sobre Where().ToList()", ForeachConToList);
        yield return C(c3, "contar", "contar_sin", "Count(condición)", ContarDirecto);
        yield return C(c3, "contar", "contar_con", "Where().ToList().Count", ContarConToList);

        const string c4 = "first";
        yield return C(c4, "buscar", "l_foreach", "List · foreach", ListaForeach);
        yield return C(c4, "buscar", "l_find", "List · Find", ListaFind);
        yield return C(c4, "buscar", "l_first", "List · First", ListaFirst);
        yield return C(c4, "buscar", "a_for", "array · for", ArrayFor);
        yield return C(c4, "buscar", "a_find", "array · Array.Find", ArrayArrayFind);
        yield return C(c4, "buscar", "a_first", "array · First", ArrayFirst);

        const string c5 = "minby";
        yield return C(c5, "min", "min_for", "mínimo · for", MinimoAMano);
        yield return C(c5, "min", "min_minby", "mínimo · MinBy", ConMinBy);
        yield return C(c5, "min", "min_orderby", "mínimo · OrderBy().First()", OrderByFirst);
        yield return C(c5, "top", "top_take", "10 más caros · OrderByDescending().Take(10)", Top10Take);
        yield return C(c5, "top", "top_tolist", "10 más caros · OrderByDescending().ToList().Take(10)", Top10ToListAntes);

        const string c6 = "multiple";
        yield return C(c6, "tres", "multi_tres", "Count() + Sum() + Max() sobre la secuencia", TresRecorridas);
        yield return C(c6, "tres", "multi_tolist", "ToList() una vez y después las tres", Materializada);
        yield return C(c6, "tres", "multi_foreach", "un solo foreach", UnForeach);

        const string c7 = "iteradores";
        foreach (var (id, nombre, op) in new (string, string, Func<long>)[]
        {
            ("it_elementat", "Select().ElementAt(5000)", SelectElementAt),
            ("it_toarray", "Where().Select().ToArray()", WhereSelectToArray),
            ("it_range", "Range().Select().ToList()", RangeSelectToList),
            ("it_distinct", "Distinct().First()", DistinctFirst),
            ("it_orderfirst", "OrderBy().First()", OrderByPrimero),
            ("it_ordercontains", "OrderBy().Contains()", OrderByContains),
            ("it_reverse", "Reverse().First()", ReverseFirst),
            ("it_append", "100 Append() y ToArray()", AppendCadena),
            ("it_selectmany", "SelectMany().Take(100.000).Count()", SelectManyCount),
            ("it_skiptake", "Where().Skip(100).Take(100).ToArray()", SkipTakeToArray),
        })
            yield return C(c7, id, id, nombre, op);

        const string c8 = "contains";
        yield return C(c8, "filtro", "con_lista", "1.000 pedidos contra 1.000 ids · List.Contains", ContainsEnLista);
        yield return C(c8, "filtro", "con_hash", "1.000 pedidos contra 1.000 ids · ToHashSet() y Contains", ContainsEnHashSet);
        yield return C(c8, "cruce", "cruce_first", "1.000 búsquedas en 10.000 productos · First por cada una", BuscarConFirst);
        yield return C(c8, "cruce", "cruce_dic", "1.000 búsquedas en 10.000 productos · ToDictionary una vez", BuscarConDiccionario);

        const string c9 = "detalles";
        yield return C(c9, "captura", "lambda_static", "lambda sin captura (array de 100)", LambdaSinCaptura);
        yield return C(c9, "captura", "lambda_captura", "lambda que captura una variable local", LambdaConCaptura);
        yield return C(c9, "contar", "det_count", "Count(condición)", CountConPredicado);
        yield return C(c9, "contar", "where_count", "Where(condición).Count()", WhereCount);
        yield return C(c9, "grupos", "grupos_groupby", "GroupBy().ToDictionary(g => g.Count())", GroupByContar);
#if NET9_0_OR_GREATER
        yield return C(c9, "grupos", "grupos_countby", "CountBy().ToDictionary() (.NET 9+)", CountByContar);
#endif
    }

    /// <summary>Cuántas veces se ejecuta la proyección en cada variante del capítulo de enumeración múltiple.</summary>
    public static object Hechos()
    {
        int veces = 0;
        IEnumerable<int> q = Prods.Select(p => { veces++; return Caro(p); });
        _ = q.Count() + (long)q.Sum() + q.Max();
        int sinMaterializar = veces;
        veces = 0;
        var l = q.ToList();
        _ = l.Count + (long)l.Sum() + l.Max();
        return new { elementos = Prods.Length, proyeccionesTresRecorridas = sinMaterializar, proyeccionesConToList = veces };
    }
}
