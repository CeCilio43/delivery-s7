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

    // Created on use, so a test can still change settings before the service starts.
    private HttpClient Customer => _factory.ClientAs("customer-1");

    public void Dispose() => _factory.Dispose();

    private Task OrderCreated(decimal total) => _factory.DeliverAsync(RoutingKeys.OrderCreated,
        new OrderCreatedEvent("order-1", "customer-1", "restaurant-1", [], total, "2026-10-08T12:00:00.000Z"));

    private Task OrderCancelled() => _factory.DeliverAsync(RoutingKeys.OrderCancelled,
        new OrderCancelledEvent("order-1", "customer-1", "restaurant-1", null, "Cancelled by customer", "2026-10-08T12:05:00.000Z"));

    private Task<Transaction> StoredPayment() => _factory.WithDb(db => db.Transactions.SingleAsync());

    private async Task<HttpResponseMessage> PayNow() =>
        await Customer.PostAsync($"/payments/{(await StoredPayment()).Id}/pay", null);

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"payment-service"}""", await _factory.CreateClient().GetStringAsync("/health"));
    }

    [Fact]
    public async Task OrderCreated_CreatesAPendingPaymentWithoutChargingIt()
    {
        await OrderCreated(25m);

        var payment = await StoredPayment();
        Assert.Equal(("order-1", "customer-1", 25m, PaymentStatus.Pending), (payment.OrderId, payment.CustomerId, payment.Amount, payment.Status));
        Assert.Empty(_factory.Events.Published);
    }

    [Fact]
    public async Task OrderCreated_DoesNotCreateASecondPaymentOnRedelivery()
    {
        await OrderCreated(25m);
        await OrderCreated(25m);

        Assert.Equal(1, await _factory.WithDb(db => db.Transactions.CountAsync()));
    }

    [Fact]
    public async Task PayNow_ChargesThePaymentAndPublishesPaymentSucceeded()
    {
        await OrderCreated(25m);

        var response = await PayNow();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SUCCEEDED", body.GetProperty("status").GetString());
        Assert.Equal("25", body.GetProperty("amount").GetString());
        var payment = await StoredPayment();
        Assert.Equal(PaymentStatus.Succeeded, payment.Status);
        Assert.StartsWith("sim_", payment.ProviderRef);
        var succeeded = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.PaymentSucceeded));
        Assert.Equal(payment.Id, succeeded.GetProperty("paymentId").GetString());
        Assert.Equal("order-1", succeeded.GetProperty("orderId").GetString());
        Assert.Equal(25m, succeeded.GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task PayNow_DeclinesPaymentsAboveTheLimitAndPublishesPaymentFailed()
    {
        _factory.Settings["PAYMENT_DECLINE_ABOVE"] = "50";
        await OrderCreated(75m);

        var response = await PayNow();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("FAILED", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString());
        var failed = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.PaymentFailed));
        Assert.Equal("order-1", failed.GetProperty("orderId").GetString());
        Assert.Equal("Amount 75.00 exceeds the card limit of 50.00", failed.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task PayNow_NeverChargesTwice()
    {
        await OrderCreated(25m);
        await PayNow();

        var second = await PayNow();

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("This payment can't be paid while SUCCEEDED",
            (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
        Assert.Single(_factory.Events.Published);
    }

    [Fact]
    public async Task PayNow_UndoesTheChargeWhenTheEventBusIsDown()
    {
        await OrderCreated(25m);
        _factory.Events.FailNextPublish();

        var response = await PayNow();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(PaymentStatus.Pending, (await StoredPayment()).Status);
        Assert.Equal(HttpStatusCode.OK, (await PayNow()).StatusCode);
    }

    [Fact]
    public async Task PayNow_Returns404ForSomeoneElsesPayment()
    {
        await OrderCreated(25m);
        var payment = await StoredPayment();

        var response = await _factory.ClientAs("customer-2").PostAsync($"/payments/{payment.Id}/pay", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(PaymentStatus.Pending, (await StoredPayment()).Status);
    }

    [Fact]
    public async Task OrderCancelled_VoidsAnUnpaidPaymentSoItCantBePaid()
    {
        await OrderCreated(25m);
        await OrderCancelled();

        Assert.Equal(PaymentStatus.Cancelled, (await StoredPayment()).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await PayNow()).StatusCode);
        Assert.Empty(_factory.Events.Published);
    }

    [Fact]
    public async Task OrderCancelled_RefundsAPaidPayment()
    {
        await OrderCreated(25m);
        await PayNow();

        await OrderCancelled();

        Assert.Equal(PaymentStatus.Refunded, (await StoredPayment()).Status);
    }

    [Fact]
    public async Task Payments_ListsOnlyTheCallersPaymentsWithAmountsAsStrings()
    {
        await _factory.Seed(
            new Transaction { Id = "pay-1", OrderId = "order-1", CustomerId = "customer-1", Amount = 17.5m, Status = PaymentStatus.Succeeded },
            new Transaction { Id = "pay-2", OrderId = "order-2", CustomerId = "customer-2", Amount = 4m });

        var payments = await Customer.GetFromJsonAsync<JsonElement[]>("/payments?orderId=order-1");

        var payment = Assert.Single(payments!);
        Assert.Equal("pay-1", payment.GetProperty("id").GetString());
        Assert.Equal("17.5", payment.GetProperty("amount").GetString());
        Assert.Equal("SUCCEEDED", payment.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Payment_Returns404ForSomeoneElsesPayment()
    {
        await _factory.Seed(new Transaction { Id = "pay-2", OrderId = "order-2", CustomerId = "customer-2", Amount = 4m });

        var response = await Customer.GetAsync("/payments/pay-2");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Payments_RejectRequestsThatDidNotComeThroughTheGateway()
    {
        var response = await _factory.CreateClient().GetAsync("/payments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
