using System.Text.Json;
using Cronometro;

// Modos:
//   verificar                      comprueba que las variantes de cada grupo devuelvan lo mismo
//   medir <salida.json> [capitulo] verifica y después mide
var casos = Casos.Todos().ToList();
var distintos = casos.GroupBy(c => (c.Capitulo, c.Grupo))
    .Where(g => g.Select(c => c.Correr(1)).Distinct().Count() > 1)
    .Select(g => $"{g.Key.Capitulo}/{g.Key.Grupo}: {string.Join(", ", g.Select(c => $"{c.Id}={c.Correr(1)}"))}")
    .ToList();
foreach (var d in distintos) Console.Error.WriteLine("Resultados distintos en " + d);
if (distintos.Count > 0) return 1;
Console.WriteLine($"Verificados {casos.Count} casos: cada grupo devuelve lo mismo.");

switch (args.FirstOrDefault())
{
    case "verificar":
        return 0;
    case "medir":
        var lista = new List<Medicion>();
        foreach (var c in casos.Where(c => args.Length < 3 || c.Capitulo == args[2]))
        {
            var m = Arnes.Medir(c);
            lista.Add(m);
            Console.WriteLine($"{m.Capitulo,-12} {m.Id,-18} {m.MedianaNs,14:F1} ns [{m.MinNs:F1} .. {m.MaxNs:F1}] {m.BytesPorOp,12:F1} B");
        }
        File.WriteAllText(args[1], JsonSerializer.Serialize(new { entorno = Arnes.Entorno(), mediciones = lista, hechos = Casos.Hechos() }, Arnes.Json));
        return 0;
    default:
        Console.WriteLine("Uso: verificar | medir <salida.json> [capitulo]");
        return 1;
}
