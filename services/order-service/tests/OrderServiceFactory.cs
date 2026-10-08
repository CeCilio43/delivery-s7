using System.Net;
using System.Text;
using System.Text.Json;
using Delivery.Common.Json;
using Delivery.Testing;
using Microsoft.Extensions.DependencyInjection;
using OrderService.Data;

namespace OrderService.Tests;

/// <summary>order-service with restaurant-service replaced by <see cref="StubRestaurantService"/>.</summary>
public sealed class OrderServiceFactory : DbServiceFactory<Program, OrderDb>
{
    public StubRestaurantService RestaurantService { get; } = new();

    protected override void ConfigureTestServices(IServiceCollection services)
    {
        base.ConfigureTestServices(services);
        services.AddHttpClient<RestaurantClient>().ConfigurePrimaryHttpMessageHandler(() => RestaurantService);
    }
}

/// <summary>Answers GET /restaurants/{id} with whatever the test set up.</summary>
public sealed class StubRestaurantService : HttpMessageHandler
{
    private HttpStatusCode _status = HttpStatusCode.NotFound;
    private string _body = """{"error":"Restaurant not found"}""";

    public int Calls { get; private set; }

    public bool Unreachable { get; set; }

    public void Respond(object body, HttpStatusCode status = HttpStatusCode.OK)
    {
        _status = status;
        _body = JsonSerializer.Serialize(body, ApiJson.Options);
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        if (Unreachable) throw new HttpRequestException("connection refused");
        return Task.FromResult(new HttpResponseMessage(_status)
        {
            Content = new StringContent(_body, Encoding.UTF8, "application/json"),
        });
    }
}
