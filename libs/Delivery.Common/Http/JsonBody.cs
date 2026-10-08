using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;

namespace Delivery.Common.Http;

/// <summary>
/// Reads a request body as loosely-typed JSON, so endpoints can validate it
/// field by field and tell "left out" apart from "null", the way the Node
/// handlers did with req.body.
/// </summary>
public static class JsonBody
{
    /// <summary>
    /// The parsed body, or null when there is none (or it isn't sent as JSON).
    /// Malformed JSON throws <see cref="BadHttpRequestException"/>, which
    /// becomes a 400.
    /// </summary>
    public static async Task<JsonNode?> ReadAsync(HttpRequest request)
    {
        if (request.HasJsonContentType() is false) return null;

        using var reader = new StreamReader(request.Body);
        var text = await reader.ReadToEndAsync(request.HttpContext.RequestAborted);
        if (string.IsNullOrWhiteSpace(text)) return null;

        try
        {
            return JsonNode.Parse(text);
        }
        catch (JsonException ex)
        {
            throw new BadHttpRequestException("Request body is not valid JSON", ex);
        }
    }

    /// <summary>The value if it's a JSON string, otherwise null.</summary>
    public static string? AsString(this JsonNode? node) =>
        node is JsonValue value && value.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : null;

    /// <summary>The value if it's a JSON true/false, otherwise null.</summary>
    public static bool? AsBoolean(this JsonNode? node) =>
        node?.GetValueKind() switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };

    /// <summary>The value if it's a JSON number that fits a decimal, otherwise null.</summary>
    public static decimal? AsDecimal(this JsonNode? node) =>
        node is JsonValue value && value.GetValueKind() == JsonValueKind.Number && value.TryGetValue<decimal>(out var number)
            ? number
            : null;
}
