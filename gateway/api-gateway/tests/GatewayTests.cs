using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text.Json;
using System.Text.Json.Nodes;
using Delivery.Common.Auth;
using Delivery.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ApiGateway.Tests;

/// <summary>
/// A stand-in for every downstream service: records the requests the gateway
/// forwarded, answers with the path it got, and accepts the notification
/// websocket.
/// </summary>
public sealed class StubService : IAsyncDisposable
{
    private readonly WebApplication _app;

    public ConcurrentQueue<(string PathAndQuery, IHeaderDictionary Headers)> Received { get; } = new();

    public string Url { get; }

    public StubService()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        _app = builder.Build();
        _app.UseWebSockets();
        _app.Run(async context =>
        {
            var pathAndQuery = $"{context.Request.Path}{context.Request.QueryString}";
            Received.Enqueue((pathAndQuery, new HeaderDictionary(context.Request.Headers.ToDictionary())));
            if (context.WebSockets.IsWebSocketRequest)
            {
                using var socket = await context.WebSockets.AcceptWebSocketAsync();
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
                return;
            }
            await context.Response.WriteAsJsonAsync(new { path = pathAndQuery });
        });
        _app.StartAsync().GetAwaiter().GetResult();
        Url = _app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
    }

    public ValueTask DisposeAsync() => _app.DisposeAsync();
}

public sealed class GatewayTests : IAsyncLifetime
{
    private readonly StubService _upstream = new();
    private readonly ServiceFactory<Program> _gateway = new();

