using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Delivery.Common.Json;

/// <summary>
/// The JSON format of every HTTP response, unchanged from the Node services
/// so the frontends keep working: camelCase properties, enums as
/// UPPER_SNAKE_CASE strings, timestamps as ISO strings with milliseconds,
/// and money as strings ("12.5"), since a JSON number can't hold an exact
/// decimal.
/// </summary>
public static class ApiJson
{
    public static readonly JsonSerializerOptions Options = Configure(new JsonSerializerOptions());

    public static JsonSerializerOptions Configure(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = true;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseUpper));
        options.Converters.Add(new IsoDateTimeConverter());
        options.Converters.Add(new DecimalStringConverter());
        return options;
    }

    /// <summary>An enum value as the API and the database spell it, e.g. RESTAURANT_OWNER.</summary>
    public static string ToApiName(this Enum value) => JsonNamingPolicy.SnakeCaseUpper.ConvertName(value.ToString());
}

public sealed class IsoDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        DateTime.Parse(reader.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(Clock.ToIso(value));
}

/// <summary>
/// Writes decimals the way Prisma's Decimal did: as a string without
/// trailing zeros ("12.5", "17"). Reads both strings and numbers.
/// </summary>
public sealed class DecimalStringConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.String
            ? decimal.Parse(reader.GetString()!, NumberStyles.Float, CultureInfo.InvariantCulture)
            : reader.GetDecimal();

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) =>
        writer.WriteStringValue(Format(value));

    public static string Format(decimal value) =>
        value.ToString("0.############################", CultureInfo.InvariantCulture);
}
