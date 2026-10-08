using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using Delivery.Common.Http;

namespace NotificationService;

public interface INotificationSender
{
    /// <summary>Sends a JSON-serializable notification to every connection of one user.</summary>
    Task SendToUserAsync(string userId, object notification);
}

/// <summary>
/// The websocket connections at /ws/notifications, by user. Connections must
/// come through the api-gateway, which verifies the JWT and forwards the
/// caller as x-user-id; anything else is refused, so every socket is tied to
/// a known user.
/// </summary>
public sealed class NotificationHub : INotificationSender
{
    public const string Path = "/ws/notifications";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // One user can have several connections open (e.g. multiple tabs).
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Connection, byte>> _connectionsByUser = new();

    public async Task AcceptAsync(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var userId = context.Request.Headers[GatewayIdentity.UserIdHeader].ToString();
        if (userId.Length == 0)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        var connection = new Connection(socket);
        var connections = _connectionsByUser.GetOrAdd(userId, _ => new());
        connections[connection] = 0;
        try
        {
            await connection.SendAsync(JsonSerializer.Serialize(new { type = "connected", message = "Connected to notification-service" }));
            await connection.ReceiveUntilClosedAsync(context.RequestAborted);
        }
        finally
        {
            connections.TryRemove(connection, out _);
            if (connections.IsEmpty) _connectionsByUser.TryRemove(new(userId, connections));
        }
    }

    public async Task SendToUserAsync(string userId, object notification)
    {
        if (!_connectionsByUser.TryGetValue(userId, out var connections)) return;

        var data = JsonSerializer.Serialize(notification, notification.GetType(), Json);
        await Task.WhenAll(connections.Keys.Select(connection => connection.SendAsync(data)));
    }

    private sealed class Connection(WebSocket socket)
    {
        // A WebSocket allows only one send at a time.
        private readonly SemaphoreSlim _sendLock = new(1, 1);

        public async Task SendAsync(string data)
        {
            await _sendLock.WaitAsync();
            try
            {
                if (socket.State == WebSocketState.Open)
                {
                    await socket.SendAsync(System.Text.Encoding.UTF8.GetBytes(data), WebSocketMessageType.Text, endOfMessage: true, CancellationToken.None);
                }
            }
            catch (WebSocketException)
            {
                // The client went away mid-send; its receive loop cleans up.
            }
            finally
            {
                _sendLock.Release();
            }
        }

        /// <summary>Clients don't send anything; this just waits for the close.</summary>
        public async Task ReceiveUntilClosedAsync(CancellationToken cancellationToken)
        {
            var buffer = new byte[1024];
            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    var result = await socket.ReceiveAsync(buffer, cancellationToken);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _sendLock.WaitAsync(CancellationToken.None);
                        try
                        {
                            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
                        }
                        finally
                        {
                            _sendLock.Release();
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is WebSocketException or OperationCanceledException)
            {
                // Connection dropped.
            }
        }
    }
}
