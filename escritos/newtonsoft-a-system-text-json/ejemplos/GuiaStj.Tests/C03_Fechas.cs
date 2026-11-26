using System.Globalization;

namespace GuiaStj.Tests;

public class C03_Fechas
{
    public class ConFecha { public DateTime F { get; set; } }
    public class ConOffset { public DateTimeOffset F { get; set; } }
    public class ConTexto { public string? F { get; set; } }

    // +05:45 es un huso raro a propósito: así los tests no dependen del huso de la máquina
    // (salvo que justo sea ese)
    private const string Iso = """{"F":"2026-11-25T10:30:00+05:45"}""";
    private static readonly DateTimeOffset Esperado = new(2026, 11, 25, 10, 30, 0, new TimeSpan(5, 45, 0));

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Utc)]
    [InlineData(DateTimeKind.Local)]
    public void T0301_DateTime_se_escribe_igual(DateTimeKind kind)
    {
        var f = new DateTime(2026, 11, 25, 10, 30, 0, kind);
        Assert.Equal(Json.Nj(f), Stj.Serialize(f));
        var conFraccion = f.AddTicks(1_200_000);
        Assert.Equal(Json.Nj(conFraccion), Stj.Serialize(conFraccion));
    }

    [Fact]
    public void T0302_DateTimeOffset_con_offset_cero()
    {
        var f = new DateTimeOffset(2026, 11, 25, 10, 30, 0, TimeSpan.Zero);
        Assert.Equal("\"2026-11-25T10:30:00+00:00\"", Json.Nj(f));
        Assert.Equal("\"2026-11-25T10:30:00+00:00\"", Stj.Serialize(f));
    }

    [Fact]
    public void T0303_Propiedad_DateTimeOffset_conserva_el_offset_en_los_dos()
    {
        Assert.Equal(Esperado.Offset, Json.DeNj<ConOffset>(Iso)!.F.Offset);
        Assert.Equal(Esperado.Offset, Stj.Deserialize<ConOffset>(Iso)!.F.Offset);
    }

    [Fact]
    public void T0304_Propiedad_DateTime_con_offset_pasa_a_hora_local_en_los_dos()
    {
        var nj = Json.DeNj<ConFecha>(Iso)!.F;
        var stj = Stj.Deserialize<ConFecha>(Iso)!.F;
        Assert.Equal(DateTimeKind.Local, nj.Kind);
        Assert.Equal(DateTimeKind.Local, stj.Kind);
        Assert.Equal(Esperado.LocalDateTime, nj);
        Assert.Equal(Esperado.LocalDateTime, stj);
    }

    [Fact]
    public void T0305_Newtonsoft_convierte_strings_en_fechas_en_object_y_JObject()
    {
        var nj = Json.DeNj<Dictionary<string, object>>(Iso)!;
        Assert.IsType<DateTime>(nj["F"]);
        Assert.Equal(NJL.JTokenType.Date, NJL.JObject.Parse(Iso)["F"]!.Type);

        var stj = Stj.Deserialize<Dictionary<string, object>>(Iso)!;
        Assert.Equal(JsonValueKind.String, ((JsonElement)stj["F"]).ValueKind);
        Assert.Equal("2026-11-25T10:30:00+05:45", JsonNode.Parse(Iso)!["F"]!.GetValue<string>());
    }

    [Fact]
    public void T0306_El_offset_se_pierde_al_pasar_por_JObject()
    {
        var porJObject = NJL.JObject.Parse(Iso).ToObject<ConOffset>()!.F;
        Assert.Equal(Esperado.UtcDateTime, porJObject.UtcDateTime);   // mismo instante
        Assert.NotEqual(Esperado.Offset, porJObject.Offset);          // otro offset

        var porJsonNode = JsonNode.Parse(Iso)!.Deserialize<ConOffset>()!.F;
        Assert.Equal(Esperado.Offset, porJsonNode.Offset);
    }

    [Fact]
    public void T0307_DateParseHandling_None_deja_el_texto()
    {
        var nj = Json.DeNj<Dictionary<string, object>>(Iso, new() { DateParseHandling = NJ.DateParseHandling.None })!;
        Assert.Equal("2026-11-25T10:30:00+05:45", nj["F"]);
    }

    [Fact]
    public void T0308_Propiedad_string_recibe_el_texto_original_en_los_dos()
    {
        Assert.Equal("2026-11-25T10:30:00+05:45", Json.DeNj<ConTexto>(Iso)!.F);
        Assert.Equal("2026-11-25T10:30:00+05:45", Stj.Deserialize<ConTexto>(Iso)!.F);
    }

    [Theory]
    [InlineData("2026-11-25 10:30:00")]
    [InlineData("11/25/2026")]
    [InlineData("\\/Date(1795602600000)\\/")]
    public void T0309_Formatos_que_acepta_Newtonsoft_y_STJ_no(string fecha)
    {
        var json = $$"""{"F":"{{fecha}}"}""";
        Assert.Equal(2026, Json.DeNj<ConFecha>(json)!.F.Year);
        Assert.Throws<JsonException>(() => Stj.Deserialize<ConFecha>(json));
    }

    [Fact]
    public void T0310_Solo_fecha_ISO_la_aceptan_los_dos()
    {
        const string json = """{"F":"2026-11-25"}""";
        var esperado = new DateTime(2026, 11, 25);
        Assert.Equal(esperado, Json.DeNj<ConFecha>(json)!.F);
        Assert.Equal(esperado, Stj.Deserialize<ConFecha>(json)!.F);
    }

    public class FechaArgentina : JsonConverter<DateTime>
    {
        private const string Formato = "dd/MM/yyyy";

        public override DateTime Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
            => DateTime.TryParseExact(reader.GetString(), Formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)
                ? f
                : throw new JsonException($"Se esperaba una fecha {Formato}.");

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions o)
            => writer.WriteStringValue(value.ToString(Formato, CultureInfo.InvariantCulture));
    }

    [Fact]
    public void T0311_Formato_propio_DateFormatString_contra_converter()
    {
        var v = new ConFecha { F = new DateTime(2026, 11, 25) };
        const string esperado = """{"F":"25/11/2026"}""";
        var nj = new NJ.JsonSerializerSettings { DateFormatString = "dd/MM/yyyy", Culture = CultureInfo.InvariantCulture };
        var stj = new JsonSerializerOptions { Converters = { new FechaArgentina() } };

        Assert.Equal(esperado, Json.Nj(v, nj));
        Assert.Equal(esperado, Stj.Serialize(v, stj));
        Assert.Equal(v.F, Json.DeNj<ConFecha>(esperado, nj)!.F);
        Assert.Equal(v.F, Stj.Deserialize<ConFecha>(esperado, stj)!.F);
        Assert.Throws<JsonException>(() => Stj.Deserialize<ConFecha>("""{"F":"2026-11-25"}""", stj));
    }

    [Fact]
    public void T0312_El_converter_de_DateTime_tambien_cubre_DateTime_anulable()
    {
        var stj = new JsonSerializerOptions { Converters = { new FechaArgentina() } };
        DateTime? f = new DateTime(2026, 11, 25);
        Assert.Equal("\"25/11/2026\"", Stj.Serialize(f, stj));
        Assert.Null(Stj.Deserialize<DateTime?>("null", stj));
    }

    // Igual que DateTimeZoneHandling.Utc: un Unspecified se toma como si ya fuera UTC
    public class SiempreUtc : JsonConverter<DateTime>
    {
        private static DateTime AUtc(DateTime f) => f.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(f, DateTimeKind.Utc)
            : f.ToUniversalTime();

        public override DateTime Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o) => AUtc(reader.GetDateTime());
        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions o) => writer.WriteStringValue(AUtc(value));
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Utc)]
    [InlineData(DateTimeKind.Local)]
    public void T0313_DateTimeZoneHandling_Utc_con_un_converter(DateTimeKind kind)
    {
        var nj = new NJ.JsonSerializerSettings { DateTimeZoneHandling = NJ.DateTimeZoneHandling.Utc };
        var stj = new JsonSerializerOptions { Converters = { new SiempreUtc() } };
        var f = new DateTime(2026, 11, 25, 10, 30, 0, kind);
        Assert.Equal(Json.Nj(f, nj), Stj.Serialize(f, stj));
        Assert.Equal(DateTimeKind.Utc, Stj.Deserialize<DateTime>("\"2026-11-25T10:30:00+05:45\"", stj).Kind);
    }

    [Fact]
    public void T0314_TimeSpan()
    {
        var t = new TimeSpan(1, 2, 3, 4);
        Assert.Equal("\"1.02:03:04\"", Json.Nj(t));
        Assert.Equal("\"1.02:03:04\"", Stj.Serialize(t));
        Assert.Equal(t, Stj.Deserialize<TimeSpan>("\"1.02:03:04\""));
    }

    [Fact]
    public void T0315_DateOnly_y_TimeOnly()
    {
        var d = new DateOnly(2026, 11, 25);
        var h = new TimeOnly(10, 30);
        Assert.Equal("\"2026-11-25\"", Stj.Serialize(d));
        Assert.Equal("\"10:30:00\"", Stj.Serialize(h));
        Assert.Equal("\"2026-11-25\"", Json.Nj(d));
        Assert.Equal("\"10:30:00\"", Json.Nj(h));
    }
}
