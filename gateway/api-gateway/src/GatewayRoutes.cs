using Yarp.ReverseProxy.Configuration;

namespace ApiGateway;

/// <summary>Who may use a proxied route; stored in each route's metadata.</summary>
public static class Access
{
    public const string Key = "access";

    /// <summary>Anyone, without a token.</summary>
    public const string Public = "public";

    /// <summary>Any caller with a valid JWT, forwarded as x-user-id / x-user-role.</summary>
    public const string User = "user";

    /// <summary>Callers whose JWT has the RESTAURANT_OWNER role.</summary>
    public const string Owner = "owner";

    /// <summary>The notification websocket, which passes its JWT as ?token=.</summary>
    public const string Socket = "socket";
}

/// <summary>Which service each path is proxied to, and who may call it.</summary>
public static class GatewayRoutes
{
    public const string NotificationSocketPath = "/ws/notifications";

    // Each prefix also matches everything below it, e.g. /restaurants covers
    // both GET /restaurants and GET /restaurants/{id}, and /register covers
    // /register/restaurant-owner (the restaurant-app's sign-up).
    private static readonly (string Prefix, string Service, string Access)[] Table =
    [
        // Auth routes are unauthenticated by design.
        ("/register", "user", Access.Public),
        ("/login", "user", Access.Public),
        ("/auth/google", "user", Access.Public),
        // Restaurant browsing is public too.
        ("/restaurants", "restaurant", Access.Public),
        ("/orders", "order", Access.User),
        ("/payments", "payment", Access.User),
        // The restaurant-owner area. This is only the coarse role gate; the services
        // behind it still check that each restaurant or order belongs to the owner.
        ("/owner/restaurants", "restaurant", Access.Owner),
        ("/owner/orders", "order", Access.Owner),
    ];

    public static IReadOnlyList<RouteConfig> Routes()
    {
        var routes = Table.Select(route => new RouteConfig
        {
            RouteId = route.Prefix.TrimStart('/').Replace('/', '-'),
            ClusterId = route.Service,
            Match = new RouteMatch { Path = $"{route.Prefix}/{{**rest}}" },
            Metadata = new Dictionary<string, string> { [Access.Key] = route.Access },
        }).ToList();

        routes.Add(new RouteConfig
        {
            RouteId = "notification-socket",
            ClusterId = "notification",
            Match = new RouteMatch { Path = NotificationSocketPath },
            Metadata = new Dictionary<string, string> { [Access.Key] = Access.Socket },
            // The token has done its job at the gateway; don't pass it on.
            Transforms = [new Dictionary<string, string> { ["QueryRemoveParameter"] = "token" }],
        });
        return routes;
    }

    public static IReadOnlyList<ClusterConfig> Clusters(IConfiguration configuration)
    {
        ClusterConfig Cluster(string id, string setting, string fallback) => new()
        {
            ClusterId = id,
            Destinations = new Dictionary<string, DestinationConfig>
            {
                [id] = new() { Address = configuration[setting] ?? fallback },
            },
        };

        return
        [
            Cluster("user", "USER_SERVICE_URL", "http://localhost:3001"),
            Cluster("restaurant", "RESTAURANT_SERVICE_URL", "http://localhost:3002"),
            Cluster("order", "ORDER_SERVICE_URL", "http://localhost:3003"),
            Cluster("payment", "PAYMENT_SERVICE_URL", "http://localhost:3004"),
            Cluster("notification", "NOTIFICATION_SERVICE_URL", "http://localhost:3005"),
        ];
    }
}
