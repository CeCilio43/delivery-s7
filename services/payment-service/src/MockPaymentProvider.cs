using System.Globalization;
using Delivery.Common;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using PaymentService.Data;

namespace PaymentService;

public enum ChargeResult
{
    Charged,
    /// <summary>Paid already, or its order was cancelled.</summary>
    NotPending,
    /// <summary>The outcome couldn't be published, so the charge was undone.</summary>
    EventBusUnavailable,
}

/// <summary>
/// Stands in for a real payment provider when the customer presses "Pay now".
/// It approves every charge up to PAYMENT_DECLINE_ABOVE and declines anything
/// larger, so both the success and failure paths of the order flow can be
/// exercised on demand.
/// </summary>
public class MockPaymentProvider(PaymentDb db, IEventBus bus, IConfiguration configuration, ILogger<MockPaymentProvider> logger)
{
    private decimal DeclineLimit =>
        decimal.TryParse(configuration["PAYMENT_DECLINE_ABOVE"], NumberStyles.Float, CultureInfo.InvariantCulture, out var limit)
            ? limit
            : 100;

    /// <summary>Charges a pending payment and publishes payment.succeeded or payment.failed.</summary>
    public async Task<ChargeResult> ChargeAsync(Transaction payment)
    {
        var limit = DeclineLimit;
        var approved = payment.Amount <= limit;
        var providerRef = approved ? $"sim_{Guid.NewGuid()}" : null;

        // Conditional on still being PENDING, so a double click (or a cancel
        // arriving at the same time) can't charge twice.
        var charged = await db.Transactions
            .Where(t => t.Id == payment.Id && t.Status == PaymentStatus.Pending)
            .ExecuteUpdateAsync(set => set
                .SetProperty(t => t.Status, approved ? PaymentStatus.Succeeded : PaymentStatus.Failed)
                .SetProperty(t => t.ProviderRef, providerRef)
                .SetProperty(t => t.UpdatedAt, Clock.Now()));
        if (charged == 0) return ChargeResult.NotPending;

        try
        {
            if (approved)
            {
                await bus.PublishAsync(RoutingKeys.PaymentSucceeded,
                    new PaymentSucceededEvent(payment.Id, payment.OrderId, payment.Amount, Clock.IsoNow()));
            }
            else
            {
                var reason = string.Create(CultureInfo.InvariantCulture, $"Amount {payment.Amount:F2} exceeds the card limit of {limit:F2}");
                await bus.PublishAsync(RoutingKeys.PaymentFailed,
                    new PaymentFailedEvent(payment.Id, payment.OrderId, reason, Clock.IsoNow()));
            }
            return ChargeResult.Charged;
        }
        catch (Exception ex)
        {
            // Without the event order-service never hears about the payment, so a
            // charged-but-unconfirmed order would be stuck. Undo it; the customer
            // can simply press "Pay now" again.
            logger.LogError(ex, "Failed to publish the outcome of payment {PaymentId}; undoing the charge", payment.Id);
            await db.Transactions
                .Where(t => t.Id == payment.Id)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(t => t.Status, PaymentStatus.Pending)
                    .SetProperty(t => t.ProviderRef, (string?)null)
                    .SetProperty(t => t.UpdatedAt, Clock.Now()));
            return ChargeResult.EventBusUnavailable;
        }
    }
}
