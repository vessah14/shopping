using EspaceShoppingPlus.Api.Interfaces;
using Npgsql;

namespace EspaceShoppingPlus.Api.Services;

public sealed class FapshiPayoutOrchestrator(
    IStoreService storeService,
    IFapshiPayoutService payoutService,
    ILogger<FapshiPayoutOrchestrator> logger)
{
    public async Task SubmitQueuedPayoutAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var payout = await storeService.TryStartOwnerPayoutAsync(orderId, cancellationToken);
        if (payout is null)
        {
            return;
        }

        await SubmitClaimedPayoutAsync(payout, cancellationToken);
    }

    public async Task SubmitClaimedPayoutAsync(OwnerPayout payout, CancellationToken cancellationToken)
    {
        try
        {
            var submission = await payoutService.SubmitPayoutAsync(payout, cancellationToken);
            var updated = await storeService.CompleteOwnerPayoutSubmissionAsync(
                payout.OrderId,
                "submitted",
                submission.TransId,
                null,
                cancellationToken);
            if (!updated)
            {
                logger.LogError(
                    "Fapshi accepted payout for order {OrderId}, but its transaction ID was not recorded.",
                    payout.OrderId);
            }
        }
        catch (FapshiPayoutException error)
        {
            await MarkForManualReviewAsync(payout, error.Message, error, cancellationToken);
        }
        catch (HttpRequestException error)
        {
            await MarkForManualReviewAsync(
                payout,
                "Réponse réseau incertaine; vérifier dans Fapshi avant toute nouvelle tentative.",
                error,
                cancellationToken);
        }
        catch (TaskCanceledException error) when (!cancellationToken.IsCancellationRequested)
        {
            await MarkForManualReviewAsync(
                payout,
                "Délai dépassé; vérifier dans Fapshi avant toute nouvelle tentative.",
                error,
                cancellationToken);
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to update the payout ledger for order {OrderId}.", payout.OrderId);
            throw;
        }
    }

    private async Task MarkForManualReviewAsync(
        OwnerPayout payout,
        string details,
        Exception error,
        CancellationToken cancellationToken)
    {
        logger.LogWarning(error, "Fapshi payout for order {OrderId} requires manual reconciliation.", payout.OrderId);
        var updated = await storeService.CompleteOwnerPayoutSubmissionAsync(
            payout.OrderId,
            "manual_review",
            null,
            details,
            cancellationToken);
        if (!updated)
        {
            logger.LogError(
                "Unable to mark Fapshi payout for order {OrderId} for manual review.",
                payout.OrderId);
        }
    }
}
