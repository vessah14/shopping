using System.Text.Json;
using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EspaceShoppingPlus.Api.Controllers;

[ApiController]
[Route("api/webhooks/fapshi")]
public sealed class FapshiWebhookController(
    IStoreService storeService,
    IFapshiPaymentService fapshiPaymentService,
    IFapshiPayoutService fapshiPayoutService,
    FapshiPayoutOrchestrator payoutOrchestrator,
    IOptions<FapshiOptions> fapshiOptions,
    ILogger<FapshiWebhookController> logger) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(64 * 1024)]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        if (!fapshiPaymentService.IsValidWebhookSecret(Request.Headers["x-wh-secret"].ToString()))
        {
            return Unauthorized();
        }

        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync(cancellationToken);
        string? transId;
        try
        {
            using var payload = JsonDocument.Parse(rawBody);
            var root = payload.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("transId", out var idProperty) ||
                idProperty.ValueKind != JsonValueKind.String)
            {
                return BadRequest();
            }

            transId = idProperty.GetString();
        }
        catch (JsonException)
        {
            return BadRequest();
        }

        // The webhook body is only a hint: the status, amount and order always come from the Fapshi API.
        FapshiPaymentVerification verification;
        try
        {
            verification = await fapshiPaymentService.VerifyPaymentAsync(transId!, cancellationToken);
        }
        catch (FapshiException error)
        {
            logger.LogWarning(error, "Unable to verify Fapshi webhook transaction.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException error)
        {
            logger.LogWarning(error, "Fapshi verification service is unavailable.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        catch (TaskCanceledException error) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(error, "Fapshi verification request timed out.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        if (!Guid.TryParseExact(verification.ExternalId, "D", out var orderId))
        {
            return Ok();
        }

        var paymentStatus = verification.Status switch
        {
            "SUCCESSFUL" => "confirmed",
            "FAILED" or "EXPIRED" => "failed",
            _ => null,
        };
        if (paymentStatus is null)
        {
            return Ok();
        }

        try
        {
            var payoutOptions = fapshiOptions.Value.Payout;
            var ownerPayout = paymentStatus == "confirmed"
                ? new OwnerPayoutReservation(
                    verification.Revenue,
                    payoutOptions.PhoneNumber,
                    payoutOptions.BaseUrl,
                    payoutOptions.Enabled,
                    fapshiPayoutService.IsConfigured)
                : null;
            var updateResult = await storeService.UpdateFapshiPaymentStatusAsync(
                orderId,
                verification.TransId,
                paymentStatus,
                verification.Amount,
                ownerPayout,
                cancellationToken);
            if (updateResult == FapshiPaymentUpdateResult.Rejected)
            {
                logger.LogWarning(
                    "Fapshi transaction {TransactionId} did not match pending order {OrderId}.",
                    verification.TransId,
                    orderId);
            }
            else if (updateResult == FapshiPaymentUpdateResult.Updated &&
                paymentStatus == "confirmed" &&
                payoutOptions.Enabled)
            {
                await payoutOrchestrator.SubmitQueuedPayoutAsync(orderId, cancellationToken);
            }

            return Ok();
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to update payment status for order {OrderId}.", orderId);
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }
}
