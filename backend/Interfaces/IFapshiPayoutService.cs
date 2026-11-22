namespace EspaceShoppingPlus.Api.Interfaces;

public interface IFapshiPayoutService
{
    bool IsConfigured { get; }

    bool IsValidWebhookSecret(string? secret);

    Task<FapshiPayoutSubmission> SubmitPayoutAsync(
        OwnerPayout payout,
        CancellationToken cancellationToken);

    Task<FapshiPayoutVerification> VerifyPayoutAsync(
        string transId,
        CancellationToken cancellationToken);
}

public sealed record FapshiPayoutSubmission(string TransId);

public sealed record FapshiPayoutVerification(
    string TransId,
    string Status,
    string? ExternalId,
    int Amount,
    string? TransactionType);
