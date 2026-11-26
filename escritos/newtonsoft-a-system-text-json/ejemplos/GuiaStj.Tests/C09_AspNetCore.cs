using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace GuiaStj.Tests;

public class C09_AspNetCore
{
    private static JsonSerializerOptions Mvc()
    {
        var s = new ServiceCollection();
        s.AddLogging();
        s.AddControllers();
        return s.BuildServiceProvider().GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
    }

    private static JsonSerializerOptions Minimal()
    {
        var s = new ServiceCollection();
        s.ConfigureHttpJsonOptions(_ => { });
        return s.BuildServiceProvider()
            .GetRequiredService<IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>().Value.SerializerOptions;
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void T0901_Defaults_de_ASP_NET_Core(bool minimal)
    {
        var o = minimal ? Minimal() : Mvc();
        Assert.Same(JsonNamingPolicy.CamelCase, o.PropertyNamingPolicy);
        Assert.True(o.PropertyNameCaseInsensitive);
        Assert.True(o.NumberHandling.HasFlag(JsonNumberHandling.AllowReadingFromString));
        Assert.DoesNotContain(o.Converters, c => c is JsonStringEnumConverter);
        Assert.Equal(JsonIgnoreCondition.Never, o.DefaultIgnoreCondition);
        Assert.False(o.RespectNullableAnnotations);
        Assert.Null(o.DictionaryKeyPolicy);
    }

    [Fact]
    public void T0902_Configurar_MVC_y_minimal_APIs_va_por_separado()
    {
        var s = new ServiceCollection();
        s.AddLogging();
        s.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
        s.ConfigureHttpJsonOptions(o => o.SerializerOptions.WriteIndented = true);
        var p = s.BuildServiceProvider();
        var mvc = p.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
        var http = p.GetRequiredService<IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>().Value.SerializerOptions;
        Assert.Contains(mvc.Converters, c => c is JsonStringEnumConverter);
        Assert.DoesNotContain(http.Converters, c => c is JsonStringEnumConverter);
        Assert.True(http.WriteIndented);
        Assert.False(mvc.WriteIndented);
    }
}
