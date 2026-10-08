using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Delivery.Common.Events;
using Delivery.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace NotificationService.Tests;

public sealed class NotificationTests : IDisposable
{
    private readonly ServiceFactory<Program> _factory = new();

    public void Dispose() => _factory.Dispose();

    private sealed class RecordingSender : INotificationSender
    {
        public ConcurrentQueue<(string UserId, string Json)> Sent { get; } = new();

        public Task SendToUserAsync(string userId, object notification)
        {
            Sent.Enqueue((userId, JsonSerializer.Serialize(notification, notification.GetType(), new JsonSerializerOptions(JsonSerializerDefaults.Web))));
            return Task.CompletedTask;
        }
    }

    private static OrderPreparingEvent Preparing(string? ownerId) =>
        new("order-1", "customer-1", "restaurant-1", ownerId, "2026-10-08T12:00:00.000Z");

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"notification-service"}""", await _factory.CreateClient().GetStringAsync("/health"));
    }

    [Fact]
    public async Task TellsTheCustomerAndTheRestaurantOwnerEachInTheirOwnFormat()
    {
        var sender = new RecordingSender();
        await Subscriptions.NotifyOrderStatusAsync(sender, JsonSerializer.SerializeToElement(Preparing("owner-1"), EventJson.Options), "PREPARING");

        Assert.Equal(
            [
                ("customer-1", """{"type":"order.updated","orderId":"order-1","status":"PREPARING"}"""),
                ("owner-1", """{"type":"restaurant.order_updated","orderId":"order-1","restaurantId":"restaurant-1","status":"PREPARING"}"""),
            ],
            sender.Sent);
    }

    [Fact]
    public async Task PassesOnTheCancellationReason()
    {
        var sender = new RecordingSender();
        var cancelled = new OrderCancelledEvent("order-1", "customer-1", "restaurant-1", null, "Rejected by the restaurant", "2026-10-08T12:00:00.000Z");

        await Subscriptions.NotifyOrderStatusAsync(sender, JsonSerializer.SerializeToElement(cancelled, EventJson.Options), "CANCELLED");

        var (userId, json) = Assert.Single(sender.Sent);
        Assert.Equal("customer-1", userId);
        Assert.Equal("""{"type":"order.updated","orderId":"order-1","status":"CANCELLED","reason":"Rejected by the restaurant"}""", json);
    }

    [Fact]
    public async Task PushesOrderEventsFromTheBus()
    {
        var sender = new RecordingSender();
        using var factory = new ServiceFactoryWith(sender);

        await factory.DeliverAsync(RoutingKeys.OrderReady, new OrderReadyEvent("order-1", "customer-1", "restaurant-1", null, "2026-10-08T12:00:00.000Z"));

        var (userId, json) = Assert.Single(sender.Sent);
        Assert.Equal("customer-1", userId);
        Assert.Contains("\"status\":\"READY\"", json);
    }

    [Fact]
    public async Task RefusesSocketsThatDidNotComeThroughTheGateway()
    {
        var client = _factory.Server.CreateWebSocketClient();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.ConnectAsync(new Uri("ws://localhost/ws/notifications"), CancellationToken.None));

        Assert.Contains("401", error.Message);
    }

    [Fact]
    public async Task SendsAUsersNotificationsOnlyToThatUserOnEveryConnection()
    {
        using var aliceTab1 = await ConnectAs("alice");
        using var aliceTab2 = await ConnectAs("alice");
        using var bob = await ConnectAs("bob");

        var hub = _factory.Services.GetRequiredService<NotificationHub>();
        await hub.SendToUserAsync("alice", new { type = "order.updated", orderId = "order-1", status = "CONFIRMED" });
        await hub.SendToUserAsync("bob", new { type = "order.updated", orderId = "order-2", status = "READY" });

        const string expected = """{"type":"order.updated","orderId":"order-1","status":"CONFIRMED"}""";
        Assert.Equal(expected, await Receive(aliceTab1));
        Assert.Equal(expected, await Receive(aliceTab2));
        Assert.Contains("order-2", await Receive(bob));
    }

    /// <summary>Connects as the given user, the way the gateway does, and reads the "connected" ack.</summary>
    private async Task<WebSocket> ConnectAs(string userId)
    {
        var client = _factory.Server.CreateWebSocketClient();
        client.ConfigureRequest = request => request.Headers["x-user-id"] = userId;
        var socket = await client.ConnectAsync(new Uri("ws://localhost/ws/notifications"), CancellationToken.None);
        Assert.Contains("\"type\":\"connected\"", await Receive(socket));
        return socket;
    }

    private static async Task<string> Receive(WebSocket socket)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var buffer = new byte[4096];
        var result = await socket.ReceiveAsync(buffer, timeout.Token);
        return Encoding.UTF8.GetString(buffer, 0, result.Count);
    }

    private sealed class ServiceFactoryWith(INotificationSender sender) : ServiceFactory<Program>
    {
        protected override void ConfigureTestServices(IServiceCollection services) =>
            services.AddSingleton(sender);
    }
}
