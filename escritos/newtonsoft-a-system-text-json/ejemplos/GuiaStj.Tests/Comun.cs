global using Xunit;
global using NJ = Newtonsoft.Json;
global using NJL = Newtonsoft.Json.Linq;
global using NJC = Newtonsoft.Json.Converters;
global using NJS = Newtonsoft.Json.Serialization;
global using Stj = System.Text.Json.JsonSerializer;
global using System.Text.Json;
global using System.Text.Json.Nodes;
global using System.Text.Json.Serialization;
global using System.Text.Json.Serialization.Metadata;

namespace GuiaStj.Tests;

internal static class Json
{
    public static string Nj(object? valor, NJ.JsonSerializerSettings? ajustes = null)
        => NJ.JsonConvert.SerializeObject(valor, ajustes);

    public static T? DeNj<T>(string json, NJ.JsonSerializerSettings? ajustes = null)
        => NJ.JsonConvert.DeserializeObject<T>(json, ajustes);
}
