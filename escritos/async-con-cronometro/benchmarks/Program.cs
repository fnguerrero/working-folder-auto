using System.Diagnostics;
using System.Text.Json;
using Cronometro;

// Modos:
//   micro <salida.json> [capitulo]            mide los casos de tiempo y memoria
//   hambre <salida.json> <modo> <ritmo> <s>   un escenario de thread pool (un proceso por escenario)
//   excepcion void|task                       qué pasa con una excepción que nadie espera
switch (args.FirstOrDefault())
{
    case "micro":
    {
        var ui = new ContextoDeUnHilo();
        var lista = new List<Medicion>();
        foreach (var c in Casos.Todos(ui).Where(c => args.Length < 3 || c.Capitulo == args[2]))
        {
            var m = Arnes.Medir(c);
            lista.Add(m);
            Console.WriteLine($"{m.Capitulo,-15} {m.Id,-18} {m.MedianaNs,14:F1} ns [{m.MinNs:F1} .. {m.MaxNs:F1}] {m.BytesPorOp,10:F1} B");
        }
        var hechos = await Casos.Hechos(ui);
        var excepciones = new[] { "void", "task" }.Select(Hijo).ToList();
        File.WriteAllText(args[1], JsonSerializer.Serialize(new { entorno = Arnes.Entorno(), mediciones = lista, hechos, excepciones }, Arnes.Json));
        break;
    }
    case "hambre":
    {
        var r = Hambre.Correr(args[2], int.Parse(args[3]), int.Parse(args[4]));
        var texto = JsonSerializer.Serialize(new { entorno = Arnes.Entorno(), escenario = r }, Arnes.Json);
        File.WriteAllText(args[1], texto);
        using var d = JsonDocument.Parse(texto);
        var e = d.RootElement.GetProperty("escenario");
        Console.WriteLine(string.Join(" ", e.EnumerateObject().Where(p => p.Name != "serie").Select(p => $"{p.Name}={p.Value}")));
        break;
    }
    case "excepcion":
    {
        try
        {
            if (args[1] == "void") ExplotaVoid(); else _ = ExplotaTask();
        }
        catch (Exception) { Console.WriteLine("ATRAPADA"); }
        Thread.Sleep(500);
        Console.WriteLine("SIGUE VIVO");
        break;
    }
    default:
        Console.WriteLine("Uso: micro <salida.json> [capitulo] | hambre <salida.json> async|result|result200|sleep <pedidos/s> <segundos>");
        break;
}

static object Hijo(string tipo)
{
    var yo = new ProcessStartInfo(Environment.ProcessPath!) { RedirectStandardOutput = true, RedirectStandardError = true };
    // Si se lanzó con "dotnet X.dll", el ejecutable es dotnet y hay que pasarle la dll.
    if (Path.GetFileNameWithoutExtension(Environment.ProcessPath!) == "dotnet") yo.ArgumentList.Add(Environment.GetCommandLineArgs()[0]);
    yo.ArgumentList.Add("excepcion"); yo.ArgumentList.Add(tipo);
    using var p = Process.Start(yo)!;
    var err = p.StandardError.ReadToEndAsync();
    var salida = p.StandardOutput.ReadToEnd();
    p.WaitForExit();
    return new { tipo, codigoSalida = p.ExitCode, atrapadaPorElCatch = salida.Contains("ATRAPADA"), sigueVivo = salida.Contains("SIGUE VIVO"),
        errorSinAtrapar = err.Result.Contains("Unhandled exception") };
}

// <codigo:excepcion>
static async void ExplotaVoid() { await Task.Delay(50); throw new InvalidOperationException("boom"); }
static async Task ExplotaTask() { await Task.Delay(50); throw new InvalidOperationException("boom"); }
// </codigo:excepcion>
