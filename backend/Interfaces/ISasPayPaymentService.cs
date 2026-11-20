namespace EspaceShoppingPlus.Api.Interfaces;

public interface ISasPayPaymentService
{
    bool IsConfigured { get; }

    Task<SasPayCheckoutSession> CreateCheckoutSessionAsync(
        Guid orderId,
        int amountCfa,
        string customerEmail,
        string customerName,
        string customerPhone,
        string accessToken,
        CancellationToken cancellationToken);

    Task<SasPayPaymentVerification> VerifyPaymentAsync(
        string paymentId,
        CancellationToken cancellationToken);

    bool IsValidWebhookSignature(string rawBody, string? signature, string? timestamp);
}

public sealed record SasPayCheckoutSession(string Id, string CheckoutUrl);

public sealed record SasPayPaymentVerification(
    string Id,
    string Status,
    string Description,
    string Currency,
    decimal RequestedAmount);
