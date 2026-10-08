using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Delivery.Common.Auth;

/// <summary>
/// HS256 JSON Web Tokens, compatible with the tokens the Node services
/// issued with jsonwebtoken. Hand-rolled rather than using
/// Microsoft.IdentityModel because that library refuses HMAC secrets shorter
/// than 256 bits, which would reject the existing JWT_SECRET values.
/// </summary>
public static class Jwt
{
    private static readonly byte[] Header = Encoding.UTF8.GetBytes("""{"alg":"HS256","typ":"JWT"}""");

    /// <summary>Signs the claims, adding iat and (when given) exp.</summary>
    public static string Sign(JsonObject claims, string secret, TimeSpan? expiresIn = null)
    {
        var issuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = claims.DeepClone().AsObject();
        payload["iat"] = issuedAt;
        if (expiresIn is { } lifetime) payload["exp"] = issuedAt + (long)lifetime.TotalSeconds;

        var unsigned = $"{Base64Url.EncodeToString(Header)}.{Base64Url.EncodeToString(Encoding.UTF8.GetBytes(payload.ToJsonString()))}";
        return $"{unsigned}.{Base64Url.EncodeToString(Signature(unsigned, secret))}";
    }

    /// <summary>
    /// The token's claims if it is an HS256 token signed with the secret and
    /// not expired (or not yet valid); otherwise null.
    /// </summary>
    public static JsonObject? Verify(string token, string secret)
    {
        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        try
        {
            var header = JsonNode.Parse(Base64Url.DecodeFromChars(parts[0]))?.AsObject();
            if (header?["alg"]?.GetValue<string>() != "HS256") return null;

            var expected = Signature($"{parts[0]}.{parts[1]}", secret);
            if (!CryptographicOperations.FixedTimeEquals(expected, Base64Url.DecodeFromChars(parts[2]))) return null;

            var claims = JsonNode.Parse(Base64Url.DecodeFromChars(parts[1]))?.AsObject();
            if (claims is null) return null;

            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (claims["exp"] is JsonValue exp && now >= exp.GetValue<double>()) return null;
            if (claims["nbf"] is JsonValue nbf && now < nbf.GetValue<double>()) return null;
            return claims;
        }
        catch (Exception ex) when (ex is FormatException or JsonException or InvalidOperationException)
        {
            return null;
        }
    }

    private static byte[] Signature(string unsigned, string secret) =>
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(unsigned));
}
