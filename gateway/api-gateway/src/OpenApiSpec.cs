using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using YamlDotNet.RepresentationModel;

namespace ApiGateway;

/// <summary>
/// openapi.yaml (the description of every route the gateway exposes) as JSON,
/// for /openapi.json and Swagger UI at /docs.
/// </summary>
public static partial class OpenApiSpec
{
    public static JsonNode Load(string path)
    {
        var yaml = new YamlStream();
        using (var reader = new StreamReader(path)) yaml.Load(reader);
        return ToJson(yaml.Documents[0].RootNode) ?? new JsonObject();
    }

    private static JsonNode? ToJson(YamlNode node) => node switch
    {
        YamlMappingNode mapping => new JsonObject(mapping.Children.Select(entry =>
            KeyValuePair.Create(((YamlScalarNode)entry.Key).Value ?? "", ToJson(entry.Value)))),
        YamlSequenceNode sequence => new JsonArray([.. sequence.Children.Select(ToJson)]),
        YamlScalarNode scalar => ToJson(scalar),
        _ => throw new NotSupportedException($"Unsupported YAML node {node.NodeType}"),
    };

    // Unquoted scalars are typed the way YAML 1.2's core schema types them;
    // quoted and block scalars are always strings.
    private static JsonNode? ToJson(YamlScalarNode scalar)
    {
        var text = scalar.Value ?? "";
        if (scalar.Style != YamlDotNet.Core.ScalarStyle.Plain) return JsonValue.Create(text);

        if (text is "" or "~" or "null" or "Null" or "NULL") return null;
        if (text is "true" or "True" or "TRUE") return JsonValue.Create(true);
        if (text is "false" or "False" or "FALSE") return JsonValue.Create(false);
        if (IntegerPattern().IsMatch(text) && long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var integer))
        {
            return JsonValue.Create(integer);
        }
        if (FloatPattern().IsMatch(text) && decimal.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
        {
            return JsonValue.Create(number);
        }
        return JsonValue.Create(text);
    }

    [GeneratedRegex(@"^[-+]?[0-9]+$")]
    private static partial Regex IntegerPattern();

    [GeneratedRegex(@"^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$")]
    private static partial Regex FloatPattern();
}
