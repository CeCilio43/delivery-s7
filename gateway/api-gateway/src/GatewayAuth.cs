using Delivery.Common.Auth;
using Delivery.Common.Http;
using Yarp.ReverseProxy.Model;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace ApiGateway;

/// <summary>The caller, from a verified JWT.</summary>
public record GatewayUser(string Sub, string Role);

/// <summary>
/// Verifies callers before their requests are proxied. Downstream services
/// trust x-user-id / x-user-role to identify the caller, so the gateway
/// strips any client-supplied values and only re-adds them, from the
/// verified JWT, on routes that need to know who is calling.
/// </summary>
public static class GatewayAuth
{
    private const string UserKey = "gateway.user";

    public static IApplicationBuilder UseIdentityHeaderStripping(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            context.Request.Headers.Remove(GatewayIdentity.UserIdHeader);
            context.Request.Headers.Remove(GatewayIdentity.UserRoleHeader);
            return next(context);
        });

    /// <summary>Runs after routing, so it knows which route (and so which access level) a request hit.</summary>
    public static IApplicationBuilder UseGatewayAuth(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var route = context.GetEndpoint()?.Metadata.GetMetadata<RouteModel>();
            var access = route?.Config.Metadata?.GetValueOrDefault(Access.Key);
            var isWebSocket = IsWebSocketRequest(context.Request);

            // The notification socket is the gateway's only websocket entry point.
            if (isWebSocket != (access == Access.Socket))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            if (access == Access.Socket)
            {
                // Browsers can't set an Authorization header on a WebSocket, so the
                // token comes as ?token=.
                var secret = context.RequestServices.GetRequiredService<IConfiguration>()["JWT_SECRET"];
                var user = string.IsNullOrEmpty(secret) ? null : Verify(context.Request.Query["token"].ToString(), secret);
                if (user is null)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }
                context.Items[UserKey] = user;
                await next(context);
                return;
            }

            // /health, /openapi.json and the public proxies need no token.
            if (access == Access.Public || (route is null && context.GetEndpoint() is not null))
            {
                await next(context);
                return;
            }

            // Everything else, including unknown paths, requires a valid JWT.
            if (await AuthenticateBearerAsync(context) is not { } caller) return;

            if (context.Request.Path.StartsWithSegments("/owner") && caller.Role != GatewayIdentity.RestaurantOwnerRole)
            {
                await Error(context, StatusCodes.Status403Forbidden, "You do not have access to this");
                return;
            }

            await next(context);
        });

    /// <summary>Forwards the verified caller as x-user-id / x-user-role on routes that need it.</summary>
    public static void AddIdentityTransforms(TransformBuilderContext builder)
    {
        if (builder.Route.Metadata?.GetValueOrDefault(Access.Key) is null or Access.Public) return;

        builder.AddRequestTransform(transform =>
        {
            if (transform.HttpContext.Items[UserKey] is GatewayUser user)
            {
                var headers = transform.ProxyRequest.Headers;
                headers.Remove(GatewayIdentity.UserIdHeader);
                headers.Remove(GatewayIdentity.UserRoleHeader);
                headers.Add(GatewayIdentity.UserIdHeader, user.Sub);
                headers.Add(GatewayIdentity.UserRoleHeader, user.Role);
            }
            return ValueTask.CompletedTask;
        });
    }

    private static async Task<GatewayUser?> AuthenticateBearerAsync(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal))
        {
            await Error(context, StatusCodes.Status401Unauthorized, "Missing or invalid Authorization header");
            return null;
        }

        var secret = context.RequestServices.GetRequiredService<IConfiguration>()["JWT_SECRET"];
        if (string.IsNullOrEmpty(secret))
        {
            await Error(context, StatusCodes.Status500InternalServerError, "JWT_SECRET is not configured on the gateway");
            return null;
        }

        var user = Verify(header["Bearer ".Length..], secret);
        if (user is null)
        {
            await Error(context, StatusCodes.Status401Unauthorized, "Invalid or expired token");
            return null;
        }

        context.Items[UserKey] = user;
        return user;
    }

    public static GatewayUser? Verify(string token, string secret)
    {
        var claims = Jwt.Verify(token, secret);
        var sub = claims?["sub"].AsString();
        return sub is null ? null : new GatewayUser(sub, claims!["role"].AsString() ?? "");
    }

    private static bool IsWebSocketRequest(HttpRequest request) =>
        request.Headers.Upgrade.ToString().Equals("websocket", StringComparison.OrdinalIgnoreCase);

    private static Task Error(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new { error = message });
    }
}
