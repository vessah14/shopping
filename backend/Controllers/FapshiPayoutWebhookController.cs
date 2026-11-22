using System.Text.Json;
using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EspaceShoppingPlus.Api.Controllers;

[ApiController]
[Route("api/webhooks/fapshi/payout")]
public sealed class FapshiPayoutWebhookController(
    IStoreService storeService,
    IFapshiPayoutService payoutService,
    ILogger<FapshiPayoutWebhookController> logger) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(64 * 1024)]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        if (!payoutService.IsValidWebhookSecret(Request.Headers["x-wh-secret"].ToString()))
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

        FapshiPayoutVerification verification;
        try
        {
            verification = await payoutService.VerifyPayoutAsync(transId!, cancellationToken);
        }
        catch (FapshiPayoutException error)
        {
            logger.LogWarning(error, "Unable to verify Fapshi payout webhook transaction.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException error)
        {
            logger.LogWarning(error, "Fapshi payout verification service is unavailable.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        catch (TaskCanceledException error) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(error, "Fapshi payout verification request timed out.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        if (!string.Equals(verification.TransactionType, "Payout", StringComparison.OrdinalIgnoreCase) ||
            !Guid.TryParseExact(verification.ExternalId, "D", out var orderId))
        {
            return Ok();
        }

        var payoutStatus = verification.Status switch
        {
            "SUCCESSFUL" => "successful",
            "FAILED" or "EXPIRED" => "failed",
            _ => null,
        };
        if (payoutStatus is null)
        {
            return Ok();
        }

        try
        {
            var updated = await storeService.UpdateOwnerPayoutStatusAsync(
                orderId,
                verification.TransId,
                verification.Amount,
                payoutStatus,
                cancellationToken);
            if (!updated)
            {
                logger.LogWarning(
                    "Fapshi payout {TransactionId} did not match owner payout for order {OrderId}.",
                    verification.TransId,
                    orderId);
            }

            return Ok();
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to update payout status for order {OrderId}.", orderId);
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }
}
