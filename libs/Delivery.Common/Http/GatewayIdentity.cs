using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Delivery.Common.Http;

/// <summary>
/// The api-gateway verifies the JWT and forwards the caller as x-user-id /
/// x-user-role (stripping any client-supplied values first), so services
/// trust those headers rather than re-verifying the token themselves.
/// </summary>
public static class GatewayIdentity
{
    public const string UserIdHeader = "x-user-id";
    public const string UserRoleHeader = "x-user-role";
    public const string RestaurantOwnerRole = "RESTAURANT_OWNER";

    private const string UserIdKey = "gateway.userId";

    /// <summary>Only lets requests through that carry the caller's id.</summary>
    public static TBuilder RequireUser<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            var userId = context.HttpContext.Request.Headers[UserIdHeader].ToString();
            if (userId.Length == 0) return MissingUser();
            context.HttpContext.Items[UserIdKey] = userId;
            return await next(context);
        });

    /// <summary>Only lets restaurant owners through.</summary>
    public static TBuilder RequireOwner<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
        {
            var headers = context.HttpContext.Request.Headers;
            var userId = headers[UserIdHeader].ToString();
            if (userId.Length == 0) return MissingUser();
            if (headers[UserRoleHeader] != RestaurantOwnerRole)
            {
                return Results.Json(new { error = "Only restaurant owners can do this" }, statusCode: StatusCodes.Status403Forbidden);
            }
            context.HttpContext.Items[UserIdKey] = userId;
            return await next(context);
        });

    /// <summary>The caller's id, on endpoints behind <see cref="RequireUser{TBuilder}"/> or <see cref="RequireOwner{TBuilder}"/>.</summary>
    public static string UserId(this HttpContext context) =>
        context.Items[UserIdKey] as string ?? throw new InvalidOperationException("Endpoint is not behind RequireUser/RequireOwner");

    private static IResult MissingUser() =>
        Results.Json(new { error = "Missing x-user-id; call this service through the api-gateway" }, statusCode: StatusCodes.Status401Unauthorized);
}
