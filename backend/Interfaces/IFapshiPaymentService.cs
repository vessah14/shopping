namespace EspaceShoppingPlus.Api.Interfaces;

public interface IFapshiPaymentService
{
    bool IsConfigured { get; }

    Task<FapshiCheckoutSession> CreateCheckoutSessionAsync(
        Guid orderId,
        int amountCfa,
        string customerEmail,
        string accessToken,
        CancellationToken cancellationToken);

    Task<FapshiPaymentVerification> VerifyPaymentAsync(
        string transId,
        CancellationToken cancellationToken);

    bool IsValidWebhookSecret(string? secret);
}

public sealed record FapshiCheckoutSession(string TransId, string CheckoutUrl);

public sealed record FapshiPaymentVerification(
    string TransId,
    string Status,
    string? ExternalId,
    int Amount,
    int? Revenue);
