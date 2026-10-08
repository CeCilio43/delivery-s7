using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Delivery.Common.Events;
using Delivery.Testing;
using Microsoft.EntityFrameworkCore;
using PaymentService.Data;

namespace PaymentService.Tests;

public sealed class PaymentTests : IDisposable
{
    private readonly DbServiceFactory<Program, PaymentDb> _factory = new();

    public void Dispose() => _factory.Dispose();

    private Task OrderCreated(decimal total) => _factory.DeliverAsync(RoutingKeys.OrderCreated,
        new OrderCreatedEvent("order-1", "customer-1", "restaurant-1", [], total, "2026-10-08T12:00:00.000Z"));

    private Task<Transaction> StoredTransaction() => _factory.WithDb(db => db.Transactions.SingleAsync());

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"payment-service"}""", await _factory.CreateClient().GetStringAsync("/health"));
    }

    [Fact]
    public async Task OrderCreated_ChargesTheOrderAndPublishesPaymentSucceeded()
    {
        await OrderCreated(25m);

        var transaction = await StoredTransaction();
        Assert.Equal(("order-1", "customer-1", 25m, PaymentStatus.Succeeded), (transaction.OrderId, transaction.CustomerId, transaction.Amount, transaction.Status));
        Assert.StartsWith("sim_", transaction.ProviderRef);
        var succeeded = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.PaymentSucceeded));
        Assert.Equal(transaction.Id, succeeded.GetProperty("paymentId").GetString());
        Assert.Equal("order-1", succeeded.GetProperty("orderId").GetString());
        Assert.Equal(25m, succeeded.GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task OrderCreated_DeclinesOrdersAboveTheLimitAndPublishesPaymentFailed()
    {
        _factory.Settings["PAYMENT_DECLINE_ABOVE"] = "50";

        await OrderCreated(75m);

        var transaction = await StoredTransaction();
        Assert.Equal(PaymentStatus.Failed, transaction.Status);
        var failed = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.PaymentFailed));
        Assert.Equal(transaction.Id, failed.GetProperty("paymentId").GetString());
        Assert.Equal("Amount 75.00 exceeds the card limit of 50.00", failed.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task OrderCreated_DoesNotChargeTheSameOrderTwiceOnRedelivery()
    {
        await OrderCreated(25m);
        await OrderCreated(25m);

        Assert.Equal(1, await _factory.WithDb(db => db.Transactions.CountAsync()));
        Assert.Single(_factory.Events.Published);
    }

    [Fact]
    public async Task OrderCancelled_RefundsASucceededPayment()
    {
        await OrderCreated(25m);

        await _factory.DeliverAsync(RoutingKeys.OrderCancelled,
            new OrderCancelledEvent("order-1", "customer-1", "restaurant-1", "owner-1", "Cancelled by customer", "2026-10-08T12:05:00.000Z"));

        Assert.Equal(PaymentStatus.Refunded, (await StoredTransaction()).Status);
    }

    [Fact]
    public async Task Payments_ListsOnlyTheCallersPaymentsWithAmountsAsStrings()
    {
        await _factory.Seed(
            new Transaction { Id = "pay-1", OrderId = "order-1", CustomerId = "customer-1", Amount = 17.5m, Status = PaymentStatus.Succeeded },
            new Transaction { Id = "pay-2", OrderId = "order-2", CustomerId = "customer-2", Amount = 4m });

        var payments = await _factory.ClientAs("customer-1").GetFromJsonAsync<JsonElement[]>("/payments?orderId=order-1");

        var payment = Assert.Single(payments!);
        Assert.Equal("pay-1", payment.GetProperty("id").GetString());
        Assert.Equal("17.5", payment.GetProperty("amount").GetString());
        Assert.Equal("SUCCEEDED", payment.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Payment_Returns404ForSomeoneElsesPayment()
    {
        await _factory.Seed(new Transaction { Id = "pay-2", OrderId = "order-2", CustomerId = "customer-2", Amount = 4m });

        var response = await _factory.ClientAs("customer-1").GetAsync("/payments/pay-2");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Payments_RejectRequestsThatDidNotComeThroughTheGateway()
    {
        var response = await _factory.CreateClient().GetAsync("/payments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
