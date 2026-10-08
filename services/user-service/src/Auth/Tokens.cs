using System.Text.Json.Nodes;
using Delivery.Common.Auth;
using Delivery.Common.Json;
using UserService.Data;

namespace UserService.Auth;

public class Tokens(IConfiguration configuration)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(1);

    /// <summary>
    /// The JWT the api-gateway verifies. It carries the email too, so the
    /// customer-app can show who is logged in without an extra request.
    /// </summary>
    public string Sign(User user)
    {
        var secret = configuration["JWT_SECRET"];
        if (string.IsNullOrEmpty(secret)) throw new InvalidOperationException("JWT_SECRET is not set");

        var claims = new JsonObject
        {
            ["sub"] = user.Id,
            ["role"] = user.Role.ToApiName(),
            ["email"] = user.Email,
        };
        return Jwt.Sign(claims, secret, Lifetime);
    }
}