    public GatewayTests()
    {
        foreach (var service in new[] { "USER", "RESTAURANT", "ORDER", "PAYMENT", "NOTIFICATION" })
        {
            _gateway.Settings[$"{service}_SERVICE_URL"] = _upstream.Url;
        }
        // A real server, since websockets can't be proxied through the in-memory test server.
        _gateway.UseKestrel(0);
        _gateway.StartServer();
    }

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        await _gateway.DisposeAsync();
        await _upstream.DisposeAsync();
    }

    private static string Token(string sub, string role, string secret = ServiceFactory<Program>.JwtSecret) =>
        Jwt.Sign(new JsonObject { ["sub"] = sub, ["role"] = role }, secret);

    private HttpClient Client(string? token = null)
    {
        var client = _gateway.CreateClient();
        if (token is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"api-gateway"}""", await Client().GetStringAsync("/health"));
    }

    [Theory]
    [InlineData("http://localhost:5173")]
    [InlineData("http://localhost:5174")]
    public async Task Cors_AllowsTheFrontends(string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/orders");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization");

        var response = await Client().SendAsync(request);

        Assert.Equal(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Cors_DoesNotAllowOtherOrigins()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/orders");
        request.Headers.Add("Origin", "http://evil.example");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await Client().SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Theory]
    [InlineData("/login")]
    [InlineData("/register/restaurant-owner")]
    [InlineData("/restaurants/restaurant-1?search=x")]
    public async Task PublicRoutes_AreProxiedWithoutAToken(string path)
    {
        var response = await Client().GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(path, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("path").GetString());
    }

    [Fact]
    public async Task PublicRoutes_NeverForwardClientSuppliedIdentity()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/restaurants");
        request.Headers.Add("x-user-id", "someone-else");
        request.Headers.Add("x-user-role", "ADMIN");

        await Client().SendAsync(request);

        var (_, headers) = Assert.Single(_upstream.Received);
        Assert.False(headers.ContainsKey("x-user-id"));
        Assert.False(headers.ContainsKey("x-user-role"));
    }

    [Theory]
    [InlineData(null, "Missing or invalid Authorization header")]
    [InlineData("not-a-jwt", "Invalid or expired token")]
    public async Task ProtectedRoutes_RejectMissingOrInvalidTokensWithoutReachingTheService(string? token, string error)
    {
        var response = await Client(token).GetAsync("/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(error, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
        Assert.Empty(_upstream.Received);
    }

    [Fact]
    public async Task ProtectedRoutes_RejectTokensSignedWithAnotherSecret()
    {
        var response = await Client(Token("user-1", "CUSTOMER", secret: "another-secret")).GetAsync("/orders");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedRoutes_ForwardTheVerifiedUserOverridingSpoofedHeaders()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/orders/abc");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token("user-1", "CUSTOMER"));
        request.Headers.Add("x-user-id", "someone-else");
        request.Headers.Add("x-user-role", "ADMIN");

        var response = await Client().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/orders/abc", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("path").GetString());
        var (_, headers) = Assert.Single(_upstream.Received);
        Assert.Equal("user-1", headers["x-user-id"].ToString());
        Assert.Equal("CUSTOMER", headers["x-user-role"].ToString());
    }

    [Fact]
    public async Task ProtectedRoutes_AcceptTokensIssuedByTheNodeUserService()
    {
        // Signed by the Node service's jsonwebtoken with the docker-compose dev secret.
        await using var gateway = new ServiceFactory<Program>();
        gateway.Settings["JWT_SECRET"] = "dev-local-jwt-secret-change-me";
        gateway.Settings["PAYMENT_SERVICE_URL"] = _upstream.Url;
        const string nodeToken =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiQ1VTVE9NRVIiLCJlbWFpbCI6ImFAYi5jIiwiaWF0IjoxNzkxNDQ5NjQ2LCJleHAiOjQ5NDcyMDk2NDZ9.I8f7qTjH2ceeJaKvQwcTpc6Co1-Gr_vVnzdPV-tu9C4";
        var client = gateway.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", nodeToken);

        var response = await client.GetAsync("/payments");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("user-1", Assert.Single(_upstream.Received).Headers["x-user-id"].ToString());
    }

    [Fact]
    public async Task UnknownPaths_RequireATokenToo()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/nope")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client(Token("user-1", "CUSTOMER")).GetAsync("/nope")).StatusCode);
    }

    [Fact]
    public async Task OwnerRoutes_RefuseACustomerTokenBeforeReachingAnyService()
    {
        var response = await Client(Token("customer-1", "CUSTOMER")).GetAsync("/owner/orders");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(_upstream.Received);
    }

    [Theory]
    [InlineData("/owner/orders/order-1/accept")]
    [InlineData("/owner/restaurants")]
    public async Task OwnerRoutes_ForwardAnOwnersRequestWithTheirIdentity(string path)
    {
        var response = await Client(Token("owner-1", "RESTAURANT_OWNER")).PostAsync(path, null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (pathAndQuery, headers) = Assert.Single(_upstream.Received);
        Assert.Equal(path, pathAndQuery);
        Assert.Equal("owner-1", headers["x-user-id"].ToString());
        Assert.Equal("RESTAURANT_OWNER", headers["x-user-role"].ToString());
    }

    [Fact]
    public async Task Docs_ServeTheOpenApiSpec()
    {
        var spec = await Client().GetFromJsonAsync<JsonElement>("/openapi.json");

        Assert.StartsWith("3.", spec.GetProperty("openapi").GetString());
        var paths = spec.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        Assert.Contains("/login", paths);
        Assert.Contains("/restaurants", paths);
        Assert.Contains("/orders", paths);
        Assert.Contains("/payments", paths);
    }

    [Fact]
    public async Task Docs_ServeSwaggerUiWithoutAToken()
    {
        var response = await Client().GetAsync("/docs/index.html");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("swagger-ui", await response.Content.ReadAsStringAsync());
    }

    private async Task<(WebSocket? Socket, HttpStatusCode? Status)> ConnectSocket(string path, string? spoofedUserId = null)
    {
        var socket = new ClientWebSocket();
        socket.Options.CollectHttpResponseDetails = true;
        if (spoofedUserId is not null) socket.Options.SetRequestHeader("x-user-id", spoofedUserId);
        var url = new Uri(_gateway.ClientOptions.BaseAddress, path);
        try
        {
            await socket.ConnectAsync(new UriBuilder(url) { Scheme = "ws" }.Uri, CancellationToken.None);
            return (socket, null);
        }
        catch (WebSocketException)
        {
            return (null, socket.HttpStatusCode);
        }
    }

    [Theory]
    [InlineData("/ws/notifications")]
    [InlineData("/ws/notifications?token=not-a-jwt")]
    public async Task NotificationSocket_RefusesConnectionsWithoutAValidToken(string path)
    {
        var (_, status) = await ConnectSocket(path);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Empty(_upstream.Received);
    }

    [Fact]
    public async Task NotificationSocket_RefusesWebsocketUpgradesOnOtherPaths()
    {
        var (_, status) = await ConnectSocket($"/orders?token={Token("user-1", "CUSTOMER")}");

        Assert.Equal(HttpStatusCode.NotFound, status);
    }

    [Fact]
    public async Task NotificationSocket_ForwardsTheVerifiedUserAndStripsTheTokenAndSpoofedHeaders()
    {
        var (socket, _) = await ConnectSocket($"/ws/notifications?token={Token("user-1", "CUSTOMER")}", spoofedUserId: "someone-else");

        Assert.NotNull(socket);
        socket.Dispose();
        var (pathAndQuery, headers) = Assert.Single(_upstream.Received);
        Assert.Equal("/ws/notifications", pathAndQuery);
        Assert.Equal("user-1", headers["x-user-id"].ToString());
        Assert.Equal("CUSTOMER", headers["x-user-role"].ToString());
    }
}
